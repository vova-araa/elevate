import { supabase } from "@/integrations/supabase/client";
import { MAX_UPLOAD_BYTES, tooLargeMessage } from "@/lib/upload-limits";

/**
 * Eén manier om een bestand naar de opslag te sturen.
 *
 * Aanleiding: er stonden tien losse implementaties in de app. Twee daarvan
 * controleerden de bestandsgrootte, drie zetten het bestandsveld terug na een
 * keuze, geen enkele had een tijdslimiet. Het gevolg was voorspelbaar — de
 * planner bleef in de laadstand hangen zonder ooit een fout te tonen, terwijl
 * dezelfde upload elders wél netjes afketste. Elke fix moest tien keer, en dus
 * gebeurde dat niet.
 *
 * Wat hier gebeurt, gebeurt overal:
 *  - grootte vooraf controleren, zodat je niet minutenlang wacht op een
 *    afwijzing die je meteen had kunnen weten;
 *  - het pad altijd binnen de map van de klant, want daar hangt de hele
 *    tenant-isolatie aan (storage-policies kijken naar het eerste pad-segment);
 *  - een tijdslimiet, zodat een blijvend hangend verzoek een fout wordt in
 *    plaats van een eeuwige spinner;
 *  - een leesbare fout in plaats van de ruwe tekst van de opslag.
 */

/** Standaard-tijdslimiet. Ruim genoeg voor een grote video op een trage lijn. */
const DEFAULT_TIMEOUT_MS = 10 * 60_000;

export interface UploadOptions {
  /** Klant waar dit bestand bij hoort; bepaalt de map en daarmee de toegang. */
  clientId: string;
  /** Submap binnen de klantmap, bv. "planner" of "media". */
  folder?: string;
  /** Afbreken na zoveel milliseconden. */
  timeoutMs?: number;
}

export interface UploadResult {
  path: string;
  mediaType: string;
}

/** Veilige bestandsnaam: geen spaties, accenten of pad-tekens in de opslag. */
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "bin";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext.replace(/[^a-z0-9]/g, "") || "bin"}`;
}

export class UploadError extends Error {}

export async function uploadMedia(file: File, opts: UploadOptions): Promise<UploadResult> {
  if (!opts.clientId) {
    throw new UploadError("Geen klant geselecteerd — kies eerst een klant.");
  }
  if (file.size === 0) {
    throw new UploadError(`${file.name} is leeg (0 bytes).`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(tooLargeMessage(file.name));
  }

  const folder = opts.folder ? `${opts.folder}/` : "";
  const path = `${opts.clientId}/${folder}${safeFileName(file.name)}`;

  // Zonder deze afbreker blijft een verzoek dat nooit antwoordt eeuwig hangen,
  // en dat is precies hoe de knop in de planner in de laadstand bleef staan.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const { error } = await supabase.storage.from("client-uploads").upload(path, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
      // @ts-expect-error — de storage-client geeft signal door aan fetch, maar
      // het staat (nog) niet in de typedefinities.
      signal: controller.signal,
    });
    if (error) throw new UploadError(uploadErrorMessage(error.message, file.name));
    return { path, mediaType: file.type || "application/octet-stream" };
  } catch (e) {
    if (e instanceof UploadError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new UploadError(
        `Uploaden van ${file.name} duurde te lang en is afgebroken. Controleer je verbinding of probeer een kleiner bestand.`,
      );
    }
    throw new UploadError(
      `Uploaden van ${file.name} mislukt: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * De opslag geeft technische meldingen terug; dit vertaalt de twee die je in de
 * praktijk tegenkomt naar iets waar je wat aan hebt.
 */
export function uploadErrorMessage(raw: string, fileName: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("exceeded the maximum allowed size") || lower.includes("payload too large")) {
    return tooLargeMessage(fileName);
  }
  if (lower.includes("row-level security") || lower.includes("unauthorized")) {
    return "Geen toestemming om hier te uploaden. Log opnieuw in, of controleer of je toegang hebt tot deze klant.";
  }
  return `Uploaden van ${fileName} mislukt: ${raw}`;
}

/**
 * Zet het bestandsveld terug na een keuze.
 *
 * Zonder dit vuurt `change` niet als je hetzelfde bestand nog eens kiest — na
 * een mislukte poging lijkt de knop dan kapot, want er gebeurt niets.
 */
export function resetFileInput(input: HTMLInputElement | null | undefined): void {
  if (input) input.value = "";
}
