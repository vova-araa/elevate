import { describe, it, expect } from "vitest";
import { safeFileName, uploadErrorMessage, resetFileInput, formatBytes } from "@/lib/upload-media";

/**
 * De uploadknop bleef draaien zonder dat iemand wist wat hij deed. Dat had twee
 * oorzaken die allebei in dit bestand landen: er was geen voortgang te tonen
 * (supabase.storage.upload geeft die niet), en de tijdslimiet die ik eerder
 * toevoegde werkte niet — FileOptions accepteert geen AbortSignal, dus die werd
 * stilzwijgend genegeerd en de upload liep gewoon door.
 *
 * Beide zijn opgelost door XHR te gebruiken. Deze tests dekken de pure logica
 * eromheen; het XHR-pad zelf is netwerkgedrag en wordt in de app getest.
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

  it("levert bij bestanden in dezelfde milliseconde geen botsing op", () => {
    // Alleen een tijdstempel was niet genoeg: twee bestanden tegelijk kiezen
    // gaf hetzelfde pad en dus een conflict.
    const namen = new Set(Array.from({ length: 200 }, () => safeFileName("a.jpg")));
    expect(namen.size).toBe(200);
  });
});

describe("uploadErrorMessage", () => {
  it("vertaalt een te-groot-fout naar uitleg met de limiet erin", () => {
    const msg = uploadErrorMessage("The object exceeded the maximum allowed size", "reel.mp4");
    expect(msg).toMatch(/te groot/i);
    expect(msg).toMatch(/MB/);
  });

  it("herkent ook de statuscode die de opslag daarbij geeft", () => {
    expect(uploadErrorMessage("HTTP 413", "x.mp4")).toMatch(/te groot/i);
    expect(uploadErrorMessage("Payload too large", "x.mp4")).toMatch(/te groot/i);
  });

  it("zegt bij een rechtenfout wat je eraan doet", () => {
    for (const raw of ["new row violates row-level security policy", "HTTP 401", "Unauthorized"]) {
      const msg = uploadErrorMessage(raw, "x.jpg");
      expect(msg).toMatch(/toestemming/i);
    }
  });

  it("herkent een botsend pad", () => {
    expect(uploadErrorMessage("The resource already exists", "x.jpg")).toMatch(/bestaat al/i);
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

describe("formatBytes", () => {
  it("schrijft de maat zoals je hem naast een balk wil lezen", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 kB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    // Boven de tien is een decimaal alleen maar ruis.
    expect(formatBytes(250 * 1024 * 1024)).toBe("250 MB");
  });
});
