import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { generateText } from "@/lib/ai-provider.server";

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen captions genereren");
  }
}

const inputSchema = z.object({
  briefing: z.string().min(3).max(4000),
  tone: z.enum(["professioneel", "informeel", "energiek", "inspirerend"]).default("professioneel"),
  platforms: z
    .array(z.enum(["instagram", "linkedin", "tiktok", "facebook", "x", "threads"]))
    .min(1)
    .max(6),
  clientId: z.string().uuid().optional().nullable(),
  language: z.enum(["nl", "en"]).default("nl"),
});

const PLATFORM_HINTS: Record<string, string> = {
  instagram:
    "Instagram: max 2200 tekens, gebruik 3-5 relevante hashtags, emoji ok, eerste zin is een hook.",
  linkedin:
    "LinkedIn: max 3000 tekens, professioneel, geen hashtags-spam (max 3), call-to-action voor reacties.",
  tiktok: "TikTok: max 300 tekens, korte energieke zin, 2-3 hashtags, trend-aware.",
  facebook: "Facebook: max 1500 tekens, conversationeel, geen hashtag-overdaad.",
  x: "X/Twitter: max 280 tekens, krachtige hook, 1-2 hashtags max.",
  threads: "Threads: max 500 tekens, conversationeel, geen hashtags nodig.",
};

export const generateCaptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    let clientContext = "";
    let toneOfVoice = "";
    if (data.clientId) {
      const { data: c } = await supabaseAdmin
        .from("clients")
        .select("name, industry, notes")
        .eq("id", data.clientId)
        .maybeSingle();
      if (c) {
        clientContext = `\nKlant: ${c.name}${c.industry ? ` (${c.industry})` : ""}.`;
        if (c.notes)
          toneOfVoice = `\nMerkcontext/tone-of-voice notities: ${String(c.notes).slice(0, 800)}`;
      }
    }

    const lang = data.language === "en" ? "Engels" : "Nederlands";
    const results: { platform: string; text: string }[] = [];

    for (const platform of data.platforms) {
      const system = `Je bent een social-media copywriter. Schrijf in het ${lang}, toon: ${data.tone}.${clientContext}${toneOfVoice}\n\n${PLATFORM_HINTS[platform]}\n\nGeef ALLEEN de caption terug, geen uitleg of label.`;
      const text = await generateText({ system, user: data.briefing, effort: "low" });
      results.push({ platform, text });

      await supabaseAdmin.from("ai_generations").insert({
        client_id: data.clientId ?? null,
        user_id: context.userId,
        briefing: data.briefing,
        tone: data.tone,
        platform,
        generated_text: text,
      });
    }

    return { results };
  });

export const listAiGenerations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid().optional().nullable(),
        limit: z.number().min(1).max(50).default(10),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = supabaseAdmin
      .from("ai_generations")
      .select("id, client_id, platform, tone, briefing, generated_text, created_at, clients(name)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.clientId) q = q.eq("client_id", data.clientId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
