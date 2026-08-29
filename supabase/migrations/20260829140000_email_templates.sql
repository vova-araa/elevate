-- E-mailsjablonen die admins naar klanten kunnen sturen (bijv. maandrapport-
-- aankondiging, betalingsherinnering, welkomstmail) — voorheen bestond hier
-- niets voor. Zelfde patroon als feed_arrangement_slots/drive_admin_connection:
-- geen directe grants aan authenticated, alles loopt via server functions in
-- client-email.functions.ts (requireSupabaseAuth + assertAdmin, daarna
-- supabaseAdmin) — niet via RLS-policies op deze tabellen zelf.
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  -- Platte tekst met {{variabelen}} (bijv. {{klant_naam}}) die bij het
  -- versturen vervangen worden — geen HTML-editor, dat is voor een latere
  -- uitbreiding.
  body text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.email_templates is
  'Herbruikbare e-mailsjablonen (onderwerp + body met {{variabelen}}) die admins naar klanten kunnen sturen.';

alter table public.email_templates enable row level security;
revoke all on public.email_templates from anon, authenticated;
grant all on public.email_templates to service_role;

-- Verzendlog: elke poging (gelukt of mislukt) wordt vastgelegd, zodat een
-- admin kan zien wat er wanneer naar welke klant is gestuurd — anders is een
-- mislukte verzending onzichtbaar totdat de klant erover belt.
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  template_id uuid references public.email_templates(id) on delete set null,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  error text,
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index email_log_client_idx on public.email_log (client_id, created_at desc);

comment on table public.email_log is
  'Verzendlog van klant-e-mails (via sjablonen of los) — status sent/failed, voor zichtbaarheid in het klantdossier.';

alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;
grant all on public.email_log to service_role;
