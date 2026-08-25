import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { ALL_PLATFORM_IDS, type Platform } from "@/config/platforms";
import {
  listPostizIntegrations,
  postizConfigured,
  type PostizIntegration,
} from "@/lib/postiz.server";

/**
 * Beheer van de koppeling met het bureau-brede Postiz-account: welke
 * al-gekoppelde Postiz-kanalen ("integrations") horen bij welke klant.
 * Alleen admins — het Postiz-account overziet alle klanten door elkaar, dat
 * mag een klant nooit zelf zien.
 */

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen kanalen via Postiz koppelen");
  }
}

const PLATFORM = z.enum(ALL_PLATFORM_IDS as [Platform, ...Platform[]]);

export interface PostizChannelOption extends PostizIntegration {
  /** Al aan een klant in Elevate toegewezen? */
  assignedClientId: string | null;
  assignedClientName: string | null;
}

export const getPostizStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    return { configured: postizConfigured() };
  });

/**
 * Alle Postiz-integraties, gemarkeerd met welke Elevate-klant ze (indien
 * toegewezen) al hebben. De admin kiest per platform-kaart uit de
 * niet-toegewezen opties voor de actieve klant.
 */
export const listPostizChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ configured: boolean; channels: PostizChannelOption[] }> => {
      await assertAdmin(context);
      if (!postizConfigured()) return { configured: false, channels: [] };

      const [integrations, assignedRows] = await Promise.all([
        listPostizIntegrations(),
        supabaseAdmin.from("social_connections").select("client_id, meta, clients(name)"),
      ]);

      const assignedByIntegrationId = new Map<
        string,
        { clientId: string; clientName: string | null }
      >();
      for (const row of assignedRows.data ?? []) {
        const meta =
          row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
            ? (row.meta as Record<string, unknown>)
            : {};
        const integrationId =
          typeof meta.postizIntegrationId === "string" ? meta.postizIntegrationId : null;
        if (!integrationId) continue;
        const clientRel = row.clients as { name: string } | { name: string }[] | null;
        const clientName = Array.isArray(clientRel)
          ? (clientRel[0]?.name ?? null)
          : (clientRel?.name ?? null);
        assignedByIntegrationId.set(integrationId, { clientId: row.client_id, clientName });
      }

      return {
        configured: true,
        channels: integrations.map((i) => {
          const assigned = assignedByIntegrationId.get(i.id);
          return {
            ...i,
            assignedClientId: assigned?.clientId ?? null,
            assignedClientName: assigned?.clientName ?? null,
          };
        }),
      };
    },
  );

/**
 * Wijst een al in Postiz gekoppeld kanaal toe aan een klant — upsert in
 * social_connections zoals de rest van de app die tabel al gebruikt, maar
 * zonder eigen token: Postiz bewaart en ververst die zelf. status='active'
 * zodat de koppeling overal (ticker, momentum, publiceerbaarheid-checks)
 * gewoon als "gekoppeld" telt; het publiceren zelf herkent
 * meta.provider==='postiz' en gaat dan via Postiz i.p.v. onze eigen
 * Meta/TikTok-code (zie social-publish.server.ts).
 */
export const assignPostizIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        platform: PLATFORM,
        integrationId: z.string().min(1),
        integrationName: z.string().min(1),
        integrationIdentifier: z.string().min(1),
        followerCount: z.number().int().min(0).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    // Eén Postiz-integratie hoort bij precies één klant — voorkom dat
    // hetzelfde kanaal per ongeluk aan twee klanten tegelijk hangt.
    const { data: existing } = await supabaseAdmin
      .from("social_connections")
      .select("client_id")
      .eq("platform", data.platform);
    const alreadyAssignedElsewhere = (existing ?? []).find(
      (row) => row.client_id !== data.clientId,
    );
    if (alreadyAssignedElsewhere) {
      const { data: rows } = await supabaseAdmin
        .from("social_connections")
        .select("meta")
        .eq("client_id", alreadyAssignedElsewhere.client_id)
        .eq("platform", data.platform)
        .maybeSingle();
      const meta =
        rows?.meta && typeof rows.meta === "object" && !Array.isArray(rows.meta)
          ? (rows.meta as Record<string, unknown>)
          : {};
      if (meta.postizIntegrationId === data.integrationId) {
        throw new Error("Dit Postiz-kanaal is al aan een andere klant toegewezen");
      }
    }

    const { error } = await supabaseAdmin.from("social_connections").upsert(
      {
        client_id: data.clientId,
        platform: data.platform,
        account_username: data.integrationName,
        follower_count: data.followerCount ?? null,
        status: "active",
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        refresh_expires_at: null,
        never_expires: true,
        meta: {
          provider: "postiz",
          postizIntegrationId: data.integrationId,
          postizIdentifier: data.integrationIdentifier,
        },
      },
      { onConflict: "client_id,platform" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
