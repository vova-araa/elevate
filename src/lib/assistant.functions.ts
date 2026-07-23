import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, TablesInsert } from "@/integrations/supabase/types";
import { runToolLoop, type JsonValue, type ToolArgs } from "@/lib/ai-provider.server";
import { defaultHourFor, type CampaignPlatform } from "@/lib/campaigns.functions";

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

      return { ok: false, error: "Onbekende tool" };
    }

    const system = `Je bent de AI-assistent van Elevate Design, een social-media-agency. Admins gebruiken je om via natuurlijke taal dingen te regelen: posts inplannen (als concept), taken aanmaken en vragen stellen over klanten. Werk in het Nederlands, wees beknopt en concreet.

Vandaag is ${new Date().toISOString().split("T")[0]}.

Beschikbare klanten:
${clientList || "(nog geen klanten)"}

Regels:
- Zoek altijd eerst de juiste clientId op (via list_clients of de lijst hierboven) voordat je create_draft_posts, create_task of get_client_stats aanroept.
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
