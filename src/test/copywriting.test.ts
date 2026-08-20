import { describe, it, expect } from "vitest";
import { HOUSE_RULES, copywriterSystem, platformBrief, subjectOrFallback } from "@/lib/copywriting";

/**
 * Deze tests bewaken één ding: dat de AI lévert. Het echte incident was een
 * gebruiker die een foto uploadde, op genereren drukte, en als "caption" een
 * vragenlijst terugkreeg ("Waar moet de caption over gaan?"). In een chat is
 * dat behulpzaam; in een tekstveld is het kapot.
 */

describe("subjectOrFallback", () => {
  it("gebruikt de briefing als die er is", () => {
    expect(subjectOrFallback({ briefing: "Nieuwe opnameruimte geopend" })).toBe(
      "Nieuwe opnameruimte geopend",
    );
  });

  it("valt terug op de caption die er al staat", () => {
    expect(subjectOrFallback({ briefing: "   ", currentCaption: "Vandaag opgenomen" })).toBe(
      "Vandaag opgenomen",
    );
  });

  it("geeft bij alleen een foto een schrijfopdracht — geen lege string", () => {
    // Een lege string zou het model terugduwen naar vragen stellen.
    const out = subjectOrFallback({ hasMedia: true, mediaType: "image/jpeg" });
    expect(out).toMatch(/de foto/);
    expect(out.length).toBeGreaterThan(20);
  });

  it("herkent video apart van beeld", () => {
    expect(subjectOrFallback({ hasMedia: true, mediaType: "video/mp4" })).toMatch(/de video/);
  });

  it("levert ook zonder briefing én zonder media iets bruikbaars", () => {
    const out = subjectOrFallback({});
    expect(out).toMatch(/merk/);
    // Zonder houvast mag het model niets specifieks verzinnen.
    expect(out).toMatch(/zonder specifieke gebeurtenis/);
  });
});

describe("HOUSE_RULES", () => {
  it("verbiedt de wedervraag expliciet", () => {
    expect(HOUSE_RULES).toMatch(/nooit een wedervraag/i);
    expect(HOUSE_RULES).toMatch(/vraag nooit om meer informatie/i);
  });

  it("verbiedt verzonnen cijfers — die belanden anders in klantrapportages", () => {
    expect(HOUSE_RULES).toMatch(/verzonnen feiten, cijfers/i);
  });

  it("verbiedt labels en omlijstende uitleg rond de tekst", () => {
    expect(HOUSE_RULES).toMatch(/Geen inleiding, geen toelichting/i);
  });
});

describe("platformBrief", () => {
  it("geeft per platform een concrete limiet", () => {
    expect(platformBrief("instagram")).toMatch(/2200/);
    expect(platformBrief("tiktok")).toMatch(/300/);
    expect(platformBrief("facebook")).toMatch(/1500/);
  });

  it("loopt niet stuk op een onbekend platform", () => {
    const out = platformBrief("mastodon");
    expect(out).toContain("mastodon");
    expect(out).toMatch(/kort/);
  });
});

describe("copywriterSystem", () => {
  it("zet de huisregels altijd in het prompt, ook zonder opties", () => {
    expect(copywriterSystem()).toContain(HOUSE_RULES);
  });

  it("bevat rol, opdracht, platform en merkcontext", () => {
    const sys = copywriterSystem({
      platform: "instagram",
      tone: "energiek",
      context: "Klant: Uprising Studio (muziekstudio).",
      task: "Schrijf één caption.",
    });
    expect(sys).toMatch(/copywriter/i);
    expect(sys).toContain("Schrijf één caption.");
    expect(sys).toContain("2200");
    expect(sys).toContain("Uprising Studio");
    expect(sys).toMatch(/Toon: energiek/);
  });

  it("laat de tone-of-voice van de klant voorgaan op de gekozen toon", () => {
    // Anders overschrijft een standaardkeuze in de UI het merkprofiel.
    expect(copywriterSystem({ tone: "informeel" })).toMatch(/tone-of-voice van de klant.*voor/is);
  });

  it("schrijft standaard Nederlands en schakelt om op verzoek", () => {
    expect(copywriterSystem()).toMatch(/in het Nederlands/);
    expect(copywriterSystem({ language: "en" })).toMatch(/in het Engels/);
  });

  it("laat lege context weg in plaats van een gat achter te laten", () => {
    const sys = copywriterSystem({ context: "   " });
    expect(sys).not.toMatch(/\n\n\n/);
  });
});
