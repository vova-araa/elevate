import { randomBytes, createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { appUrl } from "@/lib/social-oauth.server";

/**
 * Deelbare goedkeurlinks: klanten keuren concepten goed via een beveiligde
 * link, zonder in te loggen (dé bottleneck bij goedkeuringen elders in de
 * branche). Het token zelf staat nooit in de database — alleen een
 * sha256-hash — en alle lookups/mutaties lopen via de service-role client.
 */

const TOKEN_TTL_DAYS = 14;
const STORAGE_BUCKET = "client-uploads";

// ── Auth (zelfde patroon als campaigns.functions.ts) ─────────────────────────

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen een goedkeurlink delen");
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ── Link aanmaken (admin) ────────────────────────────────────────────────────

export const createApprovalLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        // Browser-origin als fallback wanneer APP_URL niet gezet is (zelfde
        // patroon als startSocialConnect in channels.functions.ts).
        origin: z.string().url().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin.from("approval_links").insert({
      client_id: data.clientId,
      token_hash: tokenHash,
      created_by: context.userId,
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);

    const base = appUrl(data.origin?.replace(/\/$/, ""));
    return { url: `${base}/approve/${token}`, expiresAt };
  });

// ── Token → klant + link-record (intern, herbruikt door beide publieke fns) ─

interface ResolvedLink {
  clientId: string;
  clientName: string;
  linkId: string;
  createdBy: string;
}

async function resolveToken(token: string): Promise<ResolvedLink> {
  if (!token || token.length < 16) throw new Error("Ongeldige link");
  const tokenHash = hashToken(token);

  const { data: link } = await supabaseAdmin
    .from("approval_links")
    .select("id, client_id, expires_at, revoked_at, created_by")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!link) throw new Error("Deze link is ongeldig");
  if (link.revoked_at) throw new Error("Deze link is ingetrokken");
  if (new Date(link.expires_at).getTime() < Date.now()) {
    throw new Error("Deze link is verlopen");
  }

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id, name")
    .eq("id", link.client_id)
    .maybeSingle();
  if (!client) throw new Error("Klant niet gevonden");

  return {
    clientId: client.id,
    clientName: client.name,
    linkId: link.id,
    createdBy: link.created_by,
  };
}

// ── Concepten ophalen via token (publiek, geen auth) ─────────────────────────

export interface ApprovalQueuePost {
  id: string;
  platform: string;
  caption: string | null;
  scheduledAt: string;
  mediaUrl: string | null;
  mediaType: string | null;
}

export const getApprovalQueueByToken = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { clientId, clientName } = await resolveToken(data.token);

    const { data: posts, error } = await supabaseAdmin
      .from("scheduled_posts")
      .select("id, platform, caption, scheduled_at, media_path, media_type")
      .eq("client_id", clientId)
      .eq("status", "draft")
      .is("deleted_at", null)
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);

    const items: ApprovalQueuePost[] = await Promise.all(
      (posts ?? []).map(async (p) => {
        let mediaUrl: string | null = null;
        if (p.media_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(p.media_path, 3600);
          mediaUrl = signed?.signedUrl ?? null;
        }
        return {
          id: p.id,
          platform: p.platform,
          caption: p.caption,
          scheduledAt: p.scheduled_at,
          mediaUrl,
          mediaType: p.media_type,
        };
      }),
    );

    return { clientName, posts: items };
  });

// ── Goedkeuren / wijziging aanvragen via token (publiek, geen auth) ─────────

export const actOnPostByToken = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: z.string().min(1).max(200),
        postId: z.string().uuid(),
        action: z.enum(["approve", "request_change"]),
        comment: z.string().trim().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { clientId, createdBy } = await resolveToken(data.token);

    // Zeker weten dat de post ook echt bij de klant van dit token hoort.
    const { data: post } = await supabaseAdmin
      .from("scheduled_posts")
      .select("id, client_id, status")
      .eq("id", data.postId)
      .maybeSingle();
    if (!post || post.client_id !== clientId) {
      throw new Error("Deze post hoort niet bij deze link");
    }

    if (data.action === "approve") {
      const { error } = await supabaseAdmin
        .from("scheduled_posts")
        .update({ status: "scheduled" })
        .eq("id", data.postId);
      if (error) throw new Error(error.message);
      return { status: "approved" as const };
    }

    // request_change — post blijft draft, feedback komt in post_comments.
    const text = data.comment?.trim();
    if (!text) throw new Error("Geef aan wat er anders moet");

    // post_comments.author_id is not-null zonder anonieme klant-identiteit;
    // we ankeren op de link-eigenaar (de admin die de link deelde) en
    // markeren de herkomst expliciet via author_role, zodat het in de UI
    // (isClient check op "client") als klant-feedback herkend wordt.
    const { error } = await supabaseAdmin.from("post_comments").insert({
      post_id: data.postId,
      client_id: clientId,
      author_id: createdBy,
      author_role: "client",
      body: text,
    });
    if (error) throw new Error(error.message);
    return { status: "change_requested" as const };
  });
