import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getValidDriveAccessToken } from "@/lib/drive-connection.functions";
import {
  listSharedWithMe,
  listFolderContentsAuthed,
  driveMetadataAuthed,
  isImportableMedia,
  type DriveSharedItem,
} from "@/lib/drive-import.server";

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen door Drive bladeren");
  }
}

function withMediaFlag(items: DriveSharedItem[]) {
  return items.map((i) => ({
    ...i,
    isMedia: !i.isFolder && isImportableMedia(i.mimeType, i.name),
  }));
}
export type DriveBrowseItem = DriveSharedItem & { isMedia: boolean };

/** Doorzoekt alles wat met het gekoppelde account gedeeld is (leeg = meest recente). */
export const searchDriveShared = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ query: z.string().trim().max(200).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<{ items: DriveBrowseItem[] }> => {
    await assertAdmin(context);
    const accessToken = await getValidDriveAccessToken();
    const items = await listSharedWithMe(accessToken, data.query);
    return { items: withMediaFlag(items) };
  });

/** Eén map, één niveau diep — voor doorklikken vanuit de zoekresultaten. */
export const browseDriveFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ folderId: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }): Promise<{ folderName: string; items: DriveBrowseItem[] }> => {
    await assertAdmin(context);
    const accessToken = await getValidDriveAccessToken();
    const [meta, items] = await Promise.all([
      driveMetadataAuthed(data.folderId, accessToken),
      listFolderContentsAuthed(data.folderId, accessToken),
    ]);
    return { folderName: meta.name, items: withMediaFlag(items) };
  });
