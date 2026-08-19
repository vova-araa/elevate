-- Gat in de vorige rechten-ronde: `revoke ... from authenticated, anon` haalt
-- niet de standaard PUBLIC-grant weg die elke nieuw aangemaakte functie in
-- Postgres krijgt. Functies die ná die migratie zijn toegevoegd —
-- current_user_roles() en touch_updated_at() — bleven daardoor aanroepbaar
-- door `anon`, dus met de publieke sleutel die in elke browser zit.
--
-- current_user_roles() is SECURITY DEFINER; voor een anonieme aanroeper is
-- auth.uid() null en komt er niets uit, maar een SECURITY DEFINER-functie open
-- laten staan voor anon is precies wat de vorige ronde wilde dichtzetten.
--
-- service_role en authenticated hebben expliciete grants en verliezen niets.
revoke execute on all functions in schema public from public;

grant execute on function public.current_user_roles() to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.user_has_client_access(uuid, uuid) to authenticated;

-- Voorkomt dat de volgende nieuwe functie hetzelfde gat opnieuw opent.
alter default privileges in schema public revoke execute on functions from public;
