import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const PLATFORM = z.enum(["instagram", "tiktok", "linkedin", "youtube", "facebook"]);

/** Subset van het Postiz integration-object dat wij gebruiken. */
interface PostizIntegration {
  id: string | number;
  identifier?: string | null;
  providerIdentifier?: string | null;
  platform?: string | null;
  name?: string | null;
  profile?: string | null;
  username?: string | null;
  picture?: string | null;
}

const BASE = () => process.env.POSTIZ_BASE_URL?.replace(/\/$/, "") || "https://api.postiz.com";

function postizKey() {
  const k = process.env.POSTIZ_API_KEY;
  if (!k) throw new Error("Postiz API key ontbreekt in de backend.");
  return k;
}

function postizProvider(platform: z.infer<typeof PLATFORM>) {
  return platform === "instagram" ? "instagram-standalone" : platform;
}

function normalizePostizPlatform(
  identifier: string | null | undefined,
): z.infer<typeof PLATFORM> | null {
  const raw = String(identifier ?? "").toLowerCase();
  if (raw.startsWith("instagram")) return "instagram";
  if (raw.startsWith("linkedin")) return "linkedin";
  if (["tiktok", "youtube", "facebook"].includes(raw)) return raw as z.infer<typeof PLATFORM>;
  return null;
}

function integrationHandle(integration: PostizIntegration) {
  return integration.profile ?? integration.username ?? integration.name ?? "Postiz account";
}

function clientNameMatchesIntegration(
  clientName: string | null | undefined,
  integration: PostizIntegration,
) {
  const client = String(clientName ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (!client) return false;
  const haystack = [integration.name, integration.profile, integration.username]
    .map((v) =>
      String(v ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ""),
    )
    .join(" ");
  return haystack.includes(client) || client.includes(haystack.trim());
}

async function postizFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", postizKey());
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${BASE()}/public/v1${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`Postiz ${res.status}: ${text.slice(0, 300) || res.statusText}`);
  return (text ? JSON.parse(text) : null) as T;
}

/** Lookup primary client voor de huidige user (eerste client-membership). */
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

export const initPostizConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ clientId: z.string().uuid().optional(), platform: PLATFORM }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clientId = data.clientId ?? (await getUserClientId(supabase, userId));
    if (!clientId) throw new Error("Geen client gekoppeld aan jouw account");
    await assertClientAccess(supabase, userId, clientId);

    try {
      const provider = postizProvider(data.platform);
      const result = await postizFetch<{ url?: string }>(`/social/${encodeURIComponent(provider)}`);
      if (!result?.url) throw new Error("Postiz gaf geen autorisatie-link terug");
      return { redirectUrl: result.url, external: true as const, provider };
    } catch (e) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("connection_errors").insert({
        client_id: clientId,
        platform: data.platform,
        error_message:
          e instanceof Error ? e.message : "Postiz autorisatie-link kon niet worden aangemaakt",
      });
      throw e;
    }
  });

/**
 * STUB callback completer. In productie wisselt deze de OAuth code voor een
 * Postiz integration token en haalt handle + followers op.
 */
export const completePostizConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid().optional(),
        platform: PLATFORM,
        code: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clientId = data.clientId ?? (await getUserClientId(supabase, userId));
    if (!clientId) throw new Error("Geen client gekoppeld");
    await assertClientAccess(supabase, userId, clientId);

    try {
      const integrations = await postizFetch<PostizIntegration[]>("/integrations");
      const match = integrations.find(
        (i) =>
          normalizePostizPlatform(i.identifier ?? i.providerIdentifier ?? i.platform) ===
          data.platform,
      );
      if (!match?.id)
        throw new Error("Nog geen gekoppeld Postiz-account gevonden voor dit platform");

      const handle = match.profile ?? match.name ?? data.platform;
      const integrationId = String(match.id);

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("social_connections").upsert(
        {
          client_id: clientId,
          platform: data.platform,
          account_id: match.profile ?? match.name ?? null,
          account_username: handle,
          follower_count: null,
          postiz_integration_id: integrationId,
          connection_id: integrationId,
          status: "active" as const,
          connected_at: new Date().toISOString(),
          connected_by: userId,
          meta: {
            provider: "postiz",
            identifier: match.identifier ?? match.providerIdentifier ?? null,
            picture: match.picture ?? null,
          },
        },
        { onConflict: "client_id,platform" },
      );
      if (error) throw new Error(error.message);
      return { ok: true, handle, integrationId };
    } catch (e) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("connection_errors").insert({
        client_id: clientId,
        platform: data.platform,
        error_message: e instanceof Error ? e.message : "onbekende fout",
      });
      throw e;
    }
  });

export const disconnectPostizChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ clientId: z.string().uuid().optional(), platform: PLATFORM }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clientId = data.clientId ?? (await getUserClientId(supabase, userId));
    if (!clientId) throw new Error("Geen client gekoppeld");
    await assertClientAccess(supabase, userId, clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("social_connections")
      .delete()
      .eq("client_id", clientId)
      .eq("platform", data.platform);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncPostizConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ clientId: z.string().uuid().optional(), platform: PLATFORM }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clientId = data.clientId ?? (await getUserClientId(supabase, userId));
    if (!clientId) throw new Error("Geen client gekoppeld");
    await assertClientAccess(supabase, userId, clientId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .maybeSingle();
    const integrations = await postizFetch<PostizIntegration[]>("/integrations");
    const candidates = integrations.filter(
      (i) =>
        normalizePostizPlatform(i.identifier ?? i.providerIdentifier ?? i.platform) ===
        data.platform,
    );
    if (candidates.length === 0)
      return { ok: true, connected: false, reason: "Nog niet gekoppeld in Postiz" };

    const ids = candidates.map((i) => String(i.id)).filter(Boolean);
    const { data: existing } = ids.length
      ? await supabaseAdmin
          .from("social_connections")
          .select("client_id, postiz_integration_id")
          .in("postiz_integration_id", ids)
      : { data: [] as { client_id: string; postiz_integration_id: string | null }[] };
    const assigned = new Map(
      (existing ?? []).map((row) => [row.postiz_integration_id, row.client_id]),
    );

    const unassigned = candidates.filter((i) => !assigned.has(String(i.id)));
    const match =
      // Al gekoppeld aan déze klant: refresh.
      candidates.find((i) => assigned.get(String(i.id)) === clientId) ??
      // Naam van de klant matcht de Postiz account-naam.
      unassigned.find((i) => clientNameMatchesIntegration(client?.name, i)) ??
      // Alleen automatisch claimen als er precies één vrije is.
      (unassigned.length === 1 ? unassigned[0] : null);

    if (!match?.id) {
      const reason =
        unassigned.length > 1
          ? `Meerdere Postiz-accounts beschikbaar (${unassigned.length}). Kies handmatig welk account bij deze klant hoort.`
          : assigned.size > 0 && unassigned.length === 0
            ? "Alle Postiz-accounts voor dit platform zijn al aan andere klanten gekoppeld."
            : "Nog niet gekoppeld in Postiz";
      return {
        ok: true,
        connected: false,
        reason,
        claimable: unassigned.map((i) => ({
          id: String(i.id),
          name: integrationHandle(i),
          picture: i.picture ?? null,
        })),
      };
    }

    const identifier = match.identifier ?? match.providerIdentifier ?? match.platform ?? null;
    const handle = integrationHandle(match);
    const { error } = await supabaseAdmin.from("social_connections").upsert(
      {
        client_id: clientId,
        platform: data.platform,
        account_id: match.profile ?? match.name ?? null,
        account_username: handle,
        follower_count: null,
        postiz_integration_id: String(match.id),
        connection_id: String(match.id),
        status: "active" as const,
        connected_at: new Date().toISOString(),
        connected_by: userId,
        meta: { provider: "postiz", identifier, picture: match.picture ?? null },
      },
      { onConflict: "client_id,platform" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, connected: true, handle, integrationId: String(match.id) };
  });

export const claimPostizIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        platform: PLATFORM,
        integrationId: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertClientAccess(supabase, userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const integrations = await postizFetch<PostizIntegration[]>("/integrations");
    const match = integrations.find((i) => String(i.id) === data.integrationId);
    if (!match) throw new Error("Postiz-account niet gevonden");
    const platform = normalizePostizPlatform(
      match.identifier ?? match.providerIdentifier ?? match.platform,
    );
    if (platform !== data.platform) throw new Error("Postiz-account hoort niet bij dit platform");

    // Bestaande koppeling van dit account naar een andere klant wegnemen.
    await supabaseAdmin
      .from("social_connections")
      .delete()
      .eq("postiz_integration_id", data.integrationId)
      .neq("client_id", data.clientId);

    const handle = integrationHandle(match);
    const identifier = match.identifier ?? match.providerIdentifier ?? match.platform ?? null;
    const { error } = await supabaseAdmin.from("social_connections").upsert(
      {
        client_id: data.clientId,
        platform: data.platform,
        account_id: match.profile ?? match.name ?? null,
        account_username: handle,
        follower_count: null,
        postiz_integration_id: data.integrationId,
        connection_id: data.integrationId,
        status: "active" as const,
        connected_at: new Date().toISOString(),
        connected_by: userId,
        meta: { provider: "postiz", identifier, picture: match.picture ?? null },
      },
      { onConflict: "client_id,platform" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, handle, integrationId: data.integrationId };
  });

export const listClientChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clientId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clientId = data.clientId ?? (await getUserClientId(supabase, userId));
    if (!clientId) return { clientId: null, provisioned: false, channels: [] };
    await assertClientAccess(supabase, userId, clientId);

    const { data: client } = await supabase
      .from("clients")
      .select("id, name, postiz_organization_id, provisioned_at")
      .eq("id", clientId)
      .maybeSingle();

    const { data: channels } = await supabase
      .from("social_connections")
      .select(
        "platform, account_username, follower_count, status, connected_at, postiz_integration_id",
      )
      .eq("client_id", clientId);

    return {
      clientId,
      clientName: client?.name ?? null,
      provisioned: !!client,
      channels: channels ?? [],
    };
  });
