-- Intake-vragenlijst en content-strategie per klant.
--
-- client_intake: een gerichte strategische vragenlijst (positionering, doelgroep,
-- doelen, tone-of-voice, concurrenten, contentvoorkeuren, platforms/frequentie,
-- belangrijke data, dos/don'ts) die de basis vormt voor de AI-strategie.
--
-- client_strategy: de (door AI gegenereerde of handmatig ingestelde) strategie
-- van een klant — positionering, doelgroep, tone, content-pijlers, cadans
-- (posts per platform per week), doelen en dos/don'ts. Deze strategie wordt
-- vanaf nu standaard als context meegegeven bij het genereren van content-
-- plannen (zie campaigns.functions.ts#fetchClientContext) en weekplanningen
-- (zie strategy.functions.ts#generateWeekPlan).
create table public.client_intake (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  answers jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'completed')),
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table public.client_strategy (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  positioning text,
  audience text,
  tone text,
  pillars jsonb default '[]',
  cadence jsonb default '{}',
  goals text,
  dos jsonb default '[]',
  donts jsonb default '[]',
  source text not null default 'ai' check (source in ('ai', 'manual')),
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

grant select, insert, update, delete on public.client_intake to authenticated;
grant all on public.client_intake to service_role;
grant select, insert, update, delete on public.client_strategy to authenticated;
grant all on public.client_strategy to service_role;

alter table public.client_intake enable row level security;
alter table public.client_strategy enable row level security;

-- Zelfde patroon als strategy_notes: admins mogen alles beheren, klanten mogen
-- uitsluitend hun eigen rij lezen (bv. voor een toekomstige klantportaal-
-- weergave). Schrijven gebeurt in de praktijk via de server functions met de
-- service-role client (zie strategy.functions.ts), waardoor de admin-check
-- daar plaatsvindt en niet direct vanuit de browser met de anon/authenticated
-- rol.
create policy "client_intake_admin_manage" on public.client_intake
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "client_intake_select_access" on public.client_intake
  for select to authenticated
  using (public.user_has_client_access(auth.uid(), client_id));

create policy "client_strategy_admin_manage" on public.client_strategy
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "client_strategy_select_access" on public.client_strategy
  for select to authenticated
  using (public.user_has_client_access(auth.uid(), client_id));

create trigger trg_client_intake_updated
  before update on public.client_intake
  for each row execute function public.touch_updated_at();

create trigger trg_client_strategy_updated
  before update on public.client_strategy
  for each row execute function public.touch_updated_at();

create index idx_client_intake_client on public.client_intake (client_id);
create index idx_client_strategy_client on public.client_strategy (client_id);
