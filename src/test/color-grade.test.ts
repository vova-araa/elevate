import { describe, it, expect } from "vitest";
import {
  LOOKS,
  NEUTRAL_GRADE,
  gradeFilter,
  gradeOverlays,
  grainAlpha,
  isNeutral,
  parseGrade,
  vignetteAlpha,
  type Grade,
} from "@/lib/color-grade";

/**
 * Het voorbeeld in de browser en het geëxporteerde bestand delen deze functies.
 * Wijkt hier iets af, dan ziet de export er anders uit dan wat je zag — precies
 * het probleem dat deze opzet moest voorkomen.
 */

describe("gradeFilter", () => {
  it("levert geen filter op bij een neutrale grade", () => {
    expect(gradeFilter(NEUTRAL_GRADE)).toBe("none");
  });

  it("zet alleen de gewijzigde bewerkingen in de string", () => {
    const g: Grade = { ...NEUTRAL_GRADE, contrast: 1.2 };
    expect(gradeFilter(g)).toBe("contrast(1.200)");
  });

  it("begrenst waarden buiten bereik in plaats van ze door te geven", () => {
    expect(gradeFilter({ ...NEUTRAL_GRADE, exposure: 99 })).toBe("brightness(2.000)");
    expect(gradeFilter({ ...NEUTRAL_GRADE, saturation: -5 })).toBe("saturate(0.000)");
  });
});

describe("gradeOverlays", () => {
  it("geeft geen lagen bij een neutrale grade", () => {
    expect(gradeOverlays(NEUTRAL_GRADE)).toEqual([]);
  });

  it("kiest oranje bij warm en blauw bij koel", () => {
    expect(gradeOverlays({ ...NEUTRAL_GRADE, warmth: 50 })[0].color).toBe("#ff9a3c");
    expect(gradeOverlays({ ...NEUTRAL_GRADE, warmth: -50 })[0].color).toBe("#3c9aff");
  });

  it("schaalt de dekking mee met de sterkte", () => {
    const zwak = gradeOverlays({ ...NEUTRAL_GRADE, warmth: 20 })[0].alpha;
    const sterk = gradeOverlays({ ...NEUTRAL_GRADE, warmth: 80 })[0].alpha;
    expect(sterk).toBeGreaterThan(zwak);
    expect(sterk).toBeLessThanOrEqual(1);
  });

  it("tilt de zwarten op met een lichte laag in lighten", () => {
    const [layer] = gradeOverlays({ ...NEUTRAL_GRADE, fade: 100 });
    expect(layer.blend).toBe("lighten");
    expect(layer.color).toBe("rgb(60,60,60)");
  });
});

describe("vignette en korrel", () => {
  it("zijn nul zolang ze uitstaan", () => {
    expect(vignetteAlpha(NEUTRAL_GRADE)).toBe(0);
    expect(grainAlpha(NEUTRAL_GRADE)).toBe(0);
  });

  it("blijven binnen een subtiel maximum", () => {
    expect(vignetteAlpha({ ...NEUTRAL_GRADE, vignette: 100 })).toBeCloseTo(0.75);
    expect(grainAlpha({ ...NEUTRAL_GRADE, grain: 100 })).toBeCloseTo(0.22);
  });
});

describe("isNeutral", () => {
  it("herkent de neutrale grade en elke afwijking daarvan", () => {
    expect(isNeutral(NEUTRAL_GRADE)).toBe(true);
    expect(isNeutral({ ...NEUTRAL_GRADE, grain: 1 })).toBe(false);
  });
});

describe("parseGrade", () => {
  it("vult ontbrekende velden aan met de neutrale waarde", () => {
    expect(parseGrade({ warmth: 30 })).toEqual({ ...NEUTRAL_GRADE, warmth: 30 });
  });

  it("negeert onbruikbare opgeslagen waarden zonder te crashen", () => {
    // Sjablonen komen uit een jsonb-kolom en kunnen van een oudere versie zijn.
    expect(parseGrade(null)).toEqual(NEUTRAL_GRADE);
    expect(parseGrade("tekst")).toEqual(NEUTRAL_GRADE);
    expect(parseGrade([1, 2])).toEqual(NEUTRAL_GRADE);
    expect(parseGrade({ contrast: "veel", exposure: 1.2 })).toEqual({
      ...NEUTRAL_GRADE,
      exposure: 1.2,
    });
    expect(parseGrade({ grain: Number.NaN })).toEqual(NEUTRAL_GRADE);
  });
});

describe("LOOKS", () => {
  it("bevat een neutrale look en heeft geen dubbele namen", () => {
    expect(LOOKS.some((l) => isNeutral(l.grade))).toBe(true);
    expect(new Set(LOOKS.map((l) => l.id)).size).toBe(LOOKS.length);
  });

  it("gebruikt alleen waarden binnen het bereik van de schuiven", () => {
    for (const look of LOOKS) {
      expect(look.grade.exposure).toBeGreaterThanOrEqual(0.6);
      expect(look.grade.exposure).toBeLessThanOrEqual(1.6);
      expect(Math.abs(look.grade.warmth)).toBeLessThanOrEqual(100);
      expect(look.grade.grain).toBeGreaterThanOrEqual(0);
      expect(look.grade.grain).toBeLessThanOrEqual(100);
    }
  });
});
