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

/**
 * Genereert een maandrapport-rij op basis van echte cijfers uit `scheduled_posts`.
 * Bereik/engagement worden geschat op basis van gepubliceerde posts — dezelfde
 * conventie als de Analytics-pagina, totdat de Postiz analytics-koppeling live cijfers levert.
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

    const { data: posts, error: postsError } = await supabaseAdmin
      .from("scheduled_posts")
      .select("platform, status, scheduled_at, published_at")
      .eq("client_id", data.clientId)
      .gte("scheduled_at", periodStartIso)
      .lt("scheduled_at", periodEndExclusive.toISOString());
    if (postsError) throw new Error(postsError.message);

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

    // Schatting o.b.v. gepubliceerde posts — zelfde conventie als de Analytics-module,
    // totdat de Postiz analytics-koppeling live bereik/interactie-cijfers levert.
    const estimatedReach = published * 1200;
    const estimatedEngagement = published * 86;

    const metrics: Record<string, number> = {
      posts: total,
      posts_published: published,
      posts_failed: failed,
      success_rate: successRate,
      reach: estimatedReach,
      engagement: estimatedEngagement,
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

    const summary =
      total > 0
        ? `In de periode ${periodStartLabel} t/m ${periodEndLabel} zijn er ${published} van de ${total} posts gepubliceerd (${successRate}% succesratio), verdeeld over: ${platformSummary}. Geschat bereik: ${estimatedReach.toLocaleString("nl-NL")}, geschatte interacties: ${estimatedEngagement.toLocaleString("nl-NL")}.`
        : `In de periode ${periodStartLabel} t/m ${periodEndLabel} zijn er geen posts gepland of gepubliceerd voor deze klant.`;

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
