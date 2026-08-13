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
        platform: z.enum(["instagram", "facebook"]),
        limit: z.number().int().min(1).max(50).default(24),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<PublishedFeedItem[]> => {
    await assertClientAccess(context.supabase, context.userId, data.clientId);

    const meta = await connectionMeta(data.clientId, data.platform);
    // Niet gekoppeld → lege feed in plaats van een fout; de planner toont dan
    // alleen de eigen geplande/gepubliceerde posts.
    if (!meta?.pageToken) return [];
    const token = encodeURIComponent(meta.pageToken);

    if (data.platform === "instagram") {
      if (!meta.igUserId) return [];
      const json = await getJson(
        `${GRAPH}/${meta.igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${data.limit}&access_token=${token}`,
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

    if (!meta.pageId) return [];
    const json = await getJson(
      `${GRAPH}/${meta.pageId}/posts?fields=id,message,full_picture,permalink_url,created_time&limit=${data.limit}&access_token=${token}`,
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
  });
