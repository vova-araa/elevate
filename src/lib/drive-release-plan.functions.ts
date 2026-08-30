import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { generateJson } from "@/lib/ai-provider.server";
import { getValidDriveAccessToken } from "@/lib/drive-connection.functions";
import { downloadDriveFileAuthed } from "@/lib/drive-import.server";
import {
  campaignPlatform,
  fetchClientContext,
  type CampaignPlatform,
} from "@/lib/campaigns.functions";

/**
 * "Vanuit Drive een releaseplanning maken": de admin kiest in /admin/drive
 * een klant + een setje gevonden mediabestanden, AI stelt per bestand een
 * post voor (platform, caption, hashtags, datum), en na akkoord worden de
 * bestanden gedownload/geüpload en als concept ingepland — zelfde
 * propose-dan-commit-vorm als campaigns.functions.ts.
 */

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen een releaseplanning genereren");
  }
}

function maxUploadBytes(): number {
  const parsed = Number(process.env.VITE_MAX_UPLOAD_MB ?? process.env.MAX_UPLOAD_MB);
  const mb = Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
  return mb * 1024 * 1024;
}

const driveFileInput = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string(),
});

export interface DriveReleaseItem {
  dayOffset: number;
  platform: CampaignPlatform;
  title: string;
  caption: string;
  hashtags: string[];
  driveFileId: string;
  driveFileName: string;
}

export const generateDriveReleasePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        files: z.array(driveFileInput).min(1).max(60),
        platforms: z.array(campaignPlatform).min(1).max(5),
        days: z.number().int().min(1).max(31).default(14),
        notes: z.string().trim().max(600).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ items: DriveReleaseItem[] }> => {
    await assertAdmin(context);

    const clientContext = await fetchClientContext(data.clientId);
    const fileList = data.files
      .map((f) => `- id="${f.id}" naam="${f.name}" type=${f.mimeType}`)
      .join("\n");

    const system = `Je bent een senior social-media strateeg bij een creatief agency. Werk in het Nederlands.${clientContext}

Je krijgt een lijst mediabestanden uit een gedeelde Google Drive-map. Stel per bestand precies één post voor — niet meer bestanden gebruiken dan gegeven, en niet hetzelfde bestand twee keer inzetten tenzij er meer posts dan bestanden nodig zijn.

Beschikbare bestanden:
${fileList}

Verdeel de posts over de platforms ${data.platforms.join(", ")} en spreid ze over ${data.days} dagen via "dayOffset" (0 t/m ${data.days - 1}, 0 = de eerste publicatiedag). Vermijd dat meerdere posts van hetzelfde platform op dezelfde dag vallen.

Per post:
- "driveFileId": het exacte id van één bestand uit de lijst hierboven.
- "driveFileName": de bijbehorende naam, ter controle.
- "title": korte interne werktitel (max 8 woorden).
- "caption": een kant-en-klare, publiceerbare caption passend bij het platform en (indien gegeven) de bestandsnaam.
- "hashtags": 2-6 relevante hashtags zonder het #-teken.`;

    const result = await generateJson<{ items: DriveReleaseItem[] }>({
      system,
      user: data.notes?.trim()
        ? `Extra aanwijzingen voor deze releaseplanning: ${data.notes.trim()}`
        : "Stel de releaseplanning op zoals hierboven beschreven.",
      effort: "medium",
      maxTokens: 16384,
      schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                dayOffset: { type: "integer", minimum: 0, maximum: data.days - 1 },
                platform: { type: "string", enum: [...data.platforms] },
                title: { type: "string" },
                caption: { type: "string" },
                hashtags: { type: "array", items: { type: "string" } },
                driveFileId: { type: "string", enum: data.files.map((f) => f.id) },
                driveFileName: { type: "string" },
              },
              required: [
                "dayOffset",
                "platform",
                "title",
                "caption",
                "hashtags",
                "driveFileId",
                "driveFileName",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["items"],
        additionalProperties: false,
      },
    });

    const items = (result.items ?? []).map((it) => ({
      ...it,
      dayOffset: Math.min(Math.max(0, it.dayOffset | 0), data.days - 1),
      hashtags: (it.hashtags ?? []).map((h) => h.replace(/^#/, "").trim()).filter(Boolean),
    }));

    return { items };
  });

// ── Akkoord: downloaden, uploaden, inplannen als concept ─────────────────────

const releaseItemInput = z.object({
  scheduledAt: z.string().datetime(),
  platform: campaignPlatform,
  caption: z.string().trim().min(1),
  driveFileId: z.string().min(1),
  driveFileName: z.string().min(1),
});

/** Per aanroep: hoogstens zoveel posts — zelfde reden als importDriveBatch: één verzoek kort houden. */
const BATCH_SIZE = 5;

export interface CommitDriveReleaseResult {
  created: number;
  failed: { name: string; reason: string }[];
  remaining: number;
}

export const commitDriveReleasePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        items: z.array(releaseItemInput).min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<CommitDriveReleaseResult> => {
    await assertAdmin(context);

    const accessToken = await getValidDriveAccessToken();
    const limit = maxUploadBytes();
    const batch = data.items.slice(0, BATCH_SIZE);

    let created = 0;
    const failed: { name: string; reason: string }[] = [];

    for (const item of batch) {
      const safeName = item.driveFileName.replace(/[\\/]/g, "_").trim() || "bestand";
      const path = `${data.clientId}/drive/${item.driveFileId}-${safeName}`;
      try {
        const { bytes, contentType } = await downloadDriveFileAuthed(
          item.driveFileId,
          accessToken,
          limit,
        );
        const { error: uploadError } = await supabaseAdmin.storage
          .from("client-uploads")
          .upload(path, bytes, { contentType, upsert: true });
        if (uploadError) throw new Error(uploadError.message);

        // Ook in de mediabibliotheek, zodat het net als een gewone import
        // terugvindbaar is en niet dubbel geïmporteerd kan worden.
        await supabaseAdmin.from("uploads").insert({
          client_id: data.clientId,
          file_path: path,
          file_name: safeName,
          file_type: contentType,
          file_size: bytes.byteLength,
          uploader_id: context.userId,
          status: "approved",
          source_ref: `drive:${item.driveFileId}`,
        });

        const { error: postError } = await supabaseAdmin.from("scheduled_posts").insert({
          client_id: data.clientId,
          platform: item.platform,
          caption: item.caption,
          scheduled_at: item.scheduledAt,
          media_path: path,
          media_type: contentType,
          status: "draft",
        });
        if (postError) throw new Error(postError.message);

        created++;
      } catch (e) {
        failed.push({
          name: item.driveFileName,
          reason: e instanceof Error ? e.message : "onbekende fout",
        });
      }
    }

    return { created, failed, remaining: Math.max(0, data.items.length - batch.length) };
  });
