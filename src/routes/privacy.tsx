import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacyverklaring — Elevate Social" },
      {
        name: "description",
        content: "Hoe het Elevate Social platform met persoonsgegevens omgaat.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage eyebrow="Juridisch" title="Privacyverklaring" updated="19 juli 2026">
      <LegalSection title="1. Welke gegevens we verwerken">
        <p>
          <b>Accountgegevens</b>: je naam en e-mailadres, om je toegang te geven tot het portaal.
        </p>
        <p>
          <b>Content en bestanden</b>: de posts, beelden en video's die jij of ons team aanlevert
          voor jouw merk.
        </p>
        <p>
          <b>Koppelingsgegevens</b>: wanneer je een socialemedia-account koppelt, ontvangen we via
          de officiële koppeling van dat platform een toegangssleutel en basisgegevens van het
          account (zoals accountnaam en volgersaantal). Toegangssleutels worden beveiligd opgeslagen
          en zijn niet zichtbaar in de browser; we gebruiken ze uitsluitend om namens jou te
          publiceren en resultaten op te halen.
        </p>
        <p>
          <b>Gebruiksgegevens</b>: berichten, goedkeuringen en notificaties binnen het platform.
        </p>
      </LegalSection>
      <LegalSection title="2. Waarvoor we ze gebruiken">
        <p>
          Uitsluitend om onze diensten uit te voeren: content plannen en publiceren op jouw eigen
          kanalen, samenwerking en goedkeuringen mogelijk maken, en rapportages over je resultaten
          tonen. We verkopen geen gegevens en gebruiken ze niet voor advertenties van derden.
        </p>
      </LegalSection>
      <LegalSection title="3. Met wie we werken">
        <p>
          We gebruiken zorgvuldig gekozen verwerkers: <b>Supabase</b> (database, opslag en
          authenticatie), <b>Vercel</b> (hosting) en <b>Anthropic</b> (AI-ondersteuning bij het
          schrijven van content; hiervoor delen we geen persoonsgegevens die daarvoor niet nodig
          zijn). Publiceren verloopt via de officiële API's van de platforms die jij koppelt (zoals
          Meta, TikTok, LinkedIn en Google) — dat gebeurt alleen na jouw uitdrukkelijke toestemming
          op dat platform en valt daar ook onder hun eigen privacybeleid.
        </p>
      </LegalSection>
      <LegalSection title="4. Bewaren en beveiligen">
        <p>
          We bewaren gegevens zolang de samenwerking loopt. Ontkoppel je een account, dan worden de
          bijbehorende toegangssleutels verwijderd. Eindigt de samenwerking, dan verwijderen we je
          gegevens op verzoek of na een redelijke termijn. Verbindingen zijn versleuteld (https) en
          toegang is beperkt per rol: klanten zien uitsluitend hun eigen gegevens.
        </p>
      </LegalSection>
      <LegalSection title="5. Jouw rechten (AVG)">
        <p>
          Je hebt recht op inzage, correctie en verwijdering van je persoonsgegevens, en je kunt een
          gekoppeld account op elk moment ontkoppelen — in het platform of via de instellingen van
          het sociale platform zelf. Neem voor een verzoek contact op met je vaste contactpersoon
          bij Elevate Social; we reageren zo snel mogelijk en uiterlijk binnen 30 dagen.
        </p>
      </LegalSection>
      <LegalSection title="6. Wijzigingen en contact">
        <p>
          Wijzigt er iets aan deze verklaring, dan vind je de actuele versie altijd op deze pagina.
          Vragen over privacy stel je aan je vaste contactpersoon bij Elevate Social.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
