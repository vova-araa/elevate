import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { generateJson } from "@/lib/ai-provider.server";
import { copywriterSystem, subjectOrFallback } from "@/lib/copywriting";

/**
 * Advies bij het schrijven van een post: caption, hashtags en een paar concrete
 * aanscherpingen — in één keer, vanuit het scherm waar je toch al staat.
 *
 * Bewust apart van de AI Studio: daar kies je platforms en varianten, hier wil
 * je alleen snel iets bruikbaars voor de post die je nu aan het maken bent.
 */

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen de AI gebruiken");
  }
}

/** Merkcontext zodat het advies bij deze klant past en niet algemeen blijft. */
async function clientContext(clientId: string | null | undefined): Promise<string> {
  if (!clientId) return "";
  const parts: string[] = [];
  const { data: c } = await supabaseAdmin
    .from("clients")
    .select("name, industry, description, notes")
    .eq("id", clientId)
    .maybeSingle();
  if (c) {
    parts.push(`Klant: ${c.name}${c.industry ? ` (${c.industry})` : ""}.`);
    if (c.description) parts.push(`Over het merk: ${String(c.description).slice(0, 400)}`);
    if (c.notes) parts.push(`Notities: ${String(c.notes).slice(0, 400)}`);
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
    parts.push(`Tone-of-voice — houd je hieraan:\n${String(tone.body).slice(0, 1500)}`);
  }
  return parts.length ? `\n\n${parts.join("\n")}` : "";
}

export interface PostCopyAdvice {
  caption: string;
  hashtags: string[];
  tips: string[];
}

export const suggestPostCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid().nullable().optional(),
        platform: z.string().min(2).max(20),
        /** Waar de post over gaat. Mag leeg zijn als er al een caption staat. */
        briefing: z.string().max(2000).default(""),
        /** Wat er nu in het captionveld staat; dan scherpen we die aan. */
        currentCaption: z.string().max(4000).default(""),
        hasMedia: z.boolean().default(false),
        mediaType: z.string().max(60).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<PostCopyAdvice> => {
    await assertAdmin(context);

    // Bewust géén blokkade meer op een lege briefing: wie op "denk mee" drukt
    // met alleen een foto erbij verwacht een voorstel, geen instructie om eerst
    // zelf iets te typen.
    const subject = subjectOrFallback({
      briefing: data.briefing,
      currentCaption: data.currentCaption,
      hasMedia: data.hasMedia,
      mediaType: data.mediaType,
    });

    const mediaNote = data.hasMedia
      ? `Er hangt ${data.mediaType?.startsWith("video") ? "een video" : "een afbeelding"} aan deze post; verwijs daar natuurlijk naar zonder te beschrijven wat je niet kunt zien.`
      : "Er zit nog geen media bij deze post.";

    const system = copywriterSystem({
      platform: data.platform,
      context: `${await clientContext(data.clientId)}\n${mediaNote}`.trim(),
      task:
        "Lever drie dingen als JSON.\n" +
        '1. "caption": één afgeronde caption die direct geplaatst kan worden. De eerste zin draagt de kern. Geen hashtags in de caption zelf.\n' +
        '2. "hashtags": 5 tot 12 hashtags die echt bij dit onderwerp en deze branche passen. Geen vulling als #love of #instagood, niets dat losstaat van het merk.\n' +
        '3. "tips": 2 tot 4 concrete aanscherpingen voor déze post — over de openingszin, de call-to-action of het moment van plaatsen. Geen algemene socialmedia-adviezen.',
      extra:
        'De regel "geef alleen de tekst" geldt hier per veld: in "caption" staat alleen de caption, geen uitleg.',
    });

    const user = data.currentCaption.trim()
      ? `Dit staat er nu: "${data.currentCaption.slice(0, 2000)}"\n\nScherp dit aan tot een betere caption en geef passende hashtags.`
      : `De post gaat over: ${subject.slice(0, 2000)}`;

    const result = await generateJson<PostCopyAdvice>({
      system,
      user,
      effort: "medium",
      maxTokens: 4096,
      schema: {
        type: "object",
        properties: {
          caption: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
          tips: { type: "array", items: { type: "string" } },
        },
        required: ["caption", "hashtags", "tips"],
        additionalProperties: false,
      },
    });

    return {
      caption: typeof result.caption === "string" ? result.caption : "",
      // Hekje ervoor als het model het vergeet, en dubbele eruit.
      hashtags: Array.isArray(result.hashtags)
        ? [
            ...new Set(
              result.hashtags
                .filter((h): h is string => typeof h === "string" && h.trim().length > 1)
                .map((h) => (h.startsWith("#") ? h.trim() : `#${h.trim().replace(/^#+/, "")}`)),
            ),
          ]
        : [],
      tips: Array.isArray(result.tips) ? result.tips.filter((t) => typeof t === "string") : [],
    };
  });
