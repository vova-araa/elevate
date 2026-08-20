import { describe, it, expect } from "vitest";
import { preflightPost, hasBlocker } from "@/lib/post-preflight";

/**
 * Het scenario dat dit moest voorkomen: een PNG op een TikTok-post, netjes
 * goedgekeurd en ingepland, die uren later stilletjes mislukt omdat TikTok
 * alleen video's aanneemt.
 */

const basis = {
  platform: "tiktok",
  hasMedia: true,
  mediaType: "video/mp4",
  caption: "Korte caption",
  connected: true,
  now: new Date("2026-08-20T10:00:00Z"),
};

describe("TikTok", () => {
  it("blokkeert een afbeelding — dat is de gemelde situatie", () => {
    const issues = preflightPost({ ...basis, mediaType: "image/png" });
    expect(hasBlocker(issues)).toBe(true);
    expect(issues[0].message).toMatch(/geen losse afbeelding/i);
    // De gebruiker moet weten wat hij eraan doet, niet alleen dát het fout is.
    expect(issues[0].fix).toBeTruthy();
  });

  it("blokkeert een post zonder media", () => {
    expect(hasBlocker(preflightPost({ ...basis, hasMedia: false }))).toBe(true);
  });

  it("laat een video gewoon door", () => {
    expect(preflightPost(basis)).toEqual([]);
  });

  it("waarschuwt bij een lange caption zonder te blokkeren", () => {
    const issues = preflightPost({ ...basis, caption: "a".repeat(200) });
    expect(hasBlocker(issues)).toBe(false);
    expect(issues[0].message).toMatch(/afgekapt/i);
  });
});

describe("Instagram", () => {
  it("vereist media", () => {
    const issues = preflightPost({
      ...basis,
      platform: "instagram",
      hasMedia: false,
      mediaType: null,
    });
    expect(hasBlocker(issues)).toBe(true);
  });

  it("accepteert zowel foto als video", () => {
    for (const type of ["image/jpeg", "video/mp4"]) {
      expect(preflightPost({ ...basis, platform: "instagram", mediaType: type })).toEqual([]);
    }
  });
});

describe("Facebook", () => {
  it("staat een tekstpost zonder media toe", () => {
    const issues = preflightPost({
      ...basis,
      platform: "facebook",
      hasMedia: false,
      mediaType: null,
    });
    expect(issues).toEqual([]);
  });

  it("waarschuwt dat video's nog niet als video geplaatst worden", () => {
    const issues = preflightPost({ ...basis, platform: "facebook", mediaType: "video/mp4" });
    expect(hasBlocker(issues)).toBe(false);
    expect(issues[0].message).toMatch(/nog niet als video/i);
  });
});

describe("Kanaal en moment", () => {
  it("blokkeert als het kanaal niet gekoppeld is", () => {
    const issues = preflightPost({ ...basis, connected: false });
    expect(hasBlocker(issues)).toBe(true);
    expect(issues[0].message).toMatch(/niet gekoppeld/i);
  });

  it("blokkeert een volledig lege post", () => {
    const issues = preflightPost({
      ...basis,
      platform: "facebook",
      hasMedia: false,
      mediaType: null,
      caption: "   ",
    });
    expect(hasBlocker(issues)).toBe(true);
  });

  it("waarschuwt bij een moment in het verleden — maar houdt niet tegen", () => {
    // Terugwerkend inplannen is legitiem: hij gaat dan bij de eerstvolgende
    // ronde mee. Alleen niet stilzwijgend.
    const issues = preflightPost({
      ...basis,
      scheduledAt: new Date("2026-08-19T10:00:00Z"),
    });
    expect(hasBlocker(issues)).toBe(false);
    expect(issues[0].message).toMatch(/verleden/i);
  });

  it("zegt niets over een moment in de toekomst", () => {
    expect(preflightPost({ ...basis, scheduledAt: new Date("2026-08-21T10:00:00Z") })).toEqual([]);
  });
});

describe("YouTube", () => {
  it("blokkeert, want publiceren wordt nog niet ondersteund", () => {
    const issues = preflightPost({ ...basis, platform: "youtube" });
    expect(hasBlocker(issues)).toBe(true);
    expect(issues[0].message).toMatch(/nog niet ondersteund/i);
  });
});
