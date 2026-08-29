import { describe, it, expect } from "vitest";
import { applyFeedDrop, type FeedDragPayload } from "@/lib/feed-drag";
import type { FeedArrangementSlot } from "@/lib/feed-arrangement.functions";

/**
 * De herschikkingslogica van het feed-raster: een fout hier is stil (geen
 * crash) maar ondermijnt precies waar het raster voor dient — zien hoe de
 * feed er straks uitziet. Zelfde motivatie als feed-merge.test.ts.
 */

const slot = (id: string, uploadId = id): FeedArrangementSlot => ({
  id,
  position: 0,
  uploadId,
  mediaUrl: `https://example.com/${id}.jpg`,
  caption: null,
  isVideo: false,
});

describe("applyFeedDrop", () => {
  it("voegt een nieuwe upload in op de doelpositie", () => {
    const current = [slot("a"), slot("b")];
    const payload: FeedDragPayload = {
      kind: "upload",
      uploadId: "c",
      mediaUrl: "https://example.com/c.jpg",
      caption: "C",
      isVideo: false,
    };
    const next = applyFeedDrop(current, payload, 1);
    expect(next.map((s) => s.uploadId)).toEqual(["a", "c", "b"]);
  });

  it("voegt toe aan het eind als de doelpositie voorbij het raster ligt", () => {
    const current = [slot("a")];
    const payload: FeedDragPayload = {
      kind: "upload",
      uploadId: "b",
      mediaUrl: "https://example.com/b.jpg",
      caption: null,
      isVideo: false,
    };
    const next = applyFeedDrop(current, payload, 99);
    expect(next.map((s) => s.uploadId)).toEqual(["a", "b"]);
  });

  it("verplaatst i.p.v. dupliceert als dezelfde upload al in het raster staat", () => {
    // Zonder deze check zou dezelfde foto twee keer in de feed kunnen staan.
    const current = [slot("a"), slot("b"), slot("c")];
    const payload: FeedDragPayload = {
      kind: "upload",
      uploadId: "a",
      mediaUrl: "https://example.com/a.jpg",
      caption: null,
      isVideo: false,
    };
    const next = applyFeedDrop(current, payload, 2);
    expect(next.map((s) => s.uploadId)).toEqual(["b", "c", "a"]);
    expect(next.filter((s) => s.uploadId === "a")).toHaveLength(1);
  });

  it("herschikt een bestaand slot naar een latere positie", () => {
    const current = [slot("a"), slot("b"), slot("c")];
    const payload: FeedDragPayload = { kind: "slot", index: 0 };
    const next = applyFeedDrop(current, payload, 2);
    expect(next.map((s) => s.uploadId)).toEqual(["b", "c", "a"]);
  });

  it("herschikt een bestaand slot naar een eerdere positie", () => {
    const current = [slot("a"), slot("b"), slot("c")];
    const payload: FeedDragPayload = { kind: "slot", index: 2 };
    const next = applyFeedDrop(current, payload, 0);
    expect(next.map((s) => s.uploadId)).toEqual(["c", "a", "b"]);
  });

  it("doet niets als een slot op zijn eigen positie wordt losgelaten", () => {
    const current = [slot("a"), slot("b")];
    const payload: FeedDragPayload = { kind: "slot", index: 1 };
    const next = applyFeedDrop(current, payload, 1);
    expect(next).toBe(current);
  });

  it("verliest geen tegels bij een reeks herschikkingen", () => {
    let current = [slot("a"), slot("b"), slot("c"), slot("d")];
    current = applyFeedDrop(current, { kind: "slot", index: 3 }, 0);
    current = applyFeedDrop(current, { kind: "slot", index: 1 }, 3);
    current = applyFeedDrop(current, { kind: "slot", index: 0 }, 2);
    expect(current).toHaveLength(4);
    expect(new Set(current.map((s) => s.uploadId)).size).toBe(4);
  });
});
