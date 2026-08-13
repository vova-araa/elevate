// @vitest-environment node
import { describe, it, expect } from "vitest";
import { assertSafeExternalUrl } from "@/lib/ssrf-guard.server";

/**
 * De SSRF-guard beschermt elke plek waar de server een door gebruikers
 * aangeleverde URL ophaalt (media-import, webhooks, automation-acties).
 *
 * Deze test legt de bypasses vast die eerder daadwerkelijk mis zijn gegaan —
 * met name de IPv4-mapped IPv6-notatie, die Node normaliseert naar hex
 * (::ffff:169.254.169.254 → ::ffff:a9fe:a9fe) waardoor een regex op de
 * puntnotatie hem doorliet.
 */

describe("assertSafeExternalUrl", () => {
  const blocked: Array<[string, string]> = [
    ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
    ["metadata via IPv4-mapped IPv6", "http://[::ffff:169.254.169.254]/"],
    ["loopback kort", "http://127.1/"],
    ["loopback decimaal", "http://2130706433/"],
    ["loopback hex", "http://0x7f000001/"],
    ["loopback octaal", "http://017700000001/"],
    ["loopback IPv6", "https://[::1]/"],
    ["localhost met punt", "http://localhost./"],
    ["privé 10.x", "http://10.0.0.5/"],
    ["privé 192.168.x", "http://192.168.1.1/"],
    ["privé 172.16.x", "http://172.16.0.1/"],
    ["interne hostname", "https://intern.local/"],
  ];

  it.each(blocked)("blokkeert %s", async (_label, url) => {
    await expect(assertSafeExternalUrl(url, { allowHttp: true })).rejects.toThrow();
  });

  it("staat een gewone publieke https-URL toe", async () => {
    const u = await assertSafeExternalUrl("https://example.com/video.mp4");
    expect(u.hostname).toBe("example.com");
  });

  it("weigert http wanneer alleen https is toegestaan", async () => {
    await expect(assertSafeExternalUrl("http://example.com/a.mp4")).rejects.toThrow(/https/i);
  });

  it("weigert een niet-http(s) protocol", async () => {
    await expect(
      assertSafeExternalUrl("file:///etc/passwd", { allowHttp: true }),
    ).rejects.toThrow();
  });

  it("weigert onzin die geen URL is", async () => {
    await expect(assertSafeExternalUrl("geen-url", { allowHttp: true })).rejects.toThrow(
      /ongeldige url/i,
    );
  });
});
