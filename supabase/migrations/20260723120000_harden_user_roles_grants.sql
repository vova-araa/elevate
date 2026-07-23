-- Defense-in-depth voor rollen. user_roles wordt UITSLUITEND server-side
-- (service_role) geschreven via de admin-functies (setUserRole/inviteUser).
-- RLS blokkeert schrijven door niet-admins al via de policy "roles_admin_manage"
-- (WITH CHECK is_admin(auth.uid())). Uit de oude dev-migratie staan echter nog
-- ruime table-grants voor anon/authenticated open. We trekken de schrijf-grants
-- op user_roles in, zodat privilege-escalatie (een klant die zichzelf admin
-- maakt) onmogelijk blijft — ook als er ooit per ongeluk een ruimere RLS-policy
-- wordt toegevoegd of RLS tijdelijk uitstaat.
revoke insert, update, delete on public.user_roles from anon, authenticated;
