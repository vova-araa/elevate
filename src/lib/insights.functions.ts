import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * "AI-weetjes": concrete aanscherpingen op basis van de éígen cijfers van het
 * bureau — geen algemene tips.
 *
 * Bewuste keuze: dit rekent op echte data en roept géén AI-model aan. Dat maakt
 * het gratis, direct (geen wachttijd) en controleerbaar — je kunt elk advies
 * herleiden naar de cijfers eronder. De AI-tekstgeneratie zit al in AI Studio;
 * dit is de analyse-laag die zegt *waar* je die op moet inzetten.
 */

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen inzichten bekijken");
  }
}

export type InsightTone = "opportunity" | "warning" | "win";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
  /** Waar de gebruiker heen moet om er iets mee te doen. */
  href: string;
  actionLabel: string;
}

const DAY_NAMES = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];

export const getInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clientId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<Insight[]> => {
    await assertAdmin(context);

    const now = new Date();
    const since = new Date(now.getTime() - 90 * 86400000);

    let postsQ = supabaseAdmin
      .from("scheduled_posts")
      .select("id, client_id, platform, status, scheduled_at, published_at, caption, media_path")
      .is("deleted_at", null)
      .gte("scheduled_at", since.toISOString())
      .limit(1000);
    if (data.clientId) postsQ = postsQ.eq("client_id", data.clientId);

    let snapsQ = supabaseAdmin
      .from("social_metrics_snapshots")
      .select("client_id, platform, followers, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true })
      .limit(1000);
    if (data.clientId) snapsQ = snapsQ.eq("client_id", data.clientId);

    const [postsRes, snapsRes] = await Promise.all([postsQ, snapsQ]);
    const posts = postsRes.data ?? [];
    const snaps = snapsRes.data ?? [];

    const insights: Insight[] = [];
    const published = posts.filter((p) => p.status === "published" && p.published_at);

    // 1) Publicatiebetrouwbaarheid — mislukte posts zijn direct omzetverlies.
    const failed = posts.filter((p) => p.status === "failed");
    if (failed.length > 0) {
      const rate = Math.round(
        (failed.length / Math.max(1, published.length + failed.length)) * 100,
      );
      insights.push({
        id: "failed-rate",
        tone: "warning",
        title: `${failed.length} publicatie${failed.length === 1 ? "" : "s"} mislukt`,
        detail: `Dat is ${rate}% van alles wat er de afgelopen 90 dagen live had moeten gaan. Meestal is een verlopen koppeling de oorzaak.`,
        href: "/admin/channels",
        actionLabel: "Kanalen nakijken",
      });
    }

    // 2) Ritme: wat is het gemiddelde gat tussen posts?
    if (published.length >= 3) {
      const times = published.map((p) => new Date(p.published_at!).getTime()).sort((a, b) => a - b);
      const gaps: number[] = [];
      for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / 86400000);
      const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      const sinceLast = (now.getTime() - times[times.length - 1]) / 86400000;

      if (sinceLast > avgGap * 2 && sinceLast > 3) {
        insights.push({
          id: "rhythm-gap",
          tone: "warning",
          title: `${Math.round(sinceLast)} dagen niets gepost`,
          detail: `Normaal zit er gemiddeld ${avgGap.toFixed(1)} dag tussen posts. Het algoritme beloont regelmaat — plan iets in om het ritme terug te pakken.`,
          href: "/admin/planner",
          actionLabel: "Inplannen",
        });
      } else if (avgGap <= 2.5) {
        insights.push({
          id: "rhythm-good",
          tone: "win",
          title: `Sterk ritme: elke ${avgGap.toFixed(1)} dag een post`,
          detail: `${published.length} posts live in 90 dagen. Consistentie is de grootste voorspeller van groei — dit staat goed.`,
          href: "/admin/reach",
          actionLabel: "Bereik bekijken",
        });
      }
    }

    // 3) Beste dag, gebaseerd op wat er daadwerkelijk gepubliceerd is.
    if (published.length >= 8) {
      const perDay = new Map<number, number>();
      for (const p of published) {
        const d = new Date(p.published_at!).getDay();
        perDay.set(d, (perDay.get(d) ?? 0) + 1);
      }
      const quiet = [1, 2, 3, 4, 5].filter((d) => (perDay.get(d) ?? 0) === 0);
      if (quiet.length > 0) {
        insights.push({
          id: "empty-weekday",
          tone: "opportunity",
          title: `Nog nooit gepost op ${quiet.map((d) => DAY_NAMES[d]).join(" en ")}`,
          detail:
            "Een vaste extra dag in de week is de makkelijkste manier om bereik te vergroten zonder meer werk per post.",
          href: "/admin/besttime",
          actionLabel: "Beste tijden zien",
        });
      }
    }

    // 4) Media: posts zónder beeld presteren structureel slechter.
    const noMedia = published.filter((p) => !p.media_path);
    if (published.length >= 5 && noMedia.length / published.length > 0.25) {
      insights.push({
        id: "missing-media",
        tone: "opportunity",
        title: `${Math.round((noMedia.length / published.length) * 100)}% van de posts had geen beeld`,
        detail:
          "Posts met beeld of video krijgen op elk platform meer bereik. Vul de mediabibliotheek aan en koppel er beeld aan.",
        href: "/admin/media",
        actionLabel: "Media aanvullen",
      });
    }

    // 5) Volgersgroei uit echte metingen.
    if (snaps.length >= 2) {
      const byPlatform = new Map<string, typeof snaps>();
      for (const s of snaps) {
        byPlatform.set(s.platform, [...(byPlatform.get(s.platform) ?? []), s]);
      }
      for (const [platform, rows] of byPlatform) {
        if (rows.length < 2) continue;
        const first = rows[0].followers ?? 0;
        const last = rows[rows.length - 1].followers ?? 0;
        const diff = last - first;
        if (first > 0 && diff !== 0) {
          const pct = Math.round((diff / first) * 100);
          if (pct >= 5) {
            insights.push({
              id: `growth-${platform}`,
              tone: "win",
              title: `${platform} groeide ${pct}% (+${diff.toLocaleString("nl-NL")})`,
              detail:
                "Kijk welke posts in deze periode het best liepen en maak daar meer van — dat is de snelste winst.",
              href: "/admin/reach",
              actionLabel: "Analyseren",
            });
          } else if (pct <= -3) {
            insights.push({
              id: `decline-${platform}`,
              tone: "warning",
              title: `${platform} verloor ${Math.abs(pct)}% volgers`,
              detail:
                "Een daling volgt meestal op minder posten of een verschuiving in onderwerp. Vergelijk met de vorige periode.",
              href: "/admin/reach",
              actionLabel: "Analyseren",
            });
          }
        }
      }
    }

    // 6) Concepten die blijven liggen.
    const stale = posts.filter(
      (p) =>
        p.status === "draft" && new Date(p.scheduled_at).getTime() < now.getTime() - 5 * 86400000,
    );
    if (stale.length > 0) {
      insights.push({
        id: "stale-drafts",
        tone: "opportunity",
        title: `${stale.length} concept${stale.length === 1 ? "" : "en"} wacht al >5 dagen`,
        detail: "Klaar materiaal dat blijft liggen is verloren bereik. Beoordeel en plan het in.",
        href: "/admin/approvals",
        actionLabel: "Beoordelen",
      });
    }

    // Waarschuwingen eerst, dan kansen, dan de complimenten.
    const order: Record<InsightTone, number> = { warning: 0, opportunity: 1, win: 2 };
    return insights.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 6);
  });
