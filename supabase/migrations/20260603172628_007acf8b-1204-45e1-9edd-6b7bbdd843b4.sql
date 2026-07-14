
-- 1) Drop dev_open_all policies on public tables
DROP POLICY IF EXISTS dev_open_all ON public.calendar_items;
DROP POLICY IF EXISTS dev_open_all ON public.client_members;
DROP POLICY IF EXISTS dev_open_all ON public.clients;
DROP POLICY IF EXISTS dev_open_all ON public.content_items;
DROP POLICY IF EXISTS dev_open_all ON public.deals;
DROP POLICY IF EXISTS dev_open_all ON public.evaluations;
DROP POLICY IF EXISTS dev_open_all ON public.meetings;
DROP POLICY IF EXISTS dev_open_all ON public.messages;
DROP POLICY IF EXISTS dev_open_all ON public.notifications;
DROP POLICY IF EXISTS dev_open_all ON public.profiles;
DROP POLICY IF EXISTS dev_open_all ON public.reports;
DROP POLICY IF EXISTS dev_open_all ON public.roadmap_steps;
DROP POLICY IF EXISTS dev_open_all ON public.roadmaps;
DROP POLICY IF EXISTS dev_open_all ON public.strategy_notes;
DROP POLICY IF EXISTS dev_open_all ON public.tasks;
DROP POLICY IF EXISTS dev_open_all ON public.uploads;
DROP POLICY IF EXISTS dev_open_all ON public.user_roles;

-- 2) Drop dev storage policies
DROP POLICY IF EXISTS "dev client-uploads write" ON storage.objects;
DROP POLICY IF EXISTS "dev client-uploads delete" ON storage.objects;
DROP POLICY IF EXISTS "dev client-uploads update" ON storage.objects;
DROP POLICY IF EXISTS "dev client-uploads read" ON storage.objects;

-- 3) Fix broken client_uploads_delete policy to match the actual file
DROP POLICY IF EXISTS client_uploads_delete ON storage.objects;
CREATE POLICY client_uploads_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-uploads' AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.uploads u
        WHERE u.uploader_id = auth.uid()
          AND u.file_path = storage.objects.name
      )
    )
  );

-- 4) Restrict social_connections read access: tokens are sensitive, admins only
DROP POLICY IF EXISTS social_conn_select_access ON public.social_connections;
CREATE POLICY social_conn_select_admin ON public.social_connections
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 5) Set search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
