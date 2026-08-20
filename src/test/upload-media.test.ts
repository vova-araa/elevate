import { describe, it, expect } from "vitest";
import { safeFileName, uploadErrorMessage, resetFileInput } from "@/lib/upload-media";

/**
 * De uploadknop bleef in de laadstand hangen zonder ooit een fout te tonen.
 * Deze tests bewaken de drie dingen die dat veroorzaakten: onleesbare fouten,
 * bestandsnamen die de opslag niet accepteert, en een bestandsveld dat na een
 * mislukte poging niet opnieuw afvuurt.
 */

describe("safeFileName", () => {
  it("houdt de extensie maar gooit de rest van de naam weg", () => {
    const name = safeFileName("Mijn Video (definitief) — 2026.MP4");
    expect(name).toMatch(/\.mp4$/);
    // Spaties, haakjes en accenten in een storage-pad leveren later dode links
    // op; de naam zelf heeft geen functie, het pad staat in de database.
    expect(name).not.toMatch(/[ ()—]/);
  });

  it("verzint een extensie als die ontbreekt", () => {
    expect(safeFileName("bestandzonderextensie")).toMatch(/\.bin$/);
  });

  it("levert bij twee bestanden in dezelfde milliseconde geen botsing op", () => {
    const namen = new Set(Array.from({ length: 50 }, () => safeFileName("a.jpg")));
    expect(namen.size).toBe(50);
  });
});

describe("uploadErrorMessage", () => {
  it("vertaalt een te-groot-fout naar uitleg met de limiet erin", () => {
    const msg = uploadErrorMessage("The object exceeded the maximum allowed size", "reel.mp4");
    expect(msg).toMatch(/te groot/i);
    expect(msg).toMatch(/MB/);
  });

  it("herkent ook de andere formulering van de opslag", () => {
    expect(uploadErrorMessage("Payload too large", "x.mp4")).toMatch(/te groot/i);
  });

  it("zegt bij een rechtenfout wat je eraan doet", () => {
    const msg = uploadErrorMessage("new row violates row-level security policy", "x.jpg");
    expect(msg).toMatch(/toestemming/i);
    expect(msg).toMatch(/opnieuw in|toegang/i);
  });

  it("laat een onbekende fout leesbaar door in plaats van hem te slikken", () => {
    const msg = uploadErrorMessage("connection reset", "x.jpg");
    expect(msg).toContain("x.jpg");
    expect(msg).toContain("connection reset");
  });
});

describe("resetFileInput", () => {
  it("maakt de waarde leeg zodat hetzelfde bestand opnieuw kan", () => {
    // Zonder dit vuurt change niet bij dezelfde keuze en lijkt de knop dood.
    const input = { value: "C:\\fakepath\\reel.mp4" } as HTMLInputElement;
    resetFileInput(input);
    expect(input.value).toBe("");
  });

  it("loopt niet stuk als het veld er nog niet is", () => {
    expect(() => resetFileInput(null)).not.toThrow();
    expect(() => resetFileInput(undefined)).not.toThrow();
  });
});
