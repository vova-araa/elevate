import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacyverklaring — Elevate Design" },
      {
        name: "description",
        content: "Hoe het Elevate Design platform met persoonsgegevens omgaat.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage eyebrow="Juridisch" title="Privacyverklaring" updated="23 juli 2026">
      <LegalSection title="1. Wie wij zijn">
        <p>
          Deze privacyverklaring is van <b>Elevate Design</b> (elevatedesign.nl), de
          verantwoordelijke voor de verwerking van persoonsgegevens binnen dit platform. Vragen of
          verzoeken over je gegevens? Mail ons op{" "}
          <a href="mailto:elevate.plannen@gmail.com" className="text-gold hover:underline">
            elevate.plannen@gmail.com
          </a>
          .
        </p>
      </LegalSection>
      <LegalSection title="2. Welke gegevens we verwerken">
        <p>
          <b>Accountgegevens</b>: je naam en e-mailadres, om je toegang te geven tot het portaal.
        </p>
        <p>
          <b>Content en bestanden</b>: de posts, beelden en video's die jij of ons team aanlevert
          voor jouw merk.
        </p>
        <p>
          <b>Koppelingsgegevens</b>: wanneer je een socialemedia-account koppelt (zoals TikTok,
          Instagram, Facebook, LinkedIn of YouTube), ontvangen we via de officiële koppeling van dat
          platform een toegangssleutel en basisgegevens van het account — zoals accountnaam,
          profiel-ID, volgersaantal en statistieken van je eigen berichten. Toegangssleutels worden
          beveiligd opgeslagen en zijn niet zichtbaar in de browser; we gebruiken ze uitsluitend om
          namens jou te publiceren en resultaten van je eigen kanalen op te halen. We halen geen
          gegevens op van andere gebruikers dan die van het gekoppelde account zelf.
        </p>
        <p>
          <b>Gebruiksgegevens</b>: berichten, goedkeuringen en notificaties binnen het platform.
        </p>
      </LegalSection>
      <LegalSection title="3. Waarvoor we ze gebruiken">
        <p>
          Uitsluitend om onze diensten uit te voeren: content plannen en publiceren op jouw eigen
          kanalen, samenwerking en goedkeuringen mogelijk maken, en rapportages over je resultaten
          tonen. We verkopen geen gegevens, delen ze niet met adverteerders en gebruiken de gegevens
          van gekoppelde platforms niet voor andere doeleinden dan hierboven beschreven.
        </p>
      </LegalSection>
      <LegalSection title="4. Met wie we werken">
        <p>
          We gebruiken zorgvuldig gekozen verwerkers: <b>Supabase</b> (database, opslag en
          authenticatie), <b>Render</b> (hosting) en <b>Anthropic</b> (AI-ondersteuning bij het
          schrijven van content; hiervoor delen we geen persoonsgegevens die daarvoor niet nodig
          zijn). Publiceren verloopt via de officiële API's van de platforms die jij koppelt (zoals
          Meta, TikTok, LinkedIn en Google) — dat gebeurt alleen na jouw uitdrukkelijke toestemming
          op dat platform en valt daar ook onder hun eigen privacybeleid.
        </p>
      </LegalSection>
      <LegalSection title="5. Bewaren en beveiligen">
        <p>
          We bewaren gegevens zolang de samenwerking loopt. Ontkoppel je een account, dan worden de
          bijbehorende toegangssleutels en opgehaalde platformgegevens direct verwijderd. Eindigt de
          samenwerking, dan verwijderen we je gegevens op verzoek of na een redelijke termijn.
          Verbindingen zijn versleuteld (https) en toegang is beperkt per rol: klanten zien
          uitsluitend hun eigen gegevens.
        </p>
      </LegalSection>
      <LegalSection title="6. Je gegevens verwijderen">
        <p>
          Je kunt een gekoppeld account op elk moment loskoppelen — in het platform via
          "Ontkoppelen" of rechtstreeks in de instellingen van het sociale platform zelf (bij TikTok
          onder <i>Instellingen → Beveiliging → App-beheer</i>, bij Meta onder{" "}
          <i>Instellingen → Bedrijfsintegraties</i>). Zodra je ontkoppelt, verwijderen we de
          bewaarde toegangssleutel en de opgehaalde gegevens van dat account.
        </p>
        <p>
          Wil je dat we álle gegevens die we van je hebben verwijderen, stuur dan een
          verwijderverzoek naar{" "}
          <a href="mailto:elevate.plannen@gmail.com" className="text-gold hover:underline">
            elevate.plannen@gmail.com
          </a>
          . We voeren het verzoek uit en bevestigen dit uiterlijk binnen 30 dagen.
        </p>
      </LegalSection>
      <LegalSection title="7. Jouw rechten (AVG)">
        <p>
          Je hebt recht op inzage, correctie en verwijdering van je persoonsgegevens en op het
          intrekken van eerder gegeven toestemming. Neem hiervoor contact op via{" "}
          <a href="mailto:elevate.plannen@gmail.com" className="text-gold hover:underline">
            elevate.plannen@gmail.com
          </a>
          ; we reageren zo snel mogelijk en uiterlijk binnen 30 dagen. Ook kun je een klacht
          indienen bij de Autoriteit Persoonsgegevens.
        </p>
      </LegalSection>
      <LegalSection title="8. Wijzigingen en contact">
        <p>
          Wijzigt er iets aan deze verklaring, dan vind je de actuele versie altijd op deze pagina.
          Vragen over privacy stel je via{" "}
          <a href="mailto:elevate.plannen@gmail.com" className="text-gold hover:underline">
            elevate.plannen@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
