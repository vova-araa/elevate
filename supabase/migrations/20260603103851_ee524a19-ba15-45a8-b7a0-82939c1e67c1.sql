CREATE TABLE public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  notify_new_message boolean not null default true,
  notify_new_upload boolean not null default true,
  notify_approval boolean not null default true,
  notify_publish boolean not null default true,
  notify_failure boolean not null default true,
  notify_task_assigned boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prefs_own_select" ON public.notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "prefs_own_insert" ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "prefs_own_update" ON public.notification_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER notification_preferences_touch
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();