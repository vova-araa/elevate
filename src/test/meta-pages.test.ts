import { describe, it, expect } from "vitest";
import { pickPageForPlatform, toPublicPages, toStoredPages, type MetaPage } from "@/lib/meta-pages";

/**
 * Een Meta-account beheert vaak meerdere pagina's; welke we kiezen bepaalt op
 * welk account een klantpost belandt. Fout kiezen is hier niet cosmetisch.
 */

const PAGES: MetaPage[] = [
  { id: "p1", name: "Privéproject", access_token: "t1" },
  {
    id: "p2",
    name: "Uprising Studio",
    access_token: "t2",
    instagram_business_account: { id: "ig2" },
  },
  { id: "p3", name: "Oude pagina", access_token: "t3" },
];

describe("pickPageForPlatform", () => {
  it("kiest voor Facebook gewoon de eerste pagina", () => {
    expect(pickPageForPlatform(PAGES, "facebook")?.id).toBe("p1");
  });

  it("kiest voor Instagram de eerste pagina mét Business-account — niet pagina één", () => {
    // Voorheen faalde de koppeling hier: pagina één heeft geen Instagram,
    // pagina twee wél. Dat is precies de situatie bij echte klanten.
    expect(pickPageForPlatform(PAGES, "instagram")?.id).toBe("p2");
  });

  it("geeft null als geen enkele pagina bruikbaar is", () => {
    expect(pickPageForPlatform([], "facebook")).toBeNull();
    expect(
      pickPageForPlatform([{ id: "x", name: "Zonder IG", access_token: "t" }], "instagram"),
    ).toBeNull();
  });
});

describe("toStoredPages / toPublicPages", () => {
  it("bewaart tokens server-side maar laat ze nooit naar de UI lekken", () => {
    const stored = toStoredPages(PAGES);
    expect(stored[1]).toEqual({ id: "p2", name: "Uprising Studio", token: "t2", igUserId: "ig2" });

    const publiek = toPublicPages(stored);
    expect(publiek).toEqual([
      { id: "p1", name: "Privéproject", hasInstagram: false },
      { id: "p2", name: "Uprising Studio", hasInstagram: true },
      { id: "p3", name: "Oude pagina", hasInstagram: false },
    ]);
    for (const p of publiek) expect("token" in p).toBe(false);
  });

  it("verdraagt rommel uit een oude of handmatig bewerkte meta-kolom", () => {
    expect(toPublicPages(null)).toEqual([]);
    expect(toPublicPages("tekst")).toEqual([]);
    expect(toPublicPages([{ kapot: true }, null, 42])).toEqual([]);
  });
});
