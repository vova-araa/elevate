---
name: seo-audit
description: Audit and fix SEO/discoverability on this app's public pages — meta tags, Open Graph, canonicals, robots/sitemap, structured data, Core Web Vitals. Use when asked about SEO, findability, Google ranking, share previews ("link ziet er niet uit op WhatsApp/LinkedIn"), or after adding/renaming a public route.
---

# SEO-audit voor Elevate

Deze app is een **TanStack Start**-app. SEO geldt alleen voor de **publieke**
pagina's; het portaal onder `_authenticated` moet juist *niet* geïndexeerd worden.

## Waar wat staat

| Onderdeel | Bestand |
|---|---|
| Globale meta/OG/Twitter + favicons | `src/routes/__root.tsx` (`head()`) |
| `<html lang="nl">` | `src/routes/__root.tsx` (`RootShell`) |
| Per-pagina titel/description/canonical | de route zelf, via `head: () => ({ meta, links })` |
| robots | `public/robots.txt` |
| sitemap | `public/sitemap.xml` |
| noindex-portaal | `src/routes/_authenticated.tsx` (`head` → robots noindex) |

Publieke routes op dit moment: `/`, `/terms`, `/privacy`, `/data-deletion`.

## Vaste werkwijze

1. **Inventariseer** de publieke routes: `ls src/routes/*.tsx` (alles buiten
   `_authenticated`, `api`, `__root`).
2. **Controleer per publieke route** dat `head()` levert:
   - unieke `title` (≤60 tekens) en `description` (~150 tekens), in het Nederlands
   - `link: [{ rel: "canonical", href: "https://www.elevatedesign.nl<pad>" }]`
   - een eigen `og:url` (anders erft hij de homepage uit `__root`)
3. **Controleer globaal** in `__root.tsx`: `og:site_name`, `og:type`,
   `og:locale` (`nl_NL`), `og:image` (1200×630) + `og:image:width/height/alt`,
   `twitter:card = summary_large_image`.
4. **robots + sitemap**: elke nieuwe publieke route hoort in `public/sitemap.xml`;
   elke nieuwe privé-prefix hoort als `Disallow` in `public/robots.txt`.
   `robots.txt` moet de `Sitemap:`-regel bevatten.
5. **Verifieer dat het portaal dicht staat**: `noindex, nofollow` op
   `_authenticated`, en `Disallow` voor `/admin`, `/client`, `/dashboard`,
   `/api`, `/auth`.
6. **Bevestig live** dat de URL's echt laden (Meta/TikTok keuren een niet-
   bereikbare privacy-URL af):
   `curl -s -o /dev/null -w "%{http_code}" https://www.elevatedesign.nl/privacy`

## Valkuilen in deze codebase

- **Twee canonicals.** Zet canonical *per route*, niet in `__root.tsx` — anders
  krijgt elke pagina er twee en negeert Google ze.
- **`validateSearch` maakt search verplicht.** Geef het een expliciet optioneel
  returntype (`): { x?: string }`), anders faalt `typecheck` op elke bestaande
  `<Link>` naar die route.
- **`routeTree.gen.ts` is gegenereerd.** Na het toevoegen van een route eerst
  `bun run build` (of `dev`) draaien, anders faalt `typecheck` op een onbekende
  route-string.
- **www vs non-www.** Canonical/sitemap/OG gebruiken `https://www.elevatedesign.nl`.
  (Let op: TikTok's redirect-URI gebruikt bewust de non-www variant — dat is een
  aparte afspraak, geen SEO-inconsistentie.)

## Performance telt mee voor SEO

Voor Core Web Vitals: zie de perf-punten in `.claude/skills/security-audit` niet —
maar wel deze bekende zaken in dit project: Google Fonts is render-blocking in
`__root.tsx`, en zware libs (jspdf, recharts) horen lazy te zijn. Controleer met
`bun run build` welke chunk op de landing terechtkomt.

## Afronden

Altijd `bun run typecheck && bun run lint && bun run build` voordat je commit.
