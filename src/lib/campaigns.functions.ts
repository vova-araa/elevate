import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/integrations/supabase/types";
import { generateJson } from "@/lib/ai-provider.server";

// ── Auth (zelfde patroon als ai-studio.functions.ts) ─────────────────────────

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen campagnes genereren");
  }
}

// ── Platforms ────────────────────────────────────────────────────────────────

export const campaignPlatform = z.enum(["instagram", "tiktok", "linkedin", "youtube", "facebook"]);
export type CampaignPlatform = z.infer<typeof campaignPlatform>;

const PLATFORM_HINTS: Record<CampaignPlatform, string> = {
  instagram: "Instagram: visueel, hook in de eerste zin, 3-5 hashtags, emoji ok.",
  tiktok: "TikTok: kort en energiek, trend-aware, 2-3 hashtags.",
  linkedin: "LinkedIn: professioneel, waarde-gedreven, max 3 hashtags, cta voor reacties.",
  youtube: "YouTube: pakkende titel/omschrijving, gericht op kijktijd.",
  facebook: "Facebook: conversationeel, community-gericht, weinig hashtags.",
};

// Standaard-publicatietijd per platform (lokale uren), gebruikt als er geen
// expliciete tijd wordt meegegeven.
const DEFAULT_HOUR: Record<CampaignPlatform, number> = {
  instagram: 18,
  tiktok: 19,
  linkedin: 8,
  youtube: 17,
  facebook: 12,
};

export function defaultHourFor(platform: CampaignPlatform): number {
  return DEFAULT_HOUR[platform];
}

// ── Klantcontext (naam/industrie + tone-of-voice + strategie) ───────────────

/**
 * Bouwt de klantcontext die als extra system-context aan de AI wordt
 * meegegeven: klantgegevens, losse tone-of-voice-notities (strategy_notes) én
 * — indien aanwezig — de vaste client_strategy (positionering, content-
 * pijlers, cadans, dos/don'ts). Zo denkt de AI standaard vanuit de strategie
 * mee bij het genereren van contentplannen en weekplanningen.
 */
export const fetchClientContext = createServerOnlyFn(async (clientId: string): Promise<string> => {
  const parts: string[] = [];
  const { data: c } = await supabaseAdmin
    .from("clients")
    .select("name, industry, notes, description")
    .eq("id", clientId)
    .maybeSingle();
  if (c) {
    parts.push(`Klant: ${c.name}${c.industry ? ` (${c.industry})` : ""}.`);
    if (c.description) parts.push(`Over de klant: ${String(c.description).slice(0, 500)}`);
    if (c.notes) parts.push(`Klantnotities: ${String(c.notes).slice(0, 400)}`);
  }
  const { data: tone } = await supabaseAdmin
    .from("strategy_notes")
    .select("body")
    .eq("client_id", clientId)
    .eq("category", "tone_of_voice")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (tone?.body) {
    parts.push(`Tone-of-voice — houd je hier strikt aan:\n${tone.body.slice(0, 1600)}`);
  }

  const { data: strategy } = await supabaseAdmin
    .from("client_strategy")
    .select("positioning, audience, tone, pillars, cadence, goals, dos, donts")
    .eq("client_id", clientId)
    .maybeSingle();
  if (strategy) {
    const stratLines: string[] = [];
    if (strategy.positioning) stratLines.push(`Positionering: ${strategy.positioning}`);
    if (strategy.audience) stratLines.push(`Doelgroep: ${strategy.audience}`);
    if (strategy.tone) stratLines.push(`Tone-of-voice: ${strategy.tone}`);
    if (strategy.goals) stratLines.push(`Doelen: ${strategy.goals}`);
    const pillars = Array.isArray(strategy.pillars) ? (strategy.pillars as unknown[]) : [];
    if (pillars.length) stratLines.push(`Content-pijlers: ${pillars.join(", ")}`);
    const cadence = strategy.cadence as Record<string, number> | null;
    if (cadence && Object.keys(cadence).length) {
      const cadenceStr = Object.entries(cadence)
        .map(([platform, count]) => `${platform}: ${count}x/week`)
        .join(", ");
      stratLines.push(`Cadans: ${cadenceStr}`);
    }
    const dos = Array.isArray(strategy.dos) ? (strategy.dos as unknown[]) : [];
    if (dos.length) stratLines.push(`Wel doen: ${dos.join("; ")}`);
    const donts = Array.isArray(strategy.donts) ? (strategy.donts as unknown[]) : [];
    if (donts.length) stratLines.push(`Niet doen: ${donts.join("; ")}`);
    if (stratLines.length) {
      parts.push(
        `Vastgestelde contentstrategie — houd hier standaard rekening mee:\n${stratLines.join("\n")}`,
      );
    }
  }

  return parts.length ? `\n\n${parts.join("\n")}` : "";
});

// ── Contentplan genereren ────────────────────────────────────────────────────

export interface PlanItem {
  dayOffset: number;
  platform: CampaignPlatform;
  title: string;
  caption: string;
  hashtags: string[];
}

export const generateContentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        goal: z.string().trim().min(3, "Beschrijf kort het doel of thema").max(600),
        platforms: z.array(campaignPlatform).min(1).max(5),
        days: z.number().int().min(3).max(31).default(14),
        postsPerPlatform: z.number().int().min(1).max(20).default(4),
        tone: z.enum(["professioneel", "informeel", "energiek", "inspirerend"]).default("energiek"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const clientContext = await fetchClientContext(data.clientId);
    const platformRules = data.platforms.map((p) => `- ${PLATFORM_HINTS[p]}`).join("\n");
    const total = data.platforms.length * data.postsPerPlatform;

    const system = `Je bent een senior social-media strateeg bij een creatief agency. Werk in het Nederlands, basistoon: ${data.tone}.${clientContext}

Platform-richtlijnen:
${platformRules}

Opdracht: stel een samenhangend contentplan op voor een periode van ${data.days} dagen. Genereer in totaal ${total} posts: precies ${data.postsPerPlatform} per platform (${data.platforms.join(", ")}). Spreid ze logisch over de periode via "dayOffset" (geheel getal van 0 t/m ${data.days - 1}, 0 = de startdag). Vermijd dat meerdere posts van hetzelfde platform op dezelfde dag vallen.

Per post:
- "title": korte interne werktitel/idee (max 8 woorden).
- "caption": een kant-en-klare, publiceerbare caption in de juiste toon voor dat platform.
- "hashtags": 2-6 relevante hashtags zonder het #-teken.
Zorg voor variatie in invalshoek (educatief, storytelling, promotie, engagement) en een rode draad die past bij het doel.`;

    const result = await generateJson<{ items: PlanItem[] }>({
      system,
      user: `Doel/thema van de campagne: ${data.goal}`,
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
              },
              required: ["dayOffset", "platform", "title", "caption", "hashtags"],
              additionalProperties: false,
            },
          },
        },
        required: ["items"],
        additionalProperties: false,
      },
    });

    // Normaliseer: clamp dayOffset binnen bereik, hashtags ontdaan van #.
    const items = (result.items ?? []).map((it) => ({
      ...it,
      dayOffset: Math.min(Math.max(0, it.dayOffset | 0), data.days - 1),
      hashtags: (it.hashtags ?? []).map((h) => h.replace(/^#/, "").trim()).filter(Boolean),
    }));

    return { items };
  });

// ── Geselecteerde posts wegschrijven als concept ─────────────────────────────

export const createPlanPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        posts: z
          .array(
            z.object({
              scheduledAt: z.string().datetime(),
              platform: campaignPlatform,
              caption: z.string().trim().min(1),
            }),
          )
          .min(1, "Selecteer minstens één post")
          .max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const rows: TablesInsert<"scheduled_posts">[] = data.posts.map((p) => ({
      client_id: data.clientId,
      platform: p.platform,
      caption: p.caption,
      scheduled_at: p.scheduledAt,
      status: "draft",
    }));

    const { error } = await supabaseAdmin.from("scheduled_posts").insert(rows);
    if (error) throw new Error(error.message);

    return { inserted: rows.length };
  });
