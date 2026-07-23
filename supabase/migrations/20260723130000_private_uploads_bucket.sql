-- Media-opslag privé maken. De bucket client-uploads stond sinds de dev-migratie
-- op public = true, waardoor iedereen met het pad (client-UUID + bestandsnaam)
-- concept-/klantmedia buiten RLS om kon opvragen. We zetten hem op privé; de app
-- gebruikt overal kortlevende ondertekende URL's (1 uur) — zowel in de UI-previews
-- als bij het publiceren (het platform haalt de media binnen dat uur op).
--
-- LET OP: draai deze migratie pas NADAT de bijbehorende code-deploy live is,
-- anders tonen previews en publiceren kortstondig een 404.
update storage.buckets set public = false where id = 'client-uploads';
