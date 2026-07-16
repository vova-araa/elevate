# Live gaan — stappenplan (±20 minuten)

Volg dit van boven naar beneden. Na Deel 1 staat de app live; na Deel 2 kunnen
klanten met één klik hun socials koppelen.

---

## Deel 1 — De app live zetten op Vercel (±15 min)

### 1. Zet de code op je eigen main-branch

De vernieuwde app staat op de branch `claude/app-renewal-claude-code-gg6n7z`.
Maak er op GitHub een pull request van naar `main` en merge hem (of deploy
rechtstreeks vanaf deze branch — kan ook).

### 2. Database bijwerken (eenmalig, 2 min)

Er zijn twee nieuwe database-migraties. Open je Supabase-project →
**SQL Editor** → plak en draai de inhoud van deze twee bestanden (in deze volgorde):

1. `supabase/migrations/20260714120000_post_comments.sql`
2. `supabase/migrations/20260715120000_team_roles.sql`

### 3. Vercel-project aanmaken

1. Ga naar <https://vercel.com/new> en log in (met je GitHub-account is het makkelijkst).
2. **Import** je repository `vova-araa/elevate`.
3. Instellingen bij het importeren:
   - **Framework Preset**: Other
   - **Install Command**: `bun install`
   - **Build Command**: `bun run build`
   - **Output Directory**: leeg laten (Vercel herkent de build vanzelf)
4. Voeg onder **Environment Variables** deze toe:

   | Naam | Waarde |
   | --- | --- |
   | `NITRO_PRESET` | `vercel` |
   | `SUPABASE_URL` | staat al in je `.env` |
   | `SUPABASE_PUBLISHABLE_KEY` | staat al in je `.env` |
   | `VITE_SUPABASE_URL` | zelfde als SUPABASE_URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | zelfde als publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` (geheim!) |
   | `ANTHROPIC_API_KEY` | console.anthropic.com → API keys |
   | `CRON_SECRET` | verzin zelf een lang wachtwoord |

   (De social-keys uit Deel 2 voeg je later toe — de app werkt ook zonder.)

5. Klik **Deploy**. Na een paar minuten heb je een adres als
   `https://elevate-xxx.vercel.app`. Eigen domein koppelen kan later via
   *Settings → Domains*.

### 4. Controleer

- Open het adres → login-pagina zichtbaar? ✓
- Log in met je admin-account → dashboard zichtbaar? ✓
- AI Studio → genereer een caption (test van de Anthropic-key) ✓

---

## Deel 2 — Socials aanzetten zodat klanten kunnen koppelen

> Dit is **eenmalig voor jullie bureau** (per platform ±10 min). Daarna kan
> elke klant voor altijd zelf koppelen: klik → akkoord → klaar.

1. Open in de live app **Beheer → Kanalen**.
2. Elk platform dat nog niet is ingesteld toont **"⚙ Eenmalig instellen"** —
   klap open en volg de stappen (met kopieerknop voor de redirect-URI).
   Uitgebreide uitleg per platform: [KOPPELINGEN.md](KOPPELINGEN.md).
3. Zet de gekregen codes in Vercel → *Settings → Environment Variables* →
   **Redeploy** (Deployments → ⋯ → Redeploy).
4. Terug in Kanalen: de kaart is nu een **Koppelen**-knop. Test hem met je
   eigen account.

Volgorde-advies: begin met **Meta (Instagram + Facebook)** — één registratie
voor beide platforms. Daarna TikTok, dan LinkedIn.

**Klanten laten koppelen vóór de app-review van Meta/TikTok?** Voeg hun
account tijdelijk toe als *tester* in het developer-portaal, of dien de review
in (kort formulier) zodat het voor iedereen werkt.

---

## Daarna (optioneel)

- **Automatiseringen**: laat een cron elke 15 min `https://JOUW-DOMEIN/api/public/automation-tick?secret=JOUW_CRON_SECRET`
  aanroepen (bv. via cron-job.org of een Vercel Cron zonder secret in de URL +
  header). Nodig voor alerts en geplande automatiseringen.
- **Eigen domein** + `APP_URL` zetten (mooiere redirect-URI's).
- **PDF-rapporten, campagnes, bulk-import** werken direct — geen extra setup.
