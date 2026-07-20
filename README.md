# Elevate Social

Social-media-agency platform van Elevate Design: een admin-portaal voor het team (planning, publiceren, AI-content, analytics, klantbeheer) en een klantportaal (goedkeuring, kalender, rapporten, berichten).

## Stack

- **Frontend/SSR**: [TanStack Start](https://tanstack.com/start) (React 19, file-based routing, server functions) + Vite 7
- **Styling**: Tailwind CSS 4 + shadcn/ui (goud/cream thema, dark mode)
- **Data**: Supabase (Postgres + RLS, Auth, Storage, migrations in `supabase/migrations/`)
- **Publiceren**: directe OAuth-koppelingen per platform (Instagram, TikTok, LinkedIn, Facebook; YouTube kan gekoppeld worden maar publiceren wordt nog niet ondersteund)
- **AI**: Anthropic Claude API (captions, content-ideeën, hooks/hashtags, AI-assistent met tools, AI Studio)
- **State**: TanStack Query + Zustand

## Lokaal draaien

```sh
bun install
cp .env.example .env   # vul je eigen waarden in (of gebruik de bestaande .env)
bun run dev            # http://localhost:5173
```

### Vereiste omgevingsvariabelen

Zie `.env.example`. Publieke Supabase-waarden staan in `.env`; server-secrets (nooit committen):

| Variabele                                       | Waarvoor                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`                     | Admin-operaties op de server                                                     |
| `ANTHROPIC_API_KEY`                             | Alle AI-features (Claude)                                                        |
| `CLAUDE_MODEL`                                  | Optioneel, default `claude-opus-4-8`                                             |
| `APP_URL`                                       | Publieke basis-URL; OAuth redirect-URI is `${APP_URL}/api/public/oauth/callback` |
| `OAUTH_STATE_SECRET`                            | Optioneel, geheim voor het ondertekenen van de OAuth state                       |
| `META_APP_ID` / `META_APP_SECRET`               | Instagram + Facebook OAuth-app                                                   |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`    | TikTok OAuth-app                                                                 |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth-app                                                               |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`     | YouTube (Google) OAuth-app                                                       |
| `CRON_SECRET`                                   | Beveiliging van `/api/public/automation-tick`                                    |

## Social-koppelingen (direct)

Publiceren en koppelen loopt via eigen OAuth-integraties per platform (`src/lib/social-oauth.server.ts`, `src/lib/social-publish.server.ts`, `src/lib/channels.functions.ts`), met een gedeelde callback op `/api/public/oauth/callback`.

1. Registreer per platform een developer-app: Meta (Instagram + Facebook), TikTok, LinkedIn en Google (YouTube).
2. Stel bij elke app de redirect-URI in op `${APP_URL}/api/public/oauth/callback`.
3. Vul de bijbehorende client-id's/secrets in als server-secrets (zie tabel hierboven).
4. YouTube-publicatie wordt nog niet ondersteund — koppelen en statistieken ophalen werkt al wel.

👉 **Stap-voor-stap in gewone taal: [docs/KOPPELINGEN.md](docs/KOPPELINGEN.md).** De Kanalen-pagina in de app toont bovendien zelf per platform wat er nog ingesteld moet worden (met kopieerknop voor de redirect-URI). `APP_URL` is optioneel — zonder die variabele gebruikt de app automatisch het domein waarop hij draait.

## Build & deploy

🚀 **Live gaan in ±20 minuten: volg [docs/LIVE-GAAN.md](docs/LIVE-GAAN.md).**

```sh
bun run build      # productie-build (Nitro, node-server preset)
bun run start      # draait .output/server/index.mjs
```

Ander deploy-target? Zet `NITRO_PRESET` bij de build, bv. `NITRO_PRESET=vercel bun run build` of `NITRO_PRESET=cloudflare_module bun run build`.

## Scripts

| Script              | Doel                     |
| ------------------- | ------------------------ |
| `bun run dev`       | Dev-server met HMR       |
| `bun run build`     | Productie-build          |
| `bun run start`     | Productie-server starten |
| `bun run typecheck` | TypeScript check         |
| `bun run lint`      | ESLint                   |
| `bun run format`    | Prettier                 |

## Structuur

```
src/
  routes/
    _authenticated/admin/    # admin-portaal (planner, compose, AI Studio, analytics, …)
    _authenticated/client/   # klantportaal (kalender+goedkeuring, rapporten, uploads, …)
    api/public/              # publieke API (v1) + automation-tick cron endpoint
  lib/
    ai-provider.server.ts    # centrale Claude-provider (tekst, JSON, tool-loop)
    *.functions.ts           # server functions (createServerFn)
  components/                # UI-componenten (shadcn in ui/)
  integrations/supabase/     # client, server-client, auth-middleware, generated types
supabase/migrations/         # database-schema (uitvoeren via supabase db push)
```

## Historie

Dit project is oorspronkelijk gebouwd in Lovable en in juli 2026 gemigreerd naar een standalone TanStack Start-app met Claude Code. Daarbij zijn de Lovable build-config, AI-gateway en connector-gateway vervangen door standaard Vite-plugins, de Anthropic Claude API en directe OAuth-koppelingen per social-platform.
