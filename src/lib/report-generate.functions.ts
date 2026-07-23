import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, Tables } from "@/integrations/supabase/types";

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen rapporten genereren");
  }
}

const inputSchema = z.object({
  clientId: z.string().uuid(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  facebook: "Facebook",
};

/** Uitsplitsing per platform, opgeslagen in metrics.per_platform. */
export interface ReportPlatformBreakdown {
  platform: string;
  label: string;
  total: number;
  published: number;
  failed: number;
  scheduled: number;
  draft: number;
}

/** Eén regel per post, opgeslagen in metrics.posts_detail (max. 200, nieuwste eerst). */
export interface ReportPostDetail {
  platform: string;
  label: string;
  scheduled_at: string;
  published_at: string | null;
  status: string;
  caption_summary: string | null;
}

const MAX_POST_DETAILS = 200;

/** Vorm van het opgeslagen `reports.metrics`-veld — kerncijfers plus de per-platform- en per-post-uitsplitsing. */
export interface ReportMetrics {
  posts: number;
  posts_published: number;
  posts_failed: number;
  success_rate: number;
  followers_total: number | null;
  follower_growth: number | null;
  per_platform: ReportPlatformBreakdown[];
  posts_detail: ReportPostDetail[];
  [key: string]: number | null | ReportPlatformBreakdown[] | ReportPostDetail[];
}

function captionSummary(caption: string | null): string | null {
  if (!caption) return null;
  const trimmed = caption.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
}

// Zelfde conventie als analytics.functions.ts (bewust niet gedeeld via een
// export, om te voorkomen dat client-only routes per ongeluk server-only code
// meebundelen — zie import-protection in de build).
function sumFollowersTotal(rows: { follower_count: number | null }[]): number | null {
  const known = rows.filter((r) => r.follower_count !== null);
  if (known.length === 0) return null;
  return known.reduce((sum, r) => sum + (r.follower_count ?? 0), 0);
}

async function computeFollowerGrowth(clientId: string, sinceIso: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("social_metrics_snapshots")
    .select("platform, followers, captured_at")
    .eq("client_id", clientId)
    .gte("captured_at", sinceIso)
    .order("captured_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;

  const groups = new Map<string, { first: number; last: number; count: number }>();
  for (const row of data) {
    if (row.followers === null) continue;
    const group = groups.get(row.platform);
    if (!group) {
      groups.set(row.platform, { first: row.followers, last: row.followers, count: 1 });
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

/**
 * Genereert een maandrapport-rij op basis van echte cijfers: posttellingen uit
 * `scheduled_posts`, volgers uit `social_connections.follower_count` en
 * volgersgroei uit `social_metrics_snapshots`. Geen geschatte bereik-/
 * engagementcijfers meer — die vereisen een insights-koppeling per platform
 * die er nu nog niet is.
 *
 * Naast de totalen bevat `metrics.per_platform` een uitsplitsing per platform
 * (totaal/gepubliceerd/mislukt/gepland/concept) en `metrics.posts_detail` een
 * rij per post (platform, datum, status, caption-samenvatting) — beide puur
 * afgeleid van de echte `scheduled_posts`-rijen in de gekozen periode.
 */
export const createReportFromAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, name")
      .eq("id", data.clientId)
      .maybeSingle();
    if (clientError) throw new Error(clientError.message);
    if (!client) throw new Error("Klant niet gevonden");

    const periodStartIso = new Date(data.periodStart).toISOString();
    const periodEndExclusive = new Date(data.periodEnd);
    periodEndExclusive.setDate(periodEndExclusive.getDate() + 1);

    const [{ data: posts, error: postsError }, { data: connections, error: connError }] =
      await Promise.all([
        supabaseAdmin
          .from("scheduled_posts")
          .select("platform, status, scheduled_at, published_at, caption")
          .eq("client_id", data.clientId)
          .gte("scheduled_at", periodStartIso)
          .lt("scheduled_at", periodEndExclusive.toISOString())
          .order("scheduled_at", { ascending: false }),
        supabaseAdmin
          .from("social_connections")
          .select("client_id, platform, follower_count")
          .eq("client_id", data.clientId),
      ]);
    if (postsError) throw new Error(postsError.message);
    if (connError) throw new Error(connError.message);

    const rows = posts ?? [];
    const total = rows.length;
    const published = rows.filter((p) => p.status === "published").length;
    const failed = rows.filter((p) => p.status === "failed").length;
    const successRate = total > 0 ? Math.round((published / total) * 100) : 0;

    const byPlatform = new Map<string, number>();
    for (const p of rows) {
      if (p.status !== "published") continue;
      byPlatform.set(p.platform, (byPlatform.get(p.platform) ?? 0) + 1);
    }

    // Volledige uitsplitsing per platform (alle statussen), niet alleen gepubliceerd.
    const platformBreakdownMap = new Map<string, ReportPlatformBreakdown>();
    for (const p of rows) {
      let entry = platformBreakdownMap.get(p.platform);
      if (!entry) {
        entry = {
          platform: p.platform,
          label: PLATFORM_LABELS[p.platform] ?? p.platform,
          total: 0,
          published: 0,
          failed: 0,
          scheduled: 0,
          draft: 0,
        };
        platformBreakdownMap.set(p.platform, entry);
      }
      entry.total++;
      if (p.status === "published") entry.published++;
      else if (p.status === "failed") entry.failed++;
      else if (p.status === "scheduled") entry.scheduled++;
      else if (p.status === "draft") entry.draft++;
    }
    const perPlatform = [...platformBreakdownMap.values()].sort((a, b) => b.total - a.total);

    // Rij per post — al gesorteerd op scheduled_at (nieuwste eerst) via de query.
    const postDetails: ReportPostDetail[] = rows.slice(0, MAX_POST_DETAILS).map((p) => ({
      platform: p.platform,
      label: PLATFORM_LABELS[p.platform] ?? p.platform,
      scheduled_at: p.scheduled_at,
      published_at: p.published_at,
      status: p.status,
      caption_summary: captionSummary(p.caption),
    }));

    // Echte cijfers: volgers uit social_connections, volgersgroei uit de
    // snapshot-historie over de rapportperiode. Geen geschat bereik/engagement.
    const followersTotal = sumFollowersTotal(connections ?? []);
    const followerGrowth = await computeFollowerGrowth(data.clientId, periodStartIso);

    const metrics: ReportMetrics = {
      posts: total,
      posts_published: published,
      posts_failed: failed,
      success_rate: successRate,
      followers_total: followersTotal,
      follower_growth: followerGrowth,
      per_platform: perPlatform,
      posts_detail: postDetails,
    };
    for (const [platform, count] of byPlatform.entries()) {
      metrics[`${platform}_posts`] = count;
    }

    const platformSummary =
      byPlatform.size > 0
        ? [...byPlatform.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([p, c]) => `${PLATFORM_LABELS[p] ?? p} (${c})`)
            .join(", ")
        : "geen platforms";

    const periodStartLabel = new Date(data.periodStart).toLocaleDateString("nl-NL");
    const periodEndLabel = new Date(data.periodEnd).toLocaleDateString("nl-NL");

    const followersLabel =
      followersTotal != null
        ? followersTotal.toLocaleString("nl-NL")
        : "onbekend (nog geen koppeling met volgersaantal)";
    const growthLabel =
      followerGrowth != null
        ? `${followerGrowth > 0 ? "+" : ""}${followerGrowth.toLocaleString("nl-NL")}`
        : "nog geen historie (minder dan 2 metingen)";

    const summary =
      total > 0
        ? `In de periode ${periodStartLabel} t/m ${periodEndLabel} zijn er ${published} van de ${total} posts gepubliceerd (${successRate}% succesratio), verdeeld over: ${platformSummary}. Volgers totaal: ${followersLabel}. Volgersgroei in deze periode: ${growthLabel}.`
        : `In de periode ${periodStartLabel} t/m ${periodEndLabel} zijn er geen posts gepland of gepubliceerd voor deze klant. Volgers totaal: ${followersLabel}. Volgersgroei in deze periode: ${growthLabel}.`;

    const highlights =
      byPlatform.size > 0
        ? `Best presterende platform: ${
            PLATFORM_LABELS[[...byPlatform.entries()].sort((a, b) => b[1] - a[1])[0][0]] ??
            [...byPlatform.entries()].sort((a, b) => b[1] - a[1])[0][0]
          } met ${[...byPlatform.entries()].sort((a, b) => b[1] - a[1])[0][1]} gepubliceerde posts.`
        : null;

    const { data: report, error: insertError } = await supabaseAdmin
      .from("reports")
      .insert({
        client_id: data.clientId,
        title: `Maandrapport ${client.name} — ${periodStartLabel} t/m ${periodEndLabel}`,
        report_type: "monthly",
        period_start: data.periodStart,
        period_end: data.periodEnd,
        summary,
        highlights,
        metrics: metrics as unknown as Json,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (insertError) throw new Error(insertError.message);

    return report as Tables<"reports">;
  });
