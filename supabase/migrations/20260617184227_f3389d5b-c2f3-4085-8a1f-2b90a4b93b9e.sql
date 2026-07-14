DROP POLICY IF EXISTS deals_select_access ON public.deals;
DROP POLICY IF EXISTS wh_select_access ON public.webhook_endpoints;

CREATE TABLE IF NOT EXISTS public.client_secrets (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  postiz_api_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.client_secrets TO service_role;

ALTER TABLE public.client_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_secrets_admin_only ON public.client_secrets;
CREATE POLICY client_secrets_admin_only ON public.client_secrets
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS client_secrets_touch_updated_at ON public.client_secrets;
CREATE TRIGGER client_secrets_touch_updated_at
  BEFORE UPDATE ON public.client_secrets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.client_secrets (client_id, postiz_api_key)
SELECT id, postiz_api_key FROM public.clients WHERE postiz_api_key IS NOT NULL
ON CONFLICT (client_id) DO UPDATE SET postiz_api_key = EXCLUDED.postiz_api_key;

ALTER TABLE public.clients DROP COLUMN IF EXISTS postiz_api_key;