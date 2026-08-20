import { createServerFn } from "@tanstack/react-start";
import { assertSafeExternalUrl } from "@/lib/ssrf-guard.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function svc() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen deze actie uitvoeren");
  }
}

// Generate API key — returns plain token only this once.
export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: z.string().min(1).max(100),
      client_id: z.string().uuid().nullable().optional(),
      scopes: z.array(z.enum(["read", "write"])).min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = svc();
    // generate 32 hex chars
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const token = `eak_${hex}`;
    const prefix = token.slice(0, 12);
    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const hash = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { data: row, error } = await sb
      .from("api_keys")
      .insert({
        name: data.name,
        client_id: data.client_id ?? null,
        scopes: data.scopes,
        key_prefix: prefix,
        key_hash: hash,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { row, token };
  });

export const testWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ url: z.string().url(), secret: z.string().optional() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await assertSafeExternalUrl(data.url);
    const body = JSON.stringify({
      event: "test.ping",
      timestamp: new Date().toISOString(),
      data: { message: "Test vanuit Elevate" },
    });
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Elevate-Event": "test.ping",
    };
    if (data.secret) {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(data.secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
      headers["X-Elevate-Signature"] = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    try {
      const res = await fetch(data.url, { method: "POST", headers, body, redirect: "manual" });
      return { ok: res.ok, status: res.status, body: (await res.text()).slice(0, 500) };
    } catch (err) {
      return { ok: false, status: 0, body: err instanceof Error ? err.message : String(err) };
    }
  });
