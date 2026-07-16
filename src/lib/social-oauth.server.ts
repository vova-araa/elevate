import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Directe OAuth-koppelingen met de social platforms (geen tussenpartij).
 *
 * Vereiste omgevingsvariabelen per platform (zie .env.example):
 *   Meta (Facebook + Instagram): META_APP_ID, META_APP_SECRET
 *   TikTok:                      TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
 *   LinkedIn:                    LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET
 *   YouTube (Google):            GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 * Algemeen: APP_URL (publieke basis-URL, bv. https://portal.elevate.nl)
 * en optioneel OAUTH_STATE_SECRET (anders wordt de service-role key gebruikt).
 *
 * De redirect-URI die je bij elk platform registreert is altijd:
 *   `${APP_URL}/api/public/oauth/callback`
 */

export type SocialPlatform = "instagram" | "tiktok" | "linkedin" | "youtube" | "facebook";

const GRAPH = "https://graph.facebook.com/v21.0";

export function appUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new Error("APP_URL ontbreekt — zet de publieke basis-URL van de app");
  return url.replace(/\/$/, "");
}

export function oauthRedirectUri(): string {
  return `${appUrl()}/api/public/oauth/callback`;
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} ontbreekt — vereist voor deze social-koppeling`);
  return v;
}

function credentialsFor(platform: SocialPlatform): { id: string; secret: string } {
  switch (platform) {
    case "facebook":
    case "instagram":
      return { id: env("META_APP_ID"), secret: env("META_APP_SECRET") };
    case "tiktok":
      return { id: env("TIKTOK_CLIENT_KEY"), secret: env("TIKTOK_CLIENT_SECRET") };
    case "linkedin":
      return { id: env("LINKEDIN_CLIENT_ID"), secret: env("LINKEDIN_CLIENT_SECRET") };
    case "youtube":
      return { id: env("GOOGLE_CLIENT_ID"), secret: env("GOOGLE_CLIENT_SECRET") };
  }
}

const SCOPES: Record<SocialPlatform, string> = {
  facebook: "pages_show_list,pages_manage_posts,pages_read_engagement",
  instagram:
    "pages_show_list,pages_manage_posts,instagram_basic,instagram_content_publish,business_management",
  tiktok: "user.info.basic,user.info.stats,video.publish,video.upload",
  linkedin: "openid profile w_member_social",
  youtube:
    "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
};

// ── State (HMAC-getekend, voorkomt CSRF en koppelt callback aan klant) ───────

interface OAuthState {
  clientId: string;
  platform: SocialPlatform;
  returnTo: string;
  exp: number;
}

function stateSecret(): string {
  return process.env.OAUTH_STATE_SECRET ?? env("SUPABASE_SERVICE_ROLE_KEY");
}

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64url = (s: string) => Buffer.from(s, "base64url").toString("utf8");

export function signState(payload: Omit<OAuthState, "exp">): string {
  const body = b64url(JSON.stringify({ ...payload, exp: Date.now() + 15 * 60_000 }));
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): OAuthState {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Ongeldige OAuth-state");
  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("OAuth-state signature klopt niet");
  const parsed = JSON.parse(unb64url(body)) as OAuthState;
  if (Date.now() > parsed.exp) throw new Error("OAuth-state is verlopen — probeer opnieuw te koppelen");
  return parsed;
}

// ── Authorize-URL ────────────────────────────────────────────────────────────

export function buildAuthorizeUrl(platform: SocialPlatform, state: string): string {
  const { id } = credentialsFor(platform);
  const redirect = oauthRedirectUri();
  const scope = SCOPES[platform];
  switch (platform) {
    case "facebook":
    case "instagram": {
      const u = new URL("https://www.facebook.com/v21.0/dialog/oauth");
      u.searchParams.set("client_id", id);
      u.searchParams.set("redirect_uri", redirect);
      u.searchParams.set("state", state);
      u.searchParams.set("scope", scope);
      u.searchParams.set("response_type", "code");
      return u.toString();
    }
    case "tiktok": {
      const u = new URL("https://www.tiktok.com/v2/auth/authorize/");
      u.searchParams.set("client_key", id);
      u.searchParams.set("redirect_uri", redirect);
      u.searchParams.set("state", state);
      u.searchParams.set("scope", scope);
      u.searchParams.set("response_type", "code");
      return u.toString();
    }
    case "linkedin": {
      const u = new URL("https://www.linkedin.com/oauth/v2/authorization");
      u.searchParams.set("client_id", id);
      u.searchParams.set("redirect_uri", redirect);
      u.searchParams.set("state", state);
      u.searchParams.set("scope", scope);
      u.searchParams.set("response_type", "code");
      return u.toString();
    }
    case "youtube": {
      const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      u.searchParams.set("client_id", id);
      u.searchParams.set("redirect_uri", redirect);
      u.searchParams.set("state", state);
      u.searchParams.set("scope", scope);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("access_type", "offline");
      u.searchParams.set("prompt", "consent");
      return u.toString();
    }
  }
}

// ── Code → tokens ────────────────────────────────────────────────────────────

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null; // ISO
  raw: Record<string, unknown>;
}

async function postForm(url: string, form: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (json as { error_description?: string; error?: { message?: string } | string }).error_description ??
      (typeof (json as { error?: unknown }).error === "object"
        ? ((json as { error?: { message?: string } }).error?.message ?? JSON.stringify(json))
        : String((json as { error?: unknown }).error ?? res.statusText));
    throw new Error(`Token-uitwisseling mislukt: ${msg}`);
  }
  return json;
}

const expiry = (expiresIn: unknown): string | null =>
  typeof expiresIn === "number" ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

export async function exchangeCode(platform: SocialPlatform, code: string): Promise<TokenSet> {
  const { id, secret } = credentialsFor(platform);
  const redirect = oauthRedirectUri();

  switch (platform) {
    case "facebook":
    case "instagram": {
      // Korte-termijn token ophalen…
      const u = new URL(`${GRAPH}/oauth/access_token`);
      u.searchParams.set("client_id", id);
      u.searchParams.set("client_secret", secret);
      u.searchParams.set("redirect_uri", redirect);
      u.searchParams.set("code", code);
      const res = await fetch(u);
      const shortLived = (await res.json()) as { access_token?: string; error?: { message?: string } };
      if (!res.ok || !shortLived.access_token)
        throw new Error(`Meta-token mislukt: ${shortLived.error?.message ?? res.statusText}`);
      // …en direct inwisselen voor een long-lived token (~60 dagen).
      const l = new URL(`${GRAPH}/oauth/access_token`);
      l.searchParams.set("grant_type", "fb_exchange_token");
      l.searchParams.set("client_id", id);
      l.searchParams.set("client_secret", secret);
      l.searchParams.set("fb_exchange_token", shortLived.access_token);
      const lres = await fetch(l);
      const long = (await lres.json()) as { access_token?: string; expires_in?: number };
      const token = long.access_token ?? shortLived.access_token;
      return {
        accessToken: token,
        refreshToken: null,
        expiresAt: expiry(long.expires_in ?? 60 * 24 * 3600),
        raw: long as Record<string, unknown>,
      };
    }
    case "tiktok": {
      const json = await postForm("https://open.tiktokapis.com/v2/oauth/token/", {
        client_key: id,
        client_secret: secret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirect,
      });
      if (!json.access_token) throw new Error("TikTok gaf geen access token terug");
      return {
        accessToken: String(json.access_token),
        refreshToken: json.refresh_token ? String(json.refresh_token) : null,
        expiresAt: expiry(json.expires_in),
        raw: json,
      };
    }
    case "linkedin": {
      const json = await postForm("https://www.linkedin.com/oauth/v2/accessToken", {
        grant_type: "authorization_code",
        code,
        client_id: id,
        client_secret: secret,
        redirect_uri: redirect,
      });
      if (!json.access_token) throw new Error("LinkedIn gaf geen access token terug");
      return {
        accessToken: String(json.access_token),
        refreshToken: json.refresh_token ? String(json.refresh_token) : null,
        expiresAt: expiry(json.expires_in),
        raw: json,
      };
    }
    case "youtube": {
      const json = await postForm("https://oauth2.googleapis.com/token", {
        grant_type: "authorization_code",
        code,
        client_id: id,
        client_secret: secret,
        redirect_uri: redirect,
      });
      if (!json.access_token) throw new Error("Google gaf geen access token terug");
      return {
        accessToken: String(json.access_token),
        refreshToken: json.refresh_token ? String(json.refresh_token) : null,
        expiresAt: expiry(json.expires_in),
        raw: json,
      };
    }
  }
}

export async function refreshAccessToken(
  platform: SocialPlatform,
  refreshToken: string,
): Promise<TokenSet | null> {
  const { id, secret } = credentialsFor(platform);
  switch (platform) {
    case "tiktok": {
      const json = await postForm("https://open.tiktokapis.com/v2/oauth/token/", {
        client_key: id,
        client_secret: secret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
      if (!json.access_token) return null;
      return {
        accessToken: String(json.access_token),
        refreshToken: json.refresh_token ? String(json.refresh_token) : refreshToken,
        expiresAt: expiry(json.expires_in),
        raw: json,
      };
    }
    case "youtube": {
      const json = await postForm("https://oauth2.googleapis.com/token", {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: id,
        client_secret: secret,
      });
      if (!json.access_token) return null;
      return {
        accessToken: String(json.access_token),
        refreshToken,
        expiresAt: expiry(json.expires_in),
        raw: json,
      };
    }
    // Meta gebruikt long-lived tokens zonder refresh; LinkedIn geeft standaard
    // geen refresh token. Opnieuw koppelen wanneer verlopen.
    default:
      return null;
  }
}

// ── Profiel + publicatie-doelen ophalen ─────────────────────────────────────

export interface SocialProfile {
  accountId: string;
  handle: string;
  followers: number | null;
  /** Extra publicatiecontext (page-token, IG business id, LinkedIn URN, …). */
  meta: Record<string, unknown>;
}

async function getJson(url: string, token?: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = json as { error?: { message?: string } | string; message?: string };
    const msg =
      typeof err.error === "object" ? err.error?.message : (err.error ?? err.message ?? res.statusText);
    throw new Error(String(msg ?? "Profiel ophalen mislukt"));
  }
  return json;
}

interface FbPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

async function firstFacebookPage(accessToken: string): Promise<FbPage> {
  const json = await getJson(
    `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(accessToken)}`,
  );
  const pages = (json.data ?? []) as FbPage[];
  if (!pages.length)
    throw new Error(
      "Geen Facebook-pagina gevonden op dit account. Koppel een account dat beheerder is van de bedrijfspagina.",
    );
  return pages[0];
}

export async function fetchProfile(
  platform: SocialPlatform,
  tokens: TokenSet,
): Promise<SocialProfile> {
  switch (platform) {
    case "facebook": {
      const page = await firstFacebookPage(tokens.accessToken);
      return {
        accountId: page.id,
        handle: page.name,
        followers: null,
        meta: { pageId: page.id, pageToken: page.access_token },
      };
    }
    case "instagram": {
      const page = await firstFacebookPage(tokens.accessToken);
      const igId = page.instagram_business_account?.id;
      if (!igId)
        throw new Error(
          "Deze Facebook-pagina heeft geen gekoppeld Instagram Business-account. Koppel dat eerst in Meta Business Suite.",
        );
      const ig = await getJson(
        `${GRAPH}/${igId}?fields=username,followers_count&access_token=${encodeURIComponent(page.access_token)}`,
      );
      return {
        accountId: igId,
        handle: `@${String(ig.username ?? "instagram")}`,
        followers: typeof ig.followers_count === "number" ? ig.followers_count : null,
        meta: { igUserId: igId, pageId: page.id, pageToken: page.access_token },
      };
    }
    case "tiktok": {
      const json = await getJson(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count",
        tokens.accessToken,
      );
      const user = ((json.data as { user?: Record<string, unknown> })?.user ?? {}) as {
        open_id?: string;
        display_name?: string;
        follower_count?: number;
      };
      return {
        accountId: String(user.open_id ?? ""),
        handle: `@${user.display_name ?? "tiktok"}`,
        followers: typeof user.follower_count === "number" ? user.follower_count : null,
        meta: { openId: user.open_id ?? null },
      };
    }
    case "linkedin": {
      const json = await getJson("https://api.linkedin.com/v2/userinfo", tokens.accessToken);
      return {
        accountId: String(json.sub ?? ""),
        handle: String(json.name ?? "LinkedIn"),
        followers: null,
        meta: { personUrn: `urn:li:person:${String(json.sub ?? "")}` },
      };
    }
    case "youtube": {
      const json = await getJson(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
        tokens.accessToken,
      );
      const ch = ((json.items as Record<string, unknown>[]) ?? [])[0] as
        | { id?: string; snippet?: { title?: string }; statistics?: { subscriberCount?: string } }
        | undefined;
      if (!ch?.id) throw new Error("Geen YouTube-kanaal gevonden op dit Google-account");
      return {
        accountId: ch.id,
        handle: ch.snippet?.title ?? "YouTube",
        followers: ch.statistics?.subscriberCount ? Number(ch.statistics.subscriberCount) : null,
        meta: { channelId: ch.id },
      };
    }
  }
}
