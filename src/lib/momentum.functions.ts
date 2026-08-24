import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * Motoriek-score: draait de machine bij deze klant, of hapert hij?
 *
 * De score is opgebouwd uit vier meetbare onderdelen die je ook echt kunt
 * beïnvloeden. Elk onderdeel levert zijn eigen punten én zijn eigen actie op,
 * zodat een lage score meteen zegt wát je moet doen — geen abstract cijfer.
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

export interface MomentumPart {
  key: "kanalen" | "planning" | "ritme" | "opvolging";
  label: string;
  /** Behaalde punten van `max`. */
  score: number;
  max: number;
  /** Wat er aan de hand is, in gewone taal. */
  detail: string;
}

export interface OpenTask {
  id: string;
  title: string;
  clientId: string;
  clientName: string | null;
  priority: string;
  dueDate: string | null;
  /** Verstreken deadline? */
  overdue: boolean;
}

/** Een taak die de app zelf voorstelt op basis van wat hij in de data ziet. */
export interface SuggestedTask {
  key: string;
  title: string;
  why: string;
  priority: "high" | "medium" | "low";
  clientId: string;
  clientName: string;
}

export interface MomentumOverview {
  score: number;
  parts: MomentumPart[];
  openTasks: OpenTask[];
  suggestions: SuggestedTask[];
}

export const getMomentum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clientId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<MomentumOverview> => {
    await assertAdmin(context);

    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);
    const last30 = new Date(now.getTime() - 30 * 86400000);

    const scope = <T extends { eq: (c: string, v: string) => T }>(q: T): T =>
      data.clientId ? q.eq("client_id", data.clientId) : q;

    const [clientsRes, channelsRes, upcomingRes, publishedRes, draftsRes, failedRes, tasksRes] =
      await Promise.all([
        data.clientId
          ? supabaseAdmin.from("clients").select("id, name").eq("id", data.clientId)
          : supabaseAdmin.from("clients").select("id, name").order("name"),
        scope(supabaseAdmin.from("social_connections").select("client_id, platform, status")),
        scope(
          supabaseAdmin
            .from("scheduled_posts")
            .select("client_id, scheduled_at")
            .is("deleted_at", null)
            .eq("status", "scheduled")
            .gte("scheduled_at", now.toISOString())
            .lte("scheduled_at", in7.toISOString()),
        ),
        scope(
          supabaseAdmin
            .from("scheduled_posts")
            .select("client_id, published_at")
            .eq("status", "published")
            .gte("published_at", last30.toISOString()),
        ),
        scope(
          supabaseAdmin
            .from("scheduled_posts")
            .select("client_id, created_at")
            .is("deleted_at", null)
            .eq("status", "draft"),
        ),
        scope(
          supabaseAdmin
            .from("scheduled_posts")
            .select("client_id")
            .is("deleted_at", null)
            .eq("status", "failed"),
        ),
        scope(
          supabaseAdmin
            .from("tasks")
            .select("id, title, client_id, priority, due_date, status")
            .neq("status", "done")
            .order("due_date", { ascending: true, nullsFirst: false })
            .limit(12),
        ),
      ]);

    const clients = clientsRes.data ?? [];
    const nameById = new Map(clients.map((c) => [c.id, c.name]));
    const channels = (channelsRes.data ?? []).filter((c) => c.status === "active");
    const expired = (channelsRes.data ?? []).filter((c) => c.status === "expired");
    const upcoming = upcomingRes.data ?? [];
    const published = publishedRes.data ?? [];
    const drafts = draftsRes.data ?? [];
    const failed = failedRes.data ?? [];

    // ── Score: vier onderdelen van elk 25 punten ────────────────────────────
    const clientCount = Math.max(1, clients.length);

    const withChannel = new Set(channels.map((c) => c.client_id)).size;
    const kanalen = Math.round((withChannel / clientCount) * 25);

    const withPlan = new Set(upcoming.map((p) => p.client_id)).size;
    const planning = Math.round((withPlan / clientCount) * 25);

    // Ritme: gemiddeld aantal posts per klant per week over 30 dagen. 3+ = vol.
    const perWeek = published.length / clientCount / (30 / 7);
    const ritme = Math.round(Math.min(1, perWeek / 3) * 25);

    // Opvolging: mislukte posts en oude concepten trekken punten af.
    const stale = drafts.filter(
      (d) => new Date(d.created_at).getTime() < now.getTime() - 5 * 86400000,
    ).length;
    const opvolging = Math.max(0, 25 - failed.length * 5 - stale * 2 - expired.length * 5);

    const parts: MomentumPart[] = [
      {
        key: "kanalen",
        label: "Kanalen gekoppeld",
        score: kanalen,
        max: 25,
        detail:
          withChannel === clientCount
            ? "Alle klanten hebben een gekoppeld kanaal."
            : `${clientCount - withChannel} van de ${clientCount} klanten heeft nog geen kanaal.`,
      },
      {
        key: "planning",
        label: "Planning gevuld",
        score: planning,
        max: 25,
        detail:
          withPlan === clientCount
            ? "Voor elke klant staat er iets gepland deze week."
            : `${clientCount - withPlan} klant(en) zonder planning voor de komende 7 dagen.`,
      },
      {
        key: "ritme",
        label: "Publicatieritme",
        score: ritme,
        max: 25,
        detail: `Gemiddeld ${perWeek.toFixed(1)} post per klant per week (30 dagen).`,
      },
      {
        key: "opvolging",
        label: "Opvolging",
        score: opvolging,
        max: 25,
        detail:
          failed.length + stale + expired.length === 0
            ? "Niets blijft liggen."
            : `${failed.length} mislukt · ${stale} oude concepten · ${expired.length} verlopen koppeling${expired.length === 1 ? "" : "en"}.`,
      },
    ];

    const score = parts.reduce((s, p) => s + p.score, 0);

    const openTasks: OpenTask[] = (tasksRes.data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      clientId: t.client_id,
      clientName: nameById.get(t.client_id) ?? null,
      priority: t.priority,
      dueDate: t.due_date,
      overdue: !!t.due_date && new Date(t.due_date).getTime() < now.getTime(),
    }));

    // ── Voorgestelde taken ──────────────────────────────────────────────────
    // Afgeleid uit dezelfde cijfers: alleen dingen die echt iets veranderen.
    const suggestions: SuggestedTask[] = [];
    const upcomingByClient = new Set(upcoming.map((p) => p.client_id));
    const channelByClient = new Set(channels.map((c) => c.client_id));
    const existingTitles = new Set((tasksRes.data ?? []).map((t) => t.title.toLowerCase()));

    for (const c of clients) {
      if (!channelByClient.has(c.id)) {
        suggestions.push({
          key: `channel-${c.id}`,
          title: `Kanaal koppelen voor ${c.name}`,
          why: "Zonder gekoppeld kanaal kan er niets gepubliceerd worden.",
          priority: "high",
          clientId: c.id,
          clientName: c.name,
        });
      } else if (!upcomingByClient.has(c.id)) {
        suggestions.push({
          key: `plan-${c.id}`,
          title: `Content inplannen voor ${c.name}`,
          why: "Er staat de komende 7 dagen niets klaar om live te gaan.",
          priority: "high",
          clientId: c.id,
          clientName: c.name,
        });
      }
    }
    for (const f of expired) {
      const name = nameById.get(f.client_id);
      if (!name) continue;
      suggestions.push({
        key: `expired-${f.client_id}-${f.platform}`,
        title: `${f.platform} opnieuw koppelen voor ${name}`,
        why: "De koppeling is verlopen; geplande posts zullen mislukken.",
        priority: "high",
        clientId: f.client_id,
        clientName: name,
      });
    }
    const staleByClient = new Map<string, number>();
    for (const d of drafts) {
      if (new Date(d.created_at).getTime() < now.getTime() - 5 * 86400000) {
        staleByClient.set(d.client_id, (staleByClient.get(d.client_id) ?? 0) + 1);
      }
    }
    for (const [cid, count] of staleByClient) {
      const name = nameById.get(cid);
      if (!name) continue;
      suggestions.push({
        key: `drafts-${cid}`,
        title: `${count} concept(en) beoordelen voor ${name}`,
        why: "Klaar materiaal dat al meer dan 5 dagen wacht op akkoord.",
        priority: "medium",
        clientId: cid,
        clientName: name,
      });
    }

    return {
      score,
      parts,
      openTasks,
      // Niet voorstellen wat al als taak bestaat.
      suggestions: suggestions
        .filter((s) => !existingTitles.has(s.title.toLowerCase()))
        .slice(0, 6),
    };
  });

/** Een voorgestelde taak omzetten naar een echte taak. */
export const acceptSuggestedTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await supabaseAdmin.from("tasks").insert({
      client_id: data.clientId,
      title: data.title,
      description: data.description ?? null,
      priority: data.priority,
      status: "todo",
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
