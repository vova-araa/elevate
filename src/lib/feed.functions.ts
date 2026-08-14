import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

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
}

/** Alle platforms waarvoor we een feed kunnen tonen. */
const FEED_PLATFORM = z.enum(["instagram", "facebook", "tiktok", "linkedin", "youtube"]);
export type FeedPlatform = z.infer<typeof FEED_PLATFORM>;

/** Platforms waarvan we de feed rechtstreeks bij het platform kunnen ophalen. */
const READABLE_VIA_API: FeedPlatform[] = ["instagram", "facebook"];

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

  const paths = (rows ?? [])
    .filter((r) => r.media_path && !r.media_purged_at)
    .map((r) => r.media_path!);

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

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? `Feed ophalen mislukt (${res.status})`);
  return json;
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
  .handler(async ({ data, context }): Promise<PublishedFeedItem[]> => {
    await assertClientAccess(context.supabase, context.userId, data.clientId);
    const { platform, clientId, limit } = data;

    if (!READABLE_VIA_API.includes(platform)) {
      return ownPublishedPosts(clientId, platform, limit);
    }

    const meta = await connectionMeta(clientId, platform as "instagram" | "facebook");
    // Geen bruikbare koppeling → onze eigen registratie in plaats van een lege
    // kaart, zodat je altijd nog ziet wat er via ons is gepubliceerd.
    if (!meta?.pageToken) return ownPublishedPosts(clientId, platform, limit);
    const token = encodeURIComponent(meta.pageToken);

    try {
      if (platform === "instagram") {
        if (!meta.igUserId) return ownPublishedPosts(clientId, platform, limit);
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
        return rows.map((r) => ({
          id: r.id,
          caption: r.caption ?? null,
          // Video's leveren een thumbnail; die is geschikter voor een grid.
          mediaUrl: r.thumbnail_url ?? r.media_url ?? null,
          permalink: r.permalink ?? null,
          publishedAt: r.timestamp ?? new Date(0).toISOString(),
          isVideo: r.media_type === "VIDEO" || r.media_type === "REELS",
        }));
      }

      if (!meta.pageId) return ownPublishedPosts(clientId, platform, limit);
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
      return rows.map((r) => ({
        id: r.id,
        caption: r.message ?? null,
        mediaUrl: r.full_picture ?? null,
        permalink: r.permalink_url ?? null,
        publishedAt: r.created_time ?? new Date(0).toISOString(),
        isVideo: false,
      }));
    } catch {
      // Token ingetrokken of rechten weg: liever onze eigen posts tonen dan een
      // foutmelding op het dashboard. De tokenbewaking meldt het probleem apart.
      return ownPublishedPosts(clientId, platform, limit);
    }
  });
