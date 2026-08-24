import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { allowRequest, requestIp } from "@/lib/rate-limit.server";
import { ALL_PLATFORM_IDS } from "@/config/platforms";
import { notifyNewLead } from "@/lib/leads-notify.server";

/**
 * Publieke intake vanaf /contact (S01). Bewust zonder inlog — dit IS het
 * eerste contactmoment. Anti-spam zonder CAPTCHA:
 *  - honeypot (`nickname`): een verborgen veld dat een mens nooit invult;
 *  - minimale invultijd: sneller dan 2s is geen mens die een formulier leest;
 *  - rate limit per IP (zelfde patroon als data-deletion.functions.ts).
 * Bij een gevangen bot doen we alsof het gelukt is — niets laten merken.
 */
const submitLeadSchema = z.object({
  naam: z.string().trim().min(2, "Vul je naam in").max(120),
  bedrijf: z.string().trim().max(160).optional(),
  email: z.string().trim().email("Vul een geldig e-mailadres in").max(200),
  telefoon: z.string().trim().max(40).optional(),
  website: z.string().trim().max(200).optional(),
  kanalen: z
    .array(z.enum(ALL_PLATFORM_IDS as [string, ...string[]]))
    .max(10)
    .default([]),
  budgetrange: z.string().trim().max(60).optional(),
  doel: z.string().trim().max(2000).optional(),
  hoeGevonden: z.string().trim().max(160).optional(),
  // Anti-spam — geen van beide is een echt formulierveld voor de gebruiker.
  nickname: z.string().max(0).optional().default(""),
  formOpenedAt: z.number(),
});

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((d) => submitLeadSchema.parse(d))
  .handler(async ({ data }) => {
    // Honeypot ingevuld, of formulier "sneller dan menselijk" verstuurd: doe
    // alsof het gelukt is, sla niets op.
    if (data.nickname || Date.now() - data.formOpenedAt < 2000) {
      return { ok: true as const };
    }

    if (!allowRequest(`lead:${requestIp(getRequest())}`, 5, 60 * 60_000)) {
      throw new Error("Te veel aanvragen vanaf dit adres — probeer het over een uur opnieuw");
    }

    const { error } = await supabaseAdmin.from("leads").insert({
      naam: data.naam,
      bedrijf: data.bedrijf || null,
      email: data.email,
      telefoon: data.telefoon || null,
      website: data.website || null,
      kanalen: data.kanalen,
      budgetrange: data.budgetrange || null,
      doel: data.doel || null,
      hoe_gevonden: data.hoeGevonden || null,
      bron: "contactformulier",
    });
    if (error) throw new Error("Opslaan is niet gelukt — probeer het straks nog eens");

    // Notificatie is best-effort: de aanvraag is al opgeslagen, dus een
    // mislukte mail mag de indiener geen foutmelding laten zien.
    await notifyNewLead({
      naam: data.naam,
      bedrijf: data.bedrijf || null,
      email: data.email,
      telefoon: data.telefoon || null,
      website: data.website || null,
      kanalen: data.kanalen,
      budgetrange: data.budgetrange || null,
      doel: data.doel || null,
      hoeGevonden: data.hoeGevonden || null,
    }).catch((e) => console.error("[leads] Notificatiemail mislukt:", e));

    return { ok: true as const };
  });
