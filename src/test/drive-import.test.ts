// @vitest-environment node
import { describe, it, expect } from "vitest";
import { isImportableMedia, parseDriveTarget } from "@/lib/drive-import.server";

/**
 * Klanten plakken elke denkbare vorm van Drive-link. Als het herkennen van het
 * id faalt, faalt de hele import — dus dit is de plek om streng te zijn.
 */

describe("parseDriveTarget", () => {
  it("herkent een mapdeellink", () => {
    expect(parseDriveTarget("https://drive.google.com/drive/folders/1a2B3c4D5e6F7g8H9i0J")).toEqual(
      { kind: "folder", id: "1a2B3c4D5e6F7g8H9i0J" },
    );
  });

  it("herkent een mapdeellink met accountnummer en query erachter", () => {
    expect(
      parseDriveTarget(
        "https://drive.google.com/drive/u/0/folders/1a2B3c4D5e6F7g8H9i0J?usp=sharing",
      ),
    ).toEqual({ kind: "folder", id: "1a2B3c4D5e6F7g8H9i0J" });
  });

  it("herkent een bestandslink", () => {
    expect(parseDriveTarget("https://drive.google.com/file/d/1a2B3c4D5e6F7g8H9i0J/view")).toEqual({
      kind: "file",
      id: "1a2B3c4D5e6F7g8H9i0J",
    });
  });

  it("herkent de oude ?id=-vorm", () => {
    expect(parseDriveTarget("https://drive.google.com/open?id=1a2B3c4D5e6F7g8H9i0J")).toMatchObject(
      { id: "1a2B3c4D5e6F7g8H9i0J" },
    );
  });

  it("accepteert een kaal id", () => {
    expect(parseDriveTarget("1a2B3c4D5e6F7g8H9i0J1234")).toMatchObject({
      id: "1a2B3c4D5e6F7g8H9i0J1234",
    });
  });

  it("negeert spaties eromheen", () => {
    expect(
      parseDriveTarget("  https://drive.google.com/drive/folders/1a2B3c4D5e6F7g8H9i0J  "),
    ).toEqual({ kind: "folder", id: "1a2B3c4D5e6F7g8H9i0J" });
  });

  it("weigert iets wat geen Drive-link is", () => {
    expect(() => parseDriveTarget("https://example.com/foto.jpg")).toThrow();
    expect(() => parseDriveTarget("gewoon tekst")).toThrow();
  });
});

describe("isImportableMedia", () => {
  it("neemt beeld en video mee", () => {
    expect(isImportableMedia("image/jpeg", "foto.jpg")).toBe(true);
    expect(isImportableMedia("video/mp4", "reel.mp4")).toBe(true);
  });

  it("valt terug op de extensie als Drive het type niet weet", () => {
    // Drive geeft voor .mov en .heic vaak application/octet-stream terug.
    expect(isImportableMedia("application/octet-stream", "clip.MOV")).toBe(true);
    expect(isImportableMedia("application/octet-stream", "foto.HEIC")).toBe(true);
  });

  it("slaat documenten en spreadsheets over", () => {
    expect(isImportableMedia("application/pdf", "briefing.pdf")).toBe(false);
    expect(isImportableMedia("application/vnd.google-apps.document", "notities")).toBe(false);
    expect(isImportableMedia("application/octet-stream", "prijzen.xlsx")).toBe(false);
  });
});
