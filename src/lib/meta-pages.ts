/**
 * Paginakeuze voor Meta-koppelingen, als pure logica.
 *
 * Een Meta-account beheert vaak meerdere Facebook-pagina's. Blind de eerste
 * pakken ging twee kanten op mis: een klant met meerdere pagina's kreeg
 * geruisloos de verkeerde gekoppeld, en een Instagram-koppeling faalde zodra
 * pagina één toevallig geen Instagram Business-account had — ook als pagina
 * twee dat wél had.
 */

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

/** Vorm die in `social_connections.meta.pages` wordt bewaard (server-only leesbaar). */
export interface StoredPage {
  id: string;
  name: string;
  token: string;
  igUserId: string | null;
}

/** Vorm die naar de UI mag: zonder tokens. */
export interface PublicPage {
  id: string;
  name: string;
  hasInstagram: boolean;
}

export function toStoredPages(pages: MetaPage[]): StoredPage[] {
  return pages.map((p) => ({
    id: p.id,
    name: p.name,
    token: p.access_token,
    igUserId: p.instagram_business_account?.id ?? null,
  }));
}

export function toPublicPages(stored: unknown): PublicPage[] {
  if (!Array.isArray(stored)) return [];
  return stored
    .filter(
      (p): p is StoredPage =>
        !!p && typeof p === "object" && typeof (p as StoredPage).id === "string",
    )
    .map((p) => ({ id: p.id, name: p.name, hasInstagram: p.igUserId !== null }));
}

/**
 * Kies de pagina voor een platform:
 *  - facebook: de eerste pagina (elke pagina kan posten);
 *  - instagram: de eerste pagina mét een Instagram Business-account — niet de
 *    eerste pagina überhaupt.
 * `null` betekent: geen bruikbare pagina voor dit platform.
 */
export function pickPageForPlatform(
  pages: MetaPage[],
  platform: "facebook" | "instagram",
): MetaPage | null {
  if (platform === "facebook") return pages[0] ?? null;
  return pages.find((p) => p.instagram_business_account?.id) ?? null;
}
