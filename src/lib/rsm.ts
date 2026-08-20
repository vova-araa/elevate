/**
 * Reclamecode Social Media & Influencer Marketing (RSM).
 *
 * Voor Nederlandse merken en bureaus is dit geen "nice to have": zodra er een
 * betaalde relatie is tussen adverteerder en maker, moet de post herkenbaar zijn
 * als reclame. De praktische eisen die we hier controleren:
 *
 *  1. Er staat een duidelijke aanduiding in de tekst (#advertentie, #reclame,
 *     "betaald partnerschap", …). Vage termen als "#sponsored by" of
 *     "#samenwerking" gelden niet als duidelijke aanduiding.
 *  2. De aanduiding staat vooraan — vóór het "meer lezen"-knipje. Instagram
 *     knipt rond 125 tekens af, dus dat gebruiken we als grens.
 *  3. Bij video moet de aanduiding ook in beeld staan, aan het begin én aan het
 *     eind. Dat kunnen we niet uit de tekst afleiden, dus daar herinneren we
 *     alleen aan.
 *
 * De uitkomst is advies, geen slot: de aanduiding kan ook in de video zelf of in
 * het platformlabel ("Betaald partnerschap") staan, en dat kan deze code niet
 * zien. Daarom waarschuwen we, en blokkeren we niet.
 */

/** Hoeveel tekens Instagram/Facebook tonen vóór "meer lezen". */
export const VISIBLE_CAPTION_CHARS = 125;

/**
 * Aanduidingen die de Reclamecode Commissie als voldoende duidelijk beschouwt.
 * Bewust kort gehouden — hoe langer deze lijst, hoe groter de kans dat we iets
 * goedkeuren wat een klacht oplevert.
 */
const ACCEPTED_LABELS = [
  "#advertentie",
  "#reclame",
  "#ad",
  "#adv",
  "#betaaldepartnerschap",
  "#betaaldesamenwerking",
  "betaald partnerschap",
  "betaalde samenwerking",
  "in samenwerking met",
  "#gesponsord",
  "#sponsored",
  "#paidpartnership",
  "#promotie",
];

/**
 * Termen die makers vaak gebruiken maar die de RSM níet als duidelijke
 * aanduiding accepteert. Hierop wijzen we actief, want dit is de meest gemaakte
 * fout: men dénkt dat het goed staat.
 */
const WEAK_LABELS = ["#samenwerking", "#collab", "#partner", "#spon", "#sp", "#gifted", "#pr"];

export type RsmSeverity = "error" | "warning" | "info";

export interface RsmIssue {
  severity: RsmSeverity;
  message: string;
}

export interface RsmCheckInput {
  caption: string;
  /** Staat de post gemarkeerd als reclame/betaalde samenwerking? */
  isAd: boolean;
  /** Video's hebben een extra eis: aanduiding in beeld, begin én eind. */
  isVideo?: boolean;
}

/**
 * Zoekt een term met een woordgrens aan het eind. Zonder die grens zou "#ad"
 * ook in "#adidas" matchen en "#pr" in "#product" — precies de gevallen waarin
 * we een onterecht groen licht zouden geven.
 */
function indexOfTerm(haystack: string, term: string): number {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}(?![\\p{L}\\p{N}_])`, "iu").exec(haystack);
  return match ? match.index : -1;
}

/** Vindt de eerste geaccepteerde aanduiding en waar die staat. */
export function findRsmLabel(caption: string): { label: string; index: number } | null {
  let best: { label: string; index: number } | null = null;
  for (const label of ACCEPTED_LABELS) {
    const index = indexOfTerm(caption, label);
    if (index === -1) continue;
    if (!best || index < best.index) best = { label, index };
  }
  return best;
}

export function findWeakLabel(caption: string): string | null {
  for (const weak of WEAK_LABELS) {
    if (indexOfTerm(caption, weak) !== -1) return weak;
  }
  return null;
}

export function checkRsm({ caption, isAd, isVideo }: RsmCheckInput): RsmIssue[] {
  if (!isAd) return [];
  const issues: RsmIssue[] = [];
  const found = findRsmLabel(caption);

  if (!found) {
    issues.push({
      severity: "error",
      message:
        "Deze post is gemarkeerd als reclame, maar er staat geen duidelijke aanduiding in de tekst. Voeg bijvoorbeeld #advertentie toe.",
    });
  } else if (found.index >= VISIBLE_CAPTION_CHARS) {
    issues.push({
      severity: "error",
      message: `De aanduiding "${found.label}" staat pas na teken ${found.index + 1} en valt daarmee achter "meer lezen". Zet hem in de eerste ${VISIBLE_CAPTION_CHARS} tekens.`,
    });
  }

  const weak = findWeakLabel(caption);
  if (weak && !found) {
    issues.push({
      severity: "warning",
      message: `"${weak}" telt niet als duidelijke aanduiding volgens de RSM. Gebruik #advertentie, #reclame of "betaald partnerschap".`,
    });
  }

  if (isVideo) {
    issues.push({
      severity: "info",
      message:
        "Bij video moet de aanduiding ook zichtbaar in beeld staan — aan het begin én aan het eind van de video.",
    });
  }

  return issues;
}

/**
 * Zet de aanduiding vooraan in de caption. Bewust vóór de tekst en niet tussen
 * de hashtags onderaan, want daar valt hij buiten het zichtbare deel.
 */
export function prependRsmLabel(caption: string, label = "#advertentie"): string {
  if (findRsmLabel(caption)) return caption;
  return caption.trim() ? `${label} ${caption.trimStart()}` : label;
}
