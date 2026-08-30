import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Opslaggebruik voor de mediabibliotheek — uitsluitend echte cijfers.
 * Alle bytes komen uit `uploads.file_size` (bytes). Er wordt niets geschat:
 * ontbrekende groottes (null) tellen als 0.
 */

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen opslaggebruik bekijken");
  }
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface ClientStorageUsage {
  clientId: string;
  clientName: string;
  bytes: number;
  files: number;
}

export interface StorageUsage {
  totalBytes: number;
  fileCount: number;
  perClient: ClientStorageUsage[];
}

interface UploadRow {
  client_id: string;
  file_size: number | null;
  media_purged_at: string | null;
}

interface ClientRow {
  id: string;
  name: string;
}

// ── Server function ─────────────────────────────────────────────────────

export const getStorageUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StorageUsage> => {
    await assertAdmin(context);

    const [uploadsRes, clientsRes] = await Promise.all([
      supabaseAdmin.from("uploads").select("client_id, file_size, media_purged_at"),
      supabaseAdmin.from("clients").select("id, name"),
    ]);
    if (uploadsRes.error) throw new Error(uploadsRes.error.message);
    if (clientsRes.error) throw new Error(clientsRes.error.message);

    const uploads = (uploadsRes.data ?? []) as UploadRow[];
    const clients = (clientsRes.data ?? []) as ClientRow[];
    const nameById = new Map(clients.map((c) => [c.id, c.name]));

    let totalBytes = 0;
    let storedFiles = 0;
    const perClientMap = new Map<string, { bytes: number; files: number }>();
    for (const row of uploads) {
      // Opgeruimde bestanden staan niet meer in de opslag → tellen niet mee.
      if (row.media_purged_at) continue;
      const bytes = row.file_size ?? 0;
      totalBytes += bytes;
      storedFiles += 1;
      const entry = perClientMap.get(row.client_id) ?? { bytes: 0, files: 0 };
      entry.bytes += bytes;
      entry.files += 1;
      perClientMap.set(row.client_id, entry);
    }

    const perClient: ClientStorageUsage[] = Array.from(perClientMap.entries())
      .map(([clientId, { bytes, files }]) => ({
        clientId,
        clientName: nameById.get(clientId) ?? "Onbekende klant",
        bytes,
        files,
      }))
      .sort((a, b) => b.bytes - a.bytes);

    return {
      totalBytes,
      fileCount: storedFiles,
      perClient,
    };
  });

/**
 * Handmatig bulk-opruimen: verwijdert de mediabestanden van geselecteerde
 * uploads UIT DE OPSLAG, maar houdt de registratie (rij + `media_purged_at`).
 * Alleen media die al is GEPUBLICEERD wordt opgeruimd — zo kun je nooit per
 * ongeluk nog-te-plaatsen content wissen, en blijft zichtbaar dat het gebruikt
 * is (voorkomt dubbel plaatsen). Niet-gepubliceerde selecties worden
 * overgeslagen.
 */
export const purgePostedMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ uploadIds: z.array(z.string().uuid()).min(1) }).parse(d))
  .handler(async ({ data, context }): Promise<{ purged: number; skipped: number }> => {
    await assertAdmin(context);
    const now = new Date().toISOString();

    const { data: ups, error } = await supabaseAdmin
      .from("uploads")
      .select("id, client_id, file_path, media_purged_at")
      .in("id", data.uploadIds);
    if (error) throw new Error(error.message);

    let purged = 0;
    let skipped = 0;
    for (const u of ups ?? []) {
      if (u.media_purged_at) {
        skipped++;
        continue;
      }
      // Tenant-isolatie: `file_path` wordt door de klant-UI zelf meegestuurd
      // en de RLS-policy op `uploads` controleert alleen de klant, niet het
      // pad. Zonder deze check kan een rij met het pad van een ándere klant
      // hier diens bestand laten verwijderen — de service-role negeert immers
      // de storage-policies.
      if (!u.file_path?.startsWith(`${u.client_id}/`)) {
        skipped++;
        continue;
      }
      // Alleen opruimen als dit bestand daadwerkelijk al gepubliceerd is,
      // en dan uitsluitend binnen dezelfde klant.
      const { count } = await supabaseAdmin
        .from("scheduled_posts")
        .select("id", { count: "exact", head: true })
        .eq("client_id", u.client_id)
        .eq("media_path", u.file_path)
        .eq("status", "published");
      if (!count) {
        skipped++;
        continue;
      }
      await supabaseAdmin.storage.from("client-uploads").remove([u.file_path]);
      await supabaseAdmin.from("uploads").update({ media_purged_at: now }).eq("id", u.id);
      await supabaseAdmin
        .from("scheduled_posts")
        .update({ media_purged_at: now })
        .eq("client_id", u.client_id)
        .eq("media_path", u.file_path)
        .eq("status", "published");
      purged++;
    }
    return { purged, skipped };
  });
