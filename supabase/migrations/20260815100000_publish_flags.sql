-- Betaalde samenwerking als eigenschap van de post zelf.
--
-- Het RSM-vinkje in de composer controleerde tot nu alleen de captiontekst; de
-- keuze werd niet opgeslagen. Maar TikTok heeft een eigen platformlabel voor
-- betaalde samenwerkingen (brand_content_toggle) en dat moet mee op het moment
-- van publiceren — óók als de tick de post pas uren later verstuurt. Dus hoort
-- de vlag bij de post in de database, niet bij de sessie in de browser.

alter table public.scheduled_posts
  add column if not exists is_ad boolean not null default false;

comment on column public.scheduled_posts.is_ad is
  'Betaalde samenwerking/reclame. Stuurt platformlabels mee (TikTok brand_content_toggle) en activeert de RSM-check.';

-- ── Hardening uit de audit ───────────────────────────────────────────────────
-- Klanten mochten via PostgREST álle kolommen van hun eigen aanleververzoeken
-- bijwerken (de RLS-policy beperkt geen kolommen). Bedoeld is alleen de status
-- ("ik heb het aangeleverd"); titel, aantal en deadline zijn van het bureau.
-- Kolomrechten dwingen dat af; de service-role (waar de admin-schermen doorheen
-- werken) heeft hier geen last van.
revoke update on public.delivery_requests from authenticated;
grant update (status, completed_at, updated_at) on public.delivery_requests to authenticated;
