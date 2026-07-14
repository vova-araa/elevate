
-- 1) Extend notification_preferences with new types
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS notify_ai boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_planning boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_automation boolean NOT NULL DEFAULT true;

-- 2) Central enqueue function: respects in_app_enabled + per-type toggle.
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  _user_id uuid,
  _type text,
  _title text,
  _body text,
  _link text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefs public.notification_preferences%ROWTYPE;
  allowed boolean := true;
  new_id uuid;
BEGIN
  SELECT * INTO prefs FROM public.notification_preferences WHERE user_id = _user_id;

  IF FOUND THEN
    IF NOT prefs.in_app_enabled THEN
      RETURN NULL;
    END IF;
    allowed := CASE _type
      WHEN 'new_message'    THEN prefs.notify_new_message
      WHEN 'new_upload'     THEN prefs.notify_new_upload
      WHEN 'approval'       THEN prefs.notify_approval
      WHEN 'publish'        THEN prefs.notify_publish
      WHEN 'failure'        THEN prefs.notify_failure
      WHEN 'task_assigned'  THEN prefs.notify_task_assigned
      WHEN 'ai'             THEN prefs.notify_ai
      WHEN 'planning'       THEN prefs.notify_planning
      WHEN 'automation'     THEN prefs.notify_automation
      ELSE true
    END;
  END IF;

  IF NOT allowed THEN RETURN NULL; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, _title, _body, _link)
  RETURNING id INTO new_id;

  RETURN new_id;
END $$;

GRANT EXECUTE ON FUNCTION public.enqueue_notification(uuid, text, text, text, text)
  TO authenticated, service_role;

-- 3) Update notify_admins_on_upload to use the helper and emit type 'new_upload'
CREATE OR REPLACE FUNCTION public.notify_admins_on_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_record record;
  client_name text;
  is_media boolean;
  kind text;
  day_str text;
  link_url text;
  cal_date date;
BEGIN
  is_media := coalesce(new.file_type, '') ILIKE 'image/%' OR coalesce(new.file_type, '') ILIKE 'video/%';
  IF NOT is_media THEN RETURN new; END IF;

  kind := CASE WHEN coalesce(new.file_type,'') ILIKE 'video/%' THEN 'video' ELSE 'afbeelding' END;
  SELECT name INTO client_name FROM public.clients WHERE id = new.client_id;

  IF new.calendar_item_id IS NOT NULL THEN
    SELECT date INTO cal_date FROM public.calendar_items WHERE id = new.calendar_item_id;
  END IF;

  day_str := to_char(coalesce(cal_date, (new.created_at AT TIME ZONE 'Europe/Amsterdam')::date), 'YYYY-MM-DD');
  link_url := '/admin/planner?clientId=' || new.client_id::text || '&view=day&date=' || day_str;

  FOR admin_record IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.enqueue_notification(
      admin_record.user_id,
      'new_upload',
      'Nieuwe ' || kind || ': ' || coalesce(client_name, 'klant'),
      coalesce(new.file_name, 'bestand') || ' is geüpload',
      link_url
    );
  END LOOP;
  RETURN new;
END $$;

-- 4) Update notify_message_recipients to use the helper
CREATE OR REPLACE FUNCTION public.notify_message_recipients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  client_name text;
  preview text;
BEGIN
  SELECT name INTO client_name FROM public.clients WHERE id = new.client_id;
  preview := left(coalesce(new.subject, new.body), 80);

  IF new.sender_role = 'admin' THEN
    FOR rec IN SELECT user_id FROM public.client_members WHERE client_id = new.client_id LOOP
      IF rec.user_id <> new.sender_id THEN
        PERFORM public.enqueue_notification(
          rec.user_id, 'new_message',
          'Nieuw bericht van Elevate', preview, '/client/messages'
        );
      END IF;
    END LOOP;
  ELSE
    FOR rec IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      IF rec.user_id <> new.sender_id THEN
        PERFORM public.enqueue_notification(
          rec.user_id, 'new_message',
          'Bericht van ' || coalesce(client_name, 'klant'),
          preview, '/admin/clients/' || new.client_id::text
        );
      END IF;
    END LOOP;
  END IF;
  RETURN new;
END $$;
