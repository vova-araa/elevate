import { describe, it, expect } from "vitest";
import { extractPlatformBreakdown, extractPostDetails, reportStatusLabel } from "@/lib/report-data";

/**
 * `metrics` komt uit een jsonb-kolom en kan van oudere rapporten zijn, met
 * ontbrekende of verkeerd getypeerde velden. Deze helpers moeten daar altijd
 * defensief mee omgaan — een rapport openen mag nooit crashen op oude data.
 */

describe("extractPlatformBreakdown", () => {
  it("geeft een lege lijst bij ontbrekende of onbruikbare data", () => {
    expect(extractPlatformBreakdown(null)).toEqual([]);
    expect(extractPlatformBreakdown(undefined)).toEqual([]);
    expect(extractPlatformBreakdown("tekst")).toEqual([]);
    expect(extractPlatformBreakdown([])).toEqual([]);
    expect(extractPlatformBreakdown({})).toEqual([]);
    expect(extractPlatformBreakdown({ per_platform: "geen array" })).toEqual([]);
  });

  it("vult ontbrekende getallen met 0 en onbekend platform met een label", () => {
    const rows = extractPlatformBreakdown({ per_platform: [{}] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ platform: "onbekend", total: 0, published: 0, failed: 0 });
  });

  it("negeert items die geen object zijn", () => {
    const rows = extractPlatformBreakdown({
      per_platform: ["fout", 42, null, { platform: "instagram", total: 3 }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].platform).toBe("instagram");
    expect(rows[0].total).toBe(3);
  });

  it("neemt geldige waarden ongewijzigd over", () => {
    const rows = extractPlatformBreakdown({
      per_platform: [{ platform: "tiktok", label: "TikTok", total: 5, published: 4, failed: 1 }],
    });
    expect(rows[0]).toEqual({
      platform: "tiktok",
      label: "TikTok",
      total: 5,
      published: 4,
      failed: 1,
      scheduled: undefined,
      draft: undefined,
    });
  });
});

describe("extractPostDetails", () => {
  it("laat rijen zonder scheduled_at weg — die zijn onbruikbaar in een rapport", () => {
    const rows = extractPostDetails({
      posts_detail: [
        { platform: "instagram", status: "published" },
        { platform: "instagram", status: "published", scheduled_at: "2026-01-01T10:00:00Z" },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].scheduled_at).toBe("2026-01-01T10:00:00Z");
  });

  it("geeft een lege lijst bij oude rapporten zonder posts_detail", () => {
    expect(extractPostDetails({ reach: 1000 })).toEqual([]);
  });
});

describe("reportStatusLabel", () => {
  it("vertaalt bekende statussen naar het Nederlands", () => {
    expect(reportStatusLabel("published")).toBe("Gepubliceerd");
    expect(reportStatusLabel("failed")).toBe("Mislukt");
    expect(reportStatusLabel("draft")).toBe("Concept");
  });

  it("geeft een onbekende status ongewijzigd terug in plaats van leeg", () => {
    expect(reportStatusLabel("iets_nieuws")).toBe("iets_nieuws");
  });
});
