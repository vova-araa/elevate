import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { appUrl } from "@/lib/social-oauth.server";
import {
  verifyDriveState,
  exchangeDriveCode,
  fetchDriveAccountEmail,
} from "@/lib/drive-oauth.server";

/**
 * OAuth-callback voor de bureau-brede Drive-koppeling (los van
 * /api/public/oauth/callback, dat hard aan een client_id gebonden is).
 * Registreer bij Google: `${APP_URL}/api/public/oauth/drive-callback`
 */

function redirectTo(base: string, path: string, params: Record<string, string>): Response {
  const u = new URL(path, base);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  return Response.redirect(u.toString(), 302);
}

export const Route = createFileRoute("/api/public/oauth/drive-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const stateRaw = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code");
        const oauthError =
          url.searchParams.get("error_description") ?? url.searchParams.get("error");

        let returnTo = "/admin/drive";
        let base = appUrl(url.origin);
        try {
          const state = verifyDriveState(stateRaw);
          returnTo = state.returnTo;
          base = appUrl(state.origin ?? url.origin);

          if (oauthError || !code) {
            return redirectTo(base, returnTo, { error: oauthError ?? "Autorisatie geannuleerd" });
          }

          const tokens = await exchangeDriveCode(code, state.origin);
          const email = await fetchDriveAccountEmail(tokens.accessToken);

          const { error } = await supabaseAdmin.from("drive_admin_connection").upsert(
            {
              account_email: email,
              access_token: tokens.accessToken,
              refresh_token: tokens.refreshToken!,
              token_expires_at: tokens.expiresAt,
              connected_at: new Date().toISOString(),
            },
            { onConflict: "account_email" },
          );
          if (error) throw new Error(error.message);

          return redirectTo(base, returnTo, { connected: email });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Koppelen mislukt";
          return redirectTo(base, returnTo, { error: message });
        }
      },
    },
  },
});
