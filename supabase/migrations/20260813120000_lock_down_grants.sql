-- Beveiligingsronde: functie- en tabelrechten terugbrengen tot het minimum.
--
-- 1) enqueue_notification() is SECURITY DEFINER en schrijft een notificatie voor
--    een wíllekeurige gebruiker, inclusief een vrij invulbare link. Die stond
--    open voor elke ingelogde gebruiker, waardoor een klantaccount een
--    admin een echt ogende melding met een eigen (phishing-)link kon sturen —
--    precies de insert-policy die eerder juist was dichtgezet.
--
-- 2) Migratie 20260805130000 deelde EXECUTE uit op *alle* functies in public aan
--    `authenticated`. Dat maakt elke huidige én toekomstige helper-functie
--    aanroepbaar. We draaien dat terug en geven alleen de vier functies vrij die
--    de client echt nodig heeft.
--
-- 3) De dev-migratie 20260529163806 gaf `anon` volledige DML op 16 tabellen. De
--    policies zijn later verwijderd, de GRANTS niet. Vandaag houdt RLS dat tegen
--    (alle policies zijn TO authenticated), maar het is één losse policy
--    verwijderd van anonieme toegang met de publieke sleutel die in elke
--    browser zit.

-- ── 1 + 2: functierechten ───────────────────────────────────────────────────

revoke execute on function public.enqueue_notification(uuid, text, text, text, text)
  from authenticated, anon, public;

revoke execute on all functions in schema public from authenticated, anon;

grant execute on function public.current_user_roles() to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.user_has_client_access(uuid, uuid) to authenticated;

-- ── 3: tabelrechten voor anon intrekken ─────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'client_members', 'calendar_items', 'content_items', 'deals',
    'evaluations', 'meetings', 'messages', 'notifications', 'profiles',
    'reports', 'roadmaps', 'roadmap_steps', 'strategy_notes', 'tasks', 'uploads'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on public.%I from anon', t);
    end if;
  end loop;
end $$;
