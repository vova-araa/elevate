-- Vrij herschikbaar feed-raster in de mediabibliotheek: sleep media uit de
-- bibliotheek (of vul 'm met wat er al live staat) om te zien hoe de feed er
-- het mooist uitziet, los van een concrete inplanning. Eén rij per
-- klant+platform+positie; een herschikking (drag) vervangt de hele set in
-- één transactie (delete + insert) in plaats van losse posities te
-- verschuiven — dat voorkomt tijdelijk dubbele posities en verweesde gaten.
create table public.feed_arrangement_slots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  platform text not null,
  position integer not null,
  -- Eigen media: verwijst naar de upload, zodat de weergave-URL bij elke
  -- opvraging vers gesigneerd wordt (net als de rest van de mediabibliotheek).
  upload_id uuid references public.uploads(id) on delete cascade,
  -- Live/gepubliceerde post: een momentopname, geen live foreign key. De
  -- media-URL van Instagram/Facebook's Graph API (en onze eigen kortlevende
  -- signed URL als terugval) is niet permanent, dus er is niets stabiels om
  -- naar te verwijzen — "Vul met live feed" ververst deze rijen desgewenst.
  snapshot_media_url text,
  snapshot_caption text,
  snapshot_is_video boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint feed_arrangement_slots_source check (
    upload_id is not null or snapshot_media_url is not null
  )
);

create unique index feed_arrangement_slots_position_uq
  on public.feed_arrangement_slots (client_id, platform, position);

create index feed_arrangement_slots_upload_idx
  on public.feed_arrangement_slots (upload_id);

comment on table public.feed_arrangement_slots is
  'Vrij herschikbaar raster per klant+platform voor de feed-preview in de mediabibliotheek. upload_id = eigen media (live gesigneerd bij opvraging); snapshot_* = momentopname van een live/gepubliceerde post.';

alter table public.feed_arrangement_slots enable row level security;

-- Zelfde patroon als drive_admin_connection/client_secrets: geen directe
-- grants aan authenticated, alles loopt via server functions in
-- feed-arrangement.functions.ts (requireSupabaseAuth + assertClientAccess,
-- daarna supabaseAdmin) — niet via RLS-policies op deze tabel zelf.
revoke all on public.feed_arrangement_slots from anon, authenticated;
grant all on public.feed_arrangement_slots to service_role;
