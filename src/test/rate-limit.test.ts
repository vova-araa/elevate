// @vitest-environment node
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { allowRequest, resetRateLimits } from "@/lib/rate-limit.server";

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
