import { createServerFn } from "@tanstack/react-start";
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
      supabaseAdmin.from("uploads").select("client_id, file_size"),
      supabaseAdmin.from("clients").select("id, name"),
    ]);
    if (uploadsRes.error) throw new Error(uploadsRes.error.message);
    if (clientsRes.error) throw new Error(clientsRes.error.message);

    const uploads = (uploadsRes.data ?? []) as UploadRow[];
    const clients = (clientsRes.data ?? []) as ClientRow[];
    const nameById = new Map(clients.map((c) => [c.id, c.name]));

    let totalBytes = 0;
    const perClientMap = new Map<string, { bytes: number; files: number }>();
    for (const row of uploads) {
      const bytes = row.file_size ?? 0;
      totalBytes += bytes;
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
      fileCount: uploads.length,
      perClient,
    };
  });
