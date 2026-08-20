import { describe, it, expect } from "vitest";
import { reconnectDeadline, shouldRefreshNow } from "@/lib/token-lifetime";

/**
 * De kern van "waarom staat er dat mijn koppeling over 1 dag verloopt": een
 * TikTok-access-token leeft 24 uur, maar de koppeling zelf een jaar — en langer
 * zolang we blijven verversen.
 */

const NOW = new Date("2026-08-14T12:00:00Z");
const iso = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
const HOUR = 3600_000;
const DAY = 24 * HOUR;

describe("reconnectDeadline", () => {
  it("geeft geen deadline voor een token dat niet verloopt (Meta page-token)", () => {
    expect(
      reconnectDeadline({
        neverExpires: true,
        hasRefreshToken: false,
        tokenExpiresAt: iso(60 * DAY),
        refreshExpiresAt: null,
      }),
    ).toBeNull();
  });

  it("negeert het 24-uurs access-token van TikTok en kijkt naar het refresh-token", () => {
    expect(
      reconnectDeadline({
        neverExpires: false,
        hasRefreshToken: true,
        tokenExpiresAt: iso(DAY),
        refreshExpiresAt: iso(365 * DAY),
      }),
    ).toBe(iso(365 * DAY));
  });

  it("geeft geen deadline als het refresh-token zelf niet verloopt (Google)", () => {
    expect(
      reconnectDeadline({
        neverExpires: false,
        hasRefreshToken: true,
        tokenExpiresAt: iso(HOUR),
        refreshExpiresAt: null,
      }),
    ).toBeNull();
  });

  it("valt terug op het access-token als er niets te verversen valt", () => {
    expect(
      reconnectDeadline({
        neverExpires: false,
        hasRefreshToken: false,
        tokenExpiresAt: iso(3 * DAY),
        refreshExpiresAt: null,
      }),
    ).toBe(iso(3 * DAY));
  });
});

describe("shouldRefreshNow", () => {
  it("ververst pas kort voor het verlopen, niet de hele dag door", () => {
    // Een TikTok-token van 24 uur mag niet elke tick opnieuw ververst worden;
    // dat rouleert het refresh-token stuk en trekt de rate limit vol.
    expect(shouldRefreshNow(iso(20 * HOUR), NOW)).toBe(false);
    expect(shouldRefreshNow(iso(3 * HOUR), NOW)).toBe(false);
    expect(shouldRefreshNow(iso(90 * 60_000), NOW)).toBe(true);
  });

  it("ververst een al verlopen token", () => {
    expect(shouldRefreshNow(iso(-HOUR), NOW)).toBe(true);
  });

  it("doet niets zonder of met een onleesbare vervaldatum", () => {
    expect(shouldRefreshNow(null, NOW)).toBe(false);
    expect(shouldRefreshNow("geen datum", NOW)).toBe(false);
  });
});
