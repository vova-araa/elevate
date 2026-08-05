-- Ken de super_admin-rol toe aan de eigenaar. Losse migratie zodat de in de
-- vorige migratie toegevoegde enum-waarde in een nieuwe transactie bruikbaar is.
insert into public.user_roles (user_id, role)
select u.id, 'super_admin'::public.app_role
from auth.users u
where lower(u.email) = 'vovara@uprisingstudio.nl'
  and not exists (
    select 1 from public.user_roles r
    where r.user_id = u.id and r.role = 'super_admin'::public.app_role
  );
