import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { subDays } from "date-fns";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Tables } from "@/integrations/supabase/types";

/**
 * /client/overview vuurde acht losse Supabase-aanroepen vanuit de browser af
 * (kanalen, volgersgroei, aankomende posts, geplande-teller, goedkeur-teller,
 * open taken, stappenplan, laatste rapport) — twee daarvan (aankomende posts
 * en de geplande-teller) met exact hetzelfde basisfilter. Zelfde aanpak als
 * A07 (dashboard.functions.ts): gebundeld in één server-aanroep, en de
 * geplande-teller komt nu uit dezelfde PostgREST-call als de eerste vijf
 * aankomende posts (count + data in één response). Kanalen blijven apart via
 * de al bestaande, hergebruikte listClientChannels — die logica (token/meta
 * opschonen) hoort niet gedupliceerd te worden.
 */

async function getUserClientId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = roles?.some((r) => r.role === "admin");
  if (isAdmin) return null;
  const { data } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.client_id ?? null;
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

type UpcomingPost = Pick<
  Tables<"scheduled_posts">,
  "id" | "platform" | "caption" | "scheduled_at" | "status" | "media_path" | "media_type"
>;
type RoadmapWithSteps = Tables<"roadmaps"> & { roadmap_steps: Tables<"roadmap_steps">[] };

export interface ClientOverviewSummary {
  followerGrowthRaw: { platform: string; followers: number | null; captured_at: string }[];
  upcoming: UpcomingPost[];
  scheduledCount: number;
  approvalCount: number;
  openTasks: number;
  roadmaps: RoadmapWithSteps[];
  latestReport: Tables<"reports"> | null;
}

const EMPTY_SUMMARY: ClientOverviewSummary = {
  followerGrowthRaw: [],
  upcoming: [],
  scheduledCount: 0,
  approvalCount: 0,
  openTasks: 0,
  roadmaps: [],
  latestReport: null,
};

export const getClientOverviewSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ clientId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<ClientOverviewSummary> => {
    const { supabase, userId } = context;
    const clientId = data.clientId ?? (await getUserClientId(supabase, userId));
    if (!clientId) return EMPTY_SUMMARY;
    await assertClientAccess(supabase, userId, clientId);

    const now = new Date();
    const nowIso = now.toISOString();
    const ninetyDaysAgoIso = subDays(now, 90).toISOString();

    const [growthRes, upcomingRes, approvalRes, tasksRes, roadmapsRes, reportRes] =
      await Promise.all([
        supabaseAdmin
          .from("social_metrics_snapshots")
          .select("platform, followers, captured_at")
          .eq("client_id", clientId)
          .gte("captured_at", ninetyDaysAgoIso)
          .order("captured_at", { ascending: true }),
        // Teller (scheduledCount) én de eerste vijf aankomende posts uit
        // dezelfde call — zelfde basisfilter, dus geen aparte count-only query.
        supabaseAdmin
          .from("scheduled_posts")
          .select("id, platform, caption, scheduled_at, status, media_path, media_type", {
            count: "exact",
          })
          .eq("client_id", clientId)
          .eq("status", "scheduled")
          .is("deleted_at", null)
          .gte("scheduled_at", nowIso)
          .order("scheduled_at")
          .limit(5),
        supabaseAdmin
          .from("calendar_items")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .in("status", ["pending", "delivered"]),
        supabaseAdmin
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .neq("status", "done"),
        supabaseAdmin
          .from("roadmaps")
          .select("*, roadmap_steps(*)")
          .eq("client_id", clientId)
          .order("created_at"),
        supabaseAdmin
          .from("reports")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

    return {
      followerGrowthRaw: growthRes.data ?? [],
      upcoming: upcomingRes.data ?? [],
      scheduledCount: upcomingRes.count ?? 0,
      approvalCount: approvalRes.count ?? 0,
      openTasks: tasksRes.count ?? 0,
      roadmaps: (roadmapsRes.data ?? []) as RoadmapWithSteps[],
      latestReport: reportRes.data?.[0] ?? null,
    };
  });
