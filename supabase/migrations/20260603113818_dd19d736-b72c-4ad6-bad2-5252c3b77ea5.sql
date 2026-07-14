CREATE OR REPLACE FUNCTION public.notify_admins_on_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  admin_record record;
  client_name text;
  is_media boolean;
  kind text;
  day_str text;
  link_url text;
  cal_date date;
begin
  -- Only notify for images and videos
  is_media := coalesce(new.file_type, '') ilike 'image/%' or coalesce(new.file_type, '') ilike 'video/%';
  if not is_media then
    return new;
  end if;

  kind := case when coalesce(new.file_type,'') ilike 'video/%' then 'video' else 'afbeelding' end;

  select name into client_name from public.clients where id = new.client_id;

  -- Try to find the date of the linked calendar item
  if new.calendar_item_id is not null then
    select date into cal_date from public.calendar_items where id = new.calendar_item_id;
  end if;

  day_str := to_char(coalesce(cal_date, (new.created_at at time zone 'Europe/Amsterdam')::date), 'YYYY-MM-DD');
  link_url := '/admin/planner?clientId=' || new.client_id::text || '&view=day&date=' || day_str;

  for admin_record in select user_id from public.user_roles where role = 'admin' loop
    insert into public.notifications (user_id, type, title, body, link)
    values (
      admin_record.user_id,
      'new_upload',
      'Nieuwe ' || kind || ': ' || coalesce(client_name, 'klant'),
      coalesce(new.file_name, 'bestand') || ' is geüpload',
      link_url
    );
  end loop;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS uploads_notify_admins ON public.uploads;
CREATE TRIGGER uploads_notify_admins
  AFTER INSERT ON public.uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_upload();