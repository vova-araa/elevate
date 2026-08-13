import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * Alles wat het post-dashboard nodig heeft in ÉÉN aanroep, server-side parallel
 * opgehaald. Het dashboard vuurde hiervoor ~11 losse queries af in twee golven.
 *
 * De inhoud is bewust gericht op de dagelijkse vraag: *wat gaat er de komende
 * dagen live, bij welke klant, en waar moet ik nu iets mee?*
 */

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen dit overzicht bekijken");
  }
}

export interface UpcomingPost {
  id: string;
  clientId: string;
  clientName: string | null;
  brandColor: string | null;
  platform: string;
  caption: string | null;
  mediaPath: string | null;
  mediaType: string | null;
  scheduledAt: string;
  status: string;
}

export interface ClientPostingRow {
  clientId: string;
  clientName: string;
  brandColor: string | null;
  logoUrl: string | null;
  /** Actieve kanalen van deze klant. */
  channels: string[];
  /** Geplande posts binnen de horizon. */
  upcoming: number;
  /** Concepten die nog op akkoord wachten. */
  waiting: number;
  /** Dagen tot de eerstvolgende post; null als er niets gepland staat. */
  daysUntilNext: number | null;
}

export interface PostingOverview {
  days: number;
  totals: {
    upcoming: number;
    waiting: number;
    publishedThisWeek: number;
    failed: number;
    expiredChannels: number;
  };
  upcoming: UpcomingPost[];
  clients: ClientPostingRow[];
  /** Klanten met een actief kanaal maar zonder geplande post binnen de horizon. */
  gaps: string[];
}

export const getPostingOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        days: z.number().int().min(1).max(60).default(7),
        clientId: z.string().uuid().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<PostingOverview> => {
    await assertAdmin(context);

    const now = new Date();
    const until = new Date(now.getTime() + data.days * 86400000);
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    const scoped = <T extends { eq: (c: string, v: string) => T }>(q: T): T =>
      data.clientId ? q.eq("client_id", data.clientId) : q;

    const [clientsRes, upcomingRes, waitingRes, publishedRes, failedRes, channelsRes] =
      await Promise.all([
        supabaseAdmin.from("clients").select("id, name, brand_color, logo_url").order("name"),
        scoped(
          supabaseAdmin
            .from("scheduled_posts")
            .select(
              "id, client_id, platform, caption, media_path, media_type, scheduled_at, status",
            )
            .is("deleted_at", null)
            .in("status", ["scheduled", "publishing"])
            .gte("scheduled_at", now.toISOString())
            .lte("scheduled_at", until.toISOString())
            .order("scheduled_at", { ascending: true })
            .limit(60),
        ),
        scoped(
          supabaseAdmin
            .from("scheduled_posts")
            .select("id, client_id")
            .is("deleted_at", null)
            .eq("status", "draft"),
        ),
        scoped(
          supabaseAdmin
            .from("scheduled_posts")
            .select("id", { count: "exact", head: true })
            .eq("status", "published")
            .gte("published_at", weekAgo.toISOString()),
        ),
        scoped(
          supabaseAdmin
            .from("scheduled_posts")
            .select("id", { count: "exact", head: true })
            .is("deleted_at", null)
            .eq("status", "failed"),
        ),
        scoped(supabaseAdmin.from("social_connections").select("client_id, platform, status")),
      ]);

    const clients = clientsRes.data ?? [];
    const nameById = new Map(clients.map((c) => [c.id, c]));
    const upcomingRows = upcomingRes.data ?? [];
    const waitingRows = waitingRes.data ?? [];
    const channelRows = channelsRes.data ?? [];

    const upcoming: UpcomingPost[] = upcomingRows.map((p) => {
      const c = nameById.get(p.client_id);
      return {
        id: p.id,
        clientId: p.client_id,
        clientName: c?.name ?? null,
        brandColor: c?.brand_color ?? null,
        platform: p.platform,
        caption: p.caption,
        mediaPath: p.media_path,
        mediaType: p.media_type,
        scheduledAt: p.scheduled_at,
        status: p.status,
      };
    });

    // Per klant samenvatten: kanalen, geplande posts, wachtrij en het gat tot
    // de eerstvolgende post.
    const activeChannels = new Map<string, string[]>();
    for (const ch of channelRows) {
      if (ch.status !== "active") continue;
      activeChannels.set(ch.client_id, [...(activeChannels.get(ch.client_id) ?? []), ch.platform]);
    }
    const upcomingByClient = new Map<string, UpcomingPost[]>();
    for (const p of upcoming) {
      upcomingByClient.set(p.clientId, [...(upcomingByClient.get(p.clientId) ?? []), p]);
    }
    const waitingByClient = new Map<string, number>();
    for (const w of waitingRows) {
      waitingByClient.set(w.client_id, (waitingByClient.get(w.client_id) ?? 0) + 1);
    }

    const relevant = data.clientId ? clients.filter((c) => c.id === data.clientId) : clients;
    const rows: ClientPostingRow[] = relevant.map((c) => {
      const mine = upcomingByClient.get(c.id) ?? [];
      const next = mine[0];
      return {
        clientId: c.id,
        clientName: c.name,
        brandColor: c.brand_color,
        logoUrl: c.logo_url,
        channels: activeChannels.get(c.id) ?? [],
        upcoming: mine.length,
        waiting: waitingByClient.get(c.id) ?? 0,
        daysUntilNext: next
          ? Math.max(
              0,
              Math.round((new Date(next.scheduledAt).getTime() - now.getTime()) / 86400000),
            )
          : null,
      };
    });

    // Sorteer op urgentie: eerst wie niets gepland heeft maar wél kanalen heeft.
    rows.sort((a, b) => {
      const aGap = a.channels.length > 0 && a.upcoming === 0 ? 0 : 1;
      const bGap = b.channels.length > 0 && b.upcoming === 0 ? 0 : 1;
      if (aGap !== bGap) return aGap - bGap;
      return a.upcoming - b.upcoming;
    });

    return {
      days: data.days,
      totals: {
        upcoming: upcoming.length,
        waiting: waitingRows.length,
        publishedThisWeek: publishedRes.count ?? 0,
        failed: failedRes.count ?? 0,
        expiredChannels: channelRows.filter((c) => c.status === "expired").length,
      },
      upcoming,
      clients: rows,
      gaps: rows.filter((r) => r.channels.length > 0 && r.upcoming === 0).map((r) => r.clientName),
    };
  });
