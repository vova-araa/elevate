-- Publieke intake: een bezoeker op /contact levert naam/e-mail/wensen aan
-- zonder in te loggen. Alleen INSERT vanaf `anon` — geen enkele rol mag
-- lezen via de publieke sleutel, dat gaat via de service-role (toekomstige
-- admin-weergave, of handmatig in het Supabase-dashboard).

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'nieuw',
  bron text,
  naam text not null,
  bedrijf text,
  email text not null,
  telefoon text,
  website text,
  kanalen text[] not null default '{}',
  budgetrange text,
  doel text,
  hoe_gevonden text
);

comment on table public.leads is
  'Intake-aanvragen vanaf de publieke contactpagina. Alleen anon-INSERT; lezen gaat via de service-role.';

alter table public.leads enable row level security;

create policy "leads_insert_anon" on public.leads
  for insert to anon
  with check (true);

-- Geen select/update/delete-policy voor anon of authenticated: RLS staat aan
-- en weigert dus alles behalve de insert hierboven. De service-role
-- (supabaseAdmin) omzeilt RLS sowieso, voor eventueel later admin-gebruik.
revoke all on public.leads from anon, authenticated;
grant insert on public.leads to anon;
