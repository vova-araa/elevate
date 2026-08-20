-- Klanten mochten élke kolom van hun eigen posts wijzigen.
--
-- De RLS-policy `sched_client_update` toetst alleen of de gebruiker bij de
-- klant hoort, niet wát hij verandert. Postgres kan kolommen niet in een policy
-- beperken, en kolomrechten intrekken is hier geen optie: het bureau bewerkt
-- posts via dezelfde `authenticated`-rol, dus dat zou de planner slopen.
--
-- Waarom dit ertoe doet: het bureau keurt een caption goed, de klant past hem
-- daarna aan, en de publiceerronde plaatst de gewijzigde tekst. Dan is een
-- goedkeuring niets waard. Even goed mogelijk was: de status op 'published'
-- zetten zonder dat er iets gepubliceerd is, of het moment van plaatsen
-- verzetten naar drie uur 's nachts.
--
-- Een trigger kan wél naar de oude én nieuwe rij kijken. Bewust omgekeerd
-- geformuleerd — alles is verboden behalve `status` — zodat een kolom die er
-- later bij komt automatisch beschermd is in plaats van vergeten.

create or replace function public.enforce_client_post_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- De publiceerronde en alle server-functions draaien als service_role en
  -- moeten alles kunnen bijwerken (status, published_at, foutvelden).
  if current_user = 'service_role' or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  -- Het bureau mag alles. De app kent maar twee soorten gebruikers: admin
  -- (inclusief super_admin) gaat naar /admin, de rest naar het klantportaal.
  if public.is_admin(auth.uid()) then
    return new;
  end if;

  -- Alles behalve de status moet gelijk blijven.
  if (to_jsonb(new) - 'status' - 'updated_at') is distinct from
     (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Alleen het bureau mag de inhoud van een post wijzigen'
      using errcode = '42501';
  end if;

  -- En van de status alleen de stap die het klantportaal aanbiedt: een concept
  -- goedkeuren. Niet 'published' (dat zou een publicatie voorwenden) en niet
  -- terug uit een al ingeplande of gepubliceerde post.
  if new.status is distinct from old.status
     and not (old.status = 'draft' and new.status in ('draft', 'scheduled')) then
    raise exception 'Deze statuswijziging is voorbehouden aan het bureau'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.enforce_client_post_update() is
  'Beperkt wat een klant aan een geplande post mag wijzigen tot het goedkeuren van een concept.';

drop trigger if exists scheduled_posts_client_guard on public.scheduled_posts;
create trigger scheduled_posts_client_guard
  before update on public.scheduled_posts
  for each row
  execute function public.enforce_client_post_update();

-- De functie draait als SECURITY DEFINER en hoort niet rechtstreeks aanroepbaar
-- te zijn; alleen de trigger gebruikt hem.
revoke execute on function public.enforce_client_post_update() from public, anon, authenticated;
