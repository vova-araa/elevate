-- Ongelezen-indicator in de admin-berichtenlijst (Berichten toonde geen
-- enkel signaal welke klant-conversatie nieuw is; een admin moest elke
-- klant langsklikken om te zien of er iets bij was). Eén read_at-kolom,
-- gedeeld voor het hele admin-team (geen per-gebruiker leesstatus) — dit is
-- één gedeelde inbox, geen persoonlijke.
alter table public.messages add column if not exists read_at timestamptz;
