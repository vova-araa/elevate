-- Eén Google Drive-koppeling voor het hele bureau (elevate.plannen@gmail.com),
-- los van de per-klant social-koppelingen in social_connections. Bedoeld om
-- alles te doorzoeken wat met dat account gedeeld is, niet om te publiceren.
--
-- Bevat OAuth-tokens: net als social_connections' token-kolommen uitsluitend
-- via de service-role leesbaar/schrijfbaar (server functions met assertAdmin).
-- Geen grants naar authenticated — de admin-UI leest de status via een
-- server function die nooit de ruwe tokens teruggeeft.
create table public.drive_admin_connection (
  id uuid primary key default gen_random_uuid(),
  account_email text not null unique,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.drive_admin_connection is
  'Eén rij per gekoppeld Drive-account (in de praktijk: elevate.plannen@gmail.com). Uitsluitend via service-role.';

alter table public.drive_admin_connection enable row level security;

-- RLS staat aan zonder policies: iedere rol behalve service_role krijgt dus
-- niets, ook al zou er per ongeluk een GRANT bijkomen.
revoke all on public.drive_admin_connection from anon, authenticated;
grant all on public.drive_admin_connection to service_role;

create trigger trg_drive_admin_connection_updated
  before update on public.drive_admin_connection
  for each row execute function public.touch_updated_at();
