-- Historie van social-cijfers per klant/platform. Elke keer dat een koppeling
-- wordt gelegd of ververst (zie channels.functions.ts#refreshChannel en
-- api/public/oauth/callback.ts) en er een bekend volgersaantal is, schrijven we
-- hier een snapshot weg. Zo bouwt de app vanzelf een historie op waaruit
-- volgersgroei kan worden afgeleid — zonder verzonnen cijfers.
create table public.social_metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  platform public.social_platform not null,
  captured_at timestamptz not null default now(),
  followers integer,
  created_at timestamptz default now()
);

create index idx_metrics_snapshots_client_platform_time
  on public.social_metrics_snapshots (client_id, platform, captured_at);

-- Alleen select voor authenticated: snapshots worden uitsluitend door de
-- server (service_role, via supabaseAdmin) weggeschreven bij het koppelen/
-- verversen van een kanaal — nooit rechtstreeks vanuit de browser.
grant select on public.social_metrics_snapshots to authenticated;
grant all on public.social_metrics_snapshots to service_role;

alter table public.social_metrics_snapshots enable row level security;

-- user_has_client_access geeft zelf al true voor admins (zie is_admin-check
-- daarbinnen), dus deze ene policy dekt zowel "admins mogen alles" (select)
-- als "klanten mogen hun eigen client zien".
create policy "metrics_snapshots_select_access" on public.social_metrics_snapshots
  for select to authenticated
  using (public.user_has_client_access(auth.uid(), client_id));
