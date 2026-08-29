# TODO voor Vova

Dingen die ik niet kon afronden omdat de gegevens ontbreken, of die bewust
bij jou liggen. Bijgewerkt tijdens de audit-ronde van 24 augustus 2026, en
opnieuw op 29 augustus 2026 (feed-indeling in de mediabibliotheek + drie
migraties rechtstreeks toegepast via de Supabase-koppeling).

## Grote beslissingen — hier heb ik jouw keuze voor nodig

Dit zijn de punten uit de verbeter-ronde van 29 augustus die ik bewust
**niet** zelf heb gebouwd — te groot, te onomkeerbaar, of ik mis een
productbeslissing die alleen jij kunt maken. Alle kleinere, veilige
verbeteringen uit diezelfde ronde (concept dupliceren in de planner,
bulk herstellen/definitief verwijderen in de prullenbak, ongelezen-
indicator bij Berichten, uploadvoortgang + verwijderen bij klant-uploads,
disabled trigger-optie bij automations) zijn al gebouwd en live op de
branch.

### 1. Facturatie/betalingen voor klanten

Er bestaat nu **niets** voor facturatie — de `deals`-tabel is CRM-
pipeline-data (voor jouw eigen salesproces), geen facturen. Voor een
factuur die aan de Belastingdienst-eisen voldoet (art. 3:15d BW) moet
minimaal aanwezig zijn: doorlopend genummerd zonder gaten, jouw KVK- en
btw-nummer, klantgegevens, datum, omschrijving, bedrag excl./incl. btw,
btw-tarief en -bedrag, vervaldatum. `src/config/business.ts` mist op dit
moment nog KVK/btw/adres (zie de sectie hieronder) — dat moet sowieso
eerst ingevuld, los van deze keuze.

Open vraag voor jou, vóór ik hier iets bouw:

- **Alleen factuuradministratie** (PDF genereren, status bijhouden:
  verzonden/betaald/te laat — geen online betalen), of
- **Ook online betalen** (klant betaalt via een link — dan moet er een
  betaalprovider bij, bijv. Mollie, met eigen aansluitproces en kosten
  per transactie)?
- Of liever **geen eigen bouw**: koppelen aan / doorverwijzen naar een
  bestaand Nederlands boekhoudpakket (Moneybird, e-Boekhouden, Factuurly)
  waar je waarschijnlijk toch al iets voor nodig hebt voor de
  belastingaangifte?

Zeg me welke richting, dan ga ik research doen naar de concrete opzet
(tabellen, PDF-generatie, eventueel welke API) en bouw ik het.

### 2. Bulk-acties op Klanten en Gebruikers — bewust overgeslagen

Ik heb dit uit de verbeter-ronde gehaald in plaats van gebouwd. Bij
Gebruikers en Klanten is "verwijderen" de enige actie die je zou willen
bulken, en dat is precies de actie die nu al met opzet extra beveiligd
is: bij een gebruiker moet je de naam/e-mail exact overtypen om 'm
definitief te verwijderen (A09), en het verwijdert in één klap alle
rollen en klantkoppelingen. Bij een klant bestaat er nog niet eens een
verwijder-knop of een "archiveren"-status — een klant verwijderen zou nu
een cascade van geplande posts, uploads, berichten, deals, taken en
evaluaties meeslepen. Een bulk-verwijderknop zou die bewuste
per-item-drempel juist ondermijnen. Als je dit toch wilt, denk ik graag
mee over hoe (bijv. eerst een "archiveren" i.p.v. hard-delete voor
klanten), maar dat is een aparte, kleinere beslissing dan een simpele
bulk-knop toevoegen.

## Lekwoord-bescherming staat uit — kleine, losse verbetering

Supabase's eigen beveiligingscheck meldt dat "Leaked Password Protection"
uitstaat: nieuwe wachtwoorden worden niet getoetst tegen bekende
gelekte-wachtwoorden-lijsten (HaveIBeenPwned). Dit raakt het inlogbeleid
zelf, dus die zet ik niet zomaar zelf om — aan te zetten via het
Supabase-dashboard: Authentication → Policies → Password Security.

## Feed-indeling in de mediabibliotheek — klaar

Nieuw op /admin/media: een "Feed-indeling"-paneel waarin je bestanden uit de
bibliotheek naar een raster sleept om te zien hoe de feed er het mooist
uitziet, met een knop om 'm te vullen met wat er al live staat (via de
bestaande Instagram/Facebook-koppeling, met terugval op onze eigen
registratie — zelfde bron als de live-feed-preview op het dashboard en in de
planner) en een knop om 'm leeg te maken.

- [x] **Migratie toegepast** (29 augustus, via de Supabase MCP-koppeling):
  `feed_arrangement_slots` staat live. Werkt nu meteen.

## Plann als tussenpartij — kon ik niet vinden, actie nodig

Je vroeg om Postiz te vervangen door **Plann** (plannthat.com) voor de
tijdelijke koppeling. Ik heb gezocht naar een publieke API/developer-
documentatie voor Plann (via websearch en direct op plannthat.com) en niets
gevonden — geen API-referentie, geen developer-portal, geen Zapier-app met
koppel/publiceer-acties. Dat is een wezenlijk verschil met Postiz (dat is
open-source en API-first, vandaar dat die integratie wél lukte): zonder een
API is er niets om Elevate programmatisch mee te laten praten.

Ik heb de Postiz-koppeling daarom teruggedraaid (git revert) naar de vorige
werkende staat: het handmatige-invoerformulier voor Instagram/Facebook
tijdens Meta App Review, zie hieronder. Twee opties om verder te komen:

- [ ] **Jij checkt of Plann een API heeft** — bijvoorbeeld als betalende
  agency-klant een developer-portal, API-key-instelling, of contactpersoon
  bij Plann die dat kan bevestigen. Stuur me de documentatie/toegang, dan
  bouw ik 'm net zo als bij Postiz.
- [ ] **Of**: als Plann geen API blijkt te hebben, is een echte koppeling
  simpelweg niet mogelijk — dan is handmatige boekhouding in Elevate (welk
  Plann-account hoort bij welke klant, puur ter administratie) het hoogst
  haalbare, zonder dat er ook echt via Plann gepubliceerd kan worden.

## Migratie voor handmatig koppelen (Meta App Review) — klaar

`supabase/migrations/20260824200000_social_connection_manual_status.sql`
is toegepast (29 augustus) — "Koppel handmatig" op /admin/channels,
/client/channels en /connect/$token werkt nu.

## Google Drive-koppeling (/admin/drive) — actie nodig

Nieuwe bureau-brede Drive-koppeling: op /admin/drive kun je alles
doorzoeken wat met elevate.plannen@gmail.com gedeeld is, bestanden
selecteren en er met AI een releaseplanning van laten maken (per bestand
een post — platform, caption, hashtags, datum), en na akkoord worden de
bestanden gedownload, geüpload en als concept ingepland.

Voor het werkt:

- [x] **Migratie toegepast** (29 augustus): `drive_admin_connection` staat live.
- [ ] **Drive-scope toevoegen aan de bestaande Google OAuth-app**: de
  koppeling hergebruikt dezelfde `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
  als de YouTube-koppeling (Google staat meerdere scopes op één OAuth-app
  toe). Ga naar Google Cloud Console → die OAuth-app → OAuth consent screen
  → Scopes, en voeg toe: `https://www.googleapis.com/auth/drive.readonly`.
- [ ] **Redirect-URI registreren**: zet bij diezelfde OAuth-app onder
  Authorized redirect URIs ook `${APP_URL}/api/public/oauth/drive-callback`
  (naast de al bestaande `/api/public/oauth/callback`).
- [ ] **Koppelen**: log als admin in, ga naar /admin/drive, klik "Koppel
  Google Drive" en log in op **elevate.plannen@gmail.com** (niet een ander
  account — de knop dwingt dat account af via `login_hint`, maar controleer
  het bij het inloggen). Trek bij een eerdere test-koppeling eerst de
  bestaande toegang in bij myaccount.google.com/permissions op dat account,
  anders geeft Google geen nieuw refresh-token terug en faalt het koppelen
  met een duidelijke foutmelding die dat ook zegt.

De koppeling zelf is bureau-breed (één rij in `drive_admin_connection`),
niet per klant — welke klant een geïmporteerd bestand krijgt, kies je op de
pagina zelf via de actieve-klant-wisselaar.

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

## E-mailsjablonen naar klanten — klaar, wacht op RESEND_API_KEY

Nieuw: onder Instellingen → **E-mailsjablonen** maak je herbruikbare
sjablonen (onderwerp + tekst, met `{{klant_naam}}`/`{{vandaag}}`-variabelen).
Vanuit een klantdossier (tab **E-mail**) kies je een sjabloon, vul je de
ontvanger in (voorgesteld uit gekoppelde klant-gebruikers) en verstuur je
'm — met een verzendgeschiedenis (gelukt/mislukt) direct in het dossier.

- [x] **Migratie toegepast** (29 augustus): `email_templates` + `email_log`
  staan live.
- Gebruikt dezelfde `RESEND_API_KEY` als de leadnotificatie hieronder — als
  die al gezet staat, werkt versturen meteen. Zonder de sleutel toont de
  UI een duidelijke foutmelding bij het versturen (in plaats van stil te
  falen), sjablonen aanmaken/bewerken werkt sowieso al.

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

## Non-www → www redirect (S07) — incident, actie nodig

Ik bouwde eerst een apex→www-redirect in de app zelf (`src/server.ts`).
Live bleek dat te botsen met een redirect die al op Render-niveau stond
ingesteld — die ging blijkbaar de andere kant op (www → apex). Samen gaven
ze een oneindige 301-lus: de site opende niet meer voor bezoekers. Ik heb
de app-code direct teruggedraaid (hotfix, live) zodat de site weer werkt,
maar de eigenlijke S07-taak (non-www → www redirecten) staat daarmee weer
open.

- [ ] Check in Render → **elevate-design-r547** → Settings → Custom Domains
  welke van de twee domeinen (`elevatedesign.nl` / `www.elevatedesign.nl`)
  een "redirect to"-instelling heeft staan, en in welke richting.
- [ ] Zet die redirect goed (non-www → www, met behoud van pad/querystring)
  via die Render-instelling zelf — niet nogmaals in de app-code, anders
  ontstaat dezelfde lus opnieuw.
- Supabase ↔ Render-koppeling zelf is gecheckt en in orde (Supabase-project
  "Elevate design" staat op ACTIVE_HEALTHY); dit incident had daar niets
  mee te maken.

## Overig nog openstaand uit eerdere rondes

- ANTHROPIC_API_KEY vervangen (de oude staat in een chatgesprek)
- CRON_SECRET genereren + publiceerronde aanzetten
- TikTok-audit: scopes ophogen na goedkeuring, opnieuw koppelen
- Meta App Review: zes permissions + bedrijfsverificatie. Tot die goedgekeurd
  is, staat Instagram/Facebook op /admin/channels, /client/channels en de
  publieke koppel-link (/connect/$token) op "handmatig koppelen" — de echte
  OAuth-knop is gepauzeerd zodat hij niet doodloopt voor iedereen buiten de
  Meta-app-testers. Zet na goedkeuring `VITE_META_REVIEW_PENDING=false` in
  Render en de OAuth-knop komt vanzelf terug (zie src/config/feature-flags.ts).
  Handmatige koppelingen (status 'manual' in social_connections) hebben geen
  token en kunnen dus niet gebruikt worden om te publiceren — vervang ze na
  goedkeuring gewoon door een echte koppeling via "Ontkoppel" + "Koppelen".
- Leaked password protection aanzetten in Supabase
- `best_time_benchmarks`-tabel is niet meer in gebruik (zie A03) — kan
  verwijderd worden met een aparte, expliciet bevestigde migratie. Ik laat
  hem staan tot je dat bevestigt.
