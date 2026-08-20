-- TikTok (en straks ook Instagram-video) verwerkt asynchroon: onze upload wordt
-- aangenomen en pas daarna beoordeeld. "Upload gelukt" is dus niet "staat live".
-- Deze kolom onthoudt of we het eindoordeel van het platform al binnen hebben,
-- zodat de tick niet eindeloos dezelfde post blijft navragen.

alter table public.scheduled_posts
  add column if not exists platform_verified_at timestamptz;

comment on column public.scheduled_posts.platform_verified_at is
  'Wanneer het platform de publicatie definitief bevestigde of afkeurde; leeg = oordeel nog niet binnen.';
