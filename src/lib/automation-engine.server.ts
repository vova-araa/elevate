// Server-only automation engine: dispatches scheduled posts,
// evaluates rules, fires outgoing webhooks.
import { createClient } from "@supabase/supabase-js";
import type { Enums, Tables } from "@/integrations/supabase/types";
import { publishToPlatform } from "@/lib/social-publish.server";
import type { SocialPlatform } from "@/lib/social-oauth.server";

type WebhookEndpoint = Tables<"webhook_endpoints">;
type AutomationRule = Tables<"automation_rules">;

interface ActionConfig {
  user_id?: string;
  title?: string;
  body?: string;
  link?: string;
  client_id?: string;
  description?: string;
  priority?: Enums<"task_priority">;
  due_in_days?: number | string;
  url?: string;
  to_status?: Enums<"scheduled_post_status">;
  from_status?: Enums<"scheduled_post_status">;
}

interface TriggerConfig {
  frequency?: "daily" | "weekly" | "monthly";
  hour?: number | string;
  day_of_week?: number | string;
  day_of_month?: number | string;
}

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function hmac(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function dispatchEvent(
  event: string,
  payload: Record<string, unknown>,
  clientId?: string | null,
) {
  const sb = admin();
  const { data: endpoints } = await sb
    .from("webhook_endpoints")
    .select("*")
    .eq("is_active", true)
    .contains("events", [event]);

  if (!endpoints?.length) return;
  const filtered = clientId
    ? endpoints.filter((e: WebhookEndpoint) => !e.client_id || e.client_id === clientId)
    : endpoints;

  await Promise.all(
    filtered.map(async (ep: WebhookEndpoint) => {
      const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Elevate-Event": event,
      };
      if (ep.secret) headers["X-Elevate-Signature"] = await hmac(ep.secret, body);
      try {
        const res = await fetch(ep.url, { method: "POST", headers, body });
        const text = await res.text().catch(() => "");
        await sb.from("webhook_deliveries").insert({
          endpoint_id: ep.id,
          event,
          payload,
          status_code: res.status,
          response_body: text.slice(0, 2000),
          error_message: res.ok ? null : `HTTP ${res.status}`,
        });
        await sb
          .from("webhook_endpoints")
          .update({
            last_called_at: new Date().toISOString(),
            failure_count: res.ok ? 0 : (ep.failure_count ?? 0) + 1,
          })
          .eq("id", ep.id);
      } catch (err) {
        await sb.from("webhook_deliveries").insert({
          endpoint_id: ep.id,
          event,
          payload,
          error_message: err instanceof Error ? err.message : String(err),
        });
        await sb
          .from("webhook_endpoints")
          .update({
            failure_count: (ep.failure_count ?? 0) + 1,
          })
          .eq("id", ep.id);
      }
    }),
  );
}

async function executeAction(rule: AutomationRule, context: Record<string, unknown> = {}) {
  const sb = admin();
  const cfg = (rule.action_config ?? {}) as ActionConfig;
  try {
    if (rule.action_type === "create_notification") {
      const { data: admins } = await sb.from("user_roles").select("user_id").eq("role", "admin");
      const userIds: string[] = cfg.user_id
        ? [cfg.user_id]
        : (admins ?? []).map((a: { user_id: string }) => a.user_id);
      for (const uid of userIds) {
        await sb.rpc("enqueue_notification", {
          _user_id: uid,
          _type: "automation",
          _title: cfg.title ?? rule.name,
          _body: cfg.body ?? rule.description ?? "Automation uitgevoerd",
          _link: cfg.link ?? null,
        });
      }
    } else if (rule.action_type === "create_task") {
      await sb.from("tasks").insert({
        client_id: rule.client_id ?? cfg.client_id,
        title: cfg.title ?? rule.name,
        description: cfg.description ?? null,
        priority: cfg.priority ?? "medium",
        due_date: cfg.due_in_days
          ? new Date(Date.now() + Number(cfg.due_in_days) * 86400000).toISOString().slice(0, 10)
          : null,
      });
    } else if (rule.action_type === "send_webhook") {
      if (cfg.url) {
        const body = JSON.stringify({
          rule: rule.name,
          timestamp: new Date().toISOString(),
          context,
        });
        await fetch(cfg.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }).catch(() => null);
      }
    } else if (rule.action_type === "change_post_status") {
      const q = sb.from("scheduled_posts").update({ status: cfg.to_status ?? "scheduled" });
      if (rule.client_id) q.eq("client_id", rule.client_id);
      if (cfg.from_status) q.eq("status", cfg.from_status);
      await q;
    }
    await sb
      .from("automation_rules")
      .update({
        last_run_at: new Date().toISOString(),
        run_count: (rule.run_count ?? 0) + 1,
      })
      .eq("id", rule.id);
    await sb
      .from("automation_runs")
      .insert({ rule_id: rule.id, status: "success", payload: context });
    return true;
  } catch (err) {
    await sb.from("automation_runs").insert({
      rule_id: rule.id,
      status: "error",
      payload: context,
      error_message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

function isDue(rule: AutomationRule, now: Date): boolean {
  const cfg = (rule.trigger_config ?? {}) as TriggerConfig;
  const last = rule.last_run_at ? new Date(rule.last_run_at) : null;
  const freq = cfg.frequency ?? "daily";
  const minIntervalMs =
    freq === "daily" ? 23 * 3600_000 : freq === "weekly" ? 6 * 86400_000 : 27 * 86400_000;
  if (last && now.getTime() - last.getTime() < minIntervalMs) return false;
  // simple gating on hour/day fields when provided
  if (cfg.hour !== undefined && now.getUTCHours() !== Number(cfg.hour)) return false;
  if (
    freq === "weekly" &&
    cfg.day_of_week !== undefined &&
    now.getUTCDay() !== Number(cfg.day_of_week)
  )
    return false;
  if (
    freq === "monthly" &&
    cfg.day_of_month !== undefined &&
    now.getUTCDate() !== Number(cfg.day_of_month)
  )
    return false;
  return true;
}

export async function runTick() {
  const sb = admin();
  const now = new Date();
  const summary = { published: 0, rules_run: 0, errors: 0 };

  // 0) Verweesde posts herstellen: als een vorige tick crashte tussen "claimen"
  // (→ publishing) en de eind-update, blijft een post op "publishing" hangen.
  // Zet posts die langer dan 15 min op "publishing" staan terug op "scheduled",
  // zodat de lus hieronder ze opnieuw oppakt. 15 min ligt ruim boven een normale
  // publicatie (seconden), dus een lopende publicatie wordt nooit geraakt.
  const staleCutoff = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  await sb
    .from("scheduled_posts")
    .update({ status: "scheduled" })
    .eq("status", "publishing")
    .is("deleted_at", null)
    .lt("updated_at", staleCutoff);

  // 1) Publish scheduled posts whose time has come
  const { data: due } = await sb
    .from("scheduled_posts")
    .select("*")
    .eq("status", "scheduled")
    .is("deleted_at", null)
    .lte("scheduled_at", now.toISOString())
    .limit(50);

  for (const p of due ?? []) {
    // Atomair claimen: alleen doorgaan als deze tick de post daadwerkelijk van
    // "scheduled" naar "publishing" heeft gezet. Zo kan een tweede tick (of een
    // gelijktijdige handmatige publicatie) dezelfde post niet dubbel versturen.
    const { data: claimed } = await sb
      .from("scheduled_posts")
      .update({ status: "publishing", error_message: null, updated_at: now.toISOString() })
      .eq("id", p.id)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      // Echt publiceren via de eigen social-koppelingen (OAuth), niet alleen
      // de status omzetten.
      // Bucket is privé: kortlevende ondertekende URL (1 uur) zodat het platform
      // de media kan ophalen tijdens het publiceren.
      const mediaUrl = p.media_path
        ? ((await sb.storage.from("client-uploads").createSignedUrl(p.media_path, 3600)).data
            ?.signedUrl ?? null)
        : null;
      // Media aanwezig maar signeren mislukt → echte fout (niet stil tekst-only).
      if (p.media_path && !mediaUrl) throw new Error("Media kon niet worden voorbereid");
      const result = await publishToPlatform(p.client_id, p.platform as SocialPlatform, {
        caption: p.caption ?? "",
        mediaUrl,
        mediaType: p.media_type,
      });
      await sb
        .from("scheduled_posts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          platform_post_id: result.externalId,
          error_message: null,
        })
        .eq("id", p.id);
      summary.published++;
      await dispatchEvent("post.published", { post: p }, p.client_id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Publiceren mislukt";
      await sb
        .from("scheduled_posts")
        .update({ status: "failed", error_message: message })
        .eq("id", p.id);
      summary.errors++;
      await dispatchEvent("post.failed", { post: p, error: message }, p.client_id);
    }
  }

  // 2) Schedule-triggered rules
  const { data: rules } = await sb
    .from("automation_rules")
    .select("*")
    .eq("is_active", true)
    .eq("trigger_type", "schedule");

  for (const rule of rules ?? []) {
    if (!isDue(rule, now)) continue;
    const ok = await executeAction(rule, { triggered_at: now.toISOString() });
    summary.rules_run++;
    if (!ok) summary.errors++;
  }
  return summary;
}

// Helper for API key auth
export async function authenticateApiKey(
  req: Request,
): Promise<{ ok: boolean; key?: Tables<"api_keys">; error?: string }> {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return { ok: false, error: "Missing bearer token" };
  const token = m[1].trim();
  const prefix = token.slice(0, 12); // "eak_" + 8
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(token));
  const hash = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const sb = admin();
  const { data } = await sb
    .from("api_keys")
    .select("*")
    .eq("key_prefix", prefix)
    .eq("is_active", true)
    .maybeSingle();
  if (!data || data.key_hash !== hash) return { ok: false, error: "Invalid key" };
  await sb.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { ok: true, key: data };
}
