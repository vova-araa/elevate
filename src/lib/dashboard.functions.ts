import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { startOfWeek, endOfWeek, formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

/**
 * A07: de kop van /admin/dashboard (ticker + "Focus nu") vuurde zes losse
 * Supabase-aanroepen vanuit de browser af — drie voor de tellers, drie voor
 * dezelfde soort rijen (draft/failed/expired) nog een keer voor de
 * focuslijst. Twee daarvan hadden zelfs identieke filters (status=draft,
 * status=expired) en vroegen dus twee keer om hetzelfde. Hier in één
 * server-aanroep gebundeld: de teller en de eerste vier rijen komen voor
 * draft/expired uit dezelfde PostgREST-call (count + data in één response).
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

function capitalize(value: string): string {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

export interface DashboardTicker {
  scheduledThisWeek: number;
  waitingApproval: number;
  expiredChannels: number;
}

export type FocusKind = "draft" | "failed" | "channel";
export interface FocusItem {
  id: string;
  kind: FocusKind;
  title: string;
  detail: string;
  meta: string;
  href: string;
  actionLabel: string;
}

export interface DashboardSummary {
  ticker: DashboardTicker;
  focusItems: FocusItem[];
}

export const getDashboardSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ clientId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<DashboardSummary> => {
    await assertAdmin(context);
    const { clientId } = data;

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const scope = <T extends { eq: (c: string, v: string) => T }>(q: T): T =>
      clientId ? q.eq("client_id", clientId) : q;

    const [scheduledRes, draftsRes, failedRes, expiredRes] = await Promise.all([
      // Alleen de teller nodig — geen focuslijst voor "deze week gepland".
      scope(
        supabaseAdmin
          .from("scheduled_posts")
          .select("id", { count: "exact", head: true })
          .eq("status", "scheduled")
          .is("deleted_at", null)
          .gte("scheduled_at", weekStart.toISOString())
          .lte("scheduled_at", weekEnd.toISOString()),
      ),
      // Teller (waitingApproval) én focuslijst (top 4) uit dezelfde call.
      scope(
        supabaseAdmin
          .from("scheduled_posts")
          .select("id,caption,created_at,platform,client_id,clients(name)", { count: "exact" })
          .eq("status", "draft")
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .limit(4),
      ),
      scope(
        supabaseAdmin
          .from("scheduled_posts")
          .select("id,caption,scheduled_at,platform,client_id,clients(name)")
          .eq("status", "failed")
          .is("deleted_at", null)
          .order("scheduled_at", { ascending: false })
          .limit(4),
      ),
      // Teller (expiredChannels) én focuslijst uit dezelfde call.
      scope(
        supabaseAdmin
          .from("social_connections")
          .select("id,platform,client_id,account_username,clients(name)", { count: "exact" })
          .eq("status", "expired")
          .limit(4),
      ),
    ]);

    const draftItems: FocusItem[] = (draftsRes.data ?? []).map((d) => ({
      id: `draft-${d.id}`,
      kind: "draft",
      title: d.clients?.name ?? "Onbekende klant",
      detail: d.caption || "Geen caption",
      meta: `concept sinds ${formatDistanceToNow(new Date(d.created_at), { locale: nl })}`,
      href: "/admin/approvals",
      actionLabel: "Beoordelen",
    }));
    const failedItems: FocusItem[] = (failedRes.data ?? []).map((f) => ({
      id: `failed-${f.id}`,
      kind: "failed",
      title: f.clients?.name ?? "Onbekende klant",
      detail: f.caption || "Geen caption",
      meta: "publicatie mislukt",
      href: "/admin/planner",
      actionLabel: "Bekijken",
    }));
    const channelItems: FocusItem[] = (expiredRes.data ?? []).map((c) => ({
      id: `channel-${c.id}`,
      kind: "channel",
      title: c.clients?.name ?? "Onbekende klant",
      detail: `${capitalize(c.platform)}${c.account_username ? ` · @${c.account_username}` : ""}`,
      meta: "koppeling verlopen",
      href: "/admin/channels",
      actionLabel: "Vernieuwen",
    }));

    return {
      ticker: {
        scheduledThisWeek: scheduledRes.count ?? 0,
        waitingApproval: draftsRes.count ?? 0,
        expiredChannels: expiredRes.count ?? 0,
      },
      focusItems: [...draftItems, ...failedItems, ...channelItems],
    };
  });
