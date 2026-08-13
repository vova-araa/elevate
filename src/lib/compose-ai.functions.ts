import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { generateJson } from "@/lib/ai-provider.server";

/**
 * Advies bij het schrijven van een post: caption, hashtags en een paar concrete
 * aanscherpingen — in één keer, vanuit het scherm waar je toch al staat.
 *
 * Bewust apart van de AI Studio: daar kies je platforms en varianten, hier wil
 * je alleen snel iets bruikbaars voor de post die je nu aan het maken bent.
 */

const PLATFORM_HINTS: Record<string, string> = {
  instagram:
    "Instagram: max 2200 tekens, eerste zin is de hook (de rest valt achter 'meer lezen'), 3-5 relevante hashtags.",
  facebook: "Facebook: max 1500 tekens, conversationeel, hooguit een paar hashtags.",
  tiktok: "TikTok: max 300 tekens, korte energieke zin, 2-4 hashtags, spreektaal.",
  linkedin: "LinkedIn: max 3000 tekens, professioneel, max 3 hashtags, eindig met een vraag.",
  youtube: "YouTube: pakkende titelzin, daarna context; hashtags onderaan.",
};

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

    const subject = data.briefing.trim() || data.currentCaption.trim();
    if (!subject) {
      throw new Error("Schrijf eerst kort waar de post over gaat, dan denk ik mee.");
    }

    const rules = PLATFORM_HINTS[data.platform] ?? `${data.platform}: houd het kort en concreet.`;
    const mediaNote = data.hasMedia
      ? `Er hangt ${data.mediaType?.startsWith("video") ? "een video" : "een afbeelding"} aan deze post; verwijs daar natuurlijk naar.`
      : "Er zit nog geen media bij deze post.";

    const system = `Je bent een senior social-media copywriter die voor een Nederlands bureau werkt. Schrijf in het Nederlands.${await clientContext(data.clientId)}

Platform-richtlijn:
${rules}
${mediaNote}

Lever drie dingen:
1. "caption": één afgeronde caption die direct geplaatst kan worden. Eerste zin is de hook. Geen hashtags in de caption zelf.
2. "hashtags": 5 tot 12 hashtags die echt bij dit onderwerp en deze branche passen — geen generieke vulling als #love of #instagood, en geen hashtags die niets met het merk te maken hebben.
3. "tips": 2 tot 4 korte, concrete aanscherpingen voor deze specifieke post (bijvoorbeeld over de hook, de call-to-action of het beste moment). Geen algemene socialmedia-adviezen.`;

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
