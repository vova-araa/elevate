-- Beeldsjablonen: een opgeslagen recept dat je in één klik op nieuw beeld zet.
--
-- Het punt is herhaalbaarheid. Een klant heeft een look — een kleurgrade, een
-- vaste beeldverhouding, een tekststijl — en die moet elke post opnieuw exact
-- zo zijn. Nu stelt iemand dat elke keer met de hand in, en dus wijkt het elke
-- keer een beetje af.
--
-- `client_id` leeg = sjabloon voor het hele bureau (bv. de eigen huisstijl).

create table if not exists public.editor_templates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  name text not null,
  -- Belichting, contrast, verzadiging, warmte, tint, fade, vignet, korrel.
  grade jsonb not null default '{}'::jsonb,
  -- Beeldverhouding als getal (1 = vierkant, 0.5625 = 9:16); leeg = vrij.
  aspect numeric,
  -- Tekstlagen met positie, lettertype en kleur.
  layers jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.editor_templates is
  'Herbruikbare beeldsjablonen (kleurgrade, verhouding, tekstlagen). client_id leeg = bureaubreed.';

create index if not exists editor_templates_client_idx
  on public.editor_templates (client_id, name);

alter table public.editor_templates enable row level security;

-- Bureaubrede sjablonen zijn voor iedereen met toegang zichtbaar; klantgebonden
-- sjablonen alleen voor wie bij die klant mag. Beheren blijft aan admins.
create policy "editor_templates_select_access" on public.editor_templates
  for select to authenticated
  using (client_id is null or public.user_has_client_access(auth.uid(), client_id));
create policy "editor_templates_admin_manage" on public.editor_templates
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

revoke all on public.editor_templates from anon;
grant select, insert, update, delete on public.editor_templates to authenticated;
