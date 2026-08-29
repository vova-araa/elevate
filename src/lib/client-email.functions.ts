import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { sendClientEmail as sendViaResend } from "@/lib/client-email.server";

/**
 * E-mailsjablonen + het versturen van klant-e-mails vanuit het admin-paneel.
 * Zelfde beveiligingspatroon als feed-arrangement.functions.ts: de tabellen
 * geven niets vrij aan authenticated (zie migratie), alles loopt via
 * requireSupabaseAuth + assertAdmin, daarna supabaseAdmin.
 */

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen deze actie uitvoeren");
  }
}

// ── Sjablonen ────────────────────────────────────────────────────────────

export const listEmailTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await supabaseAdmin
      .from("email_templates")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  subject: z.string().min(1).max(255),
  body: z.string().min(1).max(20000),
});

export const upsertEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => templateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("email_templates")
        .update({
          name: data.name,
          subject: data.subject,
          body: data.body,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("email_templates")
      .insert({
        name: data.name,
        subject: data.subject,
        body: data.body,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deleteEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await supabaseAdmin.from("email_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Versturen + log ──────────────────────────────────────────────────────

/**
 * Vervangt {{variabelen}} in onderwerp/body. Bewust een kleine, vaste set —
 * geen generieke template-engine nodig voor dit gebruik.
 */
function applyVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => vars[key] ?? match);
}

const sendSchema = z.object({
  clientId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1).max(255),
  body: z.string().min(1).max(20000),
  templateId: z.string().uuid().optional(),
});

export const sendClientEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => sendSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("name")
      .eq("id", data.clientId)
      .maybeSingle();
    if (clientError) throw new Error(clientError.message);
    if (!client) throw new Error("Klant niet gevonden");

    const vars = {
      klant_naam: client.name,
      vandaag: new Date().toLocaleDateString("nl-NL", { dateStyle: "long" }),
    };
    const subject = applyVariables(data.subject, vars);
    const body = applyVariables(data.body, vars);

    try {
      await sendViaResend({ to: data.to, subject, text: body });
      await supabaseAdmin.from("email_log").insert({
        client_id: data.clientId,
        template_id: data.templateId ?? null,
        to_email: data.to,
        subject,
        body,
        status: "sent",
        sent_by: context.userId,
      });
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await supabaseAdmin.from("email_log").insert({
        client_id: data.clientId,
        template_id: data.templateId ?? null,
        to_email: data.to,
        subject,
        body,
        status: "failed",
        error: message,
        sent_by: context.userId,
      });
      throw new Error(message);
    }
  });

export const listClientEmailLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await supabaseAdmin
      .from("email_log")
      .select("id, to_email, subject, status, error, created_at")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
