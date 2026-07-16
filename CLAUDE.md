# Elevate Social — richtlijnen voor Claude Code

Nederlands social-media-agency platform. UI-taal is **Nederlands**; codecommentaar mag Nederlands of Engels zijn, wees consistent per bestand.

## Commands

- `bun install` — dependencies (bun is de package manager; lockfile is `bun.lock`)
- `bun run dev` — dev-server
- `bun run build` — productie-build (moet groen zijn vóór elke commit)
- `bun run typecheck` — `tsc --noEmit`
- `bun run lint` — ESLint

## Architectuur

- **TanStack Start** (React 19): file-based routes in `src/routes/`. `routeTree.gen.ts` is GEGENEREERD — nooit met de hand bewerken; hij wordt bij `dev`/`build` opnieuw gegenereerd zodra je route-bestanden toevoegt.
- **Server functions**: `createServerFn` + `requireSupabaseAuth` middleware (zie `src/lib/*.functions.ts`). Admin-check via het `assertAdmin`-patroon. Bestanden met `.server.ts` suffix worden nooit in de client gebundeld.
- **Supabase**: client-side `@/integrations/supabase/client`, server-side (service role) `@/integrations/supabase/client.server`. Types in `integrations/supabase/types.ts` — bij schemawijzigingen zowel een migration in `supabase/migrations/` toevoegen als types.ts bijwerken.
- **AI**: alle AI-aanroepen via `src/lib/ai-provider.server.ts` (Anthropic Claude API — `generateText`, `generateJson`, `runToolLoop`). Nooit rechtstreeks fetchen naar AI-endpoints elders in de code.
- **Publiceren**: direct via eigen OAuth-koppelingen (`src/lib/social-oauth.server.ts`, `social-publish.server.ts`, `channels.functions.ts`); callback op `/api/public/oauth/callback`.

## UI-conventies

- Thema: licht goud/cream met dark mode. Tokens: `text-gold`, `bg-gradient-gold`, `border-gold/10`, `bg-luxe`. Cards: `rounded-xl border border-gold/10 bg-card`.
- shadcn/ui-componenten uit `src/components/ui/`; icons `lucide-react`; toasts `sonner`; forms `react-hook-form` + zod.
- Data-fetching met TanStack Query (query keys als kebab-case strings, invalidate na mutaties). Globale UI-state in Zustand stores (`src/lib/stores/`).
- Datums met date-fns v4 + `nl` locale.

## Let op

- `.env` bevat alleen publieke (publishable) waarden en is gecommit; secrets horen in de deploy-omgeving (zie `.env.example`).
- Command palette (⌘K) leeft in `src/components/command-palette.tsx` — nieuwe admin-routes daar ook toevoegen aan `NAV_ITEMS`, plus in `admin-sidebar.tsx` en de `TITLES`-map in `admin-topbar.tsx`.
