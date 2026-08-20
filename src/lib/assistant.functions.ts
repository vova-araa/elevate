import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reconnectDeadline } from "@/lib/token-lifetime";
import type { Database, TablesInsert } from "@/integrations/supabase/types";
import { runToolLoop, type JsonValue, type ToolArgs } from "@/lib/ai-provider.server";
import { defaultHourFor, type CampaignPlatform } from "@/lib/campaigns.functions";
import type { Cadence, IntakeAnswers } from "@/lib/strategy.functions";

// ── Auth (zelfde patroon als campaigns.functions.ts / ai.functions.ts) ──────

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen de AI-assistent gebruiken");
  }
}

// ── Input ─────────────────────────────────────────────────────────────────

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const inputSchema = z.object({
  messages: z.array(messageSchema).min(1).max(50),
});

// ── Tools ─────────────────────────────────────────────────────────────────

const PLATFORM_ENUM = ["instagram", "tiktok", "linkedin", "youtube", "facebook"] as const;

const tools: Anthropic.Tool[] = [
  {
    name: "list_clients",
    description:
      "Geef een lijst van alle klanten met id, naam en industrie. Gebruik dit om de juiste clientId op te zoeken voordat je een andere tool aanroept.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "create_draft_posts",
    description:
      "Maak één of meer conceptposts (status 'draft') aan voor een klant in de planner. Gebruik dit als de gebruiker posts wil inplannen — ze komen als concept in de planner te staan, niet direct live.",
    input_schema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "UUID van de klant (via list_clients opzoeken)" },
        posts: {
          type: "array",
          description: "De conceptposts die aangemaakt moeten worden",
          items: {
            type: "object",
            properties: {
              date: { type: "string", description: "Datum in YYYY-MM-DD formaat" },
              platform: { type: "string", enum: [...PLATFORM_ENUM] },
              caption: { type: "string" },
            },
            required: ["date", "platform", "caption"],
          },
        },
      },
      required: ["clientId", "posts"],
    },
  },
  {
    name: "create_task",
    description: "Maak een nieuwe taak aan voor een klant.",
    input_schema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "UUID van de klant" },
        title: { type: "string" },
        description: { type: "string", description: "Optionele omschrijving" },
      },
      required: ["clientId", "title"],
    },
  },
  {
    name: "get_client_stats",
    description:
      "Haal statistieken op voor een klant: aantal posts per status (draft/scheduled/publishing/published/failed) en de eerstvolgende geplande posts.",
    input_schema: {
      type: "object",
      properties: { clientId: { type: "string", description: "UUID van de klant" } },
      required: ["clientId"],
    },
  },
  {
    name: "get_client_overview",
    description:
      "Haal het volledige, feitelijke overzicht van een klant op: strategie, stappenplan (roadmap), intake, gekoppelde kanalen, geplande/te-late/concept-posts, een afgeleide 'wat ontbreekt'-lijst en een indicatie of er genoeg gepland staat voor de komende 7/14 dagen. Gebruik dit om vragen te beantwoorden als 'hoe staat klant X ervoor?', 'wat ontbreekt er nog?' of 'wanneer moet er gepubliceerd worden?'.",
    input_schema: {
      type: "object",
      properties: { clientId: { type: "string", description: "UUID van de klant" } },
      required: ["clientId"],
    },
  },
];

interface CreateDraftPostsArgs {
  clientId: string;
  posts: { date: string; platform: CampaignPlatform; caption: string }[];
}

interface CreateTaskArgs {
  clientId: string;
  title: string;
  description?: string;
}

interface GetClientStatsArgs {
  clientId: string;
}

interface GetClientOverviewArgs {
  clientId: string;
}

const ALL_PLATFORMS = [...PLATFORM_ENUM] as CampaignPlatform[];
const DAY_MS = 24 * 60 * 60 * 1000;

// ── Klant-overzicht (feitelijke stand van zaken) ───────────────────────────

function jsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

async function buildClientOverview(clientId: string, clientName: string): Promise<JsonValue> {
  const now = new Date();
  const nowISO = now.toISOString();

  const [strategyRes, roadmapsRes, intakeRes, connectionsRes, postsRes] = await Promise.all([
    supabaseAdmin.from("client_strategy").select("*").eq("client_id", clientId).maybeSingle(),
    supabaseAdmin.from("roadmaps").select("id, title, status").eq("client_id", clientId),
    supabaseAdmin
      .from("client_intake")
      .select("answers, status, updated_at")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabaseAdmin
      .from("social_connections")
      .select(
        "platform, status, follower_count, token_expires_at, refresh_expires_at, never_expires, refresh_token, account_username",
      )
      .eq("client_id", clientId),
    supabaseAdmin
      .from("scheduled_posts")
      .select("status, scheduled_at, platform, caption, published_at")
      .eq("client_id", clientId)
      .is("deleted_at", null),
  ]);

  const firstError =
    strategyRes.error ||
    roadmapsRes.error ||
    intakeRes.error ||
    connectionsRes.error ||
    postsRes.error;
  if (firstError) return { ok: false, error: firstError.message };

  const missing: string[] = [];

  // ── Strategie ──
  const strategyRow = strategyRes.data;
  const pillars = jsonStringArray(strategyRow?.pillars);
  const cadence = (strategyRow?.cadence ?? {}) as Cadence;
  const hasStrategy = Boolean(
    strategyRow &&
    (strategyRow.positioning || strategyRow.audience || strategyRow.goals || pillars.length),
  );
  const cadencePerWeek = ALL_PLATFORMS.reduce((sum, p) => sum + (cadence[p] ?? 0), 0);
  const strategy = hasStrategy
    ? {
        positioning: strategyRow?.positioning ?? null,
        audience: strategyRow?.audience ?? null,
        tone: strategyRow?.tone ?? null,
        goals: strategyRow?.goals ?? null,
        pillars,
        cadencePerWeek,
        bron: strategyRow?.source ?? "onbekend",
      }
    : null;
  if (!hasStrategy) missing.push("Geen strategie vastgelegd");

  // ── Stappenplan (roadmap) ──
  const roadmapIds = (roadmapsRes.data ?? []).map((r) => r.id);
  let stepsTotal = 0;
  let stepsDone = 0;
  const openSteps: { title: string; status: string }[] = [];
  if (roadmapIds.length) {
    const { data: steps, error: stepsError } = await supabaseAdmin
      .from("roadmap_steps")
      .select("title, status, step_order")
      .in("roadmap_id", roadmapIds)
      .order("step_order");
    if (stepsError) return { ok: false, error: stepsError.message };
    for (const s of steps ?? []) {
      stepsTotal += 1;
      if (s.status === "completed") stepsDone += 1;
      else openSteps.push({ title: s.title, status: s.status });
    }
  }
  const stepsOpen = stepsTotal - stepsDone;
  const roadmap =
    stepsTotal > 0
      ? {
          totaal: stepsTotal,
          voltooid: stepsDone,
          open: stepsOpen,
          openStappen: openSteps.slice(0, 8),
        }
      : null;
  if (stepsTotal === 0) missing.push("Geen stappenplan (roadmap) aangemaakt");
  else if (stepsOpen > 0) missing.push(`${stepsOpen} openstaande stappenplan-stap(pen)`);

  // ── Intake ──
  const intakeRow = intakeRes.data;
  const answers = (intakeRow?.answers ?? null) as IntakeAnswers | null;
  const intakeFilled = intakeRow?.status === "completed";
  const intakeGoals =
    answers &&
    [answers.goalReach && "bereik", answers.goalLeads && "leads", answers.goalSales && "verkoop"]
      .filter(Boolean)
      .join(", ");
  const intake = intakeRow
    ? {
        ingevuld: intakeFilled,
        status: intakeRow.status,
        kernpunten: answers
          ? {
              positionering: answers.positioning || null,
              doelgroep: answers.audience || null,
              doelen: intakeGoals || null,
              toneOfVoice: answers.toneOfVoice || null,
              contentThemas: answers.contentThemes || null,
              gewenstePlatforms: Array.isArray(answers.platforms) ? answers.platforms : [],
              gewensteFrequentie: answers.platformFrequency || null,
            }
          : null,
      }
    : { ingevuld: false, status: "ontbreekt", kernpunten: null };
  if (!intakeFilled) missing.push("Intake niet (volledig) ingevuld");

  // ── Kanalen ──
  const connections = connectionsRes.data ?? [];
  const connectedPlatforms = Array.from(
    new Set(connections.filter((c) => c.status === "active").map((c) => c.platform)),
  );
  const notConnected = ALL_PLATFORMS.filter(
    (p) => !connectedPlatforms.includes(p as (typeof connectedPlatforms)[number]),
  );
  // Alleen koppelingen waar echt een mens aan te pas moet komen. Een
  // TikTok-token verloopt elke 24 uur en wordt automatisch vernieuwd; dat als
  // "bijna verlopen" aan de assistent doorgeven levert alleen vals alarm op.
  const expiringSoon = connections
    .filter((c) => c.status === "active")
    .map((c) => ({
      platform: c.platform,
      verlooptOp: reconnectDeadline({
        neverExpires: c.never_expires,
        hasRefreshToken: !!c.refresh_token,
        tokenExpiresAt: c.token_expires_at,
        refreshExpiresAt: c.refresh_expires_at,
      }),
    }))
    .filter(
      (c) =>
        c.verlooptOp !== null && new Date(c.verlooptOp).getTime() - now.getTime() < 14 * DAY_MS,
    );
  const channels = {
    gekoppeld: connectedPlatforms,
    nietGekoppeld: notConnected,
    bijnaVerlopen: expiringSoon,
    volgers: connections
      .filter((c) => c.status === "active" && typeof c.follower_count === "number")
      .map((c) => ({ platform: c.platform, volgers: c.follower_count })),
  };
  if (connectedPlatforms.length === 0) missing.push("Geen enkel kanaal gekoppeld");
  if (expiringSoon.length) missing.push(`${expiringSoon.length} koppeling(en) verlopen binnenkort`);

  // ── Posts ──
  const posts = postsRes.data ?? [];
  const counts: Record<string, number> = {};
  for (const p of posts) counts[p.status] = (counts[p.status] ?? 0) + 1;

  const scheduledFuture = posts.filter((p) => p.status === "scheduled" && p.scheduled_at >= nowISO);
  const overdue = posts.filter(
    (p) => p.status === "scheduled" && p.scheduled_at < nowISO && !p.published_at,
  );
  const drafts = counts["draft"] ?? 0;

  const in7 = new Date(now.getTime() + 7 * DAY_MS).toISOString();
  const in14 = new Date(now.getTime() + 14 * DAY_MS).toISOString();
  const plannedNext7 = scheduledFuture.filter((p) => p.scheduled_at <= in7).length;
  const plannedNext14 = scheduledFuture.filter((p) => p.scheduled_at <= in14).length;

  const upcoming = scheduledFuture
    .slice()
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, 5)
    .map((p) => ({
      scheduledAt: p.scheduled_at,
      platform: p.platform,
      caption: (p.caption ?? "").slice(0, 80),
    }));

  if (scheduledFuture.length === 0) missing.push("Geen posts ingepland voor de toekomst");
  else if (plannedNext7 === 0) missing.push("Niets gepland de komende 7 dagen");
  if (overdue.length) missing.push(`${overdue.length} post(s) staan te laat (overdue)`);

  // ── Publicatie-timing ──
  // Verwachting: minstens ~1 post per gekoppeld platform per week, of de cadans
  // uit de strategie als die er is.
  const expectedPerWeek = cadencePerWeek > 0 ? cadencePerWeek : connectedPlatforms.length;
  const timing = {
    gepland7: plannedNext7,
    gepland14: plannedNext14,
    verwachtPerWeek: expectedPerWeek,
    voldoende7: expectedPerWeek === 0 ? null : plannedNext7 >= expectedPerWeek,
    advies:
      expectedPerWeek === 0
        ? "Stel eerst een cadans in of koppel kanalen; daarna kan er content ingepland worden."
        : plannedNext7 >= expectedPerWeek
          ? "Er staat genoeg gepland voor de komende week."
          : "Er staat te weinig gepland voor de komende 7 dagen — plan extra content in.",
  };

  return {
    ok: true,
    klant: clientName,
    strategie: strategy ?? "geen strategie vastgelegd",
    stappenplan: roadmap ?? "geen stappenplan aangemaakt",
    intake,
    kanalen: channels,
    posts: {
      counts,
      geplandToekomst: scheduledFuture.length,
      teLaat: overdue.length,
      concepten: drafts,
      eerstvolgende: upcoming,
    },
    publicatieTiming: timing,
    watOntbreekt: missing.length ? missing : ["Alles op orde — geen directe hiaten gevonden."],
  };
}

// ── Server function ──────────────────────────────────────────────────────

export const runAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: clients } = await supabaseAdmin
      .from("clients")
      .select("id, name, industry")
      .order("name");

    const clientList = (clients ?? [])
      .map((c) => `- ${c.name}${c.industry ? ` (${c.industry})` : ""} → id: ${c.id}`)
      .join("\n");
    const clientName = (id: string) => (clients ?? []).find((c) => c.id === id)?.name ?? id;

    // Houd het gesprek bij de laatste ~12 berichten (context beperken).
    const recentMessages = data.messages.slice(-12);

    const summaries: string[] = [];

    async function executeTool(name: string, rawArgs: ToolArgs): Promise<JsonValue> {
      if (name === "list_clients") {
        return {
          ok: true,
          clients: (clients ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            industry: c.industry,
          })),
        };
      }

      if (name === "create_draft_posts") {
        const args = rawArgs as unknown as CreateDraftPostsArgs;
        if (!args.clientId) return { ok: false, error: "clientId ontbreekt" };
        if (!args.posts?.length) return { ok: false, error: "Geen posts opgegeven" };

        const rows: TablesInsert<"scheduled_posts">[] = args.posts.map((p) => {
          const platform = p.platform;
          const scheduledAt = new Date(`${p.date}T00:00:00`);
          scheduledAt.setHours(defaultHourFor(platform) ?? 9, 0, 0, 0);
          return {
            client_id: args.clientId,
            platform,
            caption: p.caption,
            scheduled_at: scheduledAt.toISOString(),
            status: "draft",
          };
        });

        const { error, data: inserted } = await supabaseAdmin
          .from("scheduled_posts")
          .insert(rows)
          .select("id");
        if (error) return { ok: false, error: error.message };

        const count = inserted?.length ?? rows.length;
        summaries.push(
          `${count} concept${count === 1 ? "" : "en"} aangemaakt voor ${clientName(args.clientId)}`,
        );
        return { ok: true, inserted: count };
      }

      if (name === "create_task") {
        const args = rawArgs as unknown as CreateTaskArgs;
        if (!args.clientId) return { ok: false, error: "clientId ontbreekt" };
        if (!args.title) return { ok: false, error: "title ontbreekt" };

        const { error, data: task } = await supabaseAdmin
          .from("tasks")
          .insert({
            client_id: args.clientId,
            title: args.title,
            description: args.description ?? null,
            status: "todo",
            priority: "medium",
          })
          .select("id")
          .single();
        if (error) return { ok: false, error: error.message };

        summaries.push(`Taak "${args.title}" aangemaakt voor ${clientName(args.clientId)}`);
        return { ok: true, id: task.id };
      }

      if (name === "get_client_stats") {
        const args = rawArgs as unknown as GetClientStatsArgs;
        if (!args.clientId) return { ok: false, error: "clientId ontbreekt" };

        const { data: posts, error } = await supabaseAdmin
          .from("scheduled_posts")
          .select("status, scheduled_at, platform, caption")
          .eq("client_id", args.clientId);
        if (error) return { ok: false, error: error.message };

        const counts: Record<string, number> = {};
        for (const p of posts ?? []) {
          counts[p.status] = (counts[p.status] ?? 0) + 1;
        }

        const now = new Date().toISOString();
        const upcoming = (posts ?? [])
          .filter((p) => p.status === "scheduled" && p.scheduled_at >= now)
          .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
          .slice(0, 5)
          .map((p) => ({
            scheduledAt: p.scheduled_at,
            platform: p.platform,
            caption: (p.caption ?? "").slice(0, 80),
          }));

        return { ok: true, counts, upcoming };
      }

      if (name === "get_client_overview") {
        const args = rawArgs as unknown as GetClientOverviewArgs;
        if (!args.clientId) return { ok: false, error: "clientId ontbreekt" };
        return buildClientOverview(args.clientId, clientName(args.clientId));
      }

      return { ok: false, error: "Onbekende tool" };
    }

    const system = `Je bent de AI-assistent van Elevate Design, een social-media-agency. Admins gebruiken je om via natuurlijke taal dingen te regelen: posts inplannen (als concept), taken aanmaken en vragen stellen over klanten. Werk in het Nederlands, wees beknopt en concreet.

Vandaag is ${new Date().toISOString().split("T")[0]}.

Beschikbare klanten:
${clientList || "(nog geen klanten)"}

Regels:
- Zoek altijd eerst de juiste clientId op (via list_clients of de lijst hierboven) voordat je create_draft_posts, create_task, get_client_stats of get_client_overview aanroept.
- Voor vragen over hoe een klant ervoor staat ("hoe staat klant X ervoor?", "wat ontbreekt er nog?", "wanneer moet er gepubliceerd worden?", "wat is de strategie?"), gebruik get_client_overview: dat geeft de volledige, feitelijke stand (strategie, stappenplan, intake, gekoppelde kanalen, geplande/te-late/concept-posts, een 'wat ontbreekt'-lijst en of er genoeg gepland staat voor de komende 7/14 dagen). Adviseer op basis daarvan proactief wat ontbreekt en of er content ingepland moet worden.
- Baseer je antwoorden uitsluitend op de echte data uit de tools — verzin nooit cijfers, kanalen of planningen.
- create_draft_posts maakt CONCEPTEN aan (status draft) — nooit direct live posts. Zeg dat er expliciet bij.
- Vraag om verduidelijking als de klant, datum of het onderwerp niet duidelijk genoeg is in plaats van te gokken.
- Bevestig na een tool-aanroep kort en concreet wat er is gebeurd.`;

    const result = await runToolLoop({
      system,
      messages: recentMessages,
      tools,
      executeTool,
      maxIterations: 6,
      effort: "medium",
    });

    return { reply: result.reply || "Klaar.", actions: summaries };
  });
