import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().min(1).max(120),
  company: z.string().max(160).optional(),
  clientId: z.string().uuid().optional(),
  makeAdmin: z.boolean().optional(),
});

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r: any) => r.role === "admin")) {
    throw new Error("Alleen admins mogen deze actie uitvoeren");
  }
}

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const siteUrl = process.env.SITE_URL || "";
    const { data: created, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.fullName, company: data.company },
      redirectTo: siteUrl ? `${siteUrl}/auth` : undefined,
    });

    if (error || !created.user) {
      const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
      const { data: u2, error: e2 } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: data.fullName, company: data.company },
      });
      if (e2 || !u2.user)
        throw new Error(e2?.message || error?.message || "Kon gebruiker niet aanmaken");
      return await finalize(u2.user.id, data, tempPassword);
    }

    return await finalize(created.user.id, data, null);
  });

async function finalize(
  userId: string,
  data: z.infer<typeof inviteSchema>,
  tempPassword: string | null,
) {
  await supabaseAdmin.from("profiles").upsert({
    id: userId,
    full_name: data.fullName,
    company: data.company ?? null,
    email: data.email,
  });

  await supabaseAdmin
    .from("user_roles")
    .upsert(
      { user_id: userId, role: data.makeAdmin ? "admin" : "client" },
      { onConflict: "user_id,role" },
    );

  if (data.clientId) {
    await supabaseAdmin
      .from("client_members")
      .upsert({ client_id: data.clientId, user_id: userId }, { onConflict: "client_id,user_id" });
  }

  return { userId, tempPassword };
}

const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "client"]),
  enabled: z.boolean(),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => roleSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && data.role === "admin" && !data.enabled) {
      throw new Error("Je kunt je eigen admin-rol niet intrekken");
    }
    if (data.enabled) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const memberSchema = z.object({
  userId: z.string().uuid(),
  clientId: z.string().uuid(),
  link: z.boolean(),
});

export const setClientMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => memberSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.link) {
      const { error } = await supabaseAdmin
        .from("client_members")
        .upsert(
          { client_id: data.clientId, user_id: data.userId },
          { onConflict: "client_id,user_id" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("client_members")
        .delete()
        .eq("client_id", data.clientId)
        .eq("user_id", data.userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const deleteSchema = z.object({ userId: z.string().uuid() });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("Je kunt jezelf niet verwijderen");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
