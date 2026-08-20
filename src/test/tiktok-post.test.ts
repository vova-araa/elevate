import { describe, it, expect } from "vitest";
import {
  MB,
  MAX_CHUNK,
  interpretTikTokStatus,
  buildDirectInitBody,
  buildInboxInitBody,
  chunkPlan,
  contentRange,
  pickPrivacyLevel,
} from "@/lib/tiktok-post";

/**
 * Dit is het rekenwerk van het publiceerpad — het deel waar een fout niet een
 * lelijke pagina oplevert maar een klantpost die niet (of half) live gaat.
 */

describe("chunkPlan", () => {
  it("stuurt een klein bestand als één chunk (de enige onder-5MB-uitzondering)", () => {
    const plan = chunkPlan(3 * MB);
    expect(plan).toEqual({
      chunkSize: 3 * MB,
      totalChunkCount: 1,
      ranges: [{ start: 0, end: 3 * MB - 1 }],
    });
  });

  it("houdt alles tot 64MB in één chunk — scheelt requests, blijft binnen de grenzen", () => {
    const plan = chunkPlan(50 * MB);
    expect(plan.totalChunkCount).toBe(1);
    expect(plan.ranges[0]).toEqual({ start: 0, end: 50 * MB - 1 });
  });

  it("voegt de rest bij de laatste chunk in plaats van een extra chunk te maken", () => {
    // 130 MB = 2 hele chunks van 64 + 2 MB rest. TikTok wil dan géén derde
    // chunk: total_chunk_count wordt naar benéden afgerond en de rest gaat bij
    // de laatste chunk. Naar boven afronden is precies de klassieke fout.
    const size = 130 * MB;
    const plan = chunkPlan(size);
    expect(plan.totalChunkCount).toBe(2);
    expect(plan.ranges).toEqual([
      { start: 0, end: MAX_CHUNK - 1 },
      { start: MAX_CHUNK, end: size - 1 },
    ]);
    // De laatste chunk (64+2=66MB) blijft onder het 128MB-maximum.
    expect(plan.ranges[1].end - plan.ranges[1].start + 1).toBeLessThanOrEqual(128 * MB);
  });

  it("dekt samen exact het hele bestand, zonder gat of overlap", () => {
    for (const size of [1, 5 * MB, 64 * MB, 64 * MB + 1, 200 * MB, 1024 * MB]) {
      const plan = chunkPlan(size);
      let expectedStart = 0;
      for (const r of plan.ranges) {
        expect(r.start).toBe(expectedStart);
        expectedStart = r.end + 1;
      }
      expect(expectedStart).toBe(size);
    }
  });

  it("weigert onzin en te grote bestanden", () => {
    expect(() => chunkPlan(0)).toThrow();
    expect(() => chunkPlan(-5)).toThrow();
    expect(() => chunkPlan(2.5)).toThrow();
    expect(() => chunkPlan(5 * 1024 * MB)).toThrow(/4 GB/);
  });
});

describe("contentRange", () => {
  it("schrijft de header zoals TikTok hem wil: inclusieve bytes en totaal", () => {
    expect(contentRange({ start: 0, end: 999 }, 5000)).toBe("bytes 0-999/5000");
  });
});

describe("pickPrivacyLevel", () => {
  it("kiest openbaar wanneer dat kan", () => {
    expect(pickPrivacyLevel(["SELF_ONLY", "PUBLIC_TO_EVERYONE"])).toBe("PUBLIC_TO_EVERYONE");
  });

  it("faalt hardop in plaats van stilletjes privé te publiceren", () => {
    // Een klantpost die als 'alleen ik' live gaat lijkt gepubliceerd maar is
    // onzichtbaar — dat moet een fout zijn, geen stille terugval.
    expect(() => pickPrivacyLevel(["SELF_ONLY"])).toThrow(/geauditeerd/);
    expect(() => pickPrivacyLevel(["FOLLOWER_OF_CREATOR", "SELF_ONLY"])).toThrow(/openbaar/);
    expect(() => pickPrivacyLevel([])).toThrow();
  });
});

describe("buildDirectInitBody", () => {
  it("bouwt de volledige body met FILE_UPLOAD en chunkgegevens", () => {
    const body = buildDirectInitBody({
      caption: "Nieuwe collectie",
      privacyLevel: "PUBLIC_TO_EVERYONE",
      videoSize: 10 * MB,
    });
    expect(body).toEqual({
      post_info: { title: "Nieuwe collectie", privacy_level: "PUBLIC_TO_EVERYONE" },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: 10 * MB,
        chunk_size: 10 * MB,
        total_chunk_count: 1,
      },
    });
  });

  it("stuurt het reclamelabel alleen mee als de post er een is", () => {
    const ad = buildDirectInitBody({
      caption: "x",
      privacyLevel: "PUBLIC_TO_EVERYONE",
      videoSize: MB,
      isAd: true,
    });
    expect((ad.post_info as Record<string, unknown>).brand_content_toggle).toBe(true);
    const organic = buildDirectInitBody({
      caption: "x",
      privacyLevel: "PUBLIC_TO_EVERYONE",
      videoSize: MB,
    });
    expect("brand_content_toggle" in (organic.post_info as object)).toBe(false);
  });

  it("kapt de caption af op TikToks limiet van 2200 tekens", () => {
    const body = buildDirectInitBody({
      caption: "a".repeat(3000),
      privacyLevel: "PUBLIC_TO_EVERYONE",
      videoSize: MB,
    });
    expect(((body.post_info as Record<string, unknown>).title as string).length).toBe(2200);
  });
});

describe("buildInboxInitBody", () => {
  it("bevat géén post_info — de klant maakt de post af in de app", () => {
    const body = buildInboxInitBody(8 * MB);
    expect("post_info" in body).toBe(false);
    expect((body.source_info as Record<string, unknown>).source).toBe("FILE_UPLOAD");
  });
});

describe("interpretTikTokStatus", () => {
  it("ziet zowel een geplaatste video als een inbox-concept als eindstation", () => {
    expect(interpretTikTokStatus("PUBLISH_COMPLETE")).toBe("klaar");
    // Vóór de audit is de inbox de bedoelde uitkomst — geen fout.
    expect(interpretTikTokStatus("SEND_TO_USER_INBOX")).toBe("klaar");
  });

  it("meldt een afkeuring als mislukt", () => {
    expect(interpretTikTokStatus("FAILED")).toBe("mislukt");
  });

  it("wacht rustig af bij tussen- en onbekende statussen", () => {
    expect(interpretTikTokStatus("PROCESSING_UPLOAD")).toBe("bezig");
    expect(interpretTikTokStatus("PROCESSING_DOWNLOAD")).toBe("bezig");
    // Nieuwe statuswaarde van TikTok mag geen fout worden — later opnieuw kijken.
    expect(interpretTikTokStatus("IETS_NIEUWS")).toBe("bezig");
  });
});
