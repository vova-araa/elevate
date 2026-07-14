
-- Enums
CREATE TYPE public.social_platform AS ENUM ('instagram','tiktok','linkedin','youtube','facebook');
CREATE TYPE public.scheduled_post_status AS ENUM ('draft','scheduled','publishing','published','failed');

-- social_connections
CREATE TABLE public.social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform public.social_platform NOT NULL,
  account_id text,
  account_username text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, platform)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_connections TO authenticated;
GRANT ALL ON public.social_connections TO service_role;

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_conn_admin_manage" ON public.social_connections
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "social_conn_select_access" ON public.social_connections
  FOR SELECT TO authenticated USING (public.user_has_client_access(auth.uid(), client_id));

CREATE TRIGGER trg_social_conn_updated
  BEFORE UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- scheduled_posts
CREATE TABLE public.scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform public.social_platform NOT NULL DEFAULT 'instagram',
  caption text,
  media_path text,
  media_type text,
  scheduled_at timestamptz NOT NULL,
  status public.scheduled_post_status NOT NULL DEFAULT 'draft',
  platform_post_id text,
  platform_container_id text,
  error_message text,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_posts TO authenticated;
GRANT ALL ON public.scheduled_posts TO service_role;

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sched_admin_manage" ON public.scheduled_posts
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "sched_select_access" ON public.scheduled_posts
  FOR SELECT TO authenticated USING (public.user_has_client_access(auth.uid(), client_id));
CREATE POLICY "sched_client_update" ON public.scheduled_posts
  FOR UPDATE TO authenticated USING (public.user_has_client_access(auth.uid(), client_id));

CREATE INDEX idx_sched_client_date ON public.scheduled_posts (client_id, scheduled_at);
CREATE INDEX idx_sched_status_date ON public.scheduled_posts (status, scheduled_at);

CREATE TRIGGER trg_sched_updated
  BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('social-media','social-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "social_media_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'social-media' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'social-media' AND public.is_admin(auth.uid()));

CREATE POLICY "social_media_client_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'social-media'
    AND public.user_has_client_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "social_media_client_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'social-media'
    AND public.user_has_client_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
