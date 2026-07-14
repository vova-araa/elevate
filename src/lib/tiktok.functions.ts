import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// TikTok publiceren loopt via Postiz (net als de andere platforms).
// De oude directe TikTok-koppeling via de Lovable connector-gateway is
// verwijderd bij de migratie weg van Lovable.

const POSTIZ_BASE = () =>
  process.env.POSTIZ_BASE_URL?.replace(/\/$/, "") || "https://api.postiz.com";

function postizKey() {
  const k = process.env.POSTIZ_API_KEY;
  if (!k) throw new Error("POSTIZ_API_KEY ontbreekt — voeg de Postiz API key toe aan je omgeving.");
  return k;
}

async function postizFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", postizKey());
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${POSTIZ_BASE()}/public/v1${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Postiz ${res.status}: ${text.slice(0, 500) || res.statusText}`);
  }
  return text ? JSON.parse(text) : null;
}

export const disconnectTikTok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("social_connections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Publiceer een geplande TikTok-post direct via Postiz.
 * Vereist een social_connections rij voor client+tiktok met postiz_integration_id.
 */
export const publishTikTokPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: post, error: postErr } = await supabase
      .from("scheduled_posts")
      .select("*")
      .eq("id", data.postId)
      .maybeSingle();
    if (postErr) throw new Error(postErr.message);
    if (!post) throw new Error("Post niet gevonden");
    if (post.platform !== "tiktok") throw new Error("Deze post is niet voor TikTok");

    const { data: conn, error: connErr } = await supabase
      .from("social_connections")
      .select("*")
      .eq("client_id", post.client_id)
      .eq("platform", "tiktok")
      .maybeSingle();
    if (connErr) throw new Error(connErr.message);
    if (!conn?.postiz_integration_id) {
      throw new Error(
        "TikTok is niet gekoppeld via Postiz voor deze klant. Verbind het TikTok-kanaal in Postiz en wijs het toe aan deze klant onder Kanalen.",
      );
    }

    await supabase
      .from("scheduled_posts")
      .update({ status: "publishing", error_message: null })
      .eq("id", post.id);

    try {
      // Media (indien aanwezig) via signed URL naar Postiz uploaden
      let image: { id?: string; path: string }[] | undefined;
      if (post.media_path) {
        const { data: signed, error: signErr } = await supabase.storage
          .from("social-media")
          .createSignedUrl(post.media_path, 3600);
        if (signErr || !signed?.signedUrl)
          throw new Error(signErr?.message ?? "Signed URL mislukt");

        const fileRes = await fetch(signed.signedUrl);
        if (!fileRes.ok) throw new Error(`Media niet bereikbaar: ${fileRes.status}`);
        const blob = await fileRes.blob();
        const filename = post.media_path.split("/").pop() || "upload.mp4";
        const fd = new FormData();
        fd.append(
          "file",
          new File([blob], filename, { type: blob.type || "application/octet-stream" }),
        );
        const uploaded = await postizFetch("/upload", { method: "POST", body: fd });
        if (uploaded?.path)
          image = [{ id: uploaded.id ? String(uploaded.id) : undefined, path: uploaded.path }];
      }

      const result = await postizFetch("/posts", {
        method: "POST",
        body: JSON.stringify({
          type: "now",
          date: new Date().toISOString(),
          shortLink: false,
          tags: [],
          posts: [
            {
              integration: { id: String(conn.postiz_integration_id) },
              value: [{ content: post.caption ?? "", ...(image ? { image } : {}) }],
            },
          ],
        }),
      });

      const publishId: string | null = Array.isArray(result)
        ? (result[0]?.postId ?? null)
        : (result?.id ?? null);

      await supabase
        .from("scheduled_posts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          platform_container_id: publishId,
        })
        .eq("id", post.id);

      return { ok: true, publishId };
    } catch (e: any) {
      await supabase
        .from("scheduled_posts")
        .update({
          status: "failed",
          error_message: e?.message ?? "Onbekende fout",
        })
        .eq("id", post.id);
      throw e;
    }
  });
