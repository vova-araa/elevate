
CREATE TABLE public.media_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_folders TO authenticated;
GRANT ALL ON public.media_folders TO service_role;

ALTER TABLE public.media_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_folders_select" ON public.media_folders FOR SELECT TO authenticated
  USING (public.user_has_client_access(auth.uid(), client_id));
CREATE POLICY "media_folders_admin_manage" ON public.media_folders FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER media_folders_touch BEFORE UPDATE ON public.media_folders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.uploads ADD COLUMN folder_id uuid REFERENCES public.media_folders(id) ON DELETE SET NULL;
CREATE INDEX uploads_folder_id_idx ON public.uploads(folder_id);
