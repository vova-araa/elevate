
-- Sender role enum
do $$ begin
  create type public.message_sender_role as enum ('admin','client');
exception when duplicate_object then null; end $$;

-- Messages table
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  sender_id uuid not null,
  sender_role public.message_sender_role not null,
  subject text,
  body text not null,
  deliverable_type public.deliverable_type,
  due_date date,
  priority public.task_priority not null default 'medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_messages_client_created on public.messages(client_id, created_at desc);

grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;

alter table public.messages enable row level security;

create policy messages_select_access on public.messages
  for select to authenticated
  using (public.user_has_client_access(auth.uid(), client_id));

create policy messages_insert_access on public.messages
  for insert to authenticated
  with check (
    public.user_has_client_access(auth.uid(), client_id)
    and sender_id = auth.uid()
  );

create policy messages_admin_manage on public.messages
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create trigger messages_touch
  before update on public.messages
  for each row execute function public.touch_updated_at();

-- Notify trigger: notify the other party (admins or client members)
create or replace function public.notify_message_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  client_name text;
  preview text;
begin
  select name into client_name from public.clients where id = new.client_id;
  preview := left(coalesce(new.subject, new.body), 80);

  if new.sender_role = 'admin' then
    -- notify all client members
    for rec in select user_id from public.client_members where client_id = new.client_id loop
      if rec.user_id <> new.sender_id then
        insert into public.notifications (user_id, type, title, body, link)
        values (
          rec.user_id, 'new_message',
          'Nieuw bericht van Elevate',
          preview,
          '/client/messages'
        );
      end if;
    end loop;
  else
    -- notify all admins
    for rec in select user_id from public.user_roles where role = 'admin' loop
      if rec.user_id <> new.sender_id then
        insert into public.notifications (user_id, type, title, body, link)
        values (
          rec.user_id, 'new_message',
          'Bericht van ' || coalesce(client_name, 'klant'),
          preview,
          '/admin/clients/' || new.client_id::text
        );
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_message_recipients();

-- Realtime
alter table public.messages replica identity full;
alter publication supabase_realtime add table public.messages;
