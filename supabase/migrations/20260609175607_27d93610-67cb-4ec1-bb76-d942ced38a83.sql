-- Extend clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS postiz_organization_id text,
  ADD COLUMN IF NOT EXISTS postiz_api_key text,
  ADD COLUMN IF NOT EXISTS provisioned_at timestamptz;

-- Extend social_connections (handle == account_username already exists)
DO $$ BEGIN
  CREATE TYPE public.social_connection_status AS ENUM ('active','expired','error','pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS postiz_integration_id text,
  ADD COLUMN IF NOT EXISTS follower_count integer,
  ADD COLUMN IF NOT EXISTS status public.social_connection_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS connected_at timestamptz;

-- Provision queue
DO $$ BEGIN
  CREATE TYPE public.provision_status AS ENUM ('pending','processing','done','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.provision_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status public.provision_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id)
);
CREATE INDEX IF NOT EXISTS idx_provision_queue_status ON public.provision_queue(status, last_attempt_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provision_queue TO authenticated;
GRANT ALL ON public.provision_queue TO service_role;
ALTER TABLE public.provision_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pq_admin_manage" ON public.provision_queue
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "pq_client_select" ON public.provision_queue
  FOR SELECT TO authenticated
  USING (public.user_has_client_access(auth.uid(), client_id));
CREATE TRIGGER trg_pq_updated BEFORE UPDATE ON public.provision_queue
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Connection errors
CREATE TABLE IF NOT EXISTS public.connection_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform public.social_platform NOT NULL,
  error_message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conn_err_client ON public.connection_errors(client_id, created_at DESC);
GRANT SELECT, INSERT ON public.connection_errors TO authenticated;
GRANT ALL ON public.connection_errors TO service_role;
ALTER TABLE public.connection_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce_select_access" ON public.connection_errors
  FOR SELECT TO authenticated
  USING (public.user_has_client_access(auth.uid(), client_id));
CREATE POLICY "ce_admin_manage" ON public.connection_errors
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Auto-enqueue: nieuwe client zonder Postiz-org -> in queue
CREATE OR REPLACE FUNCTION public.enqueue_postiz_provision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.postiz_organization_id IS NULL THEN
    INSERT INTO public.provision_queue (client_id, status)
    VALUES (NEW.id, 'pending')
    ON CONFLICT (client_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clients_enqueue_provision ON public.clients;
CREATE TRIGGER trg_clients_enqueue_provision
  AFTER INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_postiz_provision();

-- Backfill: zet bestaande clients zonder org in de queue
INSERT INTO public.provision_queue (client_id, status)
SELECT id, 'pending' FROM public.clients
WHERE postiz_organization_id IS NULL
ON CONFLICT (client_id) DO NOTHING;