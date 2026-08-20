import { describe, it, expect } from "vitest";
import { mergeFeed, signablePaths } from "@/lib/feed-merge";

/**
 * Twee dingen die stil fout kunnen gaan in het feedraster: welke media we
 * signeren (een fout pad levert een werkende URL naar andermans bestanden op)
 * en de volgorde (een raster dat het toekomstige profiel niet toont is voor een
 * bureau nutteloos).
 */

const KLANT = "11111111-1111-1111-1111-111111111111";
const ANDERE = "22222222-2222-2222-2222-222222222222";

describe("signablePaths", () => {
  it("laat alleen paden binnen de map van deze klant door", () => {
    // media_path is door de klant te bewerken en de service-role negeert de
    // storage-policies — zonder deze filter is dat een lek, geen schoonheidsfout.
    const paths = signablePaths(
      [
        { media_path: `${KLANT}/reel.mp4`, media_purged_at: null },
        { media_path: `${ANDERE}/contract.pdf`, media_purged_at: null },
      ],
      KLANT,
    );
    expect(paths).toEqual([`${KLANT}/reel.mp4`]);
  });

  it("trapt niet in een pad dat alleen maar begint als het klant-id", () => {
    const paths = signablePaths(
      [{ media_path: `${KLANT}-backup/geheim.jpg`, media_purged_at: null }],
      KLANT,
    );
    expect(paths).toEqual([]);
  });

  it("slaat opgeruimde media over — die zouden een dode link geven", () => {
    const paths = signablePaths(
      [{ media_path: `${KLANT}/oud.jpg`, media_purged_at: "2026-07-01T00:00:00Z" }],
      KLANT,
    );
    expect(paths).toEqual([]);
  });

  it("verdraagt rijen zonder media", () => {
    expect(signablePaths([{ media_path: null }], KLANT)).toEqual([]);
    expect(signablePaths([], KLANT)).toEqual([]);
  });
});

describe("mergeFeed", () => {
  // Eén type voor beide soorten, net als in de echte feed: PublishedFeedItem
  // draagt de union, niet twee losse types.
  type Item = { id: string; kind: "gepland" | "gepubliceerd" };
  const gepland = (id: string): Item => ({ id, kind: "gepland" });
  const live = (id: string): Item => ({ id, kind: "gepubliceerd" });

  it("zet geplande posts vóór gepubliceerde", () => {
    // Zo verschijnen ze straks ook op het profiel: het nieuwste linksboven.
    const uit = mergeFeed([gepland("p1"), gepland("p2")], [live("g1")], 12);
    expect(uit.map((i) => i.id)).toEqual(["p1", "p2", "g1"]);
  });

  it("vult het raster ook als er nog niets gepubliceerd is", () => {
    // Precies de gemelde situatie: twee posts ingepland, raster toonde leegte.
    const uit = mergeFeed([gepland("p1"), gepland("p2")], [], 12);
    expect(uit).toHaveLength(2);
  });

  it("toont de bestaande feed onverkort als er niets gepland staat", () => {
    const uit = mergeFeed([], [live("g1"), live("g2")], 12);
    expect(uit.map((i) => i.id)).toEqual(["g1", "g2"]);
  });

  it("laat een volle planning de bestaande feed niet wegduwen", () => {
    // De limiet geldt per soort: anders zie je niet meer waar je op voortbouwt.
    const planning: Item[] = Array.from({ length: 20 }, (_, i) => gepland(`p${i}`));
    const bestaand: Item[] = Array.from({ length: 20 }, (_, i) => live(`g${i}`));
    const uit = mergeFeed(planning, bestaand, 6);
    expect(uit.filter((i) => i.kind === "gepland")).toHaveLength(6);
    expect(uit.filter((i) => i.kind === "gepubliceerd")).toHaveLength(6);
  });
});
