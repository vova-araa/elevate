import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * De Overview-tab van een klantdossier vuurde acht losse Supabase-aanroepen
 * af vanuit de browser (meetings, deals, reports, tasks, uploads,
 * content_items, evaluations, strategy_notes) — zelfde patroon als A07
 * (dashboard.functions.ts) en de latere client-overview.functions.ts,
 * hier gebundeld tot één server-aanroep.
 */

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen dit dossier bekijken");
  }
}

export interface ClientOverviewStats {
  meetings: number;
  reports: number;
  uploads: number;
  strategy: number;
  openTasks: number;
  wonValue: number;
  pipeValue: number;
  lastScore: number | null;
  liveContent: number;
}

export const getClientOverviewStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ClientOverviewStats> => {
    await assertAdmin(context);
    const { clientId } = data;

    const [m, d2, r, t, u, c, e, s] = await Promise.all([
      supabaseAdmin
        .from("meetings")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId),
      supabaseAdmin.from("deals").select("value_cents,stage").eq("client_id", clientId),
      supabaseAdmin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId),
      supabaseAdmin.from("tasks").select("status").eq("client_id", clientId),
      supabaseAdmin
        .from("uploads")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId),
      supabaseAdmin.from("content_items").select("status").eq("client_id", clientId),
      supabaseAdmin.from("evaluations").select("score").eq("client_id", clientId),
      supabaseAdmin
        .from("strategy_notes")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId),
    ]);

    const openTasks = (t.data ?? []).filter((x) => x.status !== "done").length;
    const wonDeals = (d2.data ?? []).filter((x) => x.stage === "won");
    const pipeline = (d2.data ?? []).filter((x) => !["won", "lost"].includes(x.stage));
    const wonValue = wonDeals.reduce((acc: number, x) => acc + (x.value_cents ?? 0), 0) / 100;
    const pipeValue = pipeline.reduce((acc: number, x) => acc + (x.value_cents ?? 0), 0) / 100;
    const lastScore = (e.data ?? []).slice(-1)[0]?.score ?? null;
    const liveContent = (c.data ?? []).filter(
      (x) => x.status === "scheduled" || x.status === "published",
    ).length;

    return {
      meetings: m.count ?? 0,
      reports: r.count ?? 0,
      uploads: u.count ?? 0,
      strategy: s.count ?? 0,
      openTasks,
      wonValue,
      pipeValue,
      lastScore,
      liveContent,
    };
  });
