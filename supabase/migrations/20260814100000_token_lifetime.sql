-- Hoe lang een koppeling écht meegaat.
--
-- `token_expires_at` is de vervaldatum van het *access*-token, en dat zegt bijna
-- niets over de levensduur van de koppeling:
--
--   TikTok  access 24 uur, refresh 365 dagen — en elke verversing levert weer
--           een nieuw refresh-token van 365 dagen op. Blijf je verversen, dan
--           verloopt de koppeling nooit.
--   Google  access 1 uur, refresh onbeperkt geldig.
--   Meta    long-lived user token 60 dagen, maar het page-token dat daaruit
--           komt heeft géén vervaldatum. Wij publiceren met dat page-token.
--
-- Op "24 uur" waarschuwen is dus onzin, en na 60 dagen een Meta-koppeling op
-- 'expired' zetten terwijl publiceren gewoon werkt is erger dan onzin.
--
-- Daarom leggen we de échte deadline apart vast: de datum waarop we niet meer
-- kunnen verversen en een mens opnieuw moet koppelen. Is die leeg terwijl er een
-- refresh-token is, dan is de koppeling onbeperkt geldig.

alter table public.social_connections
  add column if not exists refresh_expires_at timestamptz,
  -- Aparte vlag omdat "geen vervaldatum" en "vervaldatum nog onbekend" allebei
  -- als NULL uit de platform-API's komen; dit onderscheid bepaalt of we
  -- waarschuwen.
  add column if not exists never_expires boolean not null default false;

comment on column public.social_connections.refresh_expires_at is
  'Wanneer het refresh-token zelf verloopt; daarna moet een mens opnieuw koppelen.';
comment on column public.social_connections.never_expires is
  'True als het token dat wij gebruiken geen vervaldatum heeft (bv. Meta page-token).';

-- Koppelingen die al gekoppeld zijn: Meta-koppelingen publiceren met een
-- page-token zonder vervaldatum, dus die mogen meteen als onbeperkt gelden.
update public.social_connections
   set never_expires = true
 where platform in ('facebook', 'instagram')
   and meta ? 'pageToken';
