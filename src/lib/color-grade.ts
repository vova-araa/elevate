/**
 * Kleurgraden voor de beeld-editor.
 *
 * Bewust geen WebGL en geen externe bibliotheek: alles wat hier gebeurt kan met
 * de filter-eigenschap die zowel CSS als canvas 2D kennen, plus een paar
 * overlays met een blend-modus. Dat betekent dat het voorbeeld in de browser en
 * het geëxporteerde bestand langs exact dezelfde bewerking gaan — geen "in de
 * app zag het er anders uit" — en dat er geen renderserver aan te pas komt.
 *
 * Wat níet met filters kan (kleurtemperatuur, fade, vignet, korrel) doen we met
 * een gekleurde laag eroverheen in de juiste blend-modus. Dat is precies hoe een
 * grade in een echte editor ook is opgebouwd: eerst de toon, dan de kleur.
 */

export interface Grade {
  /** Belichting. 1 = ongewijzigd. */
  exposure: number;
  /** Contrast. 1 = ongewijzigd. */
  contrast: number;
  /** Verzadiging. 1 = ongewijzigd, 0 = zwart-wit. */
  saturation: number;
  /** Kleurtemperatuur, -100 (koel/blauw) tot 100 (warm/oranje). */
  warmth: number;
  /** Tint, -100 (groen) tot 100 (magenta). */
  tint: number;
  /** Zwarten optillen voor een matte, filmische look. 0-100. */
  fade: number;
  /** Randverdonkering. 0-100. */
  vignette: number;
  /** Filmkorrel. 0-100. */
  grain: number;
}

export const NEUTRAL_GRADE: Grade = {
  exposure: 1,
  contrast: 1,
  saturation: 1,
  warmth: 0,
  tint: 0,
  fade: 0,
  vignette: 0,
  grain: 0,
};

export function isNeutral(g: Grade): boolean {
  return (Object.keys(NEUTRAL_GRADE) as (keyof Grade)[]).every(
    (k) => Math.abs(g[k] - NEUTRAL_GRADE[k]) < 0.001,
  );
}

/** Voorinstellingen. Namen zoals een fotograaf ze zou noemen, niet "Filter 3". */
export const LOOKS: { id: string; label: string; grade: Grade }[] = [
  { id: "neutraal", label: "Neutraal", grade: NEUTRAL_GRADE },
  {
    id: "warm-goud",
    label: "Warm goud",
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 1.04,
      contrast: 1.06,
      saturation: 1.08,
      warmth: 28,
      fade: 6,
      vignette: 12,
    },
  },
  {
    id: "filmisch",
    label: "Filmisch",
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 1.02,
      contrast: 1.14,
      saturation: 0.92,
      warmth: 10,
      tint: -6,
      fade: 16,
      vignette: 22,
      grain: 18,
    },
  },
  {
    id: "helder",
    label: "Helder & schoon",
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 1.1,
      contrast: 1.04,
      saturation: 1.05,
      warmth: 4,
    },
  },
  {
    id: "pastel",
    label: "Zacht pastel",
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 1.06,
      contrast: 0.92,
      saturation: 0.88,
      warmth: 12,
      tint: 6,
      fade: 22,
    },
  },
  {
    id: "mono",
    label: "Zwart-wit",
    grade: {
      ...NEUTRAL_GRADE,
      contrast: 1.18,
      saturation: 0,
      fade: 8,
      vignette: 18,
      grain: 12,
    },
  },
  {
    id: "vintage",
    label: "Vintage",
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 0.98,
      contrast: 0.94,
      saturation: 0.8,
      warmth: 34,
      tint: -10,
      fade: 30,
      vignette: 26,
      grain: 24,
    },
  },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * De toon-bewerkingen als filter-string. Werkt identiek in CSS (`filter:`) en op
 * canvas (`ctx.filter`), en dat is precies waarom we het zo doen.
 */
export function gradeFilter(g: Grade): string {
  const parts: string[] = [];
  if (g.exposure !== 1) parts.push(`brightness(${clamp(g.exposure, 0.2, 2).toFixed(3)})`);
  if (g.contrast !== 1) parts.push(`contrast(${clamp(g.contrast, 0.2, 2).toFixed(3)})`);
  if (g.saturation !== 1) parts.push(`saturate(${clamp(g.saturation, 0, 2).toFixed(3)})`);
  return parts.join(" ") || "none";
}

export interface Overlay {
  /** CSS-kleur van de laag. */
  color: string;
  /** Blend-modus; dezelfde namen in CSS en canvas. */
  blend: "overlay" | "soft-light" | "multiply" | "screen" | "lighten";
  /** Dekking 0-1. */
  alpha: number;
}

/**
 * De kleurlagen bovenop het beeld, in volgorde. Leeg als er niets in te stellen
 * valt — dan tekenen we ook niets.
 */
export function gradeOverlays(g: Grade): Overlay[] {
  const out: Overlay[] = [];

  // Warm/koel: oranje of blauw in soft-light houdt de huidtinten heel, waar
  // 'overlay' ze snel oranje uitslaat.
  if (g.warmth > 0) {
    out.push({ color: "#ff9a3c", blend: "soft-light", alpha: clamp(g.warmth / 100, 0, 1) * 0.55 });
  } else if (g.warmth < 0) {
    out.push({ color: "#3c9aff", blend: "soft-light", alpha: clamp(-g.warmth / 100, 0, 1) * 0.55 });
  }

  if (g.tint > 0) {
    out.push({ color: "#ff4ecd", blend: "soft-light", alpha: clamp(g.tint / 100, 0, 1) * 0.35 });
  } else if (g.tint < 0) {
    out.push({ color: "#4eff8f", blend: "soft-light", alpha: clamp(-g.tint / 100, 0, 1) * 0.35 });
  }

  // Fade tilt de zwarten op: een lichte laag in 'lighten' raakt alleen wat
  // donkerder is dan die laag, en laat de lichte partijen met rust.
  if (g.fade > 0) {
    const v = Math.round(clamp(g.fade / 100, 0, 1) * 60);
    out.push({ color: `rgb(${v},${v},${v})`, blend: "lighten", alpha: 1 });
  }

  return out;
}

/** Dekking van het vignet, of 0 als er geen vignet is. */
export function vignetteAlpha(g: Grade): number {
  return clamp(g.vignette / 100, 0, 1) * 0.75;
}

/** Dekking van de korrellaag, of 0 als er geen korrel is. */
export function grainAlpha(g: Grade): number {
  return clamp(g.grain / 100, 0, 1) * 0.22;
}

/** Onbekende of onvolledige opgeslagen grades veilig inlezen. */
export function parseGrade(value: unknown): Grade {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...NEUTRAL_GRADE };
  const raw = value as Record<string, unknown>;
  const out = { ...NEUTRAL_GRADE };
  for (const key of Object.keys(NEUTRAL_GRADE) as (keyof Grade)[]) {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return out;
}
