/**
 * De pure kant van het feedraster: welke media we mogen tonen, en in welke
 * volgorde gepland en gepubliceerd door elkaar staan.
 *
 * Apart van feed.functions.ts omdat dit precies het deel is waar een fout niet
 * zichtbaar is maar wel telt: een verkeerd pad levert een geldige URL naar
 * andermans media op, en een verkeerde volgorde maakt het raster onbruikbaar
 * als voorbeeld van het profiel.
 */

export interface FeedItemLike {
  kind: "gepubliceerd" | "gepland";
}

/**
 * Paden die we mogen signeren.
 *
 * `media_path` is door de klant te bewerken (de RLS-policy beperkt geen
 * kolommen) en de service-role negeert storage-policies. Zonder deze filter kan
 * een pad naar de map van een andere klant hier een werkende URL opleveren.
 * Opgeruimde media (`media_purged_at`) vallen ook af: het bestand bestaat niet
 * meer, signeren geeft dan een dode link.
 */
export function signablePaths(
  rows: { media_path: string | null; media_purged_at?: string | null }[],
  clientId: string,
): string[] {
  return rows
    .filter((r) => !!r.media_path && r.media_path.startsWith(`${clientId}/`) && !r.media_purged_at)
    .map((r) => r.media_path!);
}

/**
 * Geplande posts vóór gepubliceerde. Zo leest het raster als het profiel
 * straks: wat het eerst live gaat staat linksboven, precies waar het op
 * Instagram en TikTok ook belandt.
 *
 * De limiet geldt per soort, niet over het geheel — anders duwt een volle
 * planning de hele bestaande feed weg en zie je niet meer waar je op voortbouwt.
 */
export function mergeFeed<T extends FeedItemLike>(
  planned: T[],
  published: T[],
  limit: number,
): T[] {
  return [...planned.slice(0, limit), ...published.slice(0, limit)];
}
