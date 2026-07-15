import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/integrations/supabase/types";

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen bulk-posts inplannen");
  }
}

const platformSchema = z.enum(["instagram", "tiktok", "linkedin", "youtube", "facebook"]);

const bulkRowSchema = z.object({
  scheduledAt: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Ongeldige datum/tijd",
  }),
  platform: platformSchema,
  caption: z.string().trim().min(1, "Caption mag niet leeg zijn"),
});

const bulkCreateInputSchema = z.object({
  clientId: z.string().uuid(),
  rows: z.array(bulkRowSchema).min(1, "Geen rijen om te importeren").max(1000),
});

export type BulkRow = z.infer<typeof bulkRowSchema>;

export const bulkCreatePosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => bulkCreateInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: client, error: clientErr } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (clientErr) throw new Error(clientErr.message);
    if (!client) throw new Error("Klant niet gevonden");

    // Server-side revalidatie — vertrouw de client niet.
    const rows: TablesInsert<"scheduled_posts">[] = [];
    for (const row of data.rows) {
      const parsed = bulkRowSchema.safeParse(row);
      if (!parsed.success) continue;
      const scheduledAt = new Date(parsed.data.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) continue;
      const caption = parsed.data.caption.trim();
      if (!caption) continue;
      rows.push({
        client_id: data.clientId,
        platform: parsed.data.platform,
        caption,
        scheduled_at: scheduledAt.toISOString(),
        status: "draft",
        created_by: context.userId,
      });
    }

    if (rows.length === 0) throw new Error("Geen geldige rijen om te importeren");

    const { error } = await supabaseAdmin.from("scheduled_posts").insert(rows);
    if (error) throw new Error(error.message);

    return { inserted: rows.length };
  });

const getBestTimesInputSchema = z.object({
  clientId: z.string().uuid().optional().nullable(),
  platforms: z.array(platformSchema).min(1).max(6),
});

export type BestTimeResult = Record<string, string>;

export const getBestTimes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => getBestTimesInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const result: BestTimeResult = {};
    for (const platform of data.platforms) {
      const { data: rows, error } = await supabaseAdmin
        .from("best_time_benchmarks")
        .select("time_of_day,score")
        .eq("platform", platform)
        .order("score", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      result[platform] = rows?.[0]?.time_of_day?.slice(0, 5) ?? "09:00";
    }

    return result;
  });
