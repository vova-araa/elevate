import { BUSINESS } from "@/config/business";

/**
 * E-mail naar een klant versturen via Resend. Anders dan
 * leads-notify.server.ts (die een ontbrekende sleutel stil negeert, omdat een
 * lead-aanvraag nooit mag mislukken door een notificatiefout) gooit deze
 * functie een fout bij een mislukte verzending — hier IS het versturen zelf
 * de actie die de admin heeft aangevraagd, dus de UI moet het weten als het
 * niet lukt.
 */

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

export async function sendClientEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY staat niet in de omgeving — e-mail versturen is nog niet geconfigureerd.",
    );
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:
        process.env.LEADS_NOTIFICATION_FROM || `${BUSINESS.tradeName} <noreply@elevatedesign.nl>`,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend gaf ${res.status}: ${body.slice(0, 300)}`);
  }
}
