import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  refreshAccessToken,
  tiktokCanPublishDirectly,
  type SocialPlatform,
} from "@/lib/social-oauth.server";
import {
  buildDirectInitBody,
  buildInboxInitBody,
  chunkPlan,
  contentRange,
  pickPrivacyLevel,
} from "@/lib/tiktok-post";

/**
 * Direct publiceren naar de platforms via de eigen OAuth-koppelingen
 * (social_connections). Geen tussenpartij.
 *
 * Ondersteuning per platform:
 *  - facebook:  tekst en foto (Pages API)
 *  - instagram: foto/video vereist (Graph content publishing, container-flow)
 *  - linkedin:  tekst (UGC posts)
 *  - tiktok:    video vereist (Content Posting API, FILE_UPLOAD in chunks)
 *  - youtube:   nog niet ondersteund (vereist resumable video-upload)
 */

const GRAPH = "https://graph.facebook.com/v21.0";

interface PublishInput {
  caption: string;
  mediaUrl?: string | null;
  mediaType?: string | null; // bv. "image/jpeg" of "video/mp4"
  /** Betaalde samenwerking — stuurt het platformeigen reclamelabel mee waar dat kan. */
  isAd?: boolean;
}

export interface PublishResult {
  externalId: string | null;
  url?: string | null;
}

type Meta = Record<string, unknown>;

async function getConnection(clientId: string, platform: SocialPlatform) {
  const { data: conn } = await supabaseAdmin
    .from("social_connections")
    .select("access_token, refresh_token, token_expires_at, account_id, meta, status")
    .eq("client_id", clientId)
    .eq("platform", platform)
    .maybeSingle();
  if (!conn?.access_token || conn.status !== "active")
    throw new Error(
      `Geen actieve ${platform}-koppeling voor deze klant — koppel eerst via Kanalen`,
    );

  // Token verversen wanneer (bijna) verlopen en het platform dat ondersteunt.
  let accessToken = conn.access_token;
  const nearlyExpired =
    !!conn.token_expires_at &&
    new Date(conn.token_expires_at).getTime() - Date.now() < 30 * 60 * 1000;
  if (nearlyExpired && conn.refresh_token) {
    const fresh = await refreshAccessToken(platform, conn.refresh_token);
    if (fresh) {
      accessToken = fresh.accessToken;
      await supabaseAdmin
        .from("social_connections")
        .update({
          access_token: fresh.accessToken,
          refresh_token: fresh.refreshToken,
          token_expires_at: fresh.expiresAt,
          // Ook de échte deadline bijwerken: TikTok geeft bij elke verversing
          // weer 365 dagen, dus zolang we publiceren blijft de koppeling leven.
          ...(fresh.refreshExpiresAt !== undefined
            ? { refresh_expires_at: fresh.refreshExpiresAt }
            : {}),
        })
        .eq("client_id", clientId)
        .eq("platform", platform);
    }
  }

  const meta: Meta =
    conn.meta && typeof conn.meta === "object" && !Array.isArray(conn.meta)
      ? (conn.meta as Meta)
      : {};
  return { accessToken, accountId: conn.account_id, meta };
}

async function graphPost(path: string, params: Record<string, string>): Promise<Meta> {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Meta & { error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `Meta API-fout (${res.status})`);
  return json;
}

const isVideo = (input: PublishInput) =>
  (input.mediaType ?? "").startsWith("video") ||
  /\.(mp4|mov|webm)(\?|$)/i.test(input.mediaUrl ?? "");

async function publishFacebook(clientId: string, input: PublishInput): Promise<PublishResult> {
  const { meta } = await getConnection(clientId, "facebook");
  const pageId = String(meta.pageId ?? "");
  const pageToken = String(meta.pageToken ?? "");
  if (!pageId || !pageToken)
    throw new Error("Facebook-pagina ontbreekt in de koppeling — koppel Facebook opnieuw");

  if (input.mediaUrl && !isVideo(input)) {
    const json = await graphPost(`${pageId}/photos`, {
      url: input.mediaUrl,
      caption: input.caption,
      access_token: pageToken,
    });
    return { externalId: String(json.post_id ?? json.id ?? "") || null };
  }
  const json = await graphPost(`${pageId}/feed`, {
    message: input.caption,
    access_token: pageToken,
  });
  return { externalId: String(json.id ?? "") || null };
}

async function publishInstagram(clientId: string, input: PublishInput): Promise<PublishResult> {
  const { meta } = await getConnection(clientId, "instagram");
  const igId = String(meta.igUserId ?? "");
  const pageToken = String(meta.pageToken ?? "");
  if (!igId || !pageToken)
    throw new Error("Instagram Business-account ontbreekt — koppel Instagram opnieuw");
  if (!input.mediaUrl)
    throw new Error("Instagram vereist een foto of video — voeg media toe aan de post");

  const container = await graphPost(`${igId}/media`, {
    caption: input.caption,
    access_token: pageToken,
    ...(isVideo(input)
      ? { media_type: "REELS", video_url: input.mediaUrl }
      : { image_url: input.mediaUrl }),
  });
  const creationId = String(container.id ?? "");
  if (!creationId) throw new Error("Instagram-container kon niet worden aangemaakt");

  // Video's hebben verwerkingstijd nodig; kort pollen op status.
  if (isVideo(input)) {
    let finished = false;
    for (let i = 0; i < 10; i++) {
      const status = (await (
        await fetch(
          `${GRAPH}/${creationId}?fields=status_code&access_token=${encodeURIComponent(pageToken)}`,
        )
      ).json()) as { status_code?: string };
      if (status.status_code === "FINISHED") {
        finished = true;
        break;
      }
      if (status.status_code === "ERROR") throw new Error("Instagram kon de video niet verwerken");
      await new Promise((r) => setTimeout(r, 3000));
    }
    if (!finished)
      throw new Error(
        "Instagram-video wordt nog verwerkt (duurt te lang). Probeer over enkele minuten opnieuw te publiceren.",
      );
  }

  const published = await graphPost(`${igId}/media_publish`, {
    creation_id: creationId,
    access_token: pageToken,
  });
  return { externalId: String(published.id ?? "") || null };
}

async function publishLinkedIn(clientId: string, input: PublishInput): Promise<PublishResult> {
  const { accessToken, meta } = await getConnection(clientId, "linkedin");
  const author = String(meta.personUrn ?? "");
  if (!author) throw new Error("LinkedIn-profiel ontbreekt — koppel LinkedIn opnieuw");

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: input.caption },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(json.message ?? `LinkedIn API-fout (${res.status})`);
  }
  return { externalId: res.headers.get("x-restli-id") };
}

const TIKTOK = "https://open.tiktokapis.com/v2";

async function tiktokJson(
  path: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${TIKTOK}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { message?: string; code?: string };
  };
  if (!res.ok || (json.error && json.error.code !== "ok")) {
    throw new Error(json.error?.message ?? `TikTok API-fout (${res.status})`);
  }
  return json;
}

async function publishTikTok(clientId: string, input: PublishInput): Promise<PublishResult> {
  const { accessToken } = await getConnection(clientId, "tiktok");
  if (!input.mediaUrl || !isVideo(input))
    throw new Error("TikTok vereist een video — voeg een video toe aan de post");

  // FILE_UPLOAD, niet PULL_FROM_URL: bij PULL_FROM_URL moet het bronDOMEIN in
  // het TikTok-portaal geverifieerd zijn, en onze media staat op *.supabase.co —
  // een domein dat wij nooit kunnen verifiëren. Dus halen we de bytes zelf op
  // (van onze eigen ondertekende URL) en sturen we ze in stukken naar TikTok.
  const mediaRes = await fetch(input.mediaUrl);
  if (!mediaRes.ok) throw new Error(`Media kon niet worden opgehaald (${mediaRes.status})`);
  const bytes = new Uint8Array(await mediaRes.arrayBuffer());
  const plan = chunkPlan(bytes.byteLength);

  // Zonder goedgekeurde video.publish-scope mag er niet direct openbaar worden
  // gepost; de video gaat dan als concept naar de TikTok-inbox van de klant,
  // die 'm in de app afmaakt. Na de audit schakelt dit automatisch om.
  const direct = tiktokCanPublishDirectly();
  let initBody: Record<string, unknown>;
  if (direct) {
    // Eerst vragen wat dít account toestaat; blind PUBLIC_TO_EVERYONE sturen
    // ketst af op accounts met strengere instellingen.
    const info = await tiktokJson("/post/publish/creator_info/query/", accessToken, {});
    const data = (info.data ?? {}) as { privacy_level_options?: string[] };
    const privacyLevel = pickPrivacyLevel(data.privacy_level_options ?? []);
    initBody = buildDirectInitBody({
      caption: input.caption,
      privacyLevel,
      videoSize: bytes.byteLength,
      isAd: input.isAd,
    });
  } else {
    initBody = buildInboxInitBody(bytes.byteLength);
  }

  const endpoint = direct ? "/post/publish/video/init/" : "/post/publish/inbox/video/init/";
  const init = await tiktokJson(endpoint, accessToken, initBody);
  const initData = (init.data ?? {}) as { publish_id?: string; upload_url?: string };
  if (!initData.upload_url) throw new Error("TikTok gaf geen upload-URL terug");

  for (const range of plan.ranges) {
    const putRes = await fetch(initData.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": input.mediaType ?? "video/mp4",
        "Content-Range": contentRange(range, bytes.byteLength),
      },
      body: bytes.slice(range.start, range.end + 1),
    });
    // 201 bij de laatste chunk, 206 bij tussenliggende.
    if (!putRes.ok && putRes.status !== 206) {
      throw new Error(
        `TikTok-upload mislukt bij chunk ${range.start}-${range.end} (${putRes.status})`,
      );
    }
  }

  return { externalId: initData.publish_id ?? null };
}

export async function publishToPlatform(
  clientId: string,
  platform: SocialPlatform,
  input: PublishInput,
): Promise<PublishResult> {
  switch (platform) {
    case "facebook":
      return publishFacebook(clientId, input);
    case "instagram":
      return publishInstagram(clientId, input);
    case "linkedin":
      return publishLinkedIn(clientId, input);
    case "tiktok":
      return publishTikTok(clientId, input);
    case "youtube":
      throw new Error(
        "YouTube-publicatie vereist een video-upload en wordt nog niet ondersteund — plaats deze handmatig",
      );
  }
}
