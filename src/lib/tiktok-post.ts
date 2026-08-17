/**
 * De rekenkant van TikTok-publicaties, bewust los van het netwerk.
 *
 * Waarom dit bestand bestaat: de vorige aanpak (PULL_FROM_URL) liet TikTok de
 * video zelf ophalen van onze ondertekende Supabase-URL. TikTok eist echter dat
 * het bronDOMEIN vooraf geverifieerd is in het developer-portaal — en
 * `*.supabase.co` is niet ons domein, dus dat kan nooit. Vandaar FILE_UPLOAD:
 * wij sturen de bytes zelf, in stukken, naar een upload-URL van TikTok.
 *
 * Het stukjes-rekenwerk en de request-opbouw staan hier als pure functies,
 * zodat het foutgevoeligste deel van het publiceerpad echt getest kan worden —
 * zonder netwerk, zonder Supabase.
 */

export const MB = 1024 * 1024;

/** TikTok's grenzen voor chunk-uploads. */
export const MIN_CHUNK = 5 * MB;
export const MAX_CHUNK = 64 * MB;
export const MAX_VIDEO_BYTES = 4 * 1024 * MB; // 4 GB

export interface ChunkRange {
  /** Byte-offset van het eerste byte (inclusief). */
  start: number;
  /** Byte-offset van het laatste byte (inclusief), zoals Content-Range het wil. */
  end: number;
}

export interface ChunkPlan {
  chunkSize: number;
  totalChunkCount: number;
  ranges: ChunkRange[];
}

/**
 * Verdeel een video in chunks volgens TikTok's regels:
 *
 *  - kleiner dan 5 MB → één chunk met het hele bestand (de enige situatie
 *    waarin een chunk onder de 5 MB mag zijn);
 *  - tot 64 MB → één chunk; scheelt requests en is binnen de grenzen;
 *  - daarboven → chunks van 64 MB, waarbij de rest bij de láátste chunk wordt
 *    gevoegd (die mag tot 128 MB zijn). `total_chunk_count` is dus het aantal
 *    hele chunks, niet naar boven afgerond — precies waar implementaties de
 *    mist in gaan.
 */
export function chunkPlan(videoSize: number): ChunkPlan {
  if (!Number.isInteger(videoSize) || videoSize <= 0) {
    throw new Error("Videogrootte moet een positief aantal bytes zijn");
  }
  if (videoSize > MAX_VIDEO_BYTES) {
    throw new Error("Video is groter dan 4 GB — dat accepteert TikTok niet");
  }

  if (videoSize <= MAX_CHUNK) {
    return {
      chunkSize: videoSize,
      totalChunkCount: 1,
      ranges: [{ start: 0, end: videoSize - 1 }],
    };
  }

  const chunkSize = MAX_CHUNK;
  const totalChunkCount = Math.floor(videoSize / chunkSize);
  const ranges: ChunkRange[] = [];
  for (let i = 0; i < totalChunkCount; i++) {
    const start = i * chunkSize;
    // De laatste chunk krijgt de rest erbij.
    const end = i === totalChunkCount - 1 ? videoSize - 1 : start + chunkSize - 1;
    ranges.push({ start, end });
  }
  return { chunkSize, totalChunkCount, ranges };
}

/** Content-Range-header voor één chunk. */
export function contentRange(range: ChunkRange, totalSize: number): string {
  return `bytes ${range.start}-${range.end}/${totalSize}`;
}

/**
 * Kies het privacy-niveau uit wat het account daadwerkelijk toestaat
 * (uit /creator_info/query/). Wij publiceren namens merken, dus openbaar of
 * niets: stilletjes terugvallen op "alleen volgers" zou betekenen dat een
 * klantpost onzichtbaar live gaat — erger dan een nette fout.
 */
export function pickPrivacyLevel(options: string[]): string {
  if (options.includes("PUBLIC_TO_EVERYONE")) return "PUBLIC_TO_EVERYONE";
  if (options.includes("SELF_ONLY") && options.length === 1) {
    throw new Error(
      "TikTok staat voor deze app alleen privé-posts toe (app nog niet geauditeerd) — de video gaat als concept naar de inbox",
    );
  }
  throw new Error(
    "Dit TikTok-account staat geen openbare posts toe — zet het account op openbaar en probeer opnieuw",
  );
}

export interface TikTokInitOptions {
  caption: string;
  privacyLevel: string;
  videoSize: number;
  /** Betaalde samenwerking → TikTok's eigen 'Paid partnership'-label. */
  isAd?: boolean;
  /** AI-gegenereerde content → TikTok's AI-label. */
  isAigc?: boolean;
  /** Interactie-instellingen; TikTok dwingt strengere accountinstellingen alsnog af. */
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
}

/** Request-body voor /v2/post/publish/video/init/ (direct posten). */
export function buildDirectInitBody(opts: TikTokInitOptions): Record<string, unknown> {
  const plan = chunkPlan(opts.videoSize);
  return {
    post_info: {
      title: opts.caption.slice(0, 2200),
      privacy_level: opts.privacyLevel,
      ...(opts.isAd ? { brand_content_toggle: true } : {}),
      ...(opts.isAigc ? { is_aigc: true } : {}),
      ...(opts.disableComment ? { disable_comment: true } : {}),
      ...(opts.disableDuet ? { disable_duet: true } : {}),
      ...(opts.disableStitch ? { disable_stitch: true } : {}),
    },
    source_info: {
      source: "FILE_UPLOAD",
      video_size: opts.videoSize,
      chunk_size: plan.chunkSize,
      total_chunk_count: plan.totalChunkCount,
    },
  };
}

/** Request-body voor /v2/post/publish/inbox/video/init/ (concept naar de inbox). */
export function buildInboxInitBody(videoSize: number): Record<string, unknown> {
  const plan = chunkPlan(videoSize);
  return {
    source_info: {
      source: "FILE_UPLOAD",
      video_size: videoSize,
      chunk_size: plan.chunkSize,
      total_chunk_count: plan.totalChunkCount,
    },
  };
}
