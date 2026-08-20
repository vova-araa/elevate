import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mergeFeed, signablePaths } from "@/lib/feed-merge";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  refreshAccessToken,
  tiktokCanReadFeed,
  type SocialPlatform,
} from "@/lib/social-oauth.server";

/**
 * De échte gepubliceerde feed van een gekoppeld account ophalen, zodat je in de
 * planner ziet hoe het profiel er nú uitziet — en met de geplande posts erbij
 * hoe het er over X dagen uit gaat zien.
 *
 * Instagram gebruikt /{ig-user-id}/media (instagram_basic), Facebook
 * /{page-id}/posts (pages_read_engagement). TikTok heeft hiervoor de
 * video.list-scope nodig die we (nog) niet aanvragen; die feed blijft dus leeg
 * en valt terug op onze eigen registratie van gepubliceerde posts.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export interface PublishedFeedItem {
  id: string;
  caption: string | null;
  mediaUrl: string | null;
  permalink: string | null;
  publishedAt: string;
  isVideo: boolean;
  /**
   * "gepubliceerd" staat op het profiel; "gepland" staat klaar bij ons. Beide
   * horen in hetzelfde raster: een feed die alleen het verleden toont is voor
   * een bureau half werk — je wilt zien hoe het profiel eruit gáát zien.
   */
  kind: "gepubliceerd" | "gepland";
}

/** Alle platforms waarvoor we een feed kunnen tonen. */
const FEED_PLATFORM = z.enum(["instagram", "facebook", "tiktok", "linkedin", "youtube"]);
export type FeedPlatform = z.infer<typeof FEED_PLATFORM>;

/**
 * Waar de getoonde feed vandaan komt. Dit staat ook in de kaart zelf, want het
 * verschil is echt: "platform" is wat de wereld ziet op het profiel, "eigen" is
 * alleen wat wij hebben gepubliceerd.
 */
export type FeedSource = "platform" | "eigen";

/** De feed zoals een bron hem levert, nog zonder tellingen. */
export type FeedBase = Omit<PublishedFeed, "publishedCount" | "plannedCount">;

export interface PublishedFeed {
  source: FeedSource;
  items: PublishedFeedItem[];
  /** Waarom het niet de echte feed is, als dat zo is. */
  note: string | null;
  /** Aantallen apart, zodat het kopje niet hoeft te tellen. */
  publishedCount: number;
  plannedCount: number;
}

/**
 * Toegangstoken van een koppeling, zo nodig eerst ververst. TikTok-tokens leven
 * 24 uur, dus zonder deze stap is de feed de dag na het koppelen al leeg.
 */
async function accessTokenFor(clientId: string, platform: FeedPlatform): Promise<string | null> {
  const { data: conn } = await supabaseAdmin
    .from("social_connections")
    .select("access_token, refresh_token, token_expires_at, status")
    .eq("client_id", clientId)
    .eq("platform", platform)
    .maybeSingle();
  if (!conn?.access_token || conn.status !== "active") return null;

  const nearlyExpired =
    !!conn.token_expires_at &&
    new Date(conn.token_expires_at).getTime() - Date.now() < 30 * 60 * 1000;
  if (!nearlyExpired || !conn.refresh_token) return conn.access_token;

  const fresh = await refreshAccessToken(platform as SocialPlatform, conn.refresh_token).catch(
    () => null,
  );
  if (!fresh) return conn.access_token;

  await supabaseAdmin
    .from("social_connections")
    .update({
      access_token: fresh.accessToken,
      refresh_token: fresh.refreshToken,
      token_expires_at: fresh.expiresAt,
      ...(fresh.refreshExpiresAt !== undefined
        ? { refresh_expires_at: fresh.refreshExpiresAt }
        : {}),
    })
    .eq("client_id", clientId)
    .eq("platform", platform);
  return fresh.accessToken;
}

/**
 * De echte TikTok-feed. Vereist de `video.list`-scope, die pas na de volledige
 * app-audit beschikbaar is; zonder die scope weigert TikTok het hele verzoek,
 * dus vragen we het niet eens en vallen we terug op onze eigen registratie.
 */
async function tiktokFeed(clientId: string, limit: number): Promise<PublishedFeedItem[] | null> {
  if (!tiktokCanReadFeed()) return null;
  const token = await accessTokenFor(clientId, "tiktok");
  if (!token) return null;

  const res = await fetch(
    "https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,cover_image_url,share_url,create_time",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ max_count: Math.min(limit, 20) }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    data?: { videos?: Array<Record<string, unknown>> };
    error?: { code?: string; message?: string };
  };
  if (!res.ok || (json.error?.code && json.error.code !== "ok")) return null;

  return (json.data?.videos ?? []).map((v) => ({
    id: String(v.id),
    caption: (v.video_description as string) || (v.title as string) || null,
    mediaUrl: (v.cover_image_url as string) ?? null,
    permalink: (v.share_url as string) ?? null,
    publishedAt: v.create_time
      ? new Date(Number(v.create_time) * 1000).toISOString()
      : new Date(0).toISOString(),
    isVideo: true,
    kind: "gepubliceerd" as const,
  }));
}

/**
 * De echte YouTube-feed via de uploads-playlist van het kanaal. De
 * `youtube.readonly`-scope vragen we al bij het koppelen, dus dit werkt zodra
 * een kanaal gekoppeld is.
 */
async function youtubeFeed(clientId: string, limit: number): Promise<PublishedFeedItem[] | null> {
  const token = await accessTokenFor(clientId, "youtube");
  if (!token) return null;

  try {
    const channel = await getJson(
      "https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true",
      token,
    );
    const uploads = ((channel.items as Array<{
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>) ?? [])[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) return null;

    const json = await getJson(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${encodeURIComponent(uploads)}&maxResults=${Math.min(limit, 50)}`,
      token,
    );
    const rows = (json.items ?? []) as Array<{
      snippet?: {
        title?: string;
        publishedAt?: string;
        resourceId?: { videoId?: string };
        thumbnails?: Record<string, { url?: string }>;
      };
    }>;
    return rows.map((r) => {
      const videoId = r.snippet?.resourceId?.videoId ?? "";
      const thumbs = r.snippet?.thumbnails ?? {};
      return {
        id: videoId || crypto.randomUUID(),
        caption: r.snippet?.title ?? null,
        mediaUrl: (thumbs.high ?? thumbs.medium ?? thumbs.default)?.url ?? null,
        permalink: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
        publishedAt: r.snippet?.publishedAt ?? new Date(0).toISOString(),
        isVideo: true,
        kind: "gepubliceerd" as const,
      };
    });
  } catch {
    return null;
  }
}

/**
 * Terugval: onze eigen registratie van wat we voor deze klant hebben
 * gepubliceerd. Voor TikTok, LinkedIn en YouTube is dit de enige bron — die
 * API's vragen scopes voor het teruglezen van een feed die we niet aanvragen —
 * en voor Meta is het het vangnet als de koppeling stukloopt.
 *
 * Media staat in een privébucket, dus elke tegel krijgt een kortlevende
 * ondertekende URL. Bestanden die na 30 dagen zijn opgeruimd hebben er geen
 * meer; die tegel toont het platformicoon in plaats van beeld.
 */
async function ownPublishedPosts(
  clientId: string,
  platform: FeedPlatform,
  limit: number,
): Promise<PublishedFeedItem[]> {
  const { data: rows } = await supabaseAdmin
    .from("scheduled_posts")
    .select("id, caption, media_path, media_type, published_at, scheduled_at, media_purged_at")
    .eq("client_id", clientId)
    .eq("platform", platform)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  // Tenant-isolatie: media_path is door de klant bewerkbaar (RLS staat een
  // update op de hele rij toe), dus signeren we uitsluitend paden binnen de map
  // van deze klant — dezelfde check als op het publiceerpad. Zonder dit kan een
  // pad naar andermans map hier een geldige URL opleveren, want de service-role
  // client negeert de storage-policies.
  const paths = signablePaths(rows ?? [], clientId);

  // Eén verzoek voor alle paden; per tegel signeren maakt van een grid van 12
  // tegels twaalf rondjes naar de opslag.
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabaseAdmin.storage
      .from("client-uploads")
      .createSignedUrls(paths, 3600);
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }
  }

  return (rows ?? []).map((r) => ({
    id: r.id,
    caption: r.caption,
    mediaUrl: r.media_path ? (signed.get(r.media_path) ?? null) : null,
    permalink: null,
    publishedAt: r.published_at ?? r.scheduled_at,
    isVideo: (r.media_type ?? "").startsWith("video"),
    kind: "gepubliceerd" as const,
  }));
}

async function assertClientAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  clientId: string,
) {
  const { data, error } = await supabase.rpc("user_has_client_access", {
    _user_id: userId,
    _client_id: clientId,
  });
  if (error || !data) throw new Error("Geen toegang tot deze klant");
}

interface ConnMeta {
  igUserId?: string;
  pageId?: string;
  pageToken?: string;
}

async function connectionMeta(
  clientId: string,
  platform: "instagram" | "facebook",
): Promise<ConnMeta | null> {
  const { data } = await supabaseAdmin
    .from("social_connections")
    .select("meta, status")
    .eq("client_id", clientId)
    .eq("platform", platform)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  return data.meta && typeof data.meta === "object" && !Array.isArray(data.meta)
    ? (data.meta as ConnMeta)
    : null;
}

async function getJson(url: string, token?: string): Promise<Record<string, unknown>> {
  const res = await fetch(
    url,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  );
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? `Feed ophalen mislukt (${res.status})`);
  return json;
}

/**
 * Wat er klaarstaat maar nog niet live is: concepten en ingeplande posts.
 *
 * Een bureau beoordeelt een profiel op hoe het straks oogt, niet alleen op wat
 * er al staat. Door deze posts vóór de gepubliceerde te zetten zie je precies
 * dat: het raster leest als het toekomstige profiel.
 */
async function plannedPosts(
  clientId: string,
  platform: FeedPlatform,
  limit: number,
): Promise<PublishedFeedItem[]> {
  const { data: rows } = await supabaseAdmin
    .from("scheduled_posts")
    .select("id, caption, media_path, media_type, scheduled_at, media_purged_at")
    .eq("client_id", clientId)
    .eq("platform", platform)
    .in("status", ["scheduled", "draft", "publishing"])
    .is("deleted_at", null)
    // Wat het eerst live gaat, staat vooraan — dat is ook de volgorde waarin
    // het straks op het profiel verschijnt.
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  // Dezelfde tenant-check als elders: media_path is door de klant te bewerken,
  // dus we signeren uitsluitend paden binnen de map van deze klant.
  const paths = signablePaths(rows ?? [], clientId);

  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabaseAdmin.storage
      .from("client-uploads")
      .createSignedUrls(paths, 3600);
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }
  }

  return (rows ?? []).map((r) => ({
    id: r.id,
    caption: r.caption,
    mediaUrl: r.media_path ? (signed.get(r.media_path) ?? null) : null,
    permalink: null,
    publishedAt: r.scheduled_at,
    isVideo: (r.media_type ?? "").startsWith("video"),
    kind: "gepland" as const,
  }));
}

/**
 * Plakt de geplande posts vóór de feed en telt beide soorten. Dit gebeurt voor
 * élke bron: ook als Instagram een echte feed teruggeeft wil je zien wat er
 * bovenop komt.
 */
async function withPlanned(
  clientId: string,
  platform: FeedPlatform,
  limit: number,
  feed: FeedBase,
): Promise<PublishedFeed> {
  const planned = await plannedPosts(clientId, platform, limit).catch(() => []);
  return {
    ...feed,
    items: mergeFeed(planned, feed.items, limit),
    publishedCount: feed.items.length,
    plannedCount: planned.length,
  };
}

/** Waarom er geen echte feed is, per platform. */
const FALLBACK_NOTE: Record<FeedPlatform, string> = {
  instagram: "Instagram-koppeling geeft nu geen feed terug — dit zijn onze eigen posts.",
  facebook: "Facebook-koppeling geeft nu geen feed terug — dit zijn onze eigen posts.",
  tiktok:
    "TikTok geeft de feed pas vrij met de video.list-scope (na de app-audit) — dit zijn onze eigen posts.",
  youtube: "YouTube-koppeling geeft nu geen feed terug — dit zijn onze eigen posts.",
  linkedin:
    "LinkedIn laat eigen berichten niet teruglezen zonder partnerstatus — dit zijn onze eigen posts.",
};

async function fallback(
  clientId: string,
  platform: FeedPlatform,
  limit: number,
): Promise<FeedBase> {
  return {
    source: "eigen",
    items: await ownPublishedPosts(clientId, platform, limit),
    note: FALLBACK_NOTE[platform],
  };
}

export const getPublishedFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        platform: FEED_PLATFORM,
        limit: z.number().int().min(1).max(50).default(24),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<PublishedFeed> => {
    await assertClientAccess(context.supabase, context.userId, data.clientId);
    const { platform, clientId, limit } = data;
    return withPlanned(clientId, platform, limit, await sourceFeed(clientId, platform, limit));
  });

/** Haalt de feed op bij de beste beschikbare bron voor dit platform. */
async function sourceFeed(
  clientId: string,
  platform: FeedPlatform,
  limit: number,
): Promise<FeedBase> {
  if (platform === "tiktok") {
    const items = await tiktokFeed(clientId, limit).catch(() => null);
    return items ? { source: "platform", items, note: null } : fallback(clientId, platform, limit);
  }

  if (platform === "youtube") {
    const items = await youtubeFeed(clientId, limit).catch(() => null);
    return items ? { source: "platform", items, note: null } : fallback(clientId, platform, limit);
  }

  if (platform === "linkedin") return fallback(clientId, platform, limit);

  const meta = await connectionMeta(clientId, platform);
  // Geen bruikbare koppeling → onze eigen registratie in plaats van een lege
  // kaart, zodat je altijd nog ziet wat er via ons is gepubliceerd.
  if (!meta?.pageToken) return fallback(clientId, platform, limit);
  const token = encodeURIComponent(meta.pageToken);

  try {
    if (platform === "instagram") {
      if (!meta.igUserId) return fallback(clientId, platform, limit);
      const json = await getJson(
        `${GRAPH}/${meta.igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${limit}&access_token=${token}`,
      );
      const rows = (json.data ?? []) as Array<{
        id: string;
        caption?: string;
        media_type?: string;
        media_url?: string;
        thumbnail_url?: string;
        permalink?: string;
        timestamp?: string;
      }>;
      return {
        source: "platform",
        note: null,
        items: rows.map((r) => ({
          id: r.id,
          caption: r.caption ?? null,
          // Video's leveren een thumbnail; die is geschikter voor een grid.
          mediaUrl: r.thumbnail_url ?? r.media_url ?? null,
          permalink: r.permalink ?? null,
          publishedAt: r.timestamp ?? new Date(0).toISOString(),
          isVideo: r.media_type === "VIDEO" || r.media_type === "REELS",
          kind: "gepubliceerd" as const,
        })),
      };
    }

    if (!meta.pageId) return fallback(clientId, platform, limit);
    const json = await getJson(
      `${GRAPH}/${meta.pageId}/posts?fields=id,message,full_picture,permalink_url,created_time&limit=${limit}&access_token=${token}`,
    );
    const rows = (json.data ?? []) as Array<{
      id: string;
      message?: string;
      full_picture?: string;
      permalink_url?: string;
      created_time?: string;
    }>;
    return {
      source: "platform",
      note: null,
      items: rows.map((r) => ({
        id: r.id,
        caption: r.message ?? null,
        mediaUrl: r.full_picture ?? null,
        permalink: r.permalink_url ?? null,
        publishedAt: r.created_time ?? new Date(0).toISOString(),
        isVideo: false,
        kind: "gepubliceerd" as const,
      })),
    };
  } catch {
    // Token ingetrokken of rechten weg: liever onze eigen posts tonen dan een
    // foutmelding op het dashboard. De tokenbewaking meldt het probleem apart.
    return fallback(clientId, platform, limit);
  }
}
