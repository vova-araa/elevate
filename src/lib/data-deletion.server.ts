import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { appUrl } from "@/lib/social-oauth.server";

/**
 * Meta's "Data Deletion Request Callback".
 *
 * Als iemand in zijn Facebook-instellingen onze app verwijdert, roept Meta dit
 * endpoint aan met een `signed_request`. Wij moeten dan (a) de gegevens van die
 * persoon verwijderen en (b) direct een JSON-antwoord geven met een status-URL
 * en een bevestigingscode. Meta controleert dit bij de app-review; een statische
 * uitlegpagina is niet genoeg.
 *
 * Meta stuurt alleen een app-scoped user id mee — geen naam, geen e-mail. Dat id
 * slaan we bij het koppelen op als `meta.metaUserId`, zodat we hier weten welke
 * koppeling het betreft.
 */

function b64urlToBuffer(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export interface SignedRequestPayload {
  user_id?: string;
  algorithm?: string;
  issued_at?: number;
}

/**
 * Handtekening controleren met de app secret. Geeft `null` terug zodra er iets
 * niet klopt — een ongeldig verzoek mag nooit een verwijdering starten.
 */
export function parseSignedRequest(signedRequest: string): SignedRequestPayload | null {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return null;

  const parts = signedRequest.split(".");
  if (parts.length !== 2) return null;
  const [encodedSig, encodedPayload] = parts;

  const expected = createHmac("sha256", secret).update(encodedPayload).digest();
  const actual = b64urlToBuffer(encodedSig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  let payload: SignedRequestPayload;
  try {
    payload = JSON.parse(b64urlToBuffer(encodedPayload).toString("utf8"));
  } catch {
    return null;
  }
  // Meta gebruikt HMAC-SHA256; een ander algoritme betekent dat onze controle
  // hierboven niets bewijst.
  if (payload.algorithm && payload.algorithm.toUpperCase() !== "HMAC-SHA256") return null;
  return payload;
}

export interface DeletionOutcome {
  confirmationCode: string;
  statusUrl: string;
}

/**
 * Verwijdert alles wat aan deze Meta-gebruiker hangt: de opgeslagen tokens en de
 * van het platform opgehaalde accountgegevens. De klant zelf en zijn content
 * blijven bestaan — die zijn niet van Meta en vallen onder een eigen
 * verwijderverzoek (zie /data-deletion).
 */
export async function handleMetaDeletion(
  platformUserId: string,
  origin?: string,
): Promise<DeletionOutcome> {
  const confirmationCode = randomBytes(12).toString("hex");

  // De id-waarde belandt in een PostgREST `or`-filter, waar komma's en haakjes
  // grammaticaal zijn. Meta-id's zijn altijd cijfers; alles anders weigeren we
  // in plaats van te escapen.
  const safeId = /^[0-9]{1,32}$/.test(platformUserId);
  const { data: matches } = safeId
    ? await supabaseAdmin
        .from("social_connections")
        .select("id, client_id, platform, account_id")
        .in("platform", ["facebook", "instagram"])
        .or(`account_id.eq.${platformUserId},meta->>metaUserId.eq.${platformUserId}`)
    : {
        data: [] as {
          id: string;
          client_id: string;
          platform: string;
          account_id: string | null;
        }[],
      };

  const ids = (matches ?? []).map((m) => m.id);
  if (ids.length) {
    // Volledig verwijderen, niet alleen op "expired" zetten: het verzoek gaat er
    // juist om dat wij niets meer bewaren.
    await supabaseAdmin.from("social_connections").delete().in("id", ids);
  }

  await supabaseAdmin.from("data_deletion_requests").insert({
    confirmation_code: confirmationCode,
    platform: "meta",
    platform_user_id: platformUserId,
    status: "completed",
    details: {
      removed_connections: ids.length,
      platforms: [...new Set((matches ?? []).map((m) => m.platform))],
    },
    completed_at: new Date().toISOString(),
  });

  let base: string;
  try {
    base = appUrl(origin);
  } catch {
    base = "https://www.elevatedesign.nl";
  }

  return {
    confirmationCode,
    statusUrl: `${base}/data-deletion-status?code=${confirmationCode}`,
  };
}

export interface DeletionStatus {
  found: boolean;
  status?: string;
  requestedAt?: string;
  completedAt?: string | null;
  removedConnections?: number;
}

export async function lookupDeletionStatus(code: string): Promise<DeletionStatus> {
  const { data } = await supabaseAdmin
    .from("data_deletion_requests")
    .select("status, created_at, completed_at, details")
    .eq("confirmation_code", code)
    .maybeSingle();
  if (!data) return { found: false };
  const details =
    data.details && typeof data.details === "object" && !Array.isArray(data.details)
      ? (data.details as Record<string, unknown>)
      : {};
  return {
    found: true,
    status: data.status,
    requestedAt: data.created_at,
    completedAt: data.completed_at,
    removedConnections:
      typeof details.removed_connections === "number" ? details.removed_connections : 0,
  };
}
