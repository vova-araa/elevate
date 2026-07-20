import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert, Json } from "@/integrations/supabase/types";
import { generateJson } from "@/lib/ai-provider.server";
import {
  campaignPlatform,
  defaultHourFor,
  fetchClientContext,
  type CampaignPlatform,
  type PlanItem,
} from "@/lib/campaigns.functions";

// ── Auth (zelfde patroon als campaigns.functions.ts) ─────────────────────────

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen de strategie beheren");
  }
}

const PLATFORM_LIST: CampaignPlatform[] = [
  "instagram",
  "tiktok",
  "linkedin",
  "youtube",
  "facebook",
];

// ── Intake ───────────────────────────────────────────────────────────────────

// Geen .default() op de velden — de defaults leven in INTAKE_DEFAULTS aan de
// clientkant (useForm defaultValues). Zo blijft het input- en outputtype van
// dit schema identiek, wat react-hook-form's zodResolver vereist.
export const intakeAnswersSchema = z.object({
  positioning: z.string().trim().max(2000),
  audience: z.string().trim().max(2000),
  goalReach: z.boolean(),
  goalLeads: z.boolean(),
  goalSales: z.boolean(),
  goalOther: z.string().trim().max(500),
  toneOfVoice: z.string().trim().max(1000),
  competitors: z.string().trim().max(1000),
  contentThemes: z.string().trim().max(2000),
  platforms: z.array(campaignPlatform),
  platformFrequency: z.string().trim().max(1000),
  importantDates: z.string().trim().max(1000),
  dos: z.string().trim().max(1000),
  donts: z.string().trim().max(1000),
});
export type IntakeAnswers = z.infer<typeof intakeAnswersSchema>;

export const getIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: intake, error } = await supabaseAdmin
      .from("client_intake")
      .select("*")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return intake;
  });

export const saveIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        answers: intakeAnswersSchema,
        status: z.enum(["draft", "completed"]).default("draft"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row: TablesInsert<"client_intake"> = {
      client_id: data.clientId,
      answers: data.answers as unknown as Json,
      status: data.status,
    };
    const { data: saved, error } = await supabaseAdmin
      .from("client_intake")
      .upsert(row, { onConflict: "client_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

// ── Strategie ──────────────────────────────────────────────────────────────

const cadenceSchema = z
  .object({
    instagram: z.number().int().min(0).max(14).optional(),
    tiktok: z.number().int().min(0).max(14).optional(),
    linkedin: z.number().int().min(0).max(14).optional(),
    youtube: z.number().int().min(0).max(14).optional(),
    facebook: z.number().int().min(0).max(14).optional(),
  })
  .default({});
export type Cadence = Partial<Record<CampaignPlatform, number>>;

export const getStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: strategy, error } = await supabaseAdmin
      .from("client_strategy")
      .select("*")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return strategy;
  });

export const saveStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        positioning: z.string().trim().max(2000).nullable().default(null),
        audience: z.string().trim().max(2000).nullable().default(null),
        tone: z.string().trim().max(1000).nullable().default(null),
        pillars: z.array(z.string().trim().min(1)).max(12).default([]),
        cadence: cadenceSchema,
        goals: z.string().trim().max(2000).nullable().default(null),
        dos: z.array(z.string().trim().min(1)).max(20).default([]),
        donts: z.array(z.string().trim().min(1)).max(20).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // source staat hier altijd vast op "manual" — een handmatige opslag mag
    // nooit een AI-gegenereerde strategie voordoen als AI-resultaat.
    const row: TablesInsert<"client_strategy"> = {
      client_id: data.clientId,
      positioning: data.positioning,
      audience: data.audience,
      tone: data.tone,
      pillars: data.pillars as unknown as Json,
      cadence: data.cadence as unknown as Json,
      goals: data.goals,
      dos: data.dos as unknown as Json,
      donts: data.donts as unknown as Json,
      source: "manual",
    };
    const { data: saved, error } = await supabaseAdmin
      .from("client_strategy")
      .upsert(row, { onConflict: "client_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

// ── Strategie genereren met AI ───────────────────────────────────────────────

interface GeneratedStrategy {
  positioning: string;
  audience: string;
  tone: string;
  pillars: string[];
  cadence: Cadence;
  goals: string;
  dos: string[];
  donts: string[];
}

const strategyJsonSchema = {
  type: "object",
  properties: {
    positioning: { type: "string" },
    audience: { type: "string" },
    tone: { type: "string" },
    pillars: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
    cadence: {
      type: "object",
      properties: {
        instagram: { type: "integer", minimum: 0, maximum: 14 },
        tiktok: { type: "integer", minimum: 0, maximum: 14 },
        linkedin: { type: "integer", minimum: 0, maximum: 14 },
        youtube: { type: "integer", minimum: 0, maximum: 14 },
        facebook: { type: "integer", minimum: 0, maximum: 14 },
      },
      required: ["instagram", "tiktok", "linkedin", "youtube", "facebook"],
      additionalProperties: false,
    },
    goals: { type: "string" },
    dos: { type: "array", items: { type: "string" } },
    donts: { type: "array", items: { type: "string" } },
  },
  required: ["positioning", "audience", "tone", "pillars", "cadence", "goals", "dos", "donts"],
  additionalProperties: false,
};

function summarizeIntake(answers: IntakeAnswers): string {
  const goals =
    [
      answers.goalReach && "bereik/naamsbekendheid",
      answers.goalLeads && "leads",
      answers.goalSales && "verkoop",
    ]
      .filter(Boolean)
      .join(", ") || "niet expliciet opgegeven";

  return `Positionering (klantinput): ${answers.positioning || "—"}
Doelgroep (klantinput): ${answers.audience || "—"}
Doelen: ${goals}${answers.goalOther ? ` — overig: ${answers.goalOther}` : ""}
Tone-of-voice (klantinput): ${answers.toneOfVoice || "—"}
Concurrenten: ${answers.competitors || "—"}
Content-voorkeuren/thema's: ${answers.contentThemes || "—"}
Gewenste platforms: ${answers.platforms?.length ? answers.platforms.join(", ") : "—"}
Gewenste frequentie: ${answers.platformFrequency || "—"}
Belangrijke data/seizoenen: ${answers.importantDates || "—"}
Wat wél past: ${answers.dos || "—"}
Wat niet past: ${answers.donts || "—"}`;
}

export const generateStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: intake, error: intakeError } = await supabaseAdmin
      .from("client_intake")
      .select("answers")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (intakeError) throw new Error(intakeError.message);
    if (!intake || !intake.answers || Object.keys(intake.answers as object).length === 0) {
      throw new Error("Vul eerst de intake-vragenlijst in voordat je een strategie genereert.");
    }

    const answers = intake.answers as unknown as IntakeAnswers;
    const clientContext = await fetchClientContext(data.clientId);

    const system = `Je bent een senior social-media strateeg bij een creatief agency. Werk in het Nederlands.${clientContext}

Opdracht: stel op basis van de intake hieronder een concrete, uitvoerbare contentstrategie op voor deze klant.
- "positioning": een scherpe positionering in 2-4 zinnen.
- "audience": een concrete beschrijving van de doelgroep.
- "tone": de tone-of-voice in enkele kernwoorden plus een korte toelichting.
- "pillars": 3-6 content-pijlers (thema's) waar alle content uit voortkomt.
- "cadence": het aantal posts per week per platform. Gebruik uitsluitend de door de klant gewenste platforms (zet de overige op 0).
- "goals": de belangrijkste, meetbare doelen voor de komende periode.
- "dos": 3-8 concrete richtlijnen wat wél te doen.
- "donts": 3-8 concrete richtlijnen wat niet te doen.

Baseer je strategie strikt op de intake — verzin geen feiten die niet passen bij het merk.`;

    const strategy = await generateJson<GeneratedStrategy>({
      system,
      user: `Intake-antwoorden:\n${summarizeIntake(answers)}`,
      effort: "medium",
      maxTokens: 4096,
      schema: strategyJsonSchema,
    });

    const row: TablesInsert<"client_strategy"> = {
      client_id: data.clientId,
      positioning: strategy.positioning || null,
      audience: strategy.audience || null,
      tone: strategy.tone || null,
      pillars: (strategy.pillars ?? []) as unknown as Json,
      cadence: (strategy.cadence ?? {}) as unknown as Json,
      goals: strategy.goals || null,
      dos: (strategy.dos ?? []) as unknown as Json,
      donts: (strategy.donts ?? []) as unknown as Json,
      source: "ai",
    };

    const { data: saved, error } = await supabaseAdmin
      .from("client_strategy")
      .upsert(row, { onConflict: "client_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    return saved;
  });

// ── Weekplanning genereren vanuit de strategie ───────────────────────────────

export interface WeekPlanItem {
  dayOffset: number;
  date: string;
  platform: CampaignPlatform;
  title: string;
  caption: string;
  hashtags: string[];
}

export interface WeekPlanDay {
  date: string;
  dayOffset: number;
  items: WeekPlanItem[];
}

export const generateWeekPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        weekStartISO: z
          .string()
          .refine((v) => !Number.isNaN(new Date(v).getTime()), "Ongeldige startdatum"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: strategyRow, error: stratError } = await supabaseAdmin
      .from("client_strategy")
      .select("*")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (stratError) throw new Error(stratError.message);
    if (!strategyRow) {
      throw new Error(
        "Er is nog geen strategie voor deze klant — genereer of stel eerst een strategie in.",
      );
    }

    const cadence = (strategyRow.cadence ?? {}) as Cadence;
    const platforms = PLATFORM_LIST.filter((p) => (cadence[p] ?? 0) > 0);
    if (!platforms.length) {
      throw new Error(
        "De strategie heeft nog geen cadans (posts per week per platform) ingesteld.",
      );
    }
    const pillars = Array.isArray(strategyRow.pillars) ? (strategyRow.pillars as string[]) : [];
    const totalPosts = platforms.reduce((sum, p) => sum + (cadence[p] ?? 0), 0);

    const clientContext = await fetchClientContext(data.clientId);
    const cadenceLines = platforms.map((p) => `- ${p}: ${cadence[p]}x per week`).join("\n");

    const system = `Je bent een senior social-media strateeg. Werk in het Nederlands.${clientContext}

Opdracht: stel een concrete weekplanning op voor de week die begint op ${data.weekStartISO} ("dayOffset" 0 = deze dag, t/m 6 = de laatste dag van de week). Volg exact de cadans hieronder — genereer in totaal ${totalPosts} posts:
${cadenceLines}

Spreid de posts logisch over de week (vermijd dat hetzelfde platform meerdere keren op dezelfde dag valt, tenzij de cadans dat vereist) en laat ze aansluiten bij de content-pijlers: ${
      pillars.length
        ? pillars.join(", ")
        : "(nog geen pijlers vastgelegd — gebruik gezond verstand)"
    }.

Per post:
- "dayOffset": geheel getal van 0 t/m 6.
- "platform": één van ${platforms.join(", ")}.
- "title": korte interne werktitel/idee (max 8 woorden).
- "caption": een kant-en-klare, publiceerbare caption in de juiste toon voor dat platform.
- "hashtags": 2-6 relevante hashtags zonder het #-teken.`;

    const result = await generateJson<{ items: PlanItem[] }>({
      system,
      user: "Genereer de weekplanning volgens de cadans en content-pijlers hierboven.",
      effort: "medium",
      maxTokens: 8192,
      schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                dayOffset: { type: "integer", minimum: 0, maximum: 6 },
                platform: { type: "string", enum: [...platforms] },
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

    const weekStart = new Date(data.weekStartISO);
    weekStart.setHours(0, 0, 0, 0);

    const normalized = (result.items ?? []).map((it) => {
      const dayOffset = Math.min(Math.max(0, it.dayOffset | 0), 6);
      const platform = platforms.includes(it.platform) ? it.platform : platforms[0];
      const hashtags = (it.hashtags ?? []).map((h) => h.replace(/^#/, "").trim()).filter(Boolean);
      const date = new Date(weekStart);
      date.setDate(date.getDate() + dayOffset);
      const scheduledAt = new Date(date);
      scheduledAt.setHours(defaultHourFor(platform), 0, 0, 0);
      return {
        dayOffset,
        date: date.toISOString().slice(0, 10),
        platform,
        title: it.title,
        caption: it.caption,
        hashtags,
        scheduledAt,
      };
    });

    if (normalized.length) {
      const rows: TablesInsert<"scheduled_posts">[] = normalized.map((it) => ({
        client_id: data.clientId,
        platform: it.platform,
        caption: it.caption,
        scheduled_at: it.scheduledAt.toISOString(),
        status: "draft",
      }));
      const { error: insertError } = await supabaseAdmin.from("scheduled_posts").insert(rows);
      if (insertError) throw new Error(insertError.message);
    }

    const byDay = new Map<string, WeekPlanDay>();
    for (const it of normalized) {
      const day = byDay.get(it.date) ?? { date: it.date, dayOffset: it.dayOffset, items: [] };
      day.items.push({
        dayOffset: it.dayOffset,
        date: it.date,
        platform: it.platform,
        title: it.title,
        caption: it.caption,
        hashtags: it.hashtags,
      });
      byDay.set(it.date, day);
    }
    const days = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));

    return { days, inserted: normalized.length };
  });
