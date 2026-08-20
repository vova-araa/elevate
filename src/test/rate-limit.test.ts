// @vitest-environment node
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { allowRequest, resetRateLimits, requestIp } from "@/lib/rate-limit.server";

describe("allowRequest", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("laat door tot de limiet en weigert daarna", () => {
    for (let i = 0; i < 5; i++) expect(allowRequest("a", 5, 60_000)).toBe(true);
    expect(allowRequest("a", 5, 60_000)).toBe(false);
  });

  it("houdt sleutels gescheiden — één drukke afzender raakt de rest niet", () => {
    for (let i = 0; i < 5; i++) allowRequest("druk", 5, 60_000);
    expect(allowRequest("druk", 5, 60_000)).toBe(false);
    expect(allowRequest("rustig", 5, 60_000)).toBe(true);
  });

  it("begint opnieuw zodra het venster voorbij is", () => {
    for (let i = 0; i < 5; i++) allowRequest("a", 5, 60_000);
    expect(allowRequest("a", 5, 60_000)).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(allowRequest("a", 5, 60_000)).toBe(true);
  });

  it("blijft weigeren binnen het venster, ook na veel pogingen", () => {
    // De teller loopt door bij geweigerde aanvragen; blijven hameren verlengt
    // de blokkade dus feitelijk tot het venster afloopt.
    for (let i = 0; i < 50; i++) allowRequest("a", 5, 60_000);
    vi.advanceTimersByTime(30_000);
    expect(allowRequest("a", 5, 60_000)).toBe(false);
  });
});

describe("requestIp", () => {
  /**
   * x-forwarded-for is een keten waar elke proxy achteraan aanplakt. De eerste
   * waarde komt van de client en is dus vrij invulbaar: wie daar per aanvraag
   * een ander IP zette, kreeg elke keer een verse emmer en liep de limiet
   * volledig voorbij.
   */
  const req = (headers: Record<string, string>) =>
    new Request("https://example.test/", { headers });

  it("neemt de laatste hop, niet de door de client opgegeven eerste", () => {
    const ip = requestIp(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }));
    expect(ip).toBe("203.0.113.9");
  });

  it("geeft bij één hop gewoon die waarde", () => {
    expect(requestIp(req({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("laat een aanvaller met wisselende voorste waarden dezelfde emmer houden", () => {
    const a = requestIp(req({ "x-forwarded-for": "9.9.9.9, 203.0.113.9" }));
    const b = requestIp(req({ "x-forwarded-for": "8.8.8.8, 203.0.113.9" }));
    expect(a).toBe(b);
  });

  it("valt terug op x-real-ip en anders op 'onbekend'", () => {
    expect(requestIp(req({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(requestIp(req({}))).toBe("onbekend");
  });

  it("verdraagt spaties en lege segmenten", () => {
    expect(requestIp(req({ "x-forwarded-for": " 1.1.1.1 ,  203.0.113.9 , " }))).toBe("203.0.113.9");
  });
});
