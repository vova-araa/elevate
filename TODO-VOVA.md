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

## Analytics en Search Console (S04)

De site had 0 externe scripts — geen nulmeting, dus ook niets hierboven is
bewijsbaar totdat dit aan staat.

**Plausible (bezoekersanalytics, cookieloos):**
1. Account op [plausible.io](https://plausible.io), site toevoegen:
   `elevatedesign.nl`.
2. Zet in Render: `VITE_PLAUSIBLE_DOMAIN="elevatedesign.nl"`.
3. Het script laadt dan vanzelf op de publieke pagina's (niet in
   /admin of /client — dat blijft een privé-portaal). De events
   `lead_form_start`, `lead_form_submit`, `cta_click` en
   `portal_login_click` staan al klaar in de code.

**Google Search Console (domeinverificatie via DNS):**
1. Ga naar [search.google.com/search-console](https://search.google.com/search-console),
   kies "Domeinresource" (niet "URL-voorvoegsel" — dat dekt alleen www, een
   domeinresource dekt ook non-www en subdomeinen), vul `elevatedesign.nl` in.
2. Google toont een TXT-record in de vorm
   `google-site-verification=<lange-code>`.
3. Zet dat record bij je DNS-provider op de domeinnaam zelf (host `@`, type
   `TXT`), niet op een subdomein.
4. Terug in Search Console op "Verifiëren" klikken — DNS-wijzigingen kunnen
   tot enkele uren nodig hebben om door te komen.
5. Zodra geverifieerd: sitemap indienen op `https://www.elevatedesign.nl/sitemap.xml`.

Ik kan dit niet namens jou uitvoeren — de TXT-waarde komt pas na stap 1/2 uit
jouw eigen Search Console-account.

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
