-- Team & rollen: nieuwe rol 'viewer', klant-toewijzingen per teamlid, en een audit-log.
-- ADDITIEF: raakt geen bestaande policies of tabellen aan.

alter type public.app_role add value if not exists 'viewer';

-- client_assignments: welke teamleden aan welke klant zijn toegewezen (rol-/toewijzingsconcept,
-- los van de bestaande client_members-koppeling die klanttoegang bepaalt)
create table public.client_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null,
  note text,
  assigned_by uuid,
  created_at timestamptz not null default now(),
  unique(client_id, user_id)
);

grant select, insert, update, delete on public.client_assignments to authenticated;
grant all on public.client_assignments to service_role;

alter table public.client_assignments enable row level security;

-- Admins mogen alles
create policy "client_assignments_admin_manage" on public.client_assignments
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Een gebruiker mag zijn eigen toewijzingen zien
create policy "client_assignments_select_own" on public.client_assignments
  for select to authenticated
  using (user_id = auth.uid());

create index idx_client_assignments_user on public.client_assignments (user_id);
create index idx_client_assignments_client on public.client_assignments (client_id);

-- activity_log: audittrail voor teambeheer-acties (rolwijzigingen, toewijzingen, etc.)
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);

grant select on public.activity_log to authenticated;
grant all on public.activity_log to service_role;

alter table public.activity_log enable row level security;

-- Alleen admins mogen de activiteitenlog lezen; inserts gebeuren uitsluitend via service_role
-- (geen insert-policy voor authenticated).
create policy "activity_log_admin_select" on public.activity_log
  for select to authenticated
  using (public.is_admin(auth.uid()));

create index idx_activity_log_created_at on public.activity_log (created_at desc);
