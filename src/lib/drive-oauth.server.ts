import { createHmac, timingSafeEqual } from "node:crypto";
import { appUrl } from "@/lib/social-oauth.server";

/**
 * OAuth-koppeling met Google Drive voor precies één account
 * (elevate.plannen@gmail.com) — los van de per-klant social-koppelingen in
 * social_connections.server.ts. Die laatste is hard gekoppeld aan een
 * client_id; deze koppeling is bureau-breed en heeft er geen.
 *
 * Hergebruikt dezelfde GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET als de
 * YouTube-koppeling (Google staat meerdere scopes toe op één OAuth-app),
 * maar met de Drive-scope in plaats van YouTube. Zet
 * `https://www.googleapis.com/auth/drive.readonly` bij de scopes van die
 * OAuth-app in Google Cloud Console — zie TODO-VOVA.md.
 *
 * Registreer als redirect-URI: `${APP_URL}/api/public/oauth/drive-callback`
 */

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} ontbreekt — vereist voor de Drive-koppeling`);
  return v;
}

export function driveOAuthConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export function driveOAuthRedirectUri(origin?: string): string {
  return `${appUrl(origin).replace(/\/$/, "")}/api/public/oauth/drive-callback`;
}

// ── State (HMAC-getekend, voorkomt CSRF) ─────────────────────────────────────

interface DriveOAuthState {
  returnTo: string;
  origin?: string;
  exp: number;
}

function stateSecret(): string {
  return process.env.OAUTH_STATE_SECRET ?? env("SUPABASE_SERVICE_ROLE_KEY");
}

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64url = (s: string) => Buffer.from(s, "base64url").toString("utf8");

export function signDriveState(payload: Omit<DriveOAuthState, "exp">): string {
  const body = b64url(JSON.stringify({ ...payload, exp: Date.now() + 15 * 60_000 }));
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyDriveState(state: string): DriveOAuthState {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Ongeldige OAuth-state");
  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new Error("OAuth-state signature klopt niet");
  const parsed = JSON.parse(unb64url(body)) as DriveOAuthState;
  if (Date.now() > parsed.exp)
    throw new Error("OAuth-state is verlopen — probeer opnieuw te koppelen");
  return parsed;
}

// ── Authorize-URL ────────────────────────────────────────────────────────────

export function buildDriveAuthorizeUrl(state: string, origin?: string): string {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", env("GOOGLE_CLIENT_ID"));
  u.searchParams.set("redirect_uri", driveOAuthRedirectUri(origin));
  u.searchParams.set("state", state);
  u.searchParams.set("scope", DRIVE_SCOPE);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  // Zonder login_hint kan iemand per ongeluk met het verkeerde Google-account
  // inloggen — de koppeling is bedoeld voor precies dit ene account.
  u.searchParams.set("login_hint", "elevate.plannen@gmail.com");
  return u.toString();
}

// ── Code/refresh-token → access token ────────────────────────────────────────

export interface DriveTokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
}

async function postForm(
  url: string,
  form: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = json as { error_description?: string; error?: string };
    throw new Error(
      `Token-uitwisseling mislukt: ${err.error_description ?? err.error ?? res.statusText}`,
    );
  }
  return json;
}

const expiry = (expiresIn: unknown): string =>
  new Date(Date.now() + (typeof expiresIn === "number" ? expiresIn : 3600) * 1000).toISOString();

export async function exchangeDriveCode(code: string, origin?: string): Promise<DriveTokenSet> {
  const json = await postForm("https://oauth2.googleapis.com/token", {
    grant_type: "authorization_code",
    code,
    client_id: env("GOOGLE_CLIENT_ID"),
    client_secret: env("GOOGLE_CLIENT_SECRET"),
    redirect_uri: driveOAuthRedirectUri(origin),
  });
  if (!json.access_token) throw new Error("Google gaf geen access token terug");
  if (!json.refresh_token) {
    throw new Error(
      "Google gaf geen refresh-token terug. Trek eerst de bestaande toegang van deze app in bij " +
        "myaccount.google.com/permissions op elevate.plannen@gmail.com en koppel opnieuw " +
        "(Google geeft alleen bij de eerste keer een refresh-token).",
    );
  }
  return {
    accessToken: String(json.access_token),
    refreshToken: String(json.refresh_token),
    expiresAt: expiry(json.expires_in),
  };
}

export async function refreshDriveAccessToken(refreshToken: string): Promise<DriveTokenSet> {
  const json = await postForm("https://oauth2.googleapis.com/token", {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env("GOOGLE_CLIENT_ID"),
    client_secret: env("GOOGLE_CLIENT_SECRET"),
  });
  if (!json.access_token) throw new Error("Verversen van de Drive-koppeling is mislukt");
  return {
    accessToken: String(json.access_token),
    refreshToken: json.refresh_token ? String(json.refresh_token) : refreshToken,
    expiresAt: expiry(json.expires_in),
  };
}

export async function fetchDriveAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json().catch(() => ({}))) as { email?: string };
  if (!res.ok || !json.email) throw new Error("Kon het gekoppelde e-mailadres niet ophalen");
  return json.email;
}
