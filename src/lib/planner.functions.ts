import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateJson } from "@/lib/ai-provider.server";

const platformSchema = z.enum(["instagram", "tiktok", "linkedin", "youtube", "facebook"]);

const generateCaptionInput = z.object({
  brief: z.string().min(2).max(2000),
  platform: platformSchema,
  tone: z.string().max(120).optional(),
  brand: z.string().max(200).optional(),
});

export const generateCaption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => generateCaptionInput.parse(i))
  .handler(async ({ data }) => {
    const platformGuide: Record<string, string> = {
      instagram: "Max 2200 tekens, hook eerste regel, 5-10 relevante hashtags onderaan.",
      tiktok: "Korte hook, max 150 tekens caption, 3-5 hashtags, trending taal.",
      linkedin: "Professioneel, 1-3 alinea's, max 3 hashtags.",
      youtube: "Titel + beschrijving stijl, eerste 2 regels = hook.",
      facebook: "Conversationeel, 1-2 alinea's, geen hashtag-spam.",
    };

    const system = `Je schrijft social captions in het Nederlands voor ${data.platform}.
Richtlijn: ${platformGuide[data.platform]}
${data.brand ? `Brand: ${data.brand}` : ""}
${data.tone ? `Tone-of-voice: ${data.tone}` : ""}`;

    const result = await generateJson<{ caption: string; hashtags: string[] }>({
      system,
      user: data.brief,
      effort: "low",
      schema: {
        type: "object",
        properties: {
          caption: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
        },
        required: ["caption", "hashtags"],
        additionalProperties: false,
      },
    });

    return {
      caption: result.caption ?? "",
      hashtags: Array.isArray(result.hashtags) ? result.hashtags : [],
    };
  });

const ideaInput = z.object({
  brand: z.string().min(1).max(200),
  industry: z.string().max(120).optional(),
  audience: z.string().max(400).optional(),
  pillars: z.string().max(400).optional(),
  goal: z.string().max(400).optional(),
  platforms: z.array(platformSchema).min(1).max(5),
  count: z.number().int().min(1).max(15).default(8),
});

export const generateContentIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ideaInput.parse(i))
  .handler(async ({ data }) => {
    const system = `Je bent een senior social media strateeg. Genereer ${data.count} concrete contentideeën in het Nederlands voor het merk "${data.brand}"${data.industry ? ` (${data.industry})` : ""}.
Per idee: kies het beste platform uit [${data.platforms.join(", ")}], format (reel, carousel, static, story, short, long-video, text-post), een korte hook (max 90 tekens), en 1-2 zinnen omschrijving van de uitvoering.

${data.audience ? `Doelgroep: ${data.audience}` : ""}
${data.pillars ? `Content pijlers: ${data.pillars}` : ""}
${data.goal ? `Doel: ${data.goal}` : ""}

Mix awareness, education, social proof en conversie. Vermijd cliché's. Geef variatie in formats.`;

    const result = await generateJson<{
      ideas: { title: string; platform: string; format: string; hook: string; description: string; pillar?: string }[];
    }>({
      system,
      user: `Genereer ${data.count} ideeën voor ${data.brand}.`,
      effort: "medium",
      maxTokens: 8192,
      schema: {
        type: "object",
        properties: {
          ideas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                platform: { type: "string", enum: ["instagram", "tiktok", "linkedin", "youtube", "facebook"] },
                format: { type: "string" },
                hook: { type: "string" },
                description: { type: "string" },
                pillar: { type: "string" },
              },
              required: ["title", "platform", "format", "hook", "description", "pillar"],
              additionalProperties: false,
            },
          },
        },
        required: ["ideas"],
        additionalProperties: false,
      },
    });

    return { ideas: Array.isArray(result.ideas) ? result.ideas : [] };
  });

const hooksInput = z.object({
  topic: z.string().min(2).max(400),
  platform: platformSchema,
  count: z.number().int().min(3).max(15).default(8),
});

export const generateHooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => hooksInput.parse(i))
  .handler(async ({ data }) => {
    const result = await generateJson<{ hooks: string[] }>({
      system: `Genereer ${data.count} korte, scroll-stoppende hooks in het Nederlands voor ${data.platform}. Variatie in stijl: vraag, statement, controversieel, lijst, before/after. Max 90 tekens elk.`,
      user: data.topic,
      effort: "low",
      schema: {
        type: "object",
        properties: { hooks: { type: "array", items: { type: "string" } } },
        required: ["hooks"],
        additionalProperties: false,
      },
    });
    return { hooks: Array.isArray(result.hooks) ? result.hooks : [] };
  });

const hashtagsInput = z.object({
  topic: z.string().min(2).max(400),
  platform: platformSchema,
  niche: z.string().max(200).optional(),
});

export const generateHashtags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => hashtagsInput.parse(i))
  .handler(async ({ data }) => {
    const result = await generateJson<{ big: string[]; medium: string[]; niche: string[] }>({
      system: `Genereer een gemixte set hashtags voor ${data.platform}${data.niche ? ` in de niche: ${data.niche}` : ""}. Mix groot (volume), middel (relevant) en niche (specifiek). Geen #-tekens missen. Geen duplicaten.`,
      user: data.topic,
      effort: "low",
      schema: {
        type: "object",
        properties: {
          big: { type: "array", items: { type: "string" } },
          medium: { type: "array", items: { type: "string" } },
          niche: { type: "array", items: { type: "string" } },
        },
        required: ["big", "medium", "niche"],
        additionalProperties: false,
      },
    });
    return {
      big: Array.isArray(result.big) ? result.big : [],
      medium: Array.isArray(result.medium) ? result.medium : [],
      niche: Array.isArray(result.niche) ? result.niche : [],
    };
  });
