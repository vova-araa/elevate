/**
 * Notificatiemail bij een nieuwe lead (S01). Er was nog geen enkele
 * e-mailintegratie in de app — dit gebruikt Resend (simpele HTTP-API, geen
 * SMTP-configuratie nodig) via RESEND_API_KEY. Zonder die sleutel, of zonder
 * LEADS_NOTIFICATION_EMAIL, wordt er niets verstuurd maar de lead blijft wel
 * gewoon in de database staan — de aanvraag zelf mag nooit mislukken doordat
 * de notificatie niet lukt.
 */

export interface LeadNotification {
  naam: string;
  bedrijf: string | null;
  email: string;
  telefoon: string | null;
  website: string | null;
  kanalen: string[];
  budgetrange: string | null;
  doel: string | null;
  hoeGevonden: string | null;
}

export async function notifyNewLead(lead: LeadNotification): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEADS_NOTIFICATION_EMAIL;
  if (!apiKey || !to) {
    console.warn(
      "[leads] Geen notificatiemail verstuurd: RESEND_API_KEY en/of LEADS_NOTIFICATION_EMAIL " +
        "staan niet in de omgeving. De lead is wel opgeslagen.",
    );
    return;
  }

  const lines = [
    `Naam: ${lead.naam}`,
    lead.bedrijf ? `Bedrijf: ${lead.bedrijf}` : null,
    `E-mail: ${lead.email}`,
    lead.telefoon ? `Telefoon: ${lead.telefoon}` : null,
    lead.website ? `Website: ${lead.website}` : null,
    lead.kanalen.length ? `Kanalen: ${lead.kanalen.join(", ")}` : null,
    lead.budgetrange ? `Budget: ${lead.budgetrange}` : null,
    lead.doel ? `Doel: ${lead.doel}` : null,
    lead.hoeGevonden ? `Hoe gevonden: ${lead.hoeGevonden}` : null,
  ].filter((l): l is string => !!l);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.LEADS_NOTIFICATION_FROM || "Elevate Design <noreply@elevatedesign.nl>",
      to: [to],
      subject: `Nieuwe aanvraag: ${lead.naam}${lead.bedrijf ? ` (${lead.bedrijf})` : ""}`,
      text: lines.join("\n"),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend gaf ${res.status}: ${body.slice(0, 300)}`);
  }
}
