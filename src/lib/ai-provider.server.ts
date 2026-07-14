import Anthropic from "@anthropic-ai/sdk";

// Server-only Claude provider (vervangt de Lovable AI Gateway).
// Vereist ANTHROPIC_API_KEY in de omgeving; model overschrijfbaar via CLAUDE_MODEL.
//
// Env wordt per aanroep gelezen (niet op module-scope) zodat dit ook werkt op
// runtimes waar env pas per request bindt (zie config.server.ts).

export type Effort = "low" | "medium" | "high";

const DEFAULT_MODEL = "claude-opus-4-8";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY ontbreekt — voeg deze toe aan je omgeving (.env)");
  }
  return new Anthropic({ apiKey });
}

function getModel(): string {
  return process.env.CLAUDE_MODEL || DEFAULT_MODEL;
}

function toFriendlyError(error: unknown): Error {
  if (error instanceof Anthropic.RateLimitError) {
    return new Error("Te veel AI-verzoeken, probeer het zo opnieuw.");
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new Error("AI-authenticatie mislukt — controleer ANTHROPIC_API_KEY.");
  }
  if (error instanceof Anthropic.APIError) {
    return new Error(`AI fout (${error.status ?? "?"}): ${error.message.slice(0, 200)}`);
  }
  return error instanceof Error ? error : new Error("Onbekende AI-fout");
}

export interface GenerateTextOptions {
  system: string;
  user: string;
  maxTokens?: number;
  effort?: Effort;
}

/** Eén tekst-generatie (captions, hooks, vrije copy). */
export async function generateText(opts: GenerateTextOptions): Promise<string> {
  const client = getClient();
  try {
    const response = await client.messages.create({
      model: getModel(),
      max_tokens: opts.maxTokens ?? 2048,
      thinking: { type: "adaptive" },
      output_config: { effort: opts.effort ?? "low" },
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
    if (response.stop_reason === "refusal") {
      throw new Error("De AI heeft dit verzoek geweigerd. Pas de briefing aan en probeer opnieuw.");
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return text.trim();
  } catch (e) {
    throw toFriendlyError(e);
  }
}

export interface GenerateJsonOptions {
  system: string;
  user: string;
  /** JSON Schema; objecten moeten additionalProperties:false + required hebben. */
  schema: Record<string, unknown>;
  maxTokens?: number;
  effort?: Effort;
}

/** Gestructureerde JSON-generatie via output_config.format (gegarandeerd schema-valide). */
export async function generateJson<T>(opts: GenerateJsonOptions): Promise<T> {
  const client = getClient();
  try {
    const response = await client.messages.create({
      model: getModel(),
      max_tokens: opts.maxTokens ?? 4096,
      thinking: { type: "adaptive" },
      output_config: {
        effort: opts.effort ?? "low",
        format: { type: "json_schema", schema: opts.schema },
      },
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
    if (response.stop_reason === "refusal") {
      throw new Error("De AI heeft dit verzoek geweigerd. Pas de briefing aan en probeer opnieuw.");
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return JSON.parse(text) as T;
  } catch (e) {
    throw toFriendlyError(e);
  }
}

export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ToolLoopOptions {
  system: string;
  messages: ChatTurn[];
  tools: Anthropic.Tool[];
  executeTool: (name: string, args: any) => Promise<any>;
  maxIterations?: number;
  maxTokens?: number;
  effort?: Effort;
}

export interface ToolLoopResult {
  reply: string;
  actions: { tool: string; args: any; result: any }[];
}

/**
 * Agentische tool-loop voor de AI-assistent: Claude mag tools aanroepen,
 * wij voeren ze uit en geven de resultaten terug tot er een eindantwoord is.
 */
export async function runToolLoop(opts: ToolLoopOptions): Promise<ToolLoopResult> {
  const client = getClient();
  const model = getModel();
  const maxIterations = opts.maxIterations ?? 5;

  // System-rol turns uit de UI worden als context in een user-turn gevouwen;
  // consecutieve same-role messages combineert de API zelf.
  const messages: Anthropic.MessageParam[] = opts.messages.map((m) =>
    m.role === "system"
      ? { role: "user" as const, content: `<context>${m.content}</context>` }
      : { role: m.role, content: m.content },
  );

  const actions: ToolLoopResult["actions"] = [];

  try {
    for (let i = 0; i < maxIterations; i++) {
      const response = await client.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 4096,
        thinking: { type: "adaptive" },
        output_config: { effort: opts.effort ?? "medium" },
        system: opts.system,
        tools: opts.tools,
        messages,
      });

      if (response.stop_reason === "refusal") {
        return { reply: "De AI heeft dit verzoek geweigerd.", actions };
      }

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        const reply = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();
        return { reply, actions };
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        const args = (toolUse.input ?? {}) as any;
        let result: any;
        try {
          result = await opts.executeTool(toolUse.name, args);
        } catch (e) {
          result = { ok: false, error: e instanceof Error ? e.message : "Tool mislukt" };
        }
        actions.push({ tool: toolUse.name, args, result });
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: "user", content: toolResults });
    }
    return { reply: "Klaar.", actions };
  } catch (e) {
    throw toFriendlyError(e);
  }
}
