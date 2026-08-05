-- Robuuste rol-detectie voor de ingelogde gebruiker. De app las rollen
-- rechtstreeks uit user_roles, maar die RLS-policy roept is_admin() aan; als de
-- rol `authenticated` die functie niet mag uitvoeren, faalt de query en wordt
-- de gebruiker onterecht als 'client' behandeld. Deze SECURITY DEFINER-functie
-- omzeilt dat volledig: ze leest alleen de rollen van de aanroeper zelf en
-- vereist geen rechten op is_admin of op de tabel.
create or replace function public.current_user_roles()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(role::text), array[]::text[])
  from public.user_roles
  where user_id = auth.uid();
$$;

grant execute on function public.current_user_roles() to authenticated;

-- Herstel ook de standaard-rechten zodat de bestaande is_admin()-gebaseerde
-- policies weer werken voor ingelogde gebruikers.
grant execute on all functions in schema public to authenticated;
