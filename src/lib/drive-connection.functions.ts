import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  driveOAuthConfigured,
  signDriveState,
  buildDriveAuthorizeUrl,
  refreshDriveAccessToken,
} from "@/lib/drive-oauth.server";

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen de Drive-koppeling beheren");
  }
}

export interface DriveConnectionStatus {
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
  connectedAt: string | null;
}

export const getDriveConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DriveConnectionStatus> => {
    await assertAdmin(context);
    const configured = driveOAuthConfigured();
    if (!configured) {
      return { configured: false, connected: false, accountEmail: null, connectedAt: null };
    }
    const { data } = await supabaseAdmin
      .from("drive_admin_connection")
      .select("account_email, connected_at")
      .maybeSingle();
    return {
      configured: true,
      connected: !!data,
      accountEmail: data?.account_email ?? null,
      connectedAt: data?.connected_at ?? null,
    };
  });

export const getDriveAuthorizeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({ returnTo: z.string().max(500), origin: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    await assertAdmin(context);
    const state = signDriveState({ returnTo: data.returnTo, origin: data.origin });
    return { url: buildDriveAuthorizeUrl(state, data.origin) };
  });

export const disconnectDriveConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { error } = await supabaseAdmin
      .from("drive_admin_connection")
      .delete()
      .not("id", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Geldig access-token voor de Drive-koppeling, ververst indien nodig (binnen
 * 2 minuten van de vervaldatum). Gebruikt door drive-browse.functions.ts en
 * drive-release-plan.functions.ts — geen route, puur intern.
 */
export const getValidDriveAccessToken = createServerOnlyFn(async (): Promise<string> => {
  const { data, error } = await supabaseAdmin
    .from("drive_admin_connection")
    .select("id, access_token, refresh_token, token_expires_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      "Geen Drive-koppeling actief. Koppel eerst elevate.plannen@gmail.com op /admin/drive.",
    );
  }

  const expiresInMs = new Date(data.token_expires_at).getTime() - Date.now();
  if (expiresInMs > 2 * 60_000) return data.access_token;

  const refreshed = await refreshDriveAccessToken(data.refresh_token);
  await supabaseAdmin
    .from("drive_admin_connection")
    .update({
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken ?? data.refresh_token,
      token_expires_at: refreshed.expiresAt,
    })
    .eq("id", data.id);
  return refreshed.accessToken;
});
