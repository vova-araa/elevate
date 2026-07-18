-- Deelbare goedkeurlinks: klanten kunnen concepten goedkeuren zonder in te loggen.
-- De token zelf staat NOOIT in de database — alleen een sha256-hash. Alle toegang
-- via deze tabel loopt via de service-role client (server functions); anon en
-- authenticated krijgen expliciet geen select, zodat een lek van de anon-key of
-- een ingelogde niet-admin de tokens niet kan aflezen of enumereren.
create table public.approval_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

grant select, insert, update, delete on public.approval_links to authenticated;
grant all on public.approval_links to service_role;

alter table public.approval_links enable row level security;

-- Admins mogen alles (link aanmaken/intrekken/beheren via het admin-dashboard)
create policy "approval_links_admin_manage" on public.approval_links
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Geen select/insert/update/delete-policy voor anon of gewone authenticated
-- gebruikers: de publieke goedkeurpagina en -acties lopen uitsluitend via
-- server functions met de service-role client (token wordt daar gevalideerd).

create index idx_approval_links_client on public.approval_links (client_id);
create index idx_approval_links_token_hash on public.approval_links (token_hash);
