// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * De hele TikTok-publicatieketen, met een nagebootst TikTok en nagebootste
 * database: verbinding ophalen → media-bytes halen → creator_info →
 * init (FILE_UPLOAD) → chunk-PUT. Dit is de volgorde die echt niet mag breken;
 * tot deze test bestond was er geen enkele test die het publiceerpad raakte.
 */

// De verbinding die "in de database" staat.
const CONN = {
  access_token: "tok_123",
  refresh_token: null,
  token_expires_at: null,
  account_id: "acc",
  meta: {},
  status: "active",
};

vi.mock("@/integrations/supabase/client.server", () => {
  const maybeSingle = () => Promise.resolve({ data: CONN });
  const chain = { select: () => chain, eq: () => chain, maybeSingle };
  return { supabaseAdmin: { from: () => chain } };
});

const VIDEO_BYTES = 1024 * 1024; // 1 MB testvideo

function fakeFetch(calls: { url: string; init?: RequestInit }[]) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("signed-media")) {
      return new Response(new Uint8Array(VIDEO_BYTES), { status: 200 });
    }
    if (url.includes("creator_info/query")) {
      return Response.json({
        data: { privacy_level_options: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"] },
        error: { code: "ok" },
      });
    }
    if (url.includes("/post/publish/video/init/")) {
      return Response.json({
        data: { publish_id: "pub_42", upload_url: "https://upload.tiktokapis.example/u1" },
        error: { code: "ok" },
      });
    }
    if (url.includes("upload.tiktokapis.example")) {
      return new Response(null, { status: 201 });
    }
    throw new Error(`Onverwachte fetch in test: ${url}`);
  });
}

describe("publishTikTok — volledige keten", () => {
  const calls: { url: string; init?: RequestInit }[] = [];

  beforeEach(() => {
    calls.length = 0;
    process.env.TIKTOK_SCOPES = "user.info.basic,video.upload,video.publish";
    vi.stubGlobal("fetch", fakeFetch(calls));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TIKTOK_SCOPES;
  });

  it("doorloopt creator_info → init → chunk-upload en geeft het publish_id terug", async () => {
    const { publishToPlatform } = await import("@/lib/social-publish.server");
    const result = await publishToPlatform("client-1", "tiktok", {
      caption: "Testpost",
      mediaUrl: "https://storage.example/signed-media.mp4",
      mediaType: "video/mp4",
      isAd: true,
    });

    expect(result.externalId).toBe("pub_42");

    // Volgorde: media ophalen → creator_info → init → PUT. Wie init vóór
    // creator_info doet, publiceert met een gegokt privacy-niveau.
    const order = calls.map((c) => c.url);
    expect(order.findIndex((u) => u.includes("creator_info"))).toBeLessThan(
      order.findIndex((u) => u.includes("/video/init/")),
    );

    // De init-body moet FILE_UPLOAD zijn (PULL_FROM_URL eist domeinverificatie
    // die op *.supabase.co onmogelijk is) met kloppende maten en het
    // reclamelabel.
    const init = calls.find((c) => c.url.includes("/video/init/"))!;
    const body = JSON.parse(String(init.init?.body));
    expect(body.source_info).toEqual({
      source: "FILE_UPLOAD",
      video_size: VIDEO_BYTES,
      chunk_size: VIDEO_BYTES,
      total_chunk_count: 1,
    });
    expect(body.post_info.privacy_level).toBe("PUBLIC_TO_EVERYONE");
    expect(body.post_info.brand_content_toggle).toBe(true);

    // De chunk-PUT draagt de juiste Content-Range over het hele bestand.
    const put = calls.find((c) => c.url.includes("upload.tiktokapis.example"))!;
    const headers = put.init?.headers as Record<string, string>;
    expect(put.init?.method).toBe("PUT");
    expect(headers["Content-Range"]).toBe(`bytes 0-${VIDEO_BYTES - 1}/${VIDEO_BYTES}`);
    expect(headers["Content-Type"]).toBe("video/mp4");
  });

  it("weigert een post zonder video met een uitlegbare fout", async () => {
    const { publishToPlatform } = await import("@/lib/social-publish.server");
    await expect(
      publishToPlatform("client-1", "tiktok", { caption: "alleen tekst" }),
    ).rejects.toThrow(/vereist een video/);
  });
});
