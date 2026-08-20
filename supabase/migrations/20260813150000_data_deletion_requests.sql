-- Meta verplicht een "Data Deletion Request Callback": een endpoint dat Meta
-- aanroept wanneer een gebruiker de app-koppeling in zijn Facebook-instellingen
-- verwijdert. Het antwoord moet een bevestigingscode én een status-URL bevatten
-- waar die gebruiker de voortgang kan volgen. Daarvoor moeten we het verzoek
-- vastleggen — vandaar deze tabel.

create table if not exists public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  -- Bevestigingscode die we aan Meta teruggeven en die de gebruiker invult op
  -- de statuspagina. Geen persoonsgegeven, wel raadbaar-gevoelig: daarom random.
  confirmation_code text not null unique,
  platform text not null default 'meta',
  -- App-scoped user id van het platform. Dit is geen e-mail of naam; het is het
  -- enige dat Meta ons meestuurt om de koppeling te herkennen.
  platform_user_id text not null,
  status text not null default 'received',
  -- Wat er daadwerkelijk is verwijderd, voor de audittrail.
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.data_deletion_requests is
  'Verwijderverzoeken vanuit platform-callbacks (Meta data deletion). Alleen benaderbaar via de service role.';

create index if not exists data_deletion_requests_platform_user_idx
  on public.data_deletion_requests (platform, platform_user_id);

-- Dichtgetimmerd: het endpoint en de statuspagina draaien allebei server-side
-- met de service role. Geen enkele client-rol mag hier direct bij.
alter table public.data_deletion_requests enable row level security;
revoke all on public.data_deletion_requests from anon, authenticated;
