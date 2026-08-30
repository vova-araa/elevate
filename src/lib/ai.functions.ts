import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Enums } from "@/integrations/supabase/types";
import { generateText, runToolLoop, type JsonValue, type ToolArgs } from "@/lib/ai-provider.server";
import { copywriterSystem, subjectOrFallback } from "@/lib/copywriting";

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen deze actie uitvoeren");
  }
}

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const inputSchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
  clientId: z.string().uuid().optional().nullable(),
});

const tools: Anthropic.Tool[] = [
  {
    name: "create_task",
    description:
      "Maak een nieuwe taak aan voor een klant. Gebruik dit als de gebruiker een taak, to-do of actiepunt wil aanmaken.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string", description: "UUID van de klant" },
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        due_date: { type: "string", description: "ISO datum YYYY-MM-DD" },
        status: { type: "string", enum: ["todo", "in_progress", "done"] },
      },
      required: ["client_id", "title"],
    },
  },
  {
    name: "create_calendar_item",
    description:
      "Plan een deliverable in de contentkalender. Gebruik dit als de gebruiker iets wil inplannen op een datum.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        title: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        deliverable_type: { type: "string", enum: ["image", "video", "copy", "document", "other"] },
        description: { type: "string" },
      },
      required: ["client_id", "title", "date"],
    },
  },
  {
    name: "create_strategy_note",
    description: "Voeg een strategie-notitie toe voor een klant.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        title: { type: "string" },
        body: { type: "string" },
        category: { type: "string" },
      },
      required: ["client_id", "title"],
    },
  },
  {
    name: "generate_caption",
    description:
      "Genereer een social-media caption voor één of meer platforms. Gebruik dit als de gebruiker om een caption, post-tekst of social-copy vraagt.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string", description: "UUID van de klant, optioneel" },
        briefing: { type: "string", description: "Onderwerp of briefing" },
        tone: { type: "string", enum: ["professioneel", "informeel", "energiek", "inspirerend"] },
        platforms: {
          type: "array",
          items: {
            type: "string",
            enum: ["instagram", "linkedin", "tiktok", "facebook", "x", "threads"],
          },
        },
      },
      required: ["briefing", "platforms"],
    },
  },
  {
    name: "schedule_post",
    description:
      "Plan een post in. Roep dit aan zodra je tekst hebt en een datum/tijd én tenminste één gekoppeld platform.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string", description: "UUID van de klant" },
        content: { type: "string" },
        integration_ids: { type: "array", items: { type: "string" } },
        date: { type: "string", description: "ISO datum-tijd, bv 2026-06-10T15:30" },
        type: { type: "string", enum: ["schedule", "now", "draft"] },
      },
      required: ["client_id", "content", "date"],
    },
  },
];

interface CreateTaskArgs {
  client_id: string;
  title: string;
  description?: string;
  priority?: Enums<"task_priority">;
  status?: Enums<"task_status">;
  due_date?: string;
}

interface CreateCalendarItemArgs {
  client_id: string;
  title: string;
  date: string;
  deliverable_type?: Enums<"deliverable_type">;
  description?: string;
}

interface CreateStrategyNoteArgs {
  client_id: string;
  title: string;
  body?: string;
  category?: string;
}

interface GenerateCaptionArgs {
  client_id?: string;
  briefing: string;
  tone?: string;
  platforms?: string[];
}

interface SchedulePostArgs {
  client_id?: string;
  content: string;
  integration_ids?: string[];
  date: string;
  type?: "schedule" | "now" | "draft";
}

async function runTool(name: string, rawArgs: ToolArgs): Promise<JsonValue> {
  if (name === "create_task") {
    const args = rawArgs as unknown as CreateTaskArgs;
    const { error, data } = await supabaseAdmin
      .from("tasks")
      .insert({
        client_id: args.client_id,
        title: args.title,
        description: args.description ?? null,
        priority: args.priority ?? "medium",
        status: args.status ?? "todo",
        due_date: args.due_date ?? null,
      })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id };
  }
  if (name === "create_calendar_item") {
    const args = rawArgs as unknown as CreateCalendarItemArgs;
    const { error, data } = await supabaseAdmin
      .from("calendar_items")
      .insert({
        client_id: args.client_id,
        title: args.title,
        date: args.date,
        deliverable_type: args.deliverable_type ?? "other",
        description: args.description ?? null,
      })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id };
  }
  if (name === "create_strategy_note") {
    const args = rawArgs as unknown as CreateStrategyNoteArgs;
    const { error, data } = await supabaseAdmin
      .from("strategy_notes")
      .insert({
        client_id: args.client_id,
        title: args.title,
        body: args.body ?? null,
        category: args.category ?? "general",
      })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id };
  }
  if (name === "generate_caption") {
    const args = rawArgs as unknown as GenerateCaptionArgs;
    try {
      const results: { platform: string; text: string }[] = [];
      for (const platform of args.platforms ?? []) {
        const system = copywriterSystem({
          platform,
          tone: args.tone ?? "professioneel",
          task: "Schrijf één caption die direct geplaatst kan worden.",
        });
        const text = await generateText({
          system,
          user: subjectOrFallback({ briefing: args.briefing }),
          effort: "low",
        });
        results.push({ platform, text });
        await supabaseAdmin.from("ai_generations").insert({
          client_id: args.client_id ?? null,
          briefing: args.briefing,
          tone: args.tone ?? "professioneel",
          platform,
          generated_text: text,
        });
      }
      return { ok: true, captions: results };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Caption mislukt" };
    }
  }
  if (name === "schedule_post") {
    const args = rawArgs as unknown as SchedulePostArgs;
    try {
      if (!args.client_id) return { ok: false, error: "client_id ontbreekt" };
      const first = (args.integration_ids?.[0] ?? "instagram") as string;
      const platform = (
        ["facebook", "instagram", "linkedin", "tiktok", "youtube"].includes(first)
          ? first
          : "instagram"
      ) as Enums<"social_platform">;
      const { error, data } = await supabaseAdmin
        .from("scheduled_posts")
        .insert({
          client_id: args.client_id,
          caption: args.content,
          scheduled_at: args.date,
          status: args.type === "draft" ? "draft" : "scheduled",
          platform,
          notes: args.integration_ids ? `integrations:${args.integration_ids.join(",")}` : null,
        })
        .select()
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: data.id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Inplannen mislukt" };
    }
  }
  return { ok: false, error: "Onbekende tool" };
}

export const aiAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    // Context: alle klanten
    const { data: clients } = await supabaseAdmin
      .from("clients")
      .select("id, name, industry")
      .order("name");

    const clientList = (clients ?? [])
      .map((c) => `- ${c.name}${c.industry ? ` (${c.industry})` : ""} → id: ${c.id}`)
      .join("\n");

    const focusedClient = data.clientId
      ? (clients ?? []).find((c) => c.id === data.clientId)
      : null;

    const system = `Je bent "AI Bot", de AI-assistent van Elevate. Je helpt admins door taken, kalenderitems en strategie-notities aan te maken via de beschikbare tools. Wees beknopt, in het Nederlands.

Vandaag is ${new Date().toISOString().split("T")[0]}.

Beschikbare klanten:
${clientList || "(nog geen klanten)"}

${focusedClient ? `Huidige context: klant "${focusedClient.name}" (id: ${focusedClient.id}). Gebruik deze id standaard tenzij de gebruiker een andere noemt.` : "Vraag om de klantnaam als die niet duidelijk is."}

Wanneer je een tool aanroept, bevestig daarna kort wat je hebt gedaan.`;

    return runToolLoop({
      system,
      messages: data.messages,
      tools,
      executeTool: runTool,
      maxIterations: 5,
    });
  });
