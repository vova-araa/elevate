import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BASE = () => process.env.POSTIZ_BASE_URL?.replace(/\/$/, "") || "https://api.postiz.com";

function key() {
  const k = process.env.POSTIZ_API_KEY;
  if (!k) throw new Error("POSTIZ_API_KEY ontbreekt — voeg de Postiz API key toe aan je omgeving.");
  return k;
}

async function postizFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", key());
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${BASE()}/public/v1${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Postiz ${res.status}: ${text.slice(0, 500) || res.statusText}`);
  }
  return text ? JSON.parse(text) : null;
}

function normalizePlatform(identifier: string | null | undefined) {
  const raw = String(identifier ?? "").toLowerCase();
  if (raw.startsWith("instagram")) return "instagram";
  if (raw.startsWith("linkedin")) return "linkedin";
  if (["tiktok", "youtube", "facebook"].includes(raw)) return raw;
  return raw;
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r: any) => r.role === "admin")) {
    throw new Error("Alleen admins mogen Postiz beheren");
  }
}

export const listPostizIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const integrations = await postizFetch("/integrations");
    if (!Array.isArray(integrations)) return [];
    const ids = integrations.map((i: any) => String(i.id)).filter(Boolean);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: assigned } = ids.length
      ? await supabaseAdmin
          .from("social_connections")
          .select("client_id, platform, postiz_integration_id, account_username, clients(name)")
          .in("postiz_integration_id", ids)
      : { data: [] as any[] };
    const byId = new Map<string, any>();
    for (const row of (assigned as any[]) ?? []) byId.set(String(row.postiz_integration_id), row);
    return integrations.map((integration: any) => {
      const identifier =
        integration.providerIdentifier ?? integration.identifier ?? integration.platform ?? "";
      const assignedRow = byId.get(String(integration.id));
      return {
        ...integration,
        id: String(integration.id),
        providerIdentifier: identifier,
        platform: normalizePlatform(identifier),
        username: integration.username ?? integration.profile ?? integration.name ?? null,
        assignedClientId: assignedRow?.client_id ?? null,
        assignedClientName: assignedRow?.clients?.name ?? null,
      };
    });
  });

export const listPostizPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        startDate: z.string(),
        endDate: z.string(),
        customer: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const qs = new URLSearchParams({ startDate: data.startDate, endDate: data.endDate });
    if (data.customer) qs.set("customer", data.customer);
    return await postizFetch(`/posts?${qs.toString()}`);
  });

export const uploadPostizMediaFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        url: z.string().url(),
        filename: z.string().min(1).max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const r = await fetch(data.url);
    if (!r.ok) throw new Error(`Bestand niet bereikbaar: ${r.status}`);
    const blob = await r.blob();
    const filename = data.filename || data.url.split("/").pop()?.split("?")[0] || "upload.bin";
    const fd = new FormData();
    fd.append(
      "file",
      new File([blob], filename, { type: blob.type || "application/octet-stream" }),
    );
    return await postizFetch("/upload", { method: "POST", body: fd });
  });

const postPayload = z.object({
  type: z.enum(["draft", "schedule", "now"]),
  date: z.string(),
  shortLink: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  posts: z
    .array(
      z.object({
        integration: z.object({ id: z.string() }),
        value: z.array(
          z.object({
            content: z.string().max(10000),
            image: z.array(z.object({ id: z.string().optional(), path: z.string() })).optional(),
          }),
        ),
        settings: z.record(z.string(), z.any()).optional(),
      }),
    )
    .min(1),
});

export const createPostizPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => postPayload.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    return await postizFetch("/posts", { method: "POST", body: JSON.stringify(data) });
  });

export const deletePostizPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    return await postizFetch(`/posts/${encodeURIComponent(data.id)}`, { method: "DELETE" });
  });

export const findPostizSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ integrationId: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    return await postizFetch(`/find-slot/${encodeURIComponent(data.integrationId)}`);
  });
