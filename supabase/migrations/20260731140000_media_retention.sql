-- Media-retentie: bestanden worden 30 dagen na publicatie uit de opslag
-- verwijderd om onder de opslaglimiet te blijven, MAAR de registratie blijft
-- bestaan (rij + caption + platform + publicatiedatum). Zo zie je altijd dat een
-- stuk media al gebruikt/gepubliceerd is (voorkomt dubbel plaatsen), terwijl de
-- GB's elke maand weer vrijkomen. `media_purged_at` = tijdstip waarop het
-- bestand is opgeruimd; is het null, dan staat het bestand nog in de opslag.
alter table public.scheduled_posts add column if not exists media_purged_at timestamptz;
alter table public.uploads add column if not exists media_purged_at timestamptz;

comment on column public.scheduled_posts.media_purged_at is
  'Tijdstip waarop het mediabestand uit storage is verwijderd; registratie blijft behouden.';
comment on column public.uploads.media_purged_at is
  'Tijdstip waarop het mediabestand uit storage is verwijderd; registratie blijft behouden.';
