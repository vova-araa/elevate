import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import {
  buildAuthorizeUrl,
  signState,
  refreshAccessToken,
  fetchProfile,
  platformEnvStatus,
  type SocialPlatform,
} from "@/lib/social-oauth.server";

/**
 * Directe social-koppelingen per klant (eigen OAuth, geen tussenpartij).
 * De browser opent de authorize-URL; het platform redirect naar
 * /api/public/oauth/callback die de koppeling in social_connections zet.
 */

const PLATFORM = z.enum(["instagram", "tiktok", "linkedin", "youtube", "facebook"]);

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

/**
 * Setup-status voor de kanalen-wizard: welke platform-keys zijn al ingesteld
 * in de omgeving. Alleen booleans + namen van ontbrekende variabelen.
 */
export const getSocialSetupStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return {
      platforms: platformEnvStatus(),
      appUrlConfigured: !!process.env.APP_URL,
    };
  });

/** Start de OAuth-flow: geeft de authorize-URL terug om te openen. */
export const startSocialConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid().optional(),
        platform: PLATFORM,
        returnTo: z.enum(["admin", "client"]).default("admin"),
        // Browser-origin als fallback wanneer APP_URL niet gezet is; het
        // platform valideert de redirect-URI tegen de geregistreerde lijst.
        origin: z.string().url().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clientId = data.clientId ?? (await getUserClientId(supabase, userId));
    if (!clientId) throw new Error("Geen client gekoppeld aan jouw account");
    await assertClientAccess(supabase, userId, clientId);

    try {
      const returnTo = data.returnTo === "client" ? "/client/channels" : "/admin/channels";
      const origin = data.origin?.replace(/\/$/, "");
      const state = signState({ clientId, platform: data.platform, returnTo, origin });
      const redirectUrl = buildAuthorizeUrl(data.platform, state, origin);
      return { redirectUrl, external: true as const };
    } catch (e) {
      await supabaseAdmin.from("connection_errors").insert({
        client_id: clientId,
        platform: data.platform,
        error_message: e instanceof Error ? e.message : "Autorisatie-link kon niet worden gemaakt",
      });
      throw e;
    }
  });

/** Kanalen van een klant (zonder tokens — die blijven server-side). */
export const listClientChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clientId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clientId = data.clientId ?? (await getUserClientId(supabase, userId));
    if (!clientId) return { clientId: null, clientName: null, provisioned: false, channels: [] };
    await assertClientAccess(supabase, userId, clientId);

    const { data: client } = await supabase
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .maybeSingle();

    const { data: channels } = await supabase
      .from("social_connections")
      .select("platform, account_username, follower_count, status, connected_at, token_expires_at")
      .eq("client_id", clientId);

    return {
      clientId,
      clientName: client?.name ?? null,
      provisioned: !!client,
      channels: channels ?? [],
    };
  });

export const disconnectChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ clientId: z.string().uuid().optional(), platform: PLATFORM }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clientId = data.clientId ?? (await getUserClientId(supabase, userId));
    if (!clientId) throw new Error("Geen client gekoppeld");
    await assertClientAccess(supabase, userId, clientId);

    const { error } = await supabaseAdmin
      .from("social_connections")
      .delete()
      .eq("client_id", clientId)
      .eq("platform", data.platform);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Ververs een koppeling: token vernieuwen (waar het platform dat ondersteunt)
 * en handle + volgersaantal opnieuw ophalen.
 */
export const refreshChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ clientId: z.string().uuid().optional(), platform: PLATFORM }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clientId = data.clientId ?? (await getUserClientId(supabase, userId));
    if (!clientId) throw new Error("Geen client gekoppeld");
    await assertClientAccess(supabase, userId, clientId);

    const { data: conn } = await supabaseAdmin
      .from("social_connections")
      .select("access_token, refresh_token, token_expires_at, meta")
      .eq("client_id", clientId)
      .eq("platform", data.platform)
      .maybeSingle();
    if (!conn?.access_token)
      return { ok: true, connected: false, reason: "Nog niet gekoppeld" as string | undefined };

    const platform = data.platform as SocialPlatform;
    let accessToken = conn.access_token;
    let refreshToken = conn.refresh_token;
    let expiresAt = conn.token_expires_at;

    const nearlyExpired =
      !!expiresAt && new Date(expiresAt).getTime() - Date.now() < 24 * 3600 * 1000;
    if (nearlyExpired && refreshToken) {
      const fresh = await refreshAccessToken(platform, refreshToken);
      if (fresh) {
        accessToken = fresh.accessToken;
        refreshToken = fresh.refreshToken;
        expiresAt = fresh.expiresAt;
      }
    }

    try {
      const profile = await fetchProfile(platform, {
        accessToken,
        refreshToken,
        expiresAt,
        raw: {},
      });
      const prevMeta =
        conn.meta && typeof conn.meta === "object" && !Array.isArray(conn.meta)
          ? (conn.meta as Record<string, unknown>)
          : {};
      const { error } = await supabaseAdmin
        .from("social_connections")
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: expiresAt,
          account_id: profile.accountId,
          account_username: profile.handle,
          follower_count: profile.followers,
          status: "active",
          meta: { ...prevMeta, ...profile.meta, provider: "direct" },
        })
        .eq("client_id", clientId)
        .eq("platform", data.platform);
      if (error) throw new Error(error.message);
      return { ok: true, connected: true, handle: profile.handle };
    } catch (e) {
      // Token waarschijnlijk verlopen/ingetrokken → markeer als verlopen.
      await supabaseAdmin
        .from("social_connections")
        .update({ status: "expired" })
        .eq("client_id", clientId)
        .eq("platform", data.platform);
      return {
        ok: true,
        connected: false,
        reason:
          e instanceof Error
            ? `Koppeling verlopen: ${e.message}. Koppel opnieuw.`
            : "Koppeling verlopen — koppel opnieuw.",
      };
    }
  });
