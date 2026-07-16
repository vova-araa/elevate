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

function mediaPublicUrl(mediaPath: string | null): string | null {
  if (!mediaPath) return null;
  const { data } = supabaseAdmin.storage.from("client-uploads").getPublicUrl(mediaPath);
  return data.publicUrl ?? null;
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

    await supabaseAdmin
      .from("scheduled_posts")
      .update({ status: "publishing", error_message: null })
      .eq("id", post.id);

    try {
      const result = await publishToPlatform(post.client_id, post.platform as SocialPlatform, {
        caption: post.caption ?? "",
        mediaUrl: mediaPublicUrl(post.media_path),
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
