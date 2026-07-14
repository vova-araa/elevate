CREATE TABLE public.ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  briefing text NOT NULL,
  tone text NOT NULL DEFAULT 'professioneel',
  platform text NOT NULL,
  generated_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generations TO authenticated;
GRANT ALL ON public.ai_generations TO service_role;

ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage all ai_generations"
  ON public.ai_generations FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "client members can read own client ai_generations"
  ON public.ai_generations FOR SELECT
  TO authenticated
  USING (
    client_id IS NOT NULL
    AND public.user_has_client_access(auth.uid(), client_id)
  );

CREATE INDEX ai_generations_client_idx ON public.ai_generations(client_id, created_at DESC);