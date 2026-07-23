import { randomBytes, createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  appUrl,
  signState,
  buildAuthorizeUrl,
  platformEnvStatus,
  type SocialPlatform,
} from "@/lib/social-oauth.server";

/**
 * Deelbare koppel-links: een bedrijfseigenaar koppelt zijn eigen
 * social-accounts zonder in te loggen (zelfde patroon als
 * approval-links.functions.ts). Het token zelf staat nooit in de database —
 * alleen een sha256-hash — en alle lookups/mutaties lopen via de
 * service-role client. De uiteindelijke OAuth-koppeling hergebruikt de
 * bestaande /api/public/oauth/callback door de klant-id als getekende state
 * mee te geven, precies zoals startSocialConnect dat doet voor ingelogde
 * admins/klanten.
 */

const TOKEN_TTL_DAYS = 30;
const PLATFORM = z.enum(["instagram", "tiktok", "linkedin", "youtube", "facebook"]);

// ── Auth (zelfde patroon als approval-links.functions.ts) ────────────────────

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen een koppel-link delen");
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ── Link aanmaken (admin) ────────────────────────────────────────────────────

export const createChannelInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        // Browser-origin als fallback wanneer APP_URL niet gezet is (zelfde
        // patroon als createApprovalLink / startSocialConnect).
        origin: z.string().url().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin.from("channel_invites").insert({
      client_id: data.clientId,
      token_hash: tokenHash,
      created_by: context.userId,
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);

    const base = appUrl(data.origin?.replace(/\/$/, ""));
    return { url: `${base}/connect/${token}`, expiresAt };
  });

// ── Token → klant + invite-record (intern, herbruikt door beide publieke fns)

interface ResolvedInvite {
  clientId: string;
  clientName: string;
  inviteId: string;
}

async function resolveInviteToken(token: string): Promise<ResolvedInvite> {
  if (!token || token.length < 16) throw new Error("Ongeldige link");
  const tokenHash = hashToken(token);

  const { data: invite } = await supabaseAdmin
    .from("channel_invites")
    .select("id, client_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invite) throw new Error("Deze link is ongeldig");
  if (invite.revoked_at) throw new Error("Deze link is ingetrokken");
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    throw new Error("Deze link is verlopen");
  }

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id, name")
    .eq("id", invite.client_id)
    .maybeSingle();
  if (!client) throw new Error("Klant niet gevonden");

  return { clientId: client.id, clientName: client.name, inviteId: invite.id };
}

// ── Status ophalen via token (publiek, geen auth) ────────────────────────────

export interface ConnectPlatformStatus {
  platform: SocialPlatform;
  available: boolean;
  connected: boolean;
  handle: string | null;
  followerCount: number | null;
  status: string | null;
  connectedAt: string | null;
}

export const getConnectContext = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { clientId, clientName } = await resolveInviteToken(data.token);

    const { data: connections, error } = await supabaseAdmin
      .from("social_connections")
      .select("platform, account_username, follower_count, status, connected_at")
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);

    const byPlatform = new Map((connections ?? []).map((c) => [c.platform, c]));
    const env = platformEnvStatus();
    const platforms: ConnectPlatformStatus[] = (Object.keys(env) as SocialPlatform[]).map(
      (platform) => {
        const conn = byPlatform.get(platform);
        return {
          platform,
          available: env[platform].configured,
          connected: !!conn && conn.status === "active",
          handle: conn?.account_username ?? null,
          followerCount: conn?.follower_count ?? null,
          status: conn?.status ?? null,
          connectedAt: conn?.connected_at ?? null,
        };
      },
    );

    return { clientName, platforms };
  });

// ── OAuth-flow starten via token (publiek, geen auth) ────────────────────────

export const startConnectByToken = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: z.string().min(1).max(200),
        platform: PLATFORM,
        origin: z.string().url().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { clientId } = await resolveInviteToken(data.token);

    try {
      const origin = data.origin?.replace(/\/$/, "");
      // returnTo wijst terug naar dezelfde koppel-pagina — de eigenaar komt
      // na autoriseren gewoon weer op /connect/$token uit, precies zoals de
      // ingelogde flow terugkeert naar /admin/channels of /client/channels.
      const state = signState({
        clientId,
        platform: data.platform,
        returnTo: `/connect/${data.token}`,
        origin,
      });
      const redirectUrl = buildAuthorizeUrl(data.platform, state, origin);
      return { redirectUrl };
    } catch (e) {
      await supabaseAdmin.from("connection_errors").insert({
        client_id: clientId,
        platform: data.platform,
        error_message: e instanceof Error ? e.message : "Autorisatie-link kon niet worden gemaakt",
      });
      throw e;
    }
  });
