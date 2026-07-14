-- commentaar/feedback per geplande post (approval-flow klantportaal)
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.scheduled_posts(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  author_id uuid not null,
  author_role text not null default 'client',
  body text not null,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.post_comments to authenticated;
grant all on public.post_comments to service_role;

alter table public.post_comments enable row level security;

-- Admins mogen alles
create policy "post_comments_admin_manage" on public.post_comments
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Gebruikers met toegang tot de klant mogen lezen
create policy "post_comments_select_access" on public.post_comments
  for select to authenticated
  using (public.user_has_client_access(auth.uid(), client_id));

-- Gebruikers met toegang tot de klant mogen zelf commentaar plaatsen
create policy "post_comments_insert_access" on public.post_comments
  for insert to authenticated
  with check (
    public.user_has_client_access(auth.uid(), client_id)
    and author_id = auth.uid()
  );

create index idx_post_comments_post on public.post_comments (post_id, created_at);
