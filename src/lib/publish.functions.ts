import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { publishToPlatform } from "@/lib/social-publish.server";
import type { SocialPlatform } from "@/lib/social-oauth.server";

/**
 * Publiceer een geplande post direct naar het platform via de eigen
 * social-koppelingen (OAuth), zonder tussenkomst van een externe publishing-partij.
 */

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

async function mediaSignedUrl(mediaPath: string | null): Promise<string | null> {
  if (!mediaPath) return null;
  // Bucket is privé: geef een kortlevende ondertekende URL (1 uur) zodat het
  // platform de media binnen dat venster kan ophalen bij het publiceren.
  const { data, error } = await supabaseAdmin.storage
    .from("client-uploads")
    .createSignedUrl(mediaPath, 3600);
  if (error) return null;
  return data.signedUrl ?? null;
}

export const publishScheduledPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: post, error: loadErr } = await supabaseAdmin
      .from("scheduled_posts")
      .select("id, client_id, platform, caption, media_path, media_type, status")
      .eq("id", data.postId)
      .maybeSingle();
    if (loadErr || !post) throw new Error("Post niet gevonden");
    await assertClientAccess(supabase, userId, post.client_id);
    if (post.status === "published") return { ok: true, alreadyPublished: true as const };

    // Atomair claimen: alleen publiceren als deze aanroep de post daadwerkelijk
    // van een publiceerbare status naar "publishing" heeft gezet. Zo kan een
    // gelijktijdige engine-tick of een tweede klik dezelfde post niet dubbel
    // versturen (de verliezer ziet 0 rijen en stopt).
    const { data: claimed } = await supabaseAdmin
      .from("scheduled_posts")
      .update({ status: "publishing", error_message: null })
      .eq("id", post.id)
      .in("status", ["scheduled", "draft", "failed"])
      .select("id")
      .maybeSingle();
    if (!claimed) throw new Error("Deze post wordt al gepubliceerd of is al verwerkt.");

    // Bucket is privé: bij media een kortlevende ondertekende URL. Faalt dat
    // terwijl er wél media is, dan is dat een echte fout (geen stille tekst-only).
    const mediaUrl = post.media_path ? await mediaSignedUrl(post.media_path) : null;
    if (post.media_path && !mediaUrl) {
      await supabaseAdmin
        .from("scheduled_posts")
        .update({ status: "failed", error_message: "Media kon niet worden voorbereid" })
        .eq("id", post.id);
      throw new Error("Media kon niet worden voorbereid voor publicatie.");
    }

    try {
      const result = await publishToPlatform(post.client_id, post.platform as SocialPlatform, {
        caption: post.caption ?? "",
        mediaUrl,
        mediaType: post.media_type,
      });
      await supabaseAdmin
        .from("scheduled_posts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          platform_post_id: result.externalId,
          error_message: null,
        })
        .eq("id", post.id);
      return { ok: true, alreadyPublished: false as const, externalId: result.externalId };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Publiceren mislukt";
      await supabaseAdmin
        .from("scheduled_posts")
        .update({ status: "failed", error_message: message })
        .eq("id", post.id);
      throw new Error(message);
    }
  });
