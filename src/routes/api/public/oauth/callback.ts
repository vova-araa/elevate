import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyState, exchangeCode, fetchProfile, appUrl } from "@/lib/social-oauth.server";

/**
 * OAuth-callback voor alle directe social-koppelingen.
 * Registreer bij elk platform: `${APP_URL}/api/public/oauth/callback`
 * De state is HMAC-getekend en bevat clientId + platform + return-pagina.
 */

function redirectTo(path: string, params: Record<string, string>): Response {
  const u = new URL(path, appUrl());
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  return Response.redirect(u.toString(), 302);
}

export const Route = createFileRoute("/api/public/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const stateRaw = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code");
        const oauthError =
          url.searchParams.get("error_description") ?? url.searchParams.get("error");

        // Zonder geldige state weten we niet waarheen — val terug op admin.
        let returnTo = "/admin/channels";
        try {
          const state = verifyState(stateRaw);
          returnTo = state.returnTo;

          if (oauthError || !code) {
            return redirectTo(returnTo, {
              error: oauthError ?? "Autorisatie geannuleerd",
              platform: state.platform,
            });
          }

          const tokens = await exchangeCode(state.platform, code);
          const profile = await fetchProfile(state.platform, tokens);

          const { error } = await supabaseAdmin.from("social_connections").upsert(
            {
              client_id: state.clientId,
              platform: state.platform,
              account_id: profile.accountId,
              account_username: profile.handle,
              follower_count: profile.followers,
              access_token: tokens.accessToken,
              refresh_token: tokens.refreshToken,
              token_expires_at: tokens.expiresAt,
              connection_id: profile.accountId,
              postiz_integration_id: null,
              status: "active" as const,
              connected_at: new Date().toISOString(),
              meta: { ...profile.meta, provider: "direct" },
            },
            { onConflict: "client_id,platform" },
          );
          if (error) throw new Error(error.message);

          return redirectTo(returnTo, { connected: state.platform, handle: profile.handle });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Koppelen mislukt";
          // Best effort foutregistratie wanneer de state nog leesbaar was.
          try {
            const state = verifyState(stateRaw);
            await supabaseAdmin.from("connection_errors").insert({
              client_id: state.clientId,
              platform: state.platform,
              error_message: message,
            });
          } catch {
            /* state onleesbaar — niets te registreren */
          }
          return redirectTo(returnTo, { error: message });
        }
      },
    },
  },
});
