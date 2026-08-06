import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const inviteSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().min(1).max(120),
  company: z.string().max(160).optional(),
  clientId: z.string().uuid().optional(),
  makeAdmin: z.boolean().optional(),
});

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
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

const testAccountSchema = z.object({
  role: z.enum(["editor", "viewer", "client", "admin"]).default("editor"),
});

/**
 * Maakt snel een TEST-account aan zonder dat de admin een e-mailadres hoeft in
 * te voeren: e-mail én wachtwoord worden gegenereerd en teruggegeven zodat je
 * er direct mee kunt inloggen. Handig om bijvoorbeeld de editor-rol te testen.
 */
export const createTestAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => testAccountSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const rand = crypto.randomUUID().slice(0, 8);
    const email = `test-${data.role}-${rand}@example.com`;
    const password = "Test-" + crypto.randomUUID().slice(0, 10) + "!9";
    const label = `Test ${data.role}`;

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: label, test_account: true },
    });
    if (error || !created.user) throw new Error(error?.message || "Kon test-account niet aanmaken");

    const userId = created.user.id;
    await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: label, email });
    // De handle_new_user-trigger zet standaard 'client'; voeg de gevraagde rol toe.
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" });

    return { userId, email, password, role: data.role };
  });

const demoClientSchema = z.object({
  name: z.string().min(1).max(80).optional(),
});

/**
 * Maakt in één klik een volledige DEMO-klant + bijbehorende klant-login aan:
 * een `clients`-record, een auth-gebruiker (rol `client`), en de koppeling in
 * `client_members`. Bedoeld om Meta/TikTok App Review of een nieuwe tester-klant
 * meteen te laten koppelen op /client/channels — zonder handmatig klant + login
 * te moeten aanmaken. E-mail én wachtwoord worden gegenereerd en teruggegeven.
 */
export const createDemoClientAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => demoClientSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const rand = crypto.randomUUID().slice(0, 8);
    const clientName = data.name?.trim() || `Demo klant ${rand}`;
    const email = `demo-${rand}@example.com`;
    const password = "Demo-" + crypto.randomUUID().slice(0, 10) + "!7";
    const fullName = `${clientName} (demo)`;

    // 1) Klant-record
    const { data: client, error: cErr } = await supabaseAdmin
      .from("clients")
      .insert({ name: clientName, created_by: context.userId })
      .select("id, name")
      .single();
    if (cErr || !client) throw new Error(cErr?.message || "Kon demo-klant niet aanmaken");

    // 2) Login (auth-gebruiker)
    const { data: created, error: uErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, demo_account: true },
    });
    if (uErr || !created.user) {
      // Ruim de zojuist aangemaakte klant weer op zodat er niks halfs blijft staan.
      await supabaseAdmin.from("clients").delete().eq("id", client.id);
      throw new Error(uErr?.message || "Kon demo-login niet aanmaken");
    }
    const userId = created.user.id;

    // 3) Profiel + rol (client) + koppeling
    await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: fullName, email });
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "client" }, { onConflict: "user_id,role" });
    await supabaseAdmin
      .from("client_members")
      .upsert({ client_id: client.id, user_id: userId }, { onConflict: "client_id,user_id" });

    return { clientId: client.id, clientName: client.name, email, password };
  });

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
