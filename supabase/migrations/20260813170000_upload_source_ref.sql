-- Herkomst van een geïmporteerd bestand vastleggen.
--
-- Zonder dit kun je een Drive-map maar één keer fatsoenlijk importeren: bij de
-- tweede keer komt alles dubbel binnen. Met het bron-id erbij wordt importeren
-- een synchronisatie — alleen wat er nog niet is komt erbij, en de klant kan
-- dezelfde link gerust nog eens sturen nadat hij er bestanden aan toevoegde.

alter table public.uploads
  add column if not exists source_ref text;

comment on column public.uploads.source_ref is
  'Bron-identificatie van een geïmporteerd bestand, bv. "drive:1AbC…". Leeg bij directe uploads.';

-- Per klant is een bron-id uniek. Partieel, zodat gewone uploads (source_ref
-- null) er geen last van hebben.
create unique index if not exists uploads_client_source_ref_key
  on public.uploads (client_id, source_ref)
  where source_ref is not null;
