import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { generateJson } from "@/lib/ai-provider.server";

/**
 * Documenten bij de klant-intake laten uitlezen door de AI.
 *
 * Een merkboek, jaarplan of huisstijlgids bevat vaak precies de antwoorden die
 * we in de intake vragen. In plaats van dat overtypen leest de AI het bestand
 * en vult hij de intake-velden voor — met per veld de bron erbij, zodat je kunt
 * controleren waar het vandaan komt. Daarnaast stelt hij vervolgvragen over wat
 * er juist níét in staat maar de strategie wél scherper zou maken.
 */

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen intake-documenten analyseren");
  }
}

/** Bestandstypen die we aankunnen: PDF leest Claude zelf, de rest als tekst. */
const SUPPORTED = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
];

const MAX_BYTES = 15 * 1024 * 1024;

export interface IntakeSuggestion {
  /** Veldnaam uit intakeAnswersSchema, bv. "positioning". */
  field: string;
  /** Voorgestelde tekst voor dat veld. */
  value: string;
  /** Waar in het document dit vandaan komt. */
  source: string;
}

export interface IntakeFollowUp {
  question: string;
  /** Waarom dit antwoord de strategie scherper maakt. */
  why: string;
}

export interface IntakeAnalysis {
  summary: string;
  suggestions: IntakeSuggestion[];
  followUps: IntakeFollowUp[];
}

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "suggestions", "followUps"],
  properties: {
    summary: {
      type: "string",
      description: "Wat voor document dit is en wat er bruikbaars in staat. Max 3 zinnen.",
    },
    suggestions: {
      type: "array",
      description: "Alleen velden waarvoor het document daadwerkelijk houvast geeft.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "value", "source"],
        properties: {
          field: {
            type: "string",
            enum: [
              "positioning",
              "audience",
              "toneOfVoice",
              "competitors",
              "contentThemes",
              "platformFrequency",
              "importantDates",
              "dos",
              "donts",
              "goalOther",
            ],
          },
          value: { type: "string" },
          source: {
            type: "string",
            description: "Korte verwijzing, bv. 'hoofdstuk 2, merkbelofte'",
          },
        },
      },
    },
    followUps: {
      type: "array",
      description:
        "Vragen over informatie die ontbreekt maar de strategie duidelijk zou aanscherpen. Max 6.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "why"],
        properties: {
          question: { type: "string" },
          why: { type: "string" },
        },
      },
    },
  },
} as const;

export const analyzeIntakeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        /** Pad in de client-uploads bucket, altijd binnen de map van de klant. */
        filePath: z.string().min(1).max(500),
        fileName: z.string().max(255).optional(),
        /** Al ingevulde antwoorden, zodat de AI niet overschrijft wat er staat. */
        existingAnswers: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<IntakeAnalysis> => {
    await assertAdmin(context);

    // Tenant-isolatie: alleen bestanden binnen de map van deze klant.
    if (!data.filePath.startsWith(`${data.clientId}/`)) {
      throw new Error("Dit bestand hoort niet bij deze klant");
    }

    const { data: blob, error } = await supabaseAdmin.storage
      .from("client-uploads")
      .download(data.filePath);
    if (error || !blob) throw new Error("Bestand kon niet worden geladen");

    const mediaType = blob.type || "application/octet-stream";
    if (!SUPPORTED.some((t) => mediaType.startsWith(t))) {
      throw new Error(
        "Dit bestandstype kan (nog) niet gelezen worden. Gebruik PDF, tekst, Markdown of CSV.",
      );
    }
    const buffer = Buffer.from(await blob.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      throw new Error("Bestand is te groot om te analyseren (max 15 MB).");
    }

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("name, industry")
      .eq("id", data.clientId)
      .maybeSingle();

    const filled = Object.entries(data.existingAnswers ?? {})
      .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
      .map(([k]) => k);

    const analysis = await generateJson<IntakeAnalysis>({
      system:
        "Je bent strateeg bij een Nederlands social-media-bureau. Je leest documenten van klanten " +
        "(merkboeken, jaarplannen, huisstijlgidsen) en haalt daar de informatie uit die nodig is " +
        "voor een contentstrategie. Antwoord uitsluitend in het Nederlands. Verzin niets: neem " +
        "alleen op wat er daadwerkelijk in het document staat, en vermeld per veld waar het vandaan " +
        "komt. Laat een veld weg als het document er niets over zegt.",
      user:
        `Klant: ${client?.name ?? "onbekend"}${client?.industry ? ` (${client.industry})` : ""}.\n` +
        (filled.length
          ? `Deze intake-velden zijn al ingevuld, doe daar geen voorstel voor: ${filled.join(", ")}.\n`
          : "") +
        "Lees de bijlage en (1) vul de intake-velden waar het document uitsluitsel geeft, en " +
        "(2) stel vervolgvragen over wat ontbreekt maar de strategie echt scherper zou maken. " +
        "Stel liever drie rake vragen dan zes algemene.",
      schema: ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
      documents: [
        {
          mediaType: mediaType.split(";")[0],
          base64: buffer.toString("base64"),
          name: data.fileName,
        },
      ],
      maxTokens: 4096,
      effort: "medium",
    });

    return analysis;
  });
