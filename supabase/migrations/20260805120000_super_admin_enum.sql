-- Nieuwe rol-tier boven admin: super_admin. Een super_admin is óók admin
-- (behoudt alle admin-rechten en RLS via de bestaande is_admin()-check) en
-- krijgt daarnaast een extra super-admin-dashboard. De enum-waarde wordt hier
-- toegevoegd; de toewijzing aan een gebruiker staat in een aparte migratie
-- (een nieuwe enum-waarde mag niet in dezelfde transactie worden gebruikt).
alter type public.app_role add value if not exists 'super_admin';
