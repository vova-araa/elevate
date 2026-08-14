/**
 * Hoe lang gaat een social-koppeling écht mee?
 *
 * De vervaldatum van het access-token is daarvoor geen maat, en dat is de bron
 * van "koppeling verloopt over 1 dag" terwijl er niets aan de hand is:
 *
 *   TikTok  access 24 uur, refresh 365 dagen — en elke verversing levert weer
 *           een refresh-token van 365 dagen op. Blijf je verversen, dan
 *           verloopt de koppeling nooit.
 *   Google  access 1 uur, refresh zonder vervaldatum.
 *   Meta    long-lived user token 60 dagen, maar het page-token dat daaruit
 *           komt heeft géén vervaldatum — en dáármee publiceren wij.
 *
 * Deze twee functies bepalen wat we tonen en wanneer we ingrijpen.
 */

export interface TokenState {
  /** Het token waarmee we werken heeft geen vervaldatum (Meta page-token). */
  neverExpires: boolean;
  /** Hebben we een refresh-token om mee te vernieuwen? */
  hasRefreshToken: boolean;
  tokenExpiresAt: string | null;
  refreshExpiresAt: string | null;
}

/**
 * De datum waarop een mens opnieuw moet koppelen, of `null` als de koppeling
 * zichzelf onbeperkt in leven houdt.
 */
export function reconnectDeadline(state: TokenState): string | null {
  if (state.neverExpires) return null;
  // Met een refresh-token telt alleen wanneer dát verloopt; het access-token
  // wordt onderweg automatisch vernieuwd.
  if (state.hasRefreshToken) return state.refreshExpiresAt;
  return state.tokenExpiresAt;
}

/**
 * Kort voor het verlopen verversen, niet dagen ervoor. Bij TikTok (24 uur)
 * betekent een ruime marge dat élke tick een verversing afvuurt en het
 * refresh-token onnodig roteert — dat is geen bewaking maar slijtage.
 */
export const REFRESH_LEAD_MS = 2 * 3600 * 1000;

export function shouldRefreshNow(tokenExpiresAt: string | null, now: Date = new Date()): boolean {
  if (!tokenExpiresAt) return false;
  const expires = new Date(tokenExpiresAt).getTime();
  if (Number.isNaN(expires)) return false;
  return expires - now.getTime() < REFRESH_LEAD_MS;
}
