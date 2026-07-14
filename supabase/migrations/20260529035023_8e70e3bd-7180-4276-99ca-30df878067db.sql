
-- ============ ENUMS ============
create type public.app_role as enum ('admin', 'client');
create type public.roadmap_status as enum ('draft', 'active', 'completed', 'archived');
create type public.step_status as enum ('pending', 'in_progress', 'completed');
create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.deliverable_type as enum ('image', 'video', 'copy', 'document', 'other');
create type public.calendar_status as enum ('pending', 'delivered', 'approved');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company text,
  avatar_url text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_role(_user_id, 'admin') $$;

-- ============ CLIENTS ============
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  description text,
  logo_url text,
  brand_color text default '#D4B97A',
  website text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(client_id, user_id)
);

create or replace function public.user_has_client_access(_user_id uuid, _client_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.has_role(_user_id, 'admin')
    or exists(select 1 from public.client_members where user_id = _user_id and client_id = _client_id)
$$;

-- ============ ROADMAPS ============
create table public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  status public.roadmap_status not null default 'draft',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roadmap_steps (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.roadmaps(id) on delete cascade,
  step_order int not null default 0,
  title text not null,
  description text,
  due_date date,
  status public.step_status not null default 'pending',
  deliverable_type public.deliverable_type default 'other',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ TASKS ============
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  step_id uuid references public.roadmap_steps(id) on delete set null,
  assignee_id uuid references auth.users(id),
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_date date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ CALENDAR ITEMS ============
create table public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  step_id uuid references public.roadmap_steps(id) on delete set null,
  date date not null,
  title text not null,
  description text,
  deliverable_type public.deliverable_type not null default 'other',
  status public.calendar_status not null default 'pending',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ UPLOADS ============
create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  calendar_item_id uuid references public.calendar_items(id) on delete set null,
  uploader_id uuid references auth.users(id),
  file_path text not null,
  file_name text not null,
  file_type text,
  file_size bigint,
  caption text,
  created_at timestamptz not null default now()
);

-- ============ NOTIFICATIONS ============
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============ GRANTS ============
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.client_members to authenticated;
grant select, insert, update, delete on public.roadmaps to authenticated;
grant select, insert, update, delete on public.roadmap_steps to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.calendar_items to authenticated;
grant select, insert, update, delete on public.uploads to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.profiles, public.user_roles, public.clients, public.client_members,
  public.roadmaps, public.roadmap_steps, public.tasks, public.calendar_items,
  public.uploads, public.notifications to service_role;

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.clients enable row level security;
alter table public.client_members enable row level security;
alter table public.roadmaps enable row level security;
alter table public.roadmap_steps enable row level security;
alter table public.tasks enable row level security;
alter table public.calendar_items enable row level security;
alter table public.uploads enable row level security;
alter table public.notifications enable row level security;

-- profiles
create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()));
create policy "profiles_update_own_or_admin" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()));
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check (id = auth.uid() or public.is_admin(auth.uid()));

-- user_roles
create policy "roles_select_own_or_admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "roles_admin_manage" on public.user_roles for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- clients
create policy "clients_select_member_or_admin" on public.clients for select to authenticated
  using (public.user_has_client_access(auth.uid(), id));
create policy "clients_admin_manage" on public.clients for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- client_members
create policy "members_select_self_or_admin" on public.client_members for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "members_admin_manage" on public.client_members for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- roadmaps
create policy "roadmaps_select_access" on public.roadmaps for select to authenticated
  using (public.user_has_client_access(auth.uid(), client_id));
create policy "roadmaps_admin_manage" on public.roadmaps for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- roadmap_steps
create policy "steps_select_access" on public.roadmap_steps for select to authenticated
  using (exists(select 1 from public.roadmaps r where r.id = roadmap_id and public.user_has_client_access(auth.uid(), r.client_id)));
create policy "steps_admin_manage" on public.roadmap_steps for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "steps_client_update_status" on public.roadmap_steps for update to authenticated
  using (exists(select 1 from public.roadmaps r where r.id = roadmap_id and public.user_has_client_access(auth.uid(), r.client_id)));

-- tasks
create policy "tasks_select_access" on public.tasks for select to authenticated
  using (public.user_has_client_access(auth.uid(), client_id));
create policy "tasks_admin_manage" on public.tasks for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "tasks_update_assignee" on public.tasks for update to authenticated
  using (assignee_id = auth.uid() or public.user_has_client_access(auth.uid(), client_id));

-- calendar
create policy "cal_select_access" on public.calendar_items for select to authenticated
  using (public.user_has_client_access(auth.uid(), client_id));
create policy "cal_admin_manage" on public.calendar_items for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "cal_client_update_status" on public.calendar_items for update to authenticated
  using (public.user_has_client_access(auth.uid(), client_id));

-- uploads
create policy "uploads_select_access" on public.uploads for select to authenticated
  using (public.user_has_client_access(auth.uid(), client_id));
create policy "uploads_insert_access" on public.uploads for insert to authenticated
  with check (public.user_has_client_access(auth.uid(), client_id) and uploader_id = auth.uid());
create policy "uploads_admin_manage" on public.uploads for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "uploads_delete_own" on public.uploads for delete to authenticated
  using (uploader_id = auth.uid() or public.is_admin(auth.uid()));

-- notifications
create policy "notif_select_own" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notif_update_own" on public.notifications for update to authenticated
  using (user_id = auth.uid());
create policy "notif_insert_authenticated" on public.notifications for insert to authenticated
  with check (true);

-- ============ TRIGGERS ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'client')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.notify_admins_on_upload()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  admin_record record;
  client_name text;
begin
  select name into client_name from public.clients where id = new.client_id;
  for admin_record in select user_id from public.user_roles where role = 'admin' loop
    insert into public.notifications (user_id, type, title, body, link)
    values (
      admin_record.user_id,
      'new_upload',
      'Nieuwe upload: ' || coalesce(client_name, 'klant'),
      coalesce(new.file_name, 'bestand') || ' is geüpload',
      '/admin/clients/' || new.client_id::text
    );
  end loop;
  return new;
end;
$$;

create trigger on_new_upload
  after insert on public.uploads
  for each row execute function public.notify_admins_on_upload();

-- updated_at triggers
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger t_profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger t_clients_updated before update on public.clients for each row execute function public.touch_updated_at();
create trigger t_roadmaps_updated before update on public.roadmaps for each row execute function public.touch_updated_at();
create trigger t_steps_updated before update on public.roadmap_steps for each row execute function public.touch_updated_at();
create trigger t_tasks_updated before update on public.tasks for each row execute function public.touch_updated_at();
create trigger t_cal_updated before update on public.calendar_items for each row execute function public.touch_updated_at();

-- ============ STORAGE ============
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('client-logos', 'client-logos', true),
  ('client-uploads', 'client-uploads', false)
on conflict (id) do nothing;

-- Storage policies
create policy "avatars_public_read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_user_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_user_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "logos_public_read" on storage.objects for select using (bucket_id = 'client-logos');
create policy "logos_admin_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'client-logos' and public.is_admin(auth.uid()));
create policy "logos_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'client-logos' and public.is_admin(auth.uid()));
create policy "logos_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'client-logos' and public.is_admin(auth.uid()));

create policy "client_uploads_read" on storage.objects for select to authenticated
  using (bucket_id = 'client-uploads' and public.user_has_client_access(auth.uid(), ((storage.foldername(name))[1])::uuid));
create policy "client_uploads_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'client-uploads' and public.user_has_client_access(auth.uid(), ((storage.foldername(name))[1])::uuid));
create policy "client_uploads_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'client-uploads' and (public.is_admin(auth.uid()) or (storage.foldername(name))[1] = (select client_id::text from public.uploads where uploader_id = auth.uid() limit 1)));

-- ============ REALTIME ============
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.uploads;
alter publication supabase_realtime add table public.tasks;
