import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logActivity } from "@/lib/activity-log.server";
import type { Database } from "@/integrations/supabase/types";

// Team & rollen: editor/viewer zijn hier rol- en toewijzingsconcepten + audittrail.
// Het afdwingen van hun rechten in RLS/de admin-client-gate is een bewuste vervolgstap;
// deze ronde raken we bestaande RLS-policies en de admin/client-gate niet aan.

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen deze actie uitvoeren");
  }
}

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const [{ data: profiles, error: profilesError }, { data: roles }, { data: assignments }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }),
        supabaseAdmin.from("user_roles").select("user_id,role"),
        supabaseAdmin.from("client_assignments").select("user_id"),
      ]);
    if (profilesError) throw new Error(profilesError.message);

    return (profiles ?? []).map((p) => ({
      ...p,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      clientCount: (assignments ?? []).filter((a) => a.user_id === p.id).length,
    }));
  });

const setRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "editor", "viewer", "client"]),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => setRoleSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("Je kunt je eigen admin-rol niet intrekken");
    }

    const { error: deleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (deleteError) throw new Error(deleteError.message);

    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    if (insertError) throw new Error(insertError.message);

    await logActivity(context.userId, "role_changed", "user", data.userId, { role: data.role });

    return { ok: true };
  });

const assignClientSchema = z.object({
  userId: z.string().uuid(),
  clientId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

export const assignClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => assignClientSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { error } = await supabaseAdmin.from("client_assignments").upsert(
      {
        client_id: data.clientId,
        user_id: data.userId,
        note: data.note ?? null,
        assigned_by: context.userId,
      },
      { onConflict: "client_id,user_id" },
    );
    if (error) throw new Error(error.message);

    await logActivity(context.userId, "client_assigned", "client_assignment", data.clientId, {
      userId: data.userId,
      note: data.note ?? null,
    });

    return { ok: true };
  });

const unassignClientSchema = z.object({
  userId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export const unassignClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => unassignClientSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { error } = await supabaseAdmin
      .from("client_assignments")
      .delete()
      .eq("client_id", data.clientId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);

    await logActivity(context.userId, "client_unassigned", "client_assignment", data.clientId, {
      userId: data.userId,
    });

    return { ok: true };
  });

const listActivitySchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
});

export const listActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => listActivitySchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: entries, error } = await supabaseAdmin
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);

    const actorIds = [
      ...new Set((entries ?? []).map((e) => e.actor_id).filter((id): id is string => !!id)),
    ];
    const { data: actors } = actorIds.length
      ? await supabaseAdmin.from("profiles").select("id,full_name,email").in("id", actorIds)
      : { data: [] };

    return (entries ?? []).map((e) => ({
      ...e,
      actor: (actors ?? []).find((a) => a.id === e.actor_id) ?? null,
    }));
  });
