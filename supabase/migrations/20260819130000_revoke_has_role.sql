-- has_role() wordt nergens rechtstreeks aangeroepen: niet in een RLS-policy en
-- niet vanuit de app. is_admin() gebruikt hem wél, maar is SECURITY DEFINER —
-- die aanroep loopt via de eigenaar en vraagt geen recht van de aanroeper.
--
-- Openlaten betekende dat elke ingelogde gebruiker via /rest/v1/rpc/has_role
-- kon aftasten welke rol een willekeurig ander account heeft.
revoke execute on function public.has_role(uuid, public.app_role) from authenticated;
