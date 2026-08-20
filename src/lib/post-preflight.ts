/**
 * Controleert vóór het opslaan of een post überhaupt gepubliceerd kán worden.
 *
 * De aanleiding is concreet: een PNG op een TikTok-post laat zich probleemloos
 * inplannen en goedkeuren, maar TikTok's Content Posting API neemt alleen
 * video's aan. De post staat er dan keurig bij als "Goedgekeurd / Ingepland" en
 * mislukt pas uren later, op het moment dat hij live had moeten staan. Dat is de
 * duurste soort fout: je merkt hem als het te laat is.
 *
 * Alles hier komt uit de regels die social-publish.server.ts daadwerkelijk
 * afdwingt. Dit is bewust een kopie van díe waarheid en geen eigen mening —
 * wijzigt het publiceerpad, dan wijzigt deze lijst mee.
 */

export type IssueLevel = "blokkerend" | "let-op";

export interface PreflightIssue {
  level: IssueLevel;
  /** Wat er mis is, in de taal van de gebruiker. */
  message: string;
  /** Wat je eraan doet. Leeg als dat uit de melding zelf blijkt. */
  fix?: string;
}

export interface PreflightInput {
  platform: string;
  /** MIME-type van de media, bv. "image/png" of "video/mp4". */
  mediaType?: string | null;
  hasMedia: boolean;
  caption: string;
  /** Of het kanaal voor deze klant gekoppeld en actief is. */
  connected: boolean;
  /** Gekozen publicatiemoment. */
  scheduledAt?: Date | null;
  /** Nu, injecteerbaar zodat de test niet van de klok afhangt. */
  now?: Date;
}

const isVideo = (mediaType?: string | null) => (mediaType ?? "").startsWith("video");

/** Zichtbare lengte in de TikTok-preview; daarboven wordt het afgekapt. */
const TIKTOK_PREVIEW = 150;

export function preflightPost(input: PreflightInput): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const now = input.now ?? new Date();

  if (!input.connected) {
    issues.push({
      level: "blokkerend",
      message: `${label(input.platform)} is niet gekoppeld voor deze klant.`,
      fix: "Koppel het kanaal bij Kanalen, of haal dit platform uit de post.",
    });
  }

  switch (input.platform) {
    case "tiktok":
      // De harde regel uit publishTikTok: zonder video komt hij niet eens langs
      // de init-aanroep.
      if (!input.hasMedia) {
        issues.push({
          level: "blokkerend",
          message: "TikTok vereist een video.",
          fix: "Voeg een videobestand toe.",
        });
      } else if (!isVideo(input.mediaType)) {
        issues.push({
          level: "blokkerend",
          message: "TikTok accepteert geen losse afbeelding — alleen video.",
          fix: "Vervang de afbeelding door een video, of kies een ander platform.",
        });
      }
      if (input.caption.length > TIKTOK_PREVIEW) {
        issues.push({
          level: "let-op",
          message: `De caption is langer dan ${TIKTOK_PREVIEW} tekens en wordt in de TikTok-weergave afgekapt.`,
          fix: "Zet de kern in de eerste zin.",
        });
      }
      break;

    case "instagram":
      if (!input.hasMedia) {
        issues.push({
          level: "blokkerend",
          message: "Instagram vereist een foto of video.",
          fix: "Voeg media toe aan de post.",
        });
      }
      break;

    case "facebook":
      // Facebook zonder media is een gewone tekstpost; dat mag. Een video gaat
      // via het feed-endpoint en wordt daar niet als video geüpload — beter
      // vooraf zeggen dan achteraf een halve post.
      if (input.hasMedia && isVideo(input.mediaType)) {
        issues.push({
          level: "let-op",
          message: "Video's naar Facebook worden nog niet als video geplaatst.",
          fix: "Plaats de video voorlopig handmatig op de pagina.",
        });
      }
      break;

    case "youtube":
      issues.push({
        level: "blokkerend",
        message: "YouTube publiceren wordt nog niet ondersteund.",
        fix: "Plaats deze video handmatig.",
      });
      break;
  }

  if (!input.caption.trim() && !input.hasMedia) {
    issues.push({
      level: "blokkerend",
      message: "De post is leeg: geen tekst en geen media.",
    });
  }

  if (input.scheduledAt && input.scheduledAt.getTime() < now.getTime()) {
    issues.push({
      level: "let-op",
      message:
        "Het gekozen moment ligt in het verleden — deze post gaat bij de eerstvolgende ronde meteen live.",
    });
  }

  return issues;
}

/** Blokkerende problemen tegenhouden; "let op" mag door. */
export function hasBlocker(issues: PreflightIssue[]): boolean {
  return issues.some((i) => i.level === "blokkerend");
}

function label(platform: string): string {
  const map: Record<string, string> = {
    instagram: "Instagram",
    facebook: "Facebook",
    tiktok: "TikTok",
    youtube: "YouTube",
    linkedin: "LinkedIn",
  };
  return map[platform] ?? platform;
}
