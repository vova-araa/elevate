/**
 * Publicatiefouten classificeren.
 *
 * Het verschil dat ertoe doet: bij een *tijdelijke* fout (rate limit, netwerk,
 * platform even uit de lucht) helpt opnieuw proberen. Bij een *blijvende* fout
 * (token ingetrokken, media geweigerd, account zonder rechten) is er een mens
 * nodig — dan is eindeloos herhalen zinloos en moet er meteen een melding uit.
 *
 * We classificeren op de tekst van de foutmelding, want de platform-API's
 * geven geen consistente foutcodes terug via onze publicatiepaden.
 */

export type ErrorKind = "transient" | "permanent";

const TRANSIENT_PATTERNS = [
  /rate.?limit/i,
  /too many requests/i,
  /\b429\b/,
  /\b50[023]\b/, // 500/502/503
  /timeout|timed out|etimedout/i,
  /econnreset|econnrefused|enotfound|network/i,
  /temporarily unavailable|try again/i,
  /wordt nog verwerkt/i, // Instagram-video nog aan het verwerken
];

const PERMANENT_PATTERNS = [
  /token/i,
  /expired|verlopen/i,
  /oauth/i,
  /permission|toestemming|scope/i,
  /\b(401|403)\b/i,
  /geen actieve .* koppeling/i,
  /hoort niet bij deze klant/i,
  /vereist een video|vereist een foto/i,
  /ontbreekt/i,
  /unsupported|not supported|invalid media/i,
];

export function classifyPublishError(message: string): ErrorKind {
  // Blijvend wint: bij twijfel liever een mens waarschuwen dan blijven proberen
  // en zo een rate limit vol te trekken met kansloze pogingen.
  if (PERMANENT_PATTERNS.some((re) => re.test(message))) return "permanent";
  if (TRANSIENT_PATTERNS.some((re) => re.test(message))) return "transient";
  return "permanent";
}

/** Hoe vaak we een tijdelijke fout opnieuw proberen voordat we het opgeven. */
export const MAX_PUBLISH_RETRIES = 3;

/**
 * Wachttijd voor de volgende poging, oplopend: 5, 20, 45 minuten. Zo vangen we
 * een korte storing op zonder een uur later alsnog ongevraagd te publiceren.
 */
export function retryDelayMinutes(attempt: number): number {
  return 5 * attempt * attempt;
}

/** Korte, begrijpelijke uitleg voor in de melding en de foutenwachtrij. */
export function humanReason(message: string, kind: ErrorKind): string {
  if (kind === "transient") return "Tijdelijke storing — we proberen het automatisch opnieuw.";
  if (/token|expired|verlopen|oauth|401|403/i.test(message)) {
    return "De koppeling met het platform werkt niet meer. Koppel het kanaal opnieuw.";
  }
  if (/vereist een video|vereist een foto|media|unsupported/i.test(message)) {
    return "Het platform accepteerde de media niet. Controleer formaat en bestandstype.";
  }
  return "Publiceren is niet gelukt en vraagt om actie.";
}
