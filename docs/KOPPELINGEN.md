# Social-koppelingen instellen — simpele handleiding

Je hoeft dit **één keer** te doen (per platform, ±10 minuten). Daarna kan iedereen
in de app met één klik accounts koppelen en publiceren.

> **Het idee in één zin:** elk platform wil weten welke app er namens jou post.
> Daarvoor maak je bij dat platform een gratis "developer-app" aan en krijg je
> twee codes (een ID en een geheime sleutel) die je in de hosting-omgeving zet.

## Stap 0 — dit heb je nodig

1. Je app draait online (bv. op Vercel) met een vast adres, bv. `https://portal.jouwdomein.nl`.
2. Dit is je **redirect-URI** (heb je bij elke stap nodig — de app toont hem ook
   met een kopieerknop op de Kanalen-pagina):

   ```
   https://JOUW-DOMEIN/api/public/oauth/callback
   ```

3. Omgevingsvariabelen zet je bij je hosting (Vercel: *Project → Settings →
   Environment Variables*, daarna redeployen).

De Kanalen-pagina in de app (Beheer → Kanalen) ziet zelf welke platforms nog
niet zijn ingesteld en toont daar dezelfde stappen als hieronder.

## Instagram + Facebook (één keer, samen)

1. Ga naar <https://developers.facebook.com/apps/> en log in met je Facebook-account.
2. **Create app** → type **Business** → geef hem een naam (bv. "Elevate Social").
3. Voeg het product **Facebook Login for Business** toe.
4. Bij *Settings* van dat product: plak je redirect-URI bij **Valid OAuth Redirect URIs**.
5. Ga naar *App settings → Basic*: kopieer **App ID** en **App Secret**.
6. Zet in je hosting: `META_APP_ID` en `META_APP_SECRET`.
7. Belangrijk voor Instagram: het Instagram-account van de klant moet een
   **Business-account** zijn dat gekoppeld is aan een **Facebook-pagina**
   (instellen in de Instagram-app: *Instellingen → Account → Overschakelen naar
   professioneel account*, daarna koppelen in Meta Business Suite).

## TikTok

1. Ga naar <https://developers.tiktok.com/> → **Manage apps** → **Connect an app**.
2. Vraag de **Content Posting API** aan (Direct Post).
3. Plak je redirect-URI bij **Redirect URI**.
4. Kopieer **Client key** en **Client secret** → zet `TIKTOK_CLIENT_KEY` en `TIKTOK_CLIENT_SECRET`.

## LinkedIn

1. Ga naar <https://www.linkedin.com/developers/apps> → **Create app**
   (je hebt een LinkedIn-bedrijfspagina nodig om aan te koppelen).
2. Tab *Products*: vraag **Sign In with LinkedIn using OpenID Connect** en
   **Share on LinkedIn** aan.
3. Tab *Auth*: plak je redirect-URI bij **Authorized redirect URLs**.
4. Kopieer **Client ID** en **Client Secret** → zet `LINKEDIN_CLIENT_ID` en `LINKEDIN_CLIENT_SECRET`.

## YouTube (Google)

1. Ga naar <https://console.cloud.google.com/> → maak een project.
2. *APIs & Services → Library*: zet **YouTube Data API v3** aan.
3. *APIs & Services → Credentials* → **Create credentials → OAuth client ID**
   → type **Web application**.
4. Plak je redirect-URI bij **Authorized redirect URIs**.
5. Kopieer **Client ID** en **Client secret** → zet `GOOGLE_CLIENT_ID` en `GOOGLE_CLIENT_SECRET`.

> YouTube: koppelen en statistieken werken; automatisch video's publiceren wordt
> nog niet ondersteund.

## Klaar — zo test je het

1. Redeploy de app na het zetten van de variabelen.
2. Open **Beheer → Kanalen**, kies een klant, klik **Koppelen** bij een platform.
3. Log in bij het platform en geef akkoord — je komt vanzelf terug in de app
   met een groene melding.
4. Test een post via **Compose** met "Nu publiceren".

## Goed om te weten

- **Testen kan meteen** met je eigen accounts (als tester/beheerder van de app).
  Voor het koppelen van accounts van *klanten* vragen Meta en TikTok een korte
  **app-review** (eenmalig formulier waarin je uitlegt wat de app doet).
- `APP_URL` instellen is optioneel — de app gebruikt anders automatisch het
  domein waarop hij draait.
- Loopt een koppeling af (bv. Meta na ~60 dagen zonder gebruik)? De app markeert
  hem als **Verlopen** en één klik op Koppelen zet hem weer aan.
