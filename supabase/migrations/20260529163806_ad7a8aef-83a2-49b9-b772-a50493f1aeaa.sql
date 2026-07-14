
-- TEMP: login uitgeschakeld. Open de Data API voor anon zodat de app werkt zonder ingelogde gebruiker.
-- Aan het einde (wanneer auth weer aan staat) moeten deze open policies/grants vervangen worden.

-- 1) Grants voor anon (en authenticated, voor de zekerheid) op alle relevante public-tables.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients','client_members','calendar_items','content_items','deals','evaluations',
    'meetings','messages','notifications','profiles','reports','roadmaps','roadmap_steps',
    'strategy_notes','tasks','uploads','user_roles'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- 2) Open RLS policies voor anon (TEMP — dev mode zonder login).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients','client_members','calendar_items','content_items','deals','evaluations',
    'meetings','messages','notifications','profiles','reports','roadmaps','roadmap_steps',
    'strategy_notes','tasks','uploads','user_roles'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS dev_open_all ON public.%I', t);
    EXECUTE format('CREATE POLICY dev_open_all ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- 3) Storage: client-uploads publiek lezen + anon write tijdens dev.
UPDATE storage.buckets SET public = true WHERE id = 'client-uploads';

DROP POLICY IF EXISTS "dev client-uploads read"  ON storage.objects;
DROP POLICY IF EXISTS "dev client-uploads write" ON storage.objects;
DROP POLICY IF EXISTS "dev client-uploads update" ON storage.objects;
DROP POLICY IF EXISTS "dev client-uploads delete" ON storage.objects;

CREATE POLICY "dev client-uploads read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('client-uploads','client-logos','avatars'));

CREATE POLICY "dev client-uploads write"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id IN ('client-uploads','client-logos','avatars'));

CREATE POLICY "dev client-uploads update"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id IN ('client-uploads','client-logos','avatars'));

CREATE POLICY "dev client-uploads delete"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id IN ('client-uploads','client-logos','avatars'));
