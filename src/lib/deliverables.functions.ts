import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * Aanleverlijst — "wat moet ik nog aanleveren?"
 *
 * Twee soorten regels komen samen in één lijst:
 *
 *  1. Expliciete verzoeken die het bureau aanmaakt ("5 foto's van de nieuwe
 *     collectie, vóór vrijdag"). Die staan in `delivery_requests` en een upload
 *     die eraan hangt telt automatisch mee.
 *  2. Afgeleide signalen uit de data zelf: geen enkel kanaal gekoppeld, posts
 *     die op goedkeuring wachten, een lege planning, een onafgeronde intake.
 *     Die hoeft niemand bij te houden — ze verschijnen en verdwijnen vanzelf.
 *
 * Het tweede deel is wat dit anders maakt dan een takenlijst: de klant ziet ook
 * wat er speelt zonder dat iemand eraan gedacht heeft het op te schrijven.
 */

const KIND = z.enum(["media", "info", "access", "approval"]);
export type DeliveryKind = z.infer<typeof KIND>;

async function assertClientAccess(
  ctx: { supabase: SupabaseClient<Database>; userId: string },
  clientId: string,
) {
  const { data: ok } = await ctx.supabase.rpc("user_has_client_access", {
    _user_id: ctx.userId,
    _client_id: clientId,
  });
  if (!ok) throw new Error("Geen toegang tot deze klant");
}

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen aanleververzoeken beheren");
  }
}

export interface DeliveryItem {
  /** Verzoeken hebben een uuid; afgeleide regels een vaste sleutel. */
  id: string;
  source: "request" | "derived";
  kind: DeliveryKind;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: "open" | "submitted" | "done";
  /** Alleen bij media-verzoeken: hoeveel er al is aangeleverd. */
  delivered: number;
  needed: number;
  /** Verstreken deadline. */
  overdue: boolean;
  /** Waar de klant naartoe moet om dit af te ronden. */
  actionLabel: string | null;
  actionTo: string | null;
}

export interface DeliveryOverview {
  clientId: string;
  items: DeliveryItem[];
  /** Afgerond percentage van alles wat open stond. 100 = niets meer te doen. */
  progress: number;
  openCount: number;
  overdueCount: number;
}

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  // Een deadline van vandaag is nog niet verstreken; pas vanaf morgen.
  const end = new Date(`${due}T23:59:59`);
  return end.getTime() < Date.now();
}

export const getDeliveryOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<DeliveryOverview> => {
    await assertClientAccess(context, data.clientId);
    const { clientId } = data;
    const now = new Date();
    const in14 = new Date(now.getTime() + 14 * 86400000);

    const [requestsRes, linkedUploadsRes, channelsRes, pendingUploadsRes, plannedRes, intakeRes] =
      await Promise.all([
        supabaseAdmin
          .from("delivery_requests")
          .select("*")
          .eq("client_id", clientId)
          .order("due_date", { ascending: true, nullsFirst: false }),
        supabaseAdmin
          .from("uploads")
          .select("delivery_request_id")
          .eq("client_id", clientId)
          .not("delivery_request_id", "is", null),
        supabaseAdmin
          .from("social_connections")
          .select("platform, status")
          .eq("client_id", clientId),
        supabaseAdmin
          .from("uploads")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .eq("status", "pending"),
        supabaseAdmin
          .from("scheduled_posts")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .is("deleted_at", null)
          .in("status", ["scheduled", "publishing"])
          .gte("scheduled_at", now.toISOString())
          .lte("scheduled_at", in14.toISOString()),
        supabaseAdmin
          .from("client_intake")
          .select("status")
          .eq("client_id", clientId)
          .maybeSingle(),
      ]);

    // Hoeveel bestanden er per verzoek zijn aangeleverd.
    const deliveredPer = new Map<string, number>();
    for (const u of linkedUploadsRes.data ?? []) {
      if (!u.delivery_request_id) continue;
      deliveredPer.set(u.delivery_request_id, (deliveredPer.get(u.delivery_request_id) ?? 0) + 1);
    }

    const items: DeliveryItem[] = (requestsRes.data ?? []).map((r) => {
      const delivered = deliveredPer.get(r.id) ?? 0;
      const needed = r.quantity_needed;
      // Genoeg bestanden aangeleverd? Dan is het verzoek de facto ingeleverd,
      // ook als niemand op het vinkje heeft gedrukt.
      const status =
        r.status === "done"
          ? "done"
          : r.kind === "media" && delivered >= needed
            ? "submitted"
            : (r.status as "open" | "submitted");
      return {
        id: r.id,
        source: "request" as const,
        kind: (KIND.safeParse(r.kind).success ? r.kind : "info") as DeliveryKind,
        title: r.title,
        description: r.description,
        dueDate: r.due_date,
        status,
        delivered,
        needed,
        overdue: status !== "done" && isOverdue(r.due_date),
        actionLabel: r.kind === "media" ? "Bestanden aanleveren" : null,
        actionTo: r.kind === "media" ? "/client/uploads" : null,
      };
    });

    // ── Afgeleide regels ─────────────────────────────────────────────────────
    const active = (channelsRes.data ?? []).filter((c) => c.status === "active");
    if (active.length === 0) {
      items.push({
        id: "derived:channels",
        source: "derived",
        kind: "access",
        title: "Koppel je social-accounts",
        description:
          "Zonder koppeling kunnen we niet voor je publiceren. Koppelen duurt ongeveer een minuut.",
        dueDate: null,
        status: "open",
        delivered: 0,
        needed: 1,
        overdue: false,
        actionLabel: "Nu koppelen",
        actionTo: "/client/channels",
      });
    }

    const pendingUploads = pendingUploadsRes.count ?? 0;
    if (pendingUploads > 0) {
      items.push({
        id: "derived:pending-uploads",
        source: "derived",
        kind: "approval",
        title: `${pendingUploads} upload${pendingUploads === 1 ? "" : "s"} in behandeling`,
        description: "Je team bekijkt je materiaal. Je hoeft hier niets voor te doen.",
        dueDate: null,
        status: "submitted",
        delivered: pendingUploads,
        needed: pendingUploads,
        overdue: false,
        actionLabel: "Bekijken",
        actionTo: "/client/uploads",
      });
    }

    const planned = plannedRes.count ?? 0;
    if (planned === 0) {
      items.push({
        id: "derived:empty-planning",
        source: "derived",
        kind: "media",
        title: "Er staat nog niets gepland",
        description:
          "Voor de komende twee weken staat er geen post klaar. Nieuw beeld of video helpt ons dat te vullen.",
        dueDate: null,
        status: "open",
        delivered: 0,
        needed: 1,
        overdue: false,
        actionLabel: "Materiaal aanleveren",
        actionTo: "/client/uploads",
      });
    }

    if (!intakeRes.data || intakeRes.data.status !== "completed") {
      items.push({
        id: "derived:intake",
        source: "derived",
        kind: "info",
        title: "Rond de intake af",
        description:
          "Met je antwoorden over merk, doelgroep en toon maken we content die echt bij je past.",
        dueDate: null,
        status: intakeRes.data ? "submitted" : "open",
        delivered: 0,
        needed: 1,
        overdue: false,
        actionLabel: "Intake openen",
        actionTo: "/client/intake",
      });
    }

    const openCount = items.filter((i) => i.status === "open").length;
    const overdueCount = items.filter((i) => i.overdue).length;
    const progress =
      items.length === 0
        ? 100
        : Math.round((items.filter((i) => i.status !== "open").length / items.length) * 100);

    return { clientId, items, progress, openCount, overdueCount };
  });

// ── Beheer (admin) ───────────────────────────────────────────────────────────

export const createDeliveryRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        title: z.string().trim().min(2).max(120),
        description: z.string().trim().max(1000).optional(),
        kind: KIND.default("media"),
        quantityNeeded: z.number().int().min(1).max(100).default(1),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await supabaseAdmin.from("delivery_requests").insert({
      client_id: data.clientId,
      title: data.title,
      description: data.description ?? null,
      kind: data.kind,
      quantity_needed: data.quantityNeeded,
      due_date: data.dueDate ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);

    // De klant erop wijzen, anders staat het verzoek er wel maar ziet niemand
    // het tot de volgende keer dat hij toevallig inlogt.
    const { data: members } = await supabaseAdmin
      .from("client_members")
      .select("user_id")
      .eq("client_id", data.clientId);
    for (const m of members ?? []) {
      await supabaseAdmin.rpc("enqueue_notification", {
        _user_id: m.user_id,
        _type: "system",
        _title: "Nieuw aanleververzoek",
        _body: data.title,
        _link: "/client/uploads",
      });
    }
    return { ok: true };
  });

export const setDeliveryRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "submitted", "done"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("delivery_requests")
      .select("client_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Verzoek niet gevonden");
    await assertClientAccess(context, row.client_id);

    const { error } = await supabaseAdmin
      .from("delivery_requests")
      .update({
        status: data.status,
        completed_at: data.status === "done" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDeliveryRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await supabaseAdmin.from("delivery_requests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
