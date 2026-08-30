import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  downloadDriveFile,
  driveImportConfigured,
  driveMetadata,
  isImportableMedia,
  listDriveFolder,
  parseDriveTarget,
  type DriveFile,
  type DriveListing,
} from "@/lib/drive-import.server";

/**
 * "Stuur een Drive-link, wij halen de rest op."
 *
 * De klant deelt één map en alles erin — inclusief submappen — komt in originele
 * kwaliteit in zijn mediabibliotheek. Geen WhatsApp-compressie, geen bestand
 * voor bestand slepen.
 *
 * Het importeren gaat in porties: elke aanroep pakt een handvol bestanden en
 * meldt hoeveel er nog over is. Zo blijft één verzoek kort (geen timeout op
 * een map van 200 video's) en kan de knop live voortgang laten zien.
 *
 * Al geïmporteerde bestanden herkennen we aan `uploads.source_ref`, dus dezelfde
 * link nog een keer sturen is een synchronisatie en geen duplicatenregen.
 */

function maxUploadBytes(): number {
  const parsed = Number(process.env.VITE_MAX_UPLOAD_MB ?? process.env.MAX_UPLOAD_MB);
  const mb = Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
  return mb * 1024 * 1024;
}

/** Per aanroep: hoogstens zoveel bestanden en zoveel bytes. */
const BATCH_FILES = 6;
const BATCH_BYTES = 120 * 1024 * 1024;

async function assertClientAccess(
  ctx: { supabase: SupabaseClient<Database>; userId: string },
  clientId: string,
) {
  const { data: ok } = await ctx.supabase.rpc("user_has_client_access", {
    _user_id: ctx.userId,
    _client_id: clientId,
  });
  if (!ok) throw new Error("Geen toegang tot deze klant");
}

async function isAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  return !!roles?.some((r) => r.role === "admin");
}

/**
 * Korte cache op de mapinhoud. Zonder dit zouden we bij elke portie de hele map
 * opnieuw bij Google opvragen — bij 300 bestanden is dat 50 keer dezelfde vraag.
 */
const listingCache = new Map<string, { at: number; listing: DriveListing }>();
const LISTING_TTL_MS = 2 * 60 * 1000;

async function listingFor(url: string): Promise<DriveListing> {
  const target = parseDriveTarget(url);

  // Losse bestandslink: behandel als een map met één item, zodat de rest van de
  // stroom hetzelfde blijft.
  if (target.kind === "file") {
    const meta = await driveMetadata(target.id);
    return {
      folderId: target.id,
      folderName: meta.name,
      files: [{ id: target.id, name: meta.name, mimeType: meta.mimeType, size: null, path: "" }],
      skippedFolders: [],
      truncated: false,
    };
  }

  const cached = listingCache.get(target.id);
  if (cached && Date.now() - cached.at < LISTING_TTL_MS) return cached.listing;

  let listing: DriveListing;
  if (target.kind === "folder") {
    listing = await listDriveFolder(target.id);
  } else {
    // Onbekend soort (bv. ?id=…): eerst kijken wat het is.
    const meta = await driveMetadata(target.id);
    listing =
      meta.mimeType === "application/vnd.google-apps.folder"
        ? await listDriveFolder(target.id)
        : {
            folderId: target.id,
            folderName: meta.name,
            files: [
              { id: target.id, name: meta.name, mimeType: meta.mimeType, size: null, path: "" },
            ],
            skippedFolders: [],
            truncated: false,
          };
  }

  listingCache.set(target.id, { at: Date.now(), listing });
  return listing;
}

async function importedRefs(clientId: string): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("uploads")
    .select("source_ref")
    .eq("client_id", clientId)
    .not("source_ref", "is", null);
  return new Set((data ?? []).map((r) => r.source_ref!).filter(Boolean));
}

function mediaFiles(listing: DriveListing): DriveFile[] {
  return listing.files.filter((f) => isImportableMedia(f.mimeType, f.name));
}

export interface DrivePreview {
  configured: boolean;
  folderName: string;
  /** Bestanden die we kunnen importeren (beeld en video). */
  mediaCount: number;
  /** Wat er al een keer is binnengehaald. */
  alreadyImported: number;
  /** Wat er nu bij zou komen. */
  toImport: number;
  /** Totale omvang van wat er nog bij komt, in bytes (schatting). */
  totalBytes: number;
  /** Bestanden die geen beeld of video zijn en dus worden overgeslagen. */
  skippedOther: number;
  skippedFolders: string[];
  truncated: boolean;
  sample: { name: string; path: string }[];
}

export const previewDriveImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({ clientId: z.string().uuid(), url: z.string().trim().min(5).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<DrivePreview> => {
    await assertClientAccess(context, data.clientId);
    if (!driveImportConfigured()) {
      return {
        configured: false,
        folderName: "",
        mediaCount: 0,
        alreadyImported: 0,
        toImport: 0,
        totalBytes: 0,
        skippedOther: 0,
        skippedFolders: [],
        truncated: false,
        sample: [],
      };
    }

    const listing = await listingFor(data.url);
    const media = mediaFiles(listing);
    const existing = await importedRefs(data.clientId);
    const fresh = media.filter((f) => !existing.has(`drive:${f.id}`));

    return {
      configured: true,
      folderName: listing.folderName,
      mediaCount: media.length,
      alreadyImported: media.length - fresh.length,
      toImport: fresh.length,
      totalBytes: fresh.reduce((sum, f) => sum + (f.size ?? 0), 0),
      skippedOther: listing.files.length - media.length,
      skippedFolders: listing.skippedFolders,
      truncated: listing.truncated,
      sample: fresh.slice(0, 8).map((f) => ({ name: f.name, path: f.path })),
    };
  });

export interface DriveImportResult {
  imported: number;
  failed: { name: string; reason: string }[];
  /** Hoeveel er na deze portie nog te gaan is. */
  remaining: number;
  folderName: string;
}

export const importDriveBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        url: z.string().trim().min(5).max(2000),
        /** Map in de mediabibliotheek; leeg = automatisch op naam van de Drive-map. */
        folderId: z.string().uuid().nullable().optional(),
        /** Koppelt de bestanden aan een aanleververzoek, zodat de voortgang meeloopt. */
        deliveryRequestId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<DriveImportResult> => {
    await assertClientAccess(context, data.clientId);

    // Het aanleververzoek moet bij dezelfde klant horen — anders kan iemand
    // uploads aan andermans verzoek hangen en diens voortgang vervuilen.
    if (data.deliveryRequestId) {
      const { data: req } = await supabaseAdmin
        .from("delivery_requests")
        .select("client_id")
        .eq("id", data.deliveryRequestId)
        .maybeSingle();
      if (!req || req.client_id !== data.clientId) {
        throw new Error("Aanleververzoek hoort niet bij deze klant");
      }
    }

    // Zelfde controle voor de doelmap. Zonder dit kan een import in de map van
    // een andere klant belanden — de bestanden verdwijnen dan uit de eigen
    // bibliotheek zonder dat iemand ziet waar ze heen zijn.
    if (data.folderId) {
      const { data: map } = await supabaseAdmin
        .from("media_folders")
        .select("client_id")
        .eq("id", data.folderId)
        .maybeSingle();
      if (!map || map.client_id !== data.clientId) {
        throw new Error("Deze map hoort niet bij deze klant");
      }
    }

    const listing = await listingFor(data.url);
    const existing = await importedRefs(data.clientId);
    const pending = mediaFiles(listing).filter((f) => !existing.has(`drive:${f.id}`));

    if (pending.length === 0) {
      return { imported: 0, failed: [], remaining: 0, folderName: listing.folderName };
    }

    // Doelmap in de bibliotheek: hergebruik of maak er één met de naam van de
    // Drive-map, zodat een import niet tussen de losse bestanden verdwijnt.
    let targetFolder = data.folderId ?? null;
    if (!targetFolder && listing.folderName) {
      const { data: found } = await supabaseAdmin
        .from("media_folders")
        .select("id")
        .eq("client_id", data.clientId)
        .eq("name", listing.folderName)
        .maybeSingle();
      if (found) {
        targetFolder = found.id;
      } else {
        const { data: created } = await supabaseAdmin
          .from("media_folders")
          .insert({ client_id: data.clientId, name: listing.folderName })
          .select("id")
          .maybeSingle();
        targetFolder = created?.id ?? null;
      }
    }

    // Klantuploads gaan langs de goedkeuringswachtrij, admin-imports niet —
    // gelijk aan hoe een gewone upload zich gedraagt.
    const status = (await isAdmin(context)) ? "approved" : "pending";
    const limit = maxUploadBytes();

    const batch: DriveFile[] = [];
    let batchBytes = 0;
    for (const file of pending) {
      if (batch.length >= BATCH_FILES) break;
      if (batch.length > 0 && batchBytes + (file.size ?? 0) > BATCH_BYTES) break;
      batch.push(file);
      batchBytes += file.size ?? 0;
    }

    let imported = 0;
    const failed: { name: string; reason: string }[] = [];

    for (const file of batch) {
      const safeName = file.name.replace(/[\\/]/g, "_").trim() || "bestand";
      const path = `${data.clientId}/drive/${file.id}-${safeName}`;
      try {
        const { bytes, contentType } = await downloadDriveFile(file.id, limit);
        const { error: uploadError } = await supabaseAdmin.storage
          .from("client-uploads")
          .upload(path, bytes, { contentType, upsert: true });
        if (uploadError) throw new Error(uploadError.message);

        const { error: insertError } = await supabaseAdmin.from("uploads").insert({
          client_id: data.clientId,
          file_path: path,
          file_name: safeName,
          file_type: contentType,
          file_size: bytes.byteLength,
          folder_id: targetFolder,
          uploader_id: context.userId,
          status,
          source_ref: `drive:${file.id}`,
          delivery_request_id: data.deliveryRequestId ?? null,
        });
        if (insertError) {
          await supabaseAdmin.storage.from("client-uploads").remove([path]);
          throw new Error(insertError.message);
        }
        imported++;
      } catch (e) {
        failed.push({
          name: file.name,
          reason: e instanceof Error ? e.message : "onbekende fout",
        });
      }
    }

    // Wat niet lukte tellen we niet als "nog te gaan": anders blijft de lus van
    // de knop eindeloos op hetzelfde bestand stuklopen.
    const remaining = Math.max(0, pending.length - batch.length);
    return { imported, failed, remaining, folderName: listing.folderName };
  });
