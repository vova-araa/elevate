import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateJson } from "@/lib/ai-provider.server";

// ── Auth ─────────────────────────────────────────────────────────────────────

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r: any) => r.role === "admin")) {
    throw new Error("Alleen admins mogen de AI Studio gebruiken");
  }
}

// ── Platform helpers ─────────────────────────────────────────────────────────

const studioPlatform = z.enum(["instagram", "linkedin", "tiktok", "facebook", "x", "threads"]);
export type StudioPlatform = z.infer<typeof studioPlatform>;

const PLATFORM_HINTS: Record<StudioPlatform, string> = {
  instagram:
    "Instagram: max 2200 tekens, gebruik 3-5 relevante hashtags, emoji ok, eerste zin is een hook.",
  linkedin:
    "LinkedIn: max 3000 tekens, professioneel, geen hashtags-spam (max 3), call-to-action voor reacties.",
  tiktok: "TikTok: max 300 tekens, korte energieke zin, 2-3 hashtags, trend-aware.",
  facebook: "Facebook: max 1500 tekens, conversationeel, geen hashtag-overdaad.",
  x: "X/Twitter: max 280 tekens, krachtige hook, 1-2 hashtags max.",
  threads: "Threads: max 500 tekens, conversationeel, geen hashtags nodig.",
};

// ── Tone-of-voice profiel (opgeslagen als strategy_notes rij) ────────────────

const TONE_CATEGORY = "tone_of_voice";
const TONE_TITLE = "Tone of voice";

export interface ToneProfile {
  personality: string;
  dos: string;
  donts: string;
  examples: string;
}

function toneProfileToBody(p: ToneProfile): string {
  return [
    "## Merkpersoonlijkheid",
    p.personality.trim(),
    "",
    "## Do's",
    p.dos.trim(),
    "",
    "## Don'ts",
    p.donts.trim(),
    "",
    "## Voorbeeldzinnen",
    p.examples.trim(),
  ].join("\n");
}

function parseToneBody(body: string): ToneProfile {
  const sections: Record<string, string> = {};
  let current = "";
  for (const line of body.split("\n")) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      current = m[1].trim().toLowerCase();
      sections[current] = "";
    } else if (current) {
      sections[current] += (sections[current] ? "\n" : "") + line;
    }
  }
  const pick = (key: string) => (sections[key] ?? "").trim();
  const personality = pick("merkpersoonlijkheid");
  // Fallback: vrije tekst zonder secties → alles in merkpersoonlijkheid
  if (!personality && !sections["do's"] && !sections["don'ts"] && !sections["voorbeeldzinnen"]) {
    return { personality: body.trim(), dos: "", donts: "", examples: "" };
  }
  return {
    personality,
    dos: pick("do's"),
    donts: pick("don'ts"),
    examples: pick("voorbeeldzinnen"),
  };
}

async function fetchToneNote(clientId: string): Promise<{ id: string; body: string } | null> {
  const { data } = await supabaseAdmin
    .from("strategy_notes")
    .select("id, body")
    .eq("client_id", clientId)
    .eq("category", TONE_CATEGORY)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.body) return data ? { id: data.id, body: "" } : null;
  return { id: data.id, body: data.body };
}

async function fetchClientContext(clientId: string): Promise<string> {
  const parts: string[] = [];
  const { data: c } = await supabaseAdmin
    .from("clients")
    .select("name, industry, notes, description")
    .eq("id", clientId)
    .maybeSingle();
  if (c) {
    parts.push(`Klant: ${c.name}${c.industry ? ` (${c.industry})` : ""}.`);
    if (c.description) parts.push(`Over de klant: ${String(c.description).slice(0, 500)}`);
    if (c.notes) parts.push(`Klantnotities: ${String(c.notes).slice(0, 600)}`);
  }
  const tone = await fetchToneNote(clientId);
  if (tone?.body) {
    parts.push(
      `Tone-of-voice profiel van deze klant — houd je hier strikt aan:\n${tone.body.slice(0, 2000)}`,
    );
  }
  return parts.length ? `\n\n${parts.join("\n")}` : "";
}

export const getToneOfVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const note = await fetchToneNote(data.clientId);
    if (!note) return { noteId: null as string | null, profile: null as ToneProfile | null };
    return { noteId: note.id, profile: parseToneBody(note.body) };
  });

export const saveToneOfVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        personality: z.string().max(4000).default(""),
        dos: z.string().max(4000).default(""),
        donts: z.string().max(4000).default(""),
        examples: z.string().max(4000).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const body = toneProfileToBody(data);
    const existing = await fetchToneNote(data.clientId);
    if (existing) {
      const { error } = await supabaseAdmin
        .from("strategy_notes")
        .update({ body, title: TONE_TITLE, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true, noteId: existing.id };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("strategy_notes")
      .insert({
        client_id: data.clientId,
        category: TONE_CATEGORY,
        title: TONE_TITLE,
        body,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, noteId: inserted.id };
  });

export const suggestToneOfVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        exampleTexts: z.string().max(8000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: c } = await supabaseAdmin
      .from("clients")
      .select("name, industry, description, notes")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!c) throw new Error("Klant niet gevonden");

    const system = `Je bent een senior brand strateeg. Stel een tone-of-voice profiel op in het Nederlands voor het merk "${c.name}"${c.industry ? ` in de branche ${c.industry}` : ""}.
${c.description ? `Over het merk: ${String(c.description).slice(0, 500)}` : ""}
${c.notes ? `Notities: ${String(c.notes).slice(0, 500)}` : ""}

Geef: een korte merkpersoonlijkheid (3-5 zinnen), concrete do's, concrete don'ts en 4-6 voorbeeldzinnen die de gewenste toon laten horen. Wees specifiek en bruikbaar voor social-media copywriters, geen algemene marketing-clichés.`;

    const user = data.exampleTexts?.trim()
      ? `Analyseer deze bestaande teksten van de klant en baseer het profiel op de toon die je hierin herkent:\n\n${data.exampleTexts.slice(0, 6000)}`
      : `Er zijn geen voorbeeldteksten; baseer het profiel op de merkinfo en de branche.`;

    const result = await generateJson<{
      personality: string;
      dos: string[];
      donts: string[];
      exampleSentences: string[];
    }>({
      system,
      user,
      effort: "medium",
      maxTokens: 4096,
      schema: {
        type: "object",
        properties: {
          personality: { type: "string" },
          dos: { type: "array", items: { type: "string" } },
          donts: { type: "array", items: { type: "string" } },
          exampleSentences: { type: "array", items: { type: "string" } },
        },
        required: ["personality", "dos", "donts", "exampleSentences"],
        additionalProperties: false,
      },
    });

    const bullets = (arr: string[]) =>
      (Array.isArray(arr) ? arr : []).map((s) => `- ${s}`).join("\n");
    return {
      personality: result.personality ?? "",
      dos: bullets(result.dos),
      donts: bullets(result.donts),
      examples: bullets(result.exampleSentences),
    };
  });

// ── Captions A/B ─────────────────────────────────────────────────────────────

const VARIANT_LABELS = ["A", "B", "C"] as const;

export interface CaptionVariant {
  platform: StudioPlatform;
  variant: string;
  text: string;
  angle: string;
}

export const generateCaptionVariants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        briefing: z.string().min(3).max(4000),
        clientId: z.string().uuid().optional().nullable(),
        tone: z
          .enum(["professioneel", "informeel", "energiek", "inspirerend"])
          .default("professioneel"),
        platforms: z.array(studioPlatform).min(1).max(6),
        language: z.enum(["nl", "en"]).default("nl"),
        variantCount: z.union([z.literal(2), z.literal(3)]).default(2),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const clientContext = data.clientId ? await fetchClientContext(data.clientId) : "";
    const lang = data.language === "en" ? "Engels" : "Nederlands";
    const labels = VARIANT_LABELS.slice(0, data.variantCount);

    const platformRules = data.platforms.map((p) => `- ${PLATFORM_HINTS[p]}`).join("\n");

    const system = `Je bent een senior social-media copywriter. Schrijf captions in het ${lang}, basistoon: ${data.tone}.${clientContext}

Platform-richtlijnen:
${platformRules}

Opdracht: genereer voor ELK platform (${data.platforms.join(", ")}) precies ${data.variantCount} DUIDELIJK verschillende caption-varianten (labels: ${labels.join(", ")}).
De varianten van hetzelfde platform moeten elk een andere invalshoek hebben, bijvoorbeeld:
- storytelling / persoonlijk verhaal
- direct / voordeel + call-to-action
- vraag / engagement / prikkelende stelling
Benoem per variant de invalshoek kort in het veld "angle" (bv. "storytelling", "direct + CTA", "engagement-vraag"). De teksten mogen elkaar niet parafraseren — echt andere opbouw, hook en insteek.`;

    const result = await generateJson<{ variants: CaptionVariant[] }>({
      system,
      user: data.briefing,
      effort: "medium",
      maxTokens: 8192,
      schema: {
        type: "object",
        properties: {
          variants: {
            type: "array",
            items: {
              type: "object",
              properties: {
                platform: { type: "string", enum: [...data.platforms] },
                variant: { type: "string", enum: [...labels] },
                text: { type: "string" },
                angle: { type: "string" },
              },
              required: ["platform", "variant", "text", "angle"],
              additionalProperties: false,
            },
          },
        },
        required: ["variants"],
        additionalProperties: false,
      },
    });

    return { variants: Array.isArray(result.variants) ? result.variants : [] };
  });

export const saveCaptionVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid().optional().nullable(),
        briefing: z.string().min(1).max(4000),
        tone: z.string().max(120).default("professioneel"),
        platform: studioPlatform,
        text: z.string().min(1).max(6000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await supabaseAdmin.from("ai_generations").insert({
      client_id: data.clientId ?? null,
      user_id: context.userId,
      briefing: data.briefing,
      tone: data.tone,
      platform: data.platform,
      generated_text: data.text,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Hergebruik (repurpose) ───────────────────────────────────────────────────

export interface RepurposedPost {
  platform: StudioPlatform;
  text: string;
  hashtags: string[];
  notes: string;
}

export const repurposeContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        source: z.string().min(20).max(20000),
        platforms: z.array(studioPlatform).min(1).max(6),
        clientId: z.string().uuid().optional().nullable(),
        language: z.enum(["nl", "en"]).default("nl"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const clientContext = data.clientId ? await fetchClientContext(data.clientId) : "";
    const lang = data.language === "en" ? "Engels" : "Nederlands";
    const platformRules = data.platforms.map((p) => `- ${PLATFORM_HINTS[p]}`).join("\n");

    const system = `Je bent een content-repurposing specialist. Je krijgt één bron-content (blogtekst, video-script of bestaande post) en herschrijft die naar native posts per platform, in het ${lang}.${clientContext}

Platform-richtlijnen:
${platformRules}

Voor ELK platform (${data.platforms.join(", ")}) precies één post:
- "text": de volledige postcopy, native voor dat platform (niet knippen-en-plakken uit de bron; herschrijf hook, opbouw en lengte).
- "hashtags": passende hashtags als losse strings met #-teken (leeg array als hashtags niet passen bij het platform).
- "notes": 1-2 zinnen productie-advies (bv. visual/formaat-suggestie, beste posttijd of CTA-tip).`;

    const result = await generateJson<{ posts: RepurposedPost[] }>({
      system,
      user: `Bron-content:\n\n${data.source}`,
      effort: "medium",
      maxTokens: 12288,
      schema: {
        type: "object",
        properties: {
          posts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                platform: { type: "string", enum: [...data.platforms] },
                text: { type: "string" },
                hashtags: { type: "array", items: { type: "string" } },
                notes: { type: "string" },
              },
              required: ["platform", "text", "hashtags", "notes"],
              additionalProperties: false,
            },
          },
        },
        required: ["posts"],
        additionalProperties: false,
      },
    });

    return { posts: Array.isArray(result.posts) ? result.posts : [] };
  });
