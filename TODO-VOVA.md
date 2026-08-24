# TODO voor Vova

Dingen die ik niet kon afronden omdat de gegevens ontbreken, of die bewust
bij jou liggen. Bijgewerkt tijdens de audit-ronde van 24 augustus 2026.

## Bedrijfsgegevens (`src/config/business.ts`)

Verplicht bij commerciële online dienstverlening (art. 3:15d BW,
Handelsregisterwet art. 25) en nog leeg. Zolang deze leeg zijn, toont de
footer en de contactpagina ze zichtbaar als `<<NOG INVULLEN>>` — de site
blijft gewoon werken, `bun run build` print een waarschuwing.

- [ ] `legalName` — statutaire naam (indien anders dan "Elevate Design")
- [ ] `kvk` — KvK-nummer
- [ ] `vat` — btw-id
- [ ] `street` — straat en huisnummer
- [ ] `postalCode` — postcode
- [ ] `city` — plaats
- [ ] `phone` — telefoonnummer, in E.164-formaat (bijv. `+31612345678`)

Vul ze in `src/config/business.ts` (bij `RAW`) en de waarschuwing verdwijnt
vanzelf.

## Leadnotificatie (S01 — contactformulier)

`/contact` slaat aanvragen op in de nieuwe `leads`-tabel, maar stuurt nog
geen mail — er was nog geen e-mailintegratie in de app. Ik heb het
voorbereid op **Resend** (resend.com, simpele HTTP-API):

1. Account + geverifieerd domein bij Resend.
2. Zet in Render: `RESEND_API_KEY` en `LEADS_NOTIFICATION_EMAIL` (waar de
   melding naartoe moet).
3. Optioneel `LEADS_NOTIFICATION_FROM` als het afzenderadres moet afwijken
   van `noreply@elevatedesign.nl`.

Tot die tijd komt elke aanvraag gewoon in de database (`leads`-tabel) — je
mist alleen de directe melding. Er is nog **geen scherm in het admin-paneel**
om die lijst te bekijken; dat vraagt een aparte kleine build als je dat wilt.

## Uploadlimiet (open sinds launch-overzicht)

- [ ] Supabase → Storage → Settings → Upload file size limit
- [ ] Render → `VITE_MAX_UPLOAD_MB` (zelfde waarde als hierboven)

## Overig nog openstaand uit eerdere rondes

- ANTHROPIC_API_KEY vervangen (de oude staat in een chatgesprek)
- CRON_SECRET genereren + publiceerronde aanzetten
- TikTok-audit: scopes ophogen na goedkeuring, opnieuw koppelen
- Meta App Review: zes permissions + bedrijfsverificatie
- Leaked password protection aanzetten in Supabase
- `best_time_benchmarks`-tabel is niet meer in gebruik (zie A03) — kan
  verwijderd worden met een aparte, expliciet bevestigde migratie. Ik laat
  hem staan tot je dat bevestigt.
