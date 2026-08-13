import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const Route = createFileRoute("/data-deletion")({
  head: () => ({
    meta: [
      { title: "Gegevens verwijderen — Elevate Design" },
      {
        name: "description",
        content:
          "Hoe je je gegevens en gekoppelde social-accounts bij Elevate Design laat verwijderen.",
      },
      { property: "og:url", content: "https://www.elevatedesign.nl/data-deletion" },
    ],
    links: [{ rel: "canonical", href: "https://www.elevatedesign.nl/data-deletion" }],
  }),
  component: DataDeletionPage,
});

function DataDeletionPage() {
  return (
    <LegalPage eyebrow="Juridisch" title="Gegevens verwijderen" updated="5 augustus 2026">
      <LegalSection title="Je gekoppelde account loskoppelen">
        <p>
          Heb je een social-account (Instagram, Facebook, TikTok, LinkedIn of YouTube) aan Elevate
          Design gekoppeld en wil je die koppeling ongedaan maken? Ga in het portaal naar{" "}
          <b>Kanalen</b> en klik bij het betreffende platform op <b>Ontkoppelen</b>. Zodra je
          ontkoppelt, verwijderen we direct de bewaarde toegangssleutel (access token) en de van dat
          account opgehaalde gegevens (accountnaam, profiel-ID, volgersaantal en statistieken).
        </p>
        <p>
          Je kunt de toegang ook rechtstreeks bij het platform intrekken — bij Meta onder{" "}
          <i>Instellingen &amp; privacy → Instellingen → Bedrijfsintegraties</i>, bij TikTok onder{" "}
          <i>Instellingen → Beveiliging → App-beheer</i>. De koppeling stopt dan per direct.
        </p>
      </LegalSection>

      <LegalSection title="Al je gegevens laten verwijderen">
        <p>
          Wil je dat wij <b>alle</b> persoonsgegevens verwijderen die we van je hebben — je account,
          content, bestanden en alle gekoppelde platformgegevens — stuur dan een verwijderverzoek
          naar{" "}
          <a href="mailto:elevate.plannen@gmail.com" className="text-gold hover:underline">
            elevate.plannen@gmail.com
          </a>{" "}
          met als onderwerp <b>&quot;Verwijderverzoek&quot;</b>. Vermeld het e-mailadres waarmee je
          bekend bent, zodat we je verzoek kunnen koppelen aan het juiste account.
        </p>
        <p>
          We voeren het verzoek uit en bevestigen de verwijdering <b>uiterlijk binnen 30 dagen</b>.
          Gegevens die we wettelijk moeten bewaren (bijvoorbeeld voor de belastingadministratie)
          worden pas na de wettelijke bewaartermijn verwijderd; dat lichten we in onze bevestiging
          toe.
        </p>
      </LegalSection>

      <LegalSection title="Verzoek via Facebook of Instagram">
        <p>
          Verwijder je Elevate Design rechtstreeks in je Meta-instellingen, dan krijg je van Meta
          een <b>bevestigingscode</b>. We verwijderen dan direct de bewaarde toegangssleutel en
          accountgegevens van die koppeling. De status van dat verzoek kun je opvragen op{" "}
          <a href="/data-deletion-status" className="text-gold hover:underline">
            de statuspagina
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="English summary">
        <p>
          To disconnect a linked social account, open <b>Kanalen</b> (Channels) in the portal and
          click <b>Ontkoppelen</b> (Disconnect); we immediately delete the stored access token and
          any data fetched from that account. To request full deletion of all your personal data,
          email{" "}
          <a href="mailto:elevate.plannen@gmail.com" className="text-gold hover:underline">
            elevate.plannen@gmail.com
          </a>{" "}
          with the subject <b>&quot;Data deletion request&quot;</b>; we complete and confirm
          deletion within 30 days.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
