import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Gebruiksvoorwaarden — Elevate Design" },
      {
        name: "description",
        content: "De gebruiksvoorwaarden van het Elevate Design platform.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage eyebrow="Juridisch" title="Gebruiksvoorwaarden" updated="23 juli 2026">
      <LegalSection title="1. Wat Elevate Design is">
        <p>
          Elevate Design is het klant- en contentplatform van onze studio (elevatedesign.nl). Wij
          plannen, maken en publiceren socialemediacontent voor onze klanten. Via het platform
          bekijk je planningen, keur je content goed, deel je bestanden en volg je de resultaten van
          je merk.
        </p>
      </LegalSection>
      <LegalSection title="2. Accounts en toegang">
        <p>
          Je krijgt toegang met een persoonlijk account dat door ons wordt aangemaakt. Houd je
          inloggegevens voor jezelf en meld het ons direct als je vermoedt dat iemand anders toegang
          heeft. Wij mogen accounts beveiligen, beperken of sluiten wanneer dat nodig is om het
          platform en onze klanten te beschermen.
        </p>
        <p>
          Sommige goedkeuringen en koppelingen verlopen via een beveiligde deel-link zonder login.
          Zo'n link is persoonlijk, beperkt geldig en alleen bedoeld voor de ontvanger.
        </p>
      </LegalSection>
      <LegalSection title="3. Jouw content blijft van jou">
        <p>
          Alle merkmaterialen, teksten, beelden en video's die jij aanlevert of die wij in opdracht
          voor je maken, blijven eigendom van jou of van je onderneming volgens de afspraken in onze
          samenwerkingsovereenkomst. Je geeft ons toestemming om deze content te gebruiken voor het
          uitvoeren van onze diensten, zoals het inplannen en publiceren op je eigen kanalen.
        </p>
      </LegalSection>
      <LegalSection title="4. Koppelingen met sociale platforms">
        <p>
          Je kunt je eigen accounts (zoals Instagram, Facebook, TikTok, LinkedIn en YouTube)
          koppelen via de officiële koppelingen van die platforms. Je geeft daarbij zelf toestemming
          op het platform in kwestie en kunt die toestemming altijd intrekken — in Elevate Design
          via "Ontkoppelen" of rechtstreeks in de instellingen van het platform. We gebruiken de
          toegang uitsluitend om namens jou te publiceren en de statistieken van je eigen berichten
          op te halen. Voor het gebruik van die platforms gelden ook hun eigen voorwaarden, zoals de
          TikTok Developer Terms en het Meta Platform Terms-beleid.
        </p>
      </LegalSection>
      <LegalSection title="5. Redelijk gebruik">
        <p>
          Gebruik het platform niet voor content die onrechtmatig is, rechten van anderen schendt of
          de regels van de gekoppelde sociale platforms overtreedt. Wij mogen publicatie weigeren of
          verwijderen wanneer die regels dat vragen.
        </p>
      </LegalSection>
      <LegalSection title="6. Beschikbaarheid en aansprakelijkheid">
        <p>
          We doen ons uiterste best om het platform beschikbaar en veilig te houden, maar kunnen
          geen ononderbroken werking garanderen — we zijn mede afhankelijk van de sociale platforms
          en onze hostingpartijen. Onze aansprakelijkheid is beperkt tot wat in de
          samenwerkingsovereenkomst is afgesproken en tot wat de wet toestaat.
        </p>
      </LegalSection>
      <LegalSection title="7. Wijzigingen en contact">
        <p>
          We kunnen deze voorwaarden bijwerken; de actuele versie staat altijd op deze pagina.
          Vragen? Mail ons op{" "}
          <a href="mailto:elevate.plannen@gmail.com" className="text-gold hover:underline">
            elevate.plannen@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
