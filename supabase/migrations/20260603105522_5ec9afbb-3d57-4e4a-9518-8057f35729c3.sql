ALTER TABLE public.social_connections ADD COLUMN IF NOT EXISTS connection_id text;
CREATE INDEX IF NOT EXISTS idx_social_conn_connection_id ON public.social_connections(connection_id);