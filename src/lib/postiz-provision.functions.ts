import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_ATTEMPTS = 3;

/**
 * Stub: in een latere ronde vervangen door echte Postiz-call
 * POST https://api.postiz.com/public/v1/organizations
 */
async function callPostizCreateOrg(
  clientName: string,
): Promise<{ organizationId: string; apiKey: string }> {
  const slug =
    clientName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 24) || "client";
  return {
    organizationId: `org_stub_${slug}_${Math.random().toString(36).slice(2, 8)}`,
    apiKey: `pst_stub_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`,
  };
}

/** Provisioneer één client (admin-actie). */
export const provisionClientPostiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!roles?.some((r) => r.role === "admin"))
      throw new Error("Alleen admins mogen provisioneren");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: client, error: ce } = await supabaseAdmin
      .from("clients")
      .select("id, name, postiz_organization_id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (ce || !client) throw new Error("Client niet gevonden");
    if (client.postiz_organization_id) return { ok: true, alreadyProvisioned: true };

    try {
      const res = await callPostizCreateOrg(client.name);
      await supabaseAdmin
        .from("clients")
        .update({
          postiz_organization_id: res.organizationId,
          provisioned_at: new Date().toISOString(),
        })
        .eq("id", client.id);
      await supabaseAdmin
        .from("client_secrets")
        .upsert({ client_id: client.id, postiz_api_key: res.apiKey }, { onConflict: "client_id" });
      await supabaseAdmin
        .from("provision_queue")
        .update({ status: "done", last_attempt_at: new Date().toISOString(), error_message: null })
        .eq("client_id", client.id);
      return { ok: true, organizationId: res.organizationId };
    } catch (e) {
      await supabaseAdmin.from("provision_queue").upsert(
        {
          client_id: client.id,
          status: "failed",
          last_attempt_at: new Date().toISOString(),
          error_message: e instanceof Error ? e.message : "onbekende fout",
        },
        { onConflict: "client_id" },
      );
      throw e;
    }
  });

/** Verwerkt de wachtrij: max 10 pending clients per run. Aangeroepen vanuit cron. */
export async function runProvisionQueue() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows } = await supabaseAdmin
    .from("provision_queue")
    .select("id, client_id, attempts")
    .in("status", ["pending", "failed"])
    .lt("attempts", MAX_ATTEMPTS)
    .order("last_attempt_at", { ascending: true, nullsFirst: true })
    .limit(10);

  if (!rows?.length) return { processed: 0 };

  let success = 0;
  for (const row of rows) {
    await supabaseAdmin
      .from("provision_queue")
      .update({
        status: "processing",
        attempts: row.attempts + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, name, postiz_organization_id")
      .eq("id", row.client_id)
      .maybeSingle();

    if (!client) {
      await supabaseAdmin
        .from("provision_queue")
        .update({ status: "failed", error_message: "client weg" })
        .eq("id", row.id);
      continue;
    }
    if (client.postiz_organization_id) {
      await supabaseAdmin
        .from("provision_queue")
        .update({ status: "done", error_message: null })
        .eq("id", row.id);
      success++;
      continue;
    }

    try {
      const res = await callPostizCreateOrg(client.name);
      await supabaseAdmin
        .from("clients")
        .update({
          postiz_organization_id: res.organizationId,
          provisioned_at: new Date().toISOString(),
        })
        .eq("id", client.id);
      await supabaseAdmin
        .from("client_secrets")
        .upsert({ client_id: client.id, postiz_api_key: res.apiKey }, { onConflict: "client_id" });
      await supabaseAdmin

        .from("provision_queue")
        .update({ status: "done", error_message: null })
        .eq("id", row.id);
      success++;
    } catch (e) {
      const nextAttempts = row.attempts + 1;
      await supabaseAdmin
        .from("provision_queue")
        .update({
          status: nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
          error_message: e instanceof Error ? e.message : "onbekende fout",
        })
        .eq("id", row.id);
    }
  }
  return { processed: rows.length, success };
}
