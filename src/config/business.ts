/**
 * Eén bron voor wettelijke bedrijfsgegevens (S05) — footer, contactpagina,
 * structured data en de juridische pagina's lezen allemaal hiervandaan.
 *
 * KvK, btw-id, vestigingsadres en telefoonnummer staan nog nergens in de app,
 * terwijl dat voor commerciële online dienstverlening verplicht is (art. 3:15d
 * BW, Handelsregisterwet art. 25). Ik heb die gegevens niet — vul ze hieronder
 * in zodra je ze hebt (zie TODO-VOVA.md). Tot die tijd tonen de velden
 * hieronder zichtbaar "<<NOG INVULLEN>>" in plaats van iets te verzinnen of
 * de site onbereikbaar te maken.
 */

export interface BusinessInfo {
  legalName: string;
  tradeName: string;
  kvk: string;
  vat: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  email: string;
  privacyEmail: string;
  phone: string;
  instagram: string;
  tiktok: string;
}

const PLACEHOLDER = "<<NOG INVULLEN>>";

/** `null` = nog niet bekend. Vul hier de echte waarde in. */
const RAW: Record<keyof BusinessInfo, string | null> = {
  legalName: null,
  tradeName: "Elevate Design",
  kvk: null,
  vat: null,
  street: null,
  postalCode: null,
  city: null,
  country: "NL",
  email: "info@elevatedesign.nl",
  privacyEmail: "privacy@elevatedesign.nl",
  phone: null,
  instagram: "https://www.instagram.com/elevatedesign.official/",
  tiktok: "https://www.tiktok.com/@elevate.design.official",
};

/** Welke velden nog een placeholder zijn — gebruikt door de build-waarschuwing. */
export const BUSINESS_FIELD_STATUS = Object.fromEntries(
  Object.entries(RAW).map(([k, v]) => [k, v !== null]),
) as Record<keyof BusinessInfo, boolean>;

export const BUSINESS: BusinessInfo = Object.fromEntries(
  Object.entries(RAW).map(([k, v]) => [k, v ?? PLACEHOLDER]),
) as unknown as BusinessInfo;

export function isPlaceholder(value: string): boolean {
  return value === PLACEHOLDER;
}
