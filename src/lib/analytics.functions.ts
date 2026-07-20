import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Eén analytics-laag die uitsluitend echte cijfers teruggeeft:
 * - posttellingen komen uit `scheduled_posts` (echt).
 * - volgersaantallen komen uit `social_connections.follower_count` (echt,
 *   null voor platforms die dat niet leveren zoals Facebook/LinkedIn).
 * - volgersgroei komt uit `social_metrics_snapshots`, geschreven bij elke
 *   koppel/ververs-actie; null zolang er nog geen 2 metingen zijn.
 * Er wordt nergens een schatting (bereik/engagement) verzonnen — `hasInsights`
 * staat op false totdat er een insights-API per platform gekoppeld is.
 */

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen analytics bekijken");
  }
}

// ── Types ─────────────────────────────────────────────────────────────────

export type AnalyticsPlatform = Database["public"]["Enums"]["social_platform"];
export type AnalyticsPostStatus = Database["public"]["Enums"]["scheduled_post_status"];

export interface PostCounts {
  total: number;
  published: number;
  scheduled: number;
  failed: number;
  draft: number;
}

export interface PlatformPostCounts extends PostCounts {
  platform: AnalyticsPlatform;
}

export interface DailyPostCounts {
  date: string; // yyyy-MM-dd
  published: number;
  scheduled: number;
  failed: number;
}

export interface FollowerByPlatform {
  platform: AnalyticsPlatform;
  followers: number | null;
}

export interface ClientAnalytics {
  clientId: string;
  days: number;
  posts: PostCounts;
  postsByPlatform: PlatformPostCounts[];
  timeSeries: DailyPostCounts[];
  followersTotal: number | null;
  followersByPlatform: FollowerByPlatform[];
  followerGrowth: number | null;
  hasInsights: false;
}

export interface AgencyAnalytics {
  days: number;
  clientCount: number;
  posts: PostCounts;
  postsByPlatform: PlatformPostCounts[];
  timeSeries: DailyPostCounts[];
  followersTotal: number | null;
  followersByPlatform: FollowerByPlatform[];
  followerGrowth: number | null;
  hasInsights: false;
}

interface PostRow {
  platform: AnalyticsPlatform;
  status: AnalyticsPostStatus;
  scheduled_at: string;
  published_at: string | null;
}

interface ConnectionRow {
  client_id: string;
  platform: AnalyticsPlatform;
  follower_count: number | null;
}

// ── Bouwstenen (puur, geen IO) ──────────────────────────────────────────────

function buildPostCounts(rows: PostRow[]): PostCounts {
  return {
    total: rows.length,
    published: rows.filter((r) => r.status === "published").length,
    scheduled: rows.filter((r) => r.status === "scheduled").length,
    failed: rows.filter((r) => r.status === "failed").length,
    draft: rows.filter((r) => r.status === "draft").length,
  };
}

function buildPlatformCounts(rows: PostRow[]): PlatformPostCounts[] {
  const byPlatform = new Map<AnalyticsPlatform, PostRow[]>();
  for (const row of rows) {
    const arr = byPlatform.get(row.platform) ?? [];
    arr.push(row);
    byPlatform.set(row.platform, arr);
  }
  return Array.from(byPlatform.entries()).map(([platform, platformRows]) => ({
    platform,
    ...buildPostCounts(platformRows),
  }));
}

function buildTimeSeries(rows: PostRow[], days: number): DailyPostCounts[] {
  const buckets = new Map<string, DailyPostCounts>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, published: 0, scheduled: 0, failed: 0 });
  }
  for (const row of rows) {
    const key = (row.scheduled_at ?? row.published_at ?? "").slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (row.status === "published") bucket.published++;
    else if (row.status === "failed") bucket.failed++;
    else if (row.status === "scheduled") bucket.scheduled++;
  }
  return Array.from(buckets.values());
}

function sumFollowersTotal(rows: ConnectionRow[]): number | null {
  const known = rows.filter((r) => r.follower_count !== null);
  if (known.length === 0) return null;
  return known.reduce((sum, r) => sum + (r.follower_count ?? 0), 0);
}

function buildFollowersByPlatform(rows: ConnectionRow[]): FollowerByPlatform[] {
  const totals = new Map<AnalyticsPlatform, number | null>();
  for (const row of rows) {
    if (!totals.has(row.platform)) totals.set(row.platform, null);
    if (row.follower_count !== null) {
      const current = totals.get(row.platform) ?? null;
      totals.set(row.platform, (current ?? 0) + row.follower_count);
    }
  }
  return Array.from(totals.entries()).map(([platform, followers]) => ({ platform, followers }));
}

/**
 * Groeit = nieuwste snapshot - oudste snapshot in de periode, per
 * client+platform, opgeteld over alle relevante platforms. Platforms met
 * minder dan 2 snapshots in de periode tellen niet mee. Retourneert null als
 * er in de hele periode nergens minstens 2 metingen zijn — dan is er simpelweg
 * nog geen historie.
 */
async function computeFollowerGrowth(sinceIso: string, clientId?: string): Promise<number | null> {
  let query = supabaseAdmin
    .from("social_metrics_snapshots")
    .select("client_id, platform, followers, captured_at")
    .gte("captured_at", sinceIso)
    .order("captured_at", { ascending: true });
  if (clientId) query = query.eq("client_id", clientId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;

  const groups = new Map<string, { first: number; last: number; count: number }>();
  for (const row of data) {
    if (row.followers === null) continue;
    const key = `${row.client_id}:${row.platform}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { first: row.followers, last: row.followers, count: 1 });
    } else {
      group.last = row.followers;
      group.count++;
    }
  }

  let growth = 0;
  let counted = 0;
  for (const group of groups.values()) {
    if (group.count < 2) continue;
    growth += group.last - group.first;
    counted++;
  }
  return counted > 0 ? growth : null;
}

function sinceIsoFor(days: number): string {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since.toISOString();
}

// ── Server functions ─────────────────────────────────────────────────────

const clientInputSchema = z.object({
  clientId: z.string().uuid(),
  days: z.number().int().min(1).max(365).default(30),
});

export const getClientAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => clientInputSchema.parse(d))
  .handler(async ({ data, context }): Promise<ClientAnalytics> => {
    await assertAdmin(context);
    const { clientId, days } = data;
    const sinceIso = sinceIsoFor(days);

    const [postsRes, connRes] = await Promise.all([
      supabaseAdmin
        .from("scheduled_posts")
        .select("platform, status, scheduled_at, published_at")
        .eq("client_id", clientId)
        .gte("scheduled_at", sinceIso),
      supabaseAdmin
        .from("social_connections")
        .select("client_id, platform, follower_count")
        .eq("client_id", clientId),
    ]);
    if (postsRes.error) throw new Error(postsRes.error.message);
    if (connRes.error) throw new Error(connRes.error.message);

    const posts = (postsRes.data ?? []) as PostRow[];
    const connections = (connRes.data ?? []) as ConnectionRow[];
    const followerGrowth = await computeFollowerGrowth(sinceIso, clientId);

    return {
      clientId,
      days,
      posts: buildPostCounts(posts),
      postsByPlatform: buildPlatformCounts(posts),
      timeSeries: buildTimeSeries(posts, days),
      followersTotal: sumFollowersTotal(connections),
      followersByPlatform: buildFollowersByPlatform(connections),
      followerGrowth,
      hasInsights: false,
    };
  });

const agencyInputSchema = z.object({
  days: z.number().int().min(1).max(365).default(30),
});

export const getAgencyAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => agencyInputSchema.parse(d))
  .handler(async ({ data, context }): Promise<AgencyAnalytics> => {
    await assertAdmin(context);
    const { days } = data;
    const sinceIso = sinceIsoFor(days);

    const [postsRes, connRes, clientsRes] = await Promise.all([
      supabaseAdmin
        .from("scheduled_posts")
        .select("platform, status, scheduled_at, published_at")
        .gte("scheduled_at", sinceIso),
      supabaseAdmin.from("social_connections").select("client_id, platform, follower_count"),
      supabaseAdmin.from("clients").select("id", { count: "exact", head: true }),
    ]);
    if (postsRes.error) throw new Error(postsRes.error.message);
    if (connRes.error) throw new Error(connRes.error.message);
    if (clientsRes.error) throw new Error(clientsRes.error.message);

    const posts = (postsRes.data ?? []) as PostRow[];
    const connections = (connRes.data ?? []) as ConnectionRow[];
    const followerGrowth = await computeFollowerGrowth(sinceIso);

    return {
      days,
      clientCount: clientsRes.count ?? 0,
      posts: buildPostCounts(posts),
      postsByPlatform: buildPlatformCounts(posts),
      timeSeries: buildTimeSeries(posts, days),
      followersTotal: sumFollowersTotal(connections),
      followersByPlatform: buildFollowersByPlatform(connections),
      followerGrowth,
      hasInsights: false,
    };
  });
