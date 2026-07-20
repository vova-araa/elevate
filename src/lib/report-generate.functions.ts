import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";

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
          .select("platform, status, scheduled_at, published_at")
          .eq("client_id", data.clientId)
          .gte("scheduled_at", periodStartIso)
          .lt("scheduled_at", periodEndExclusive.toISOString()),
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

    // Echte cijfers: volgers uit social_connections, volgersgroei uit de
    // snapshot-historie over de rapportperiode. Geen geschat bereik/engagement.
    const followersTotal = sumFollowersTotal(connections ?? []);
    const followerGrowth = await computeFollowerGrowth(data.clientId, periodStartIso);

    const metrics: Record<string, number | null> = {
      posts: total,
      posts_published: published,
      posts_failed: failed,
      success_rate: successRate,
      followers_total: followersTotal,
      follower_growth: followerGrowth,
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
        metrics,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (insertError) throw new Error(insertError.message);

    return report as Tables<"reports">;
  });
