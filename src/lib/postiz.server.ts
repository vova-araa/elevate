/**
 * Client voor Postiz' publieke API (https://docs.postiz.com/public-api) —
 * vervangt onze eigen Meta/TikTok/LinkedIn-OAuth als primaire koppelweg
 * (zie TODO-VOVA.md). Eén Postiz-account/workspace bedient het hele bureau;
 * per klant kiest een admin welke al-gekoppelde Postiz-integratie
 * (Postiz noemt een gekoppeld kanaal "integration") bij welke klant hoort.
 *
 * Auth: header `Authorization: <apiKey>` — géén "Bearer "-prefix (bevestigd
 * in Postiz' eigen middleware-broncode: alleen tokens die met "pos_" beginnen
 * worden anders behandeld, een gewone API-key niet).
 */

function apiKey(): string {
  const key = process.env.POSTIZ_API_KEY;
  if (!key) throw new Error("POSTIZ_API_KEY ontbreekt — zet 'm in de omgeving");
  return key;
}

function baseUrl(): string {
  return (process.env.POSTIZ_BASE_URL || "https://api.postiz.com/public/v1").replace(/\/$/, "");
}

export function postizConfigured(): boolean {
  return !!process.env.POSTIZ_API_KEY;
}

async function postizFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown; query?: Record<string, string | undefined> },
): Promise<T> {
  const url = new URL(`${baseUrl()}${path}`);
  for (const [k, v] of Object.entries(init?.query ?? {})) {
    if (v) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: apiKey(),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (json as { msg?: string; message?: string })?.msg ??
      (json as { msg?: string; message?: string })?.message ??
      `Postiz API-fout (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

export interface PostizIntegration {
  id: string;
  name: string;
  /** Postiz' eigen provider-identifier (bv. "instagram", "tiktok-business") — bewaar deze exact, gebruik 'm 1-op-1 terug bij het publiceren. */
  identifier: string;
  picture: string | null;
  disabled: boolean;
  profile: string | null;
  customer?: { id: string; name: string };
}

/** Alle kanalen die in dit Postiz-account gekoppeld staan (bureau-breed, alle klanten door elkaar). */
export async function listPostizIntegrations(): Promise<PostizIntegration[]> {
  return postizFetch<PostizIntegration[]>("/integrations");
}

/** Postiz' eigen "customers" (groups) — niet vereist voor onze koppeling, wel handig als er al met klant-groepen gewerkt wordt in Postiz zelf. */
export async function listPostizGroups(): Promise<{ id: string; name: string }[]> {
  return postizFetch("/groups");
}

/**
 * Authorize-URL om een NIEUW kanaal te koppelen via Postiz' eigen OAuth-app.
 * Let op: Postiz' publieke API kent geen aangepaste return-URL — na
 * autoriseren landt de browser op Postiz' eigen dashboard, niet terug in
 * Elevate. De UI opent deze URL daarom in een nieuw tabblad en laat de admin
 * daarna zelf op "Ververs" klikken om de nieuwe integratie op te halen.
 */
export async function getPostizConnectUrl(identifier: string): Promise<string> {
  const { url } = await postizFetch<{ url: string }>(`/social/${encodeURIComponent(identifier)}`);
  return url;
}

export async function deletePostizIntegration(id: string): Promise<void> {
  await postizFetch(`/integrations/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export interface PostizUploadedMedia {
  id: string;
  path: string;
}

/** Laat Postiz media ophalen van een URL (onze eigen Supabase-storage-link) i.p.v. zelf bytes te uploaden. */
export async function postizUploadFromUrl(url: string): Promise<PostizUploadedMedia> {
  return postizFetch<PostizUploadedMedia>("/upload-from-url", { method: "POST", body: { url } });
}

export interface PostizCreatePostInput {
  /** "now" = meteen publiceren (onze eigen planner/cron bepaalt wannéér dit aangeroepen wordt, Postiz hoeft dus niet zelf te wachten). */
  type: "now" | "schedule" | "draft";
  date: string;
  integrationId: string;
  /** Exact de `identifier` die listPostizIntegrations() voor dit kanaal teruggaf. */
  postizIdentifier: string;
  content: string;
  media?: PostizUploadedMedia[];
}

/**
 * Maakt (en bij type "now"/"schedule" plant Postiz asynchroon in) een post.
 * Postiz verwerkt dit via een achtergrond-queue — een geslaagde aanroep hier
 * betekent "Postiz heeft de opdracht geaccepteerd", niet per se "staat al
 * live op het platform".
 */
export async function postizCreatePost(
  input: PostizCreatePostInput,
): Promise<{ postizPostId: string | null }> {
  const result = await postizFetch<Array<{ id?: string; postId?: string }>>("/posts", {
    method: "POST",
    body: {
      type: input.type,
      date: input.date,
      shortLink: false,
      tags: [],
      posts: [
        {
          integration: { id: input.integrationId },
          value: [{ content: input.content, image: input.media ?? [] }],
          settings: { __type: input.postizIdentifier },
        },
      ],
    },
  });
  const first = Array.isArray(result) ? result[0] : undefined;
  return { postizPostId: first?.id ?? first?.postId ?? null };
}
