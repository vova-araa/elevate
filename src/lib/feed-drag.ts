import type { FeedArrangementSlot } from "@/lib/feed-arrangement.functions";

/** Wat een sleepactie meedraagt — ofwel een tegel uit de bibliotheek, ofwel
    een tegel die al in het feed-raster staat (herschikken). Gedeeld tussen
    media.tsx (sleepbron) en feed-arrangement-panel.tsx (sleepdoel) zodat
    beide dezelfde payload-vorm gebruiken. */
export type FeedDragPayload =
  | { kind: "upload"; uploadId: string; mediaUrl: string; caption: string | null; isVideo: boolean }
  | { kind: "slot"; index: number };

/**
 * Pure herschikkingslogica, apart van de component zodat een fout hierin
 * (verkeerde volgorde, een tegel die verdwijnt) los te testen is — precies
 * het soort bug dat in de UI niet meteen opvalt maar het hele idee van "zie
 * hoe de feed eruit gaat zien" ondermijnt (zelfde motivatie als
 * feed-merge.ts).
 */
export function applyFeedDrop(
  current: FeedArrangementSlot[],
  payload: FeedDragPayload,
  targetIndex: number,
): FeedArrangementSlot[] {
  if (payload.kind === "upload") {
    // Dezelfde upload al ergens anders in het raster? Verplaatsen i.p.v.
    // dupliceren — anders staat dezelfde foto straks twee keer in de feed.
    const withoutDup = current.filter((s) => s.uploadId !== payload.uploadId);
    const insertAt = Math.min(targetIndex, withoutDup.length);
    const newSlot: FeedArrangementSlot = {
      id: `local-${payload.uploadId}`,
      position: insertAt,
      uploadId: payload.uploadId,
      mediaUrl: payload.mediaUrl,
      caption: payload.caption,
      isVideo: payload.isVideo,
    };
    const next = [...withoutDup];
    next.splice(insertAt, 0, newSlot);
    return next;
  }

  // Herschikken binnen het raster: het versleepte tegeltje komt op
  // `targetIndex` in het RESULTERENDE raster terecht (niet gecorrigeerd voor
  // de verschuiving die het verwijderen zelf veroorzaakt) — dat is de
  // eenvoudigste, voorspelbare uitkomst: valt de doelpositie na verwijderen
  // buiten bereik, dan komt de tegel gewoon aan het eind te staan.
  if (payload.index === targetIndex) return current;
  const next = [...current];
  const [moved] = next.splice(payload.index, 1);
  if (!moved) return current;
  next.splice(targetIndex, 0, moved);
  return next;
}

/** Media-tegel uit de bibliotheek zo maken dat hij naar het feed-raster
    gesleept kan worden. */
export function feedDragProps(upload: {
  id: string;
  url: string;
  fileName: string;
  isVideo: boolean;
}) {
  if (!upload.url) return {};
  const payload: FeedDragPayload = {
    kind: "upload",
    uploadId: upload.id,
    mediaUrl: upload.url,
    caption: upload.fileName,
    isVideo: upload.isVideo,
  };
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", JSON.stringify(payload));
      e.dataTransfer.effectAllowed = "copy";
    },
  };
}
