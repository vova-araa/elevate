import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { sourceFeed } from "@/lib/feed.functions";
import { ALL_PLATFORM_IDS, type Platform } from "@/config/platforms";

/**
 * Vrij herschikbaar feed-raster in de mediabibliotheek: sleep media uit de
 * bibliotheek (of vul 'm met wat er al live staat) om te zien hoe de feed er
 * het mooist uitziet, los van een concrete inplanning.
 *
 * Zelfde beveiligingspatroon als de rest van de client-gebonden functies:
 * requireSupabaseAuth + assertClientAccess vóór elke supabaseAdmin-aanroep
 * (de tabel zelf geeft niets vrij aan authenticated, zie de migration).
 */

const STORAGE_BUCKET = "client-uploads";
const PLATFORM = z.enum(ALL_PLATFORM_IDS as [Platform, ...Platform[]]);

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

export interface FeedArrangementSlot {
  id: string;
  position: number;
  uploadId: string | null;
  mediaUrl: string | null;
  caption: string | null;
  isVideo: boolean;
}

// ── Opvragen ──────────────────────────────────────────────────────────────

export const getFeedArrangement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clientId: z.string().uuid(), platform: PLATFORM }).parse(d))
  .handler(async ({ data, context }): Promise<FeedArrangementSlot[]> => {
    await assertClientAccess(context.supabase, context.userId, data.clientId);

    const { data: rows, error } = await supabaseAdmin
      .from("feed_arrangement_slots")
      .select(
        "id, position, upload_id, snapshot_media_url, snapshot_caption, snapshot_is_video, uploads(file_path, file_name, file_type, client_id)",
      )
      .eq("client_id", data.clientId)
      .eq("platform", data.platform)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);

    // Eigen media wordt bij élke opvraging vers gesigneerd (net als de rest
    // van de mediabibliotheek) — nooit de kortlevende URL van vorige keer
    // hergebruiken. Alleen paden binnen de map van déze klant signeren, ook
    // al staat client_id hierboven via de foreign key al vast: dubbele check
    // kost niets en voorkomt dat een verweesde/verplaatste upload alsnog een
    // URL buiten de eigen tenant oplevert.
    const uploadPaths = (rows ?? [])
      .map((r) => r.uploads)
      .filter(
        (u): u is NonNullable<typeof u> =>
          !!u && u.client_id === data.clientId && u.file_path.startsWith(`${data.clientId}/`),
      )
      .map((u) => u.file_path);

    const signed = new Map<string, string>();
    if (uploadPaths.length) {
      const { data: urls } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrls(uploadPaths, 3600);
      for (const entry of urls ?? []) {
        if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
      }
    }

    return (rows ?? []).map((r) => {
      const upload = r.uploads;
      const validUpload = upload && upload.client_id === data.clientId ? upload : null;
      return {
        id: r.id,
        position: r.position,
        uploadId: r.upload_id,
        mediaUrl: validUpload ? (signed.get(validUpload.file_path) ?? null) : r.snapshot_media_url,
        caption: validUpload ? validUpload.file_name : r.snapshot_caption,
        isVideo: validUpload
          ? (validUpload.file_type ?? "").startsWith("video")
          : r.snapshot_is_video,
      };
    });
  });

// ── Herschikken / opslaan (volledige vervanging) ────────────────────────────

const SlotInput = z
  .object({
    uploadId: z.string().uuid().optional(),
    snapshotMediaUrl: z.string().url().max(2000).optional(),
    snapshotCaption: z.string().max(2000).optional(),
    snapshotIsVideo: z.boolean().optional(),
  })
  .refine((s) => !!s.uploadId || !!s.snapshotMediaUrl, {
    message: "Slot heeft geen media",
  });

export const saveFeedArrangement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        platform: PLATFORM,
        // Ruim boven wat een raster ooit toont — puur om een lus/misbruik
        // niet onbeperkt rijen te laten aanmaken.
        slots: z.array(SlotInput).max(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertClientAccess(context.supabase, context.userId, data.clientId);

    // Eigenaarschap van alle aangeleverde upload-id's in één keer checken —
    // zonder dit kan een upload-id van een andere klant zomaar in het raster
    // van deze klant belanden (het is verder alleen een UUID, geen geheim).
    const uploadIds = [
      ...new Set(data.slots.map((s) => s.uploadId).filter((v): v is string => !!v)),
    ];
    if (uploadIds.length) {
      const { data: owned } = await supabaseAdmin
        .from("uploads")
        .select("id")
        .eq("client_id", data.clientId)
        .in("id", uploadIds);
      const ownedSet = new Set((owned ?? []).map((r) => r.id));
      if (uploadIds.some((id) => !ownedSet.has(id))) {
        throw new Error("Eén of meer bestanden horen niet bij deze klant");
      }
    }

    // Volledige vervanging i.p.v. losse posities schuiven: bij een drag komt
    // de hele nieuwe volgorde in één keer binnen, en delete+insert voorkomt
    // dat twee rijen tijdelijk dezelfde positie claimen (de unique index zou
    // dat anders midden in een reeks losse updates laten klappen).
    const del = await supabaseAdmin
      .from("feed_arrangement_slots")
      .delete()
      .eq("client_id", data.clientId)
      .eq("platform", data.platform);
    if (del.error) throw new Error(del.error.message);

    if (data.slots.length === 0) return { count: 0 };

    const rows = data.slots.map((s, i) => ({
      client_id: data.clientId,
      platform: data.platform,
      position: i,
      upload_id: s.uploadId ?? null,
      snapshot_media_url: s.uploadId ? null : (s.snapshotMediaUrl ?? null),
      snapshot_caption: s.uploadId ? null : (s.snapshotCaption ?? null),
      snapshot_is_video: s.uploadId ? false : !!s.snapshotIsVideo,
      created_by: context.userId,
    }));
    const { error } = await supabaseAdmin.from("feed_arrangement_slots").insert(rows);
    if (error) throw new Error(error.message);
    return { count: rows.length };
  });

// ── Leegmaken ────────────────────────────────────────────────────────────

export const clearFeedArrangement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clientId: z.string().uuid(), platform: PLATFORM }).parse(d))
  .handler(async ({ data, context }) => {
    await assertClientAccess(context.supabase, context.userId, data.clientId);
    const { error } = await supabaseAdmin
      .from("feed_arrangement_slots")
      .delete()
      .eq("client_id", data.clientId)
      .eq("platform", data.platform);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Vullen met de live feed ─────────────────────────────────────────────────

export const fillFeedArrangementFromLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        platform: PLATFORM,
        limit: z.number().int().min(1).max(30).default(12),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertClientAccess(context.supabase, context.userId, data.clientId);

    // Hergebruikt exact dezelfde bron als de live-feed-preview elders in de
    // app (dashboard/planner): Instagram/Facebook via de Graph API, met een
    // terugval op onze eigen 'published'-registratie per platform.
    const feed = await sourceFeed(data.clientId, data.platform, data.limit);

    const rows = feed.items
      .filter((item) => !!item.mediaUrl)
      .map((item, i) => ({
        client_id: data.clientId,
        platform: data.platform,
        position: i,
        upload_id: null,
        snapshot_media_url: item.mediaUrl,
        snapshot_caption: item.caption,
        snapshot_is_video: item.isVideo,
        created_by: context.userId,
      }));

    const del = await supabaseAdmin
      .from("feed_arrangement_slots")
      .delete()
      .eq("client_id", data.clientId)
      .eq("platform", data.platform);
    if (del.error) throw new Error(del.error.message);

    if (rows.length) {
      const { error } = await supabaseAdmin.from("feed_arrangement_slots").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { count: rows.length, source: feed.source, note: feed.note };
  });
