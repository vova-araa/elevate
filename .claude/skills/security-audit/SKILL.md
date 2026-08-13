---
name: security-audit
description: Audit this app's security — server-function authorization, Supabase RLS/grants, OAuth token handling, SSRF, tenant isolation, public token links, headers. Use when asked to check/harden security, before a go-live, after adding a server function or migration, or when reviewing anything that touches client data or social tokens.
---

# Security-audit voor Elevate

Dit platform bewaart **OAuth-tokens van klanten** (Facebook/Instagram/TikTok) en
publiceert namens hen. Een fout hier raakt echte merkaccounts. Werk paranoïde.

## Het beveiligingsmodel in het kort

- **Autorisatie in twee lagen.** Server-functions checken expliciet
  (`assertAdmin` / `assertClientAccess`), én RLS in Postgres vangt het nogmaals af.
- **`context.supabase`** (uit `requireSupabaseAuth`) draait mét de JWT van de
  gebruiker → RLS geldt. **`supabaseAdmin`** is service-role → RLS geldt *niet*.
  Elke `supabaseAdmin`-aanroep moet dus een eigen autorisatiecheck ervóór hebben.
- **Tokens verlaten de server nooit.** Kolomrechten op `social_connections`
  ontnemen `authenticated` het lezen van `access_token`/`refresh_token`/`meta`.
- **Tenant-isolatie in storage** hangt aan het eerste pad-segment: `${clientId}/…`.

## Checklist per gebied

### 1. Server functions (`src/lib/*.functions.ts`)
Loop elke `export const … = createServerFn` langs:
- Staat `.middleware([requireSupabaseAuth])` erop?
- Is er ná authenticatie ook **autorisatie**? (`assertAdmin` of `assertClientAccess`)
- Komt `clientId` uit gebruikersinvoer? → altijd `assertClientAccess` erop (IDOR).
- Kost het geld (AI) of verstuurt het iets extern? → admin-only.
- Wordt `supabaseAdmin` gebruikt zonder voorafgaande check? → fout.

### 2. Storage / tenant-isolatie
Elk pad dat je ondertekent of schrijft moet met `${clientId}/` beginnen.
Let op velden die de klant zelf kan bewerken (`scheduled_posts.media_path`) —
die moet je valideren vóór `createSignedUrl`, anders lek je andermans media.

### 3. SSRF
Gebruik **altijd** `assertSafeExternalUrl` uit `src/lib/ssrf-guard.server.ts`
voor elke `fetch` naar een door gebruikers/admins aangeleverde URL.
Een tekstuele hostname-check is níét genoeg: die guard resolvet DNS en toetst
het IP (blokkeert `127.1`, `2130706433`, `::ffff:a9fe:a9fe`, `localhost.`, enz.).

### 4. Supabase-migraties (`supabase/migrations/`)
- Elke tabel met klantdata: RLS aan, policies `TO authenticated`, geen `USING(true)`.
- **`SECURITY DEFINER`-functies**: nooit blind `grant execute … to authenticated`.
  Zo'n functie draait met verhoogde rechten; alleen expliciet vrijgeven wat de
  client nodig heeft (`current_user_roles`, `is_admin`, `has_role`,
  `user_has_client_access`).
- Let op `grant execute on all functions in schema public` — dat trekt eerdere
  hardening stilletjes terug.
- Geef `anon` niets; controleer of oude dev-grants zijn ingetrokken.

### 5. Publieke endpoints
`src/routes/api/public/**`, `approve.$token`, `connect.$token`:
- Tokens: 32 bytes random, alleen de sha256-hash opgeslagen, vervaltijd + revocatie.
- Cross-check dat het object bij de client van het token hoort.
- Secrets horen in een **header**, nooit in de querystring (logs/replay).

### 6. Headers
`vite.config.ts` → `routeRules`: CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
Referrer-Policy, Permissions-Policy.

## Werkwijze

1. Lees de code — speculeer niet. Bevestig elke bevinding op `file:line`.
2. Rangschik op ernst en beschrijf een **concreet exploitscenario**; is dat er
   niet, dan is het geen bevinding.
3. Fix de zwaarste eerst; houd fixes klein en test ze.
4. **Test guards echt.** Voorbeeld dat een bug ving:
   `bunx tsx` met een lijstje bypass-URL's tegen `assertSafeExternalUrl`.
5. `bun run typecheck && bun run lint && bun run build`, dan committen.

## Openstaand / te verifiëren

- `supabase/config.toml` verwijst naar een ander project dan productie
  (`wydyuzplgeisrgobzfge`). Controleer vóór een `db push` welk project gelinkt is,
  en verifieer in de live database:
  `select tablename, policyname from pg_policies where policyname = 'dev_open_all';`
  `select id, public from storage.buckets where id = 'client-uploads';` (moet `false`)
- Er is **nergens rate limiting** (server functions, publieke token-endpoints,
  `/api/public/v1/*`). Bij misbruik is dit de eerstvolgende laag.
- Klanten kunnen via RLS hun eigen uploads op `approved` zetten en een concept
  naar `scheduled` schuiven; de goedkeuringsflow is nu vooral client-side.
