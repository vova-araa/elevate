-- Aanleverlijst: wat moet de klant nog aanleveren?
--
-- In de praktijk gaat dit per WhatsApp en e-mail, en dan verdwijnt het. De klant
-- weet niet meer wat er van hem wordt verwacht en het bureau moet er achteraan.
-- Met een expliciete lijst per klant staat het op één plek, ziet de klant zijn
-- eigen voortgang, en telt een upload automatisch mee.

create table if not exists public.delivery_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  -- media = beeld/video, info = tekst of gegevens, access = toegang/koppeling,
  -- approval = akkoord geven. Bepaalt alleen het icoon en de call-to-action.
  kind text not null default 'media',
  -- Hoeveel bestanden er nodig zijn. Alleen zinvol bij kind = 'media'.
  quantity_needed integer not null default 1 check (quantity_needed between 1 and 100),
  due_date date,
  -- open → klant moet iets doen; submitted → aangeleverd, bureau checkt;
  -- done → afgerond.
  status text not null default 'open' check (status in ('open', 'submitted', 'done')),
  created_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.delivery_requests is
  'Wat een klant nog moet aanleveren. Zichtbaar in het klantportaal, beheerd door admins.';

create index if not exists delivery_requests_client_open_idx
  on public.delivery_requests (client_id, status, due_date);

-- Een upload kan aan een verzoek hangen, zodat de voortgang vanzelf meetelt.
alter table public.uploads
  add column if not exists delivery_request_id uuid
    references public.delivery_requests(id) on delete set null;

create index if not exists uploads_delivery_request_idx
  on public.uploads (delivery_request_id)
  where delivery_request_id is not null;

alter table public.delivery_requests enable row level security;

-- Klanten zien de verzoeken van hun eigen bedrijf en mogen de status bijwerken
-- (aanvinken dat ze het hebben aangeleverd). Aanmaken en verwijderen blijft aan
-- het bureau — anders kan een klant zijn eigen lijst leegmaken.
create policy "delivery_select_access" on public.delivery_requests for select to authenticated
  using (public.user_has_client_access(auth.uid(), client_id));
create policy "delivery_admin_manage" on public.delivery_requests for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "delivery_client_update_status" on public.delivery_requests for update to authenticated
  using (public.user_has_client_access(auth.uid(), client_id))
  with check (public.user_has_client_access(auth.uid(), client_id));

revoke all on public.delivery_requests from anon;
grant select, update on public.delivery_requests to authenticated;
grant insert, delete on public.delivery_requests to authenticated;
