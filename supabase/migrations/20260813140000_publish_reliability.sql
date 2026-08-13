-- Publicatie-betrouwbaarheid: stil mislukken is de meest genoemde klacht over
-- dit soort tools. Een post die niet live gaat zonder dat iemand het merkt kost
-- een bureau direct geloofwaardigheid bij de klant.
--
-- Hiervoor houden we per post bij hoe vaak een publicatie is geprobeerd en wat
-- voor soort fout het was, zodat we tijdelijke fouten (rate limit, netwerk)
-- automatisch opnieuw kunnen proberen en blijvende fouten (token dood, media
-- geweigerd) meteen kunnen melden in plaats van eindeloos te herhalen.

alter table public.scheduled_posts
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  -- 'transient' = opnieuw proberen, 'permanent' = actie van een mens nodig.
  add column if not exists error_kind text;

comment on column public.scheduled_posts.retry_count is
  'Aantal mislukte publicatiepogingen; boven de limiet stoppen we met opnieuw proberen.';
comment on column public.scheduled_posts.error_kind is
  'transient (netwerk/rate limit, wordt opnieuw geprobeerd) of permanent (token/media, vraagt actie).';

-- Snel de mislukte posts vinden voor de foutenwachtrij op het dashboard.
create index if not exists scheduled_posts_failed_idx
  on public.scheduled_posts (status, scheduled_at desc)
  where status = 'failed';
