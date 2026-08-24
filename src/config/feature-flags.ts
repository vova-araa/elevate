/**
 * A14: functionaliteit die nog niet werkt hoort niet klantzichtbaar in de UI
 * te staan. Feature-flags hier — via env var, standaard uit — houden zo'n
 * blok verborgen tot het echt iets doet.
 */

/** Paid ads-overzicht (Meta/Google/TikTok Ads) op /admin/analytics — nog geen API-koppeling. */
export const FEATURE_PAID_ADS = import.meta.env.VITE_FEATURE_PAID_ADS === "true";

/**
 * Tijdelijke maatregel tijdens de Meta App Review (zes permissions +
 * bedrijfsverificatie, zie TODO-VOVA.md): zolang die niet is goedgekeurd,
 * werkt de echte Instagram/Facebook-OAuth alleen voor accounts die als
 * tester op de Meta-app staan — voor iedereen anders loopt de koppelknop
 * dood. Met deze vlag aan pauzeert de OAuth-knop voor die twee platforms en
 * komt er een handmatige invoer voor in de plaats (zie
 * connectChannelManually), zodat de koppelpagina's niet twee half-werkende
 * flows door elkaar tonen. Zet 'm weer uit zodra Meta akkoord is — de
 * OAuth-knop komt dan vanzelf terug.
 */
export const META_REVIEW_PENDING = import.meta.env.VITE_META_REVIEW_PENDING !== "false";

/** Platforms die onder de Meta App Review vallen. */
export const META_GATED_PLATFORMS = ["instagram", "facebook"] as const;
