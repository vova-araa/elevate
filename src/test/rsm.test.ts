import { describe, it, expect } from "vitest";
import { checkRsm, findRsmLabel, findWeakLabel, prependRsmLabel } from "@/lib/rsm";

describe("findRsmLabel", () => {
  it("vindt een aanduiding en de positie ervan", () => {
    expect(findRsmLabel("#advertentie nieuwe collectie")).toEqual({
      label: "#advertentie",
      index: 0,
    });
  });

  it("matcht niet binnen een langer woord", () => {
    // "#adidas" bevat "#ad" maar is geen aanduiding — dit is precies het geval
    // waarin een naïeve indexOf ten onrechte groen licht geeft.
    expect(findRsmLabel("nieuwe schoenen #adidas")).toBeNull();
    expect(findRsmLabel("kijk hier #ad")).toMatchObject({ label: "#ad" });
  });

  it("kiest de vroegste aanduiding als er meerdere staan", () => {
    const found = findRsmLabel("betaald partnerschap met X #reclame");
    expect(found?.label).toBe("betaald partnerschap");
  });

  it("is hoofdletterongevoelig", () => {
    expect(findRsmLabel("#Advertentie")).toMatchObject({ index: 0 });
  });
});

describe("findWeakLabel", () => {
  it("herkent termen die niet volstaan", () => {
    expect(findWeakLabel("leuke #samenwerking met dit merk")).toBe("#samenwerking");
    expect(findWeakLabel("#collab")).toBe("#collab");
  });

  it("ziet #product niet aan voor #pr", () => {
    expect(findWeakLabel("ons nieuwe #product")).toBeNull();
  });
});

describe("checkRsm", () => {
  it("zwijgt als de post geen reclame is", () => {
    expect(checkRsm({ caption: "gewoon een post", isAd: false })).toEqual([]);
  });

  it("geeft een fout als de aanduiding ontbreekt", () => {
    const issues = checkRsm({ caption: "gewoon een post", isAd: true });
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("geeft een fout als de aanduiding buiten het zichtbare deel valt", () => {
    const caption = `${"x".repeat(140)} #advertentie`;
    const issues = checkRsm({ caption, isAd: true });
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toMatch(/meer lezen/);
  });

  it("keurt een aanduiding vooraan goed", () => {
    expect(checkRsm({ caption: "#advertentie onze nieuwe lijn", isAd: true })).toEqual([]);
  });

  it("waarschuwt bij een zwakke aanduiding zonder geldige", () => {
    const issues = checkRsm({ caption: "#samenwerking met dit merk", isAd: true });
    expect(issues.some((i) => i.severity === "warning")).toBe(true);
  });

  it("herinnert bij video aan de aanduiding in beeld", () => {
    const issues = checkRsm({ caption: "#advertentie kijk mee", isAd: true, isVideo: true });
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("info");
  });
});

describe("prependRsmLabel", () => {
  it("zet de aanduiding vooraan", () => {
    expect(prependRsmLabel("nieuwe collectie")).toBe("#advertentie nieuwe collectie");
  });

  it("verandert niets als er al een aanduiding staat", () => {
    expect(prependRsmLabel("#reclame nieuw")).toBe("#reclame nieuw");
  });

  it("werkt met een lege caption", () => {
    expect(prependRsmLabel("   ")).toBe("#advertentie");
  });
});
