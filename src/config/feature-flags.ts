/**
 * A14: functionaliteit die nog niet werkt hoort niet klantzichtbaar in de UI
 * te staan. Feature-flags hier — via env var, standaard uit — houden zo'n
 * blok verborgen tot het echt iets doet.
 */

/** Paid ads-overzicht (Meta/Google/TikTok Ads) op /admin/analytics — nog geen API-koppeling. */
export const FEATURE_PAID_ADS = import.meta.env.VITE_FEATURE_PAID_ADS === "true";
