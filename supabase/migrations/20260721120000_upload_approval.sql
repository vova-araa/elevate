-- Klant-uploads wachten voortaan op goedkeuring door een admin voordat ze
-- als normale media zichtbaar zijn. Bestaande rijen en admin-uploads krijgen
-- default 'approved' zodat ze meteen zichtbaar blijven/zijn.
alter table public.uploads add column if not exists status text not null default 'approved';
alter table public.uploads add column if not exists approved_at timestamptz;
alter table public.uploads add column if not exists approved_by uuid;
