/**
 * Eén schrijfstandaard voor alles wat de AI produceert.
 *
 * Waarom dit bestaat: de promptteksten stonden verspreid over vier bestanden,
 * elk met een eigen platformlijst en eigen instructies. Daardoor schreef de
 * captiongenerator anders dan de composer, noemde de AI platforms die we niet
 * eens publiceren, en — het ergste — begon hij bij een dunne briefing een
 * gesprek ("Waar moet de caption over gaan?") in plaats van iets te leveren.
 *
 * Een tekstveld is geen chat. Wie op "genereer" drukt wil een caption, geen
 * vragenlijst. Dat is hier een harde regel, geen suggestie.
 */

import type { Platform } from "@/config/platforms";
import { CAPTION_LIMITS } from "@/lib/social-constants";

export type { Platform };

/**
 * Wat elk platform van een tekst vraagt. Kort en operationeel: een limiet, waar
 * de aandacht valt, en hoeveel hashtags er werken. Geen sfeerbeschrijvingen —
 * die maken de output juist vager.
 *
 * De harde "max X tekens" komt uit CAPTION_LIMITS (social-constants.ts) — dat
 * is dezelfde bron als de teller/waarschuwing in het postvenster. Los
 * daarvan hardcoden leidde ertoe dat dit de AI ooit "TikTok max 300 tekens"
 * voorhield terwijl de UI pas bij 2200 blokkeerde: de AI kreeg een onjuiste,
 * te strenge limiet mee die niets met de echte grens te maken had. De
 * kortere "in de praktijk"-richtlijn is bewust wél losse schrijfadvies-tekst
 * — dat is een stijlkeuze, geen technische grens, en hoort niet uit
 * CAPTION_LIMITS te komen.
 */
const PLATFORM_STYLE_NOTES: Record<Platform, string> = {
  instagram:
    "houd het onder de 600 tenzij het verhaal meer nodig heeft. " +
    "Alleen de eerste zin is zichtbaar vóór 'meer lezen': daar staat de kern, niet de aanloop. " +
    "3 tot 5 hashtags, onderaan. Emoji mag, spaarzaam en functioneel.",
  facebook:
    "houd het in de praktijk ver onder de limiet. Schrijf zoals je het zou vertellen. " +
    "Hooguit twee hashtags; op Facebook doen ze weinig.",
  tiktok:
    "houd het in de praktijk op één of twee zinnen. De video doet het werk, " +
    "het bijschrift geeft context of een reden om te blijven kijken. 2 tot 4 hashtags. Spreektaal.",
  youtube:
    "zet de titelzin op de eerste regel — die moet los te lezen zijn. " +
    "Daaronder twee of drie zinnen context. Hashtags onderaan, maximaal drie.",
  linkedin:
    "houd het in de praktijk onder de 800. Open met de observatie of het " +
    "resultaat, niet met een aankondiging. Maximaal 3 hashtags.",
};

function buildPlatformBrief(platform: Platform): string {
  const limit = CAPTION_LIMITS[platform];
  const label = limit?.label ?? platform;
  const note = PLATFORM_STYLE_NOTES[platform];
  const maxNote = limit ? `max ${limit.hard} tekens, maar ${note}` : note;
  return `${label} — ${maxNote}`;
}

const PLATFORM_BRIEFS: Record<Platform, string> = Object.fromEntries(
  (Object.keys(PLATFORM_STYLE_NOTES) as Platform[]).map((p) => [p, buildPlatformBrief(p)]),
) as Record<Platform, string>;

export function platformBrief(platform: string): string {
  return (
    PLATFORM_BRIEFS[platform as Platform] ??
    `${platform} — houd het kort, concreet en direct plaatsbaar.`
  );
}

/**
 * De regels die voor élke gegenereerde tekst gelden.
 *
 * De eerste is de belangrijkste: nooit terugvragen. Een model dat om
 * verduidelijking vraagt is in een chat behulpzaam en in een tekstveld kapot —
 * de gebruiker krijgt een vraag waar een caption hoort te staan, en moet
 * opnieuw beginnen.
 *
 * De regel over cijfers is er omdat verzonnen statistieken ("3x meer bereik")
 * in klantcommunicatie terechtkomen en daar niet meer te onderscheiden zijn van
 * echte cijfers.
 */
export const HOUSE_RULES = `Werkwijze:
- Lever altijd het gevraagde resultaat. Stel nooit een wedervraag en vraag nooit om meer informatie. Is de briefing dun, ga dan uit van wat je uit de merkcontext en het beeld kunt afleiden en schrijf iets bruikbaars. Een tekstveld is geen gesprek.
- Geef alleen de tekst zelf. Geen inleiding, geen toelichting, geen labels als "Caption:", geen aanhalingstekens eromheen, geen meerdere varianten tenzij daar expliciet om gevraagd wordt.

Schrijfregels:
- Nederlands, tenzij anders gevraagd. Gebruik het Nederlandse woord waar dat bestaat.
- Concreet boven algemeen: noem wat er te zien is, wie het doet, wat het oplevert. Schrap elke zin die ook voor een willekeurig ander merk zou kunnen gelden.
- Geen verzonnen feiten, cijfers, percentages, prijzen of data. Weet je het niet, laat het weg.
- Geen clichés: "In de wereld van…", "Ontdek…", "Wij zijn trots om aan te kondigen", "een game changer", "het draait allemaal om", "laten we eerlijk zijn". Geen openingsvraag als hook.
- Geen opsomming van bijvoeglijke naamwoorden en geen uitroeptekens-stapeling. Eén gedachte per zin.
- Schrijf actief en in de tegenwoordige tijd.`;

export interface CopywriterPromptOptions {
  /** Platform waarvoor geschreven wordt; bepaalt lengte en hashtag-aantal. */
  platform?: string;
  /** Gewenste toon; leeg = de tone-of-voice van de klant volgen. */
  tone?: string;
  /** "nl" of "en". */
  language?: "nl" | "en";
  /** Merk- en tone-of-voice-context van de klant. */
  context?: string;
  /** Wat er precies geleverd moet worden, als dat afwijkt van "één caption". */
  task?: string;
  /** Aanvullende regels die alleen voor deze aanroep gelden. */
  extra?: string;
}

/**
 * Bouwt het systeemprompt voor een schrijfopdracht. Volgorde is bewust: rol,
 * dan taak, dan platform, dan merk, dan de huisregels — zodat de regels het
 * laatste zijn wat het model leest.
 */
export function copywriterSystem(opts: CopywriterPromptOptions = {}): string {
  const lang = opts.language === "en" ? "Engels" : "Nederlands";
  const parts: string[] = [
    `Je bent copywriter bij een Nederlands social-media-bureau en schrijft namens de klant, niet namens het bureau. Schrijf in het ${lang}.`,
  ];

  if (opts.task) parts.push(`Opdracht: ${opts.task}`);
  if (opts.platform) parts.push(platformBrief(opts.platform));
  if (opts.tone) {
    parts.push(
      `Toon: ${opts.tone}. Wijkt de tone-of-voice van de klant hiervan af, dan gaat die voor.`,
    );
  }
  if (opts.context?.trim()) parts.push(opts.context.trim());
  parts.push(HOUSE_RULES);
  if (opts.extra?.trim()) parts.push(opts.extra.trim());

  return parts.join("\n\n");
}

/**
 * Wat er geschreven moet worden als de gebruiker weinig invulde.
 *
 * Zonder dit valt het model terug op vragen stellen. Met een expliciet
 * onderwerp — al is het maar "het beeld dat erbij hangt" — levert het gewoon.
 */
export function subjectOrFallback(input: {
  briefing?: string;
  currentCaption?: string;
  hasMedia?: boolean;
  mediaType?: string | null;
}): string {
  const briefing = input.briefing?.trim();
  if (briefing) return briefing;

  const caption = input.currentCaption?.trim();
  if (caption) return caption;

  if (input.hasMedia) {
    const soort = input.mediaType?.startsWith("video") ? "de video" : "de foto";
    return `Er is geen briefing gegeven. Schrijf een caption die past bij ${soort} bij deze post en bij wat dit merk doet. Blijf weg bij details die je niet kunt weten.`;
  }

  return (
    "Er is geen briefing en geen beeld gegeven. Schrijf een korte, algemeen bruikbare caption " +
    "die past bij wat dit merk doet, zonder specifieke gebeurtenis of aanbieding te noemen."
  );
}
