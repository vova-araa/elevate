-- Deelbare koppel-links: een bedrijfseigenaar kan zijn eigen social-accounts
-- koppelen zonder in te loggen. Exact hetzelfde patroon als approval_links:
-- het token zelf staat NOOIT in de database — alleen een sha256-hash. Alle
-- toegang via deze tabel loopt via de service-role client (server functions);
-- anon en authenticated krijgen expliciet geen select, zodat een lek van de
-- anon-key of een ingelogde niet-admin de tokens niet kan aflezen of
-- enumereren.
create table public.channel_invites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

grant select, insert, update, delete on public.channel_invites to authenticated;
grant all on public.channel_invites to service_role;

alter table public.channel_invites enable row level security;

-- Admins mogen alles (link aanmaken/intrekken/beheren via het admin-dashboard)
create policy "channel_invites_admin_manage" on public.channel_invites
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Geen select/insert/update/delete-policy voor anon of gewone authenticated
-- gebruikers: de publieke koppelpagina en -acties lopen uitsluitend via
-- server functions met de service-role client (token wordt daar gevalideerd).

create index idx_channel_invites_client on public.channel_invites (client_id);
create index idx_channel_invites_token_hash on public.channel_invites (token_hash);
