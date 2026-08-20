import { supabase } from "@/integrations/supabase/client";
import { MAX_UPLOAD_BYTES, tooLargeMessage } from "@/lib/upload-limits";

/**
 * Eén manier om een bestand naar de opslag te sturen.
 *
 * Aanleiding: er stonden tien losse implementaties in de app. Twee daarvan
 * controleerden de bestandsgrootte, drie zetten het bestandsveld terug na een
 * keuze, geen enkele had een tijdslimiet. Elke fix moest tien keer, en dus
 * gebeurde dat niet.
 *
 * Waarom hier XMLHttpRequest staat en niet supabase.storage.upload():
 * die functie stuurt het bestand met fetch en geeft geen voortgang terug, én
 * accepteert geen AbortSignal (kijk maar in FileOptions — cacheControl,
 * contentType, upsert, duplex, metadata, headers, en verder niets). Een
 * afbreker meegeven wordt dus stilzwijgend genegeerd: de timer loopt af en de
 * upload gaat gewoon door. Bij een video van honderden MB's op een trage lijn
 * levert dat precies op wat er gemeld werd — een knop die blijft draaien
 * zonder dat iemand weet wat hij doet.
 *
 * XHR kan allebei wel: upload.onprogress geeft bytes-per-moment, en abort()
 * stopt het verzoek echt.
 */

/** Standaard-tijdslimiet. Ruim genoeg voor een grote video op een trage lijn. */
const DEFAULT_TIMEOUT_MS = 30 * 60_000;

/**
 * Hoe lang er niets mag gebeuren voordat we het opgeven. Dit is de echte
 * bewaking: een grote video mag uren duren, maar een verbinding die stilvalt
 * moet binnen een minuut een fout worden in plaats van eeuwig te blijven staan.
 */
const STALL_TIMEOUT_MS = 60_000;

export interface UploadProgress {
  /** Verzonden bytes. */
  loaded: number;
  /** Totaal aantal bytes. */
  total: number;
  /** Percentage 0-100, afgerond. */
  percent: number;
}

export interface UploadOptions {
  /** Klant waar dit bestand bij hoort; bepaalt de map en daarmee de toegang. */
  clientId: string;
  /** Submap binnen de klantmap, bv. "planner" of "media". */
  folder?: string;
  /** Wordt tijdens het versturen aangeroepen met de voortgang. */
  onProgress?: (p: UploadProgress) => void;
  /** Afbreken na zoveel milliseconden. */
  timeoutMs?: number;
  /** Van buitenaf afbreken (bv. een annuleerknop). */
  signal?: AbortSignal;
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

/** Door de gebruiker zelf afgebroken — geen fout om rood te melden. */
export class UploadCancelled extends UploadError {}

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
  const contentType = file.type || "application/octet-stream";

  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) {
    throw new UploadError("Je sessie is verlopen — log opnieuw in en probeer het nogmaals.");
  }

  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!baseUrl || !apiKey) {
    throw new UploadError(
      "Opslag is niet geconfigureerd (Supabase-omgevingsvariabelen ontbreken).",
    );
  }

  await sendWithProgress({
    url: `${baseUrl}/storage/v1/object/${encodeURIComponent("client-uploads")}/${path}`,
    file,
    contentType,
    token,
    apiKey,
    onProgress: opts.onProgress,
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: opts.signal,
    fileName: file.name,
  });

  return { path, mediaType: contentType };
}

interface SendOptions {
  url: string;
  file: File;
  contentType: string;
  token: string;
  apiKey: string;
  fileName: string;
  timeoutMs: number;
  onProgress?: (p: UploadProgress) => void;
  signal?: AbortSignal;
}

function sendWithProgress(o: SendOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    let lastActivity = Date.now();

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearInterval(watchdog);
      clearTimeout(hardStop);
      o.signal?.removeEventListener("abort", onExternalAbort);
      fn();
    };

    const fail = (message: string) => finish(() => reject(new UploadError(message)));

    // Bewaking op stilstand: een verbinding die wegvalt geeft geen error-event,
    // het verzoek blijft simpelweg staan. Zonder dit blijft de balk hangen.
    const watchdog = setInterval(() => {
      if (Date.now() - lastActivity > STALL_TIMEOUT_MS) {
        // Eerst de reden vastleggen, dán afbreken: xhr.abort() vuurt het
        // abort-event synchroon af, en die generieke listener zou anders deze
        // diagnose overschrijven met "is afgebroken".
        fail(
          `Uploaden van ${o.fileName} is gestopt: er kwam een minuut lang geen data door. Controleer je verbinding en probeer opnieuw.`,
        );
        xhr.abort();
      }
    }, 5_000);

    const hardStop = setTimeout(() => {
      fail(`Uploaden van ${o.fileName} duurde te lang en is afgebroken.`);
      xhr.abort();
    }, o.timeoutMs);

    // Zelf annuleren is geen fout: netjes afsluiten zonder rode melding.
    const onExternalAbort = () => {
      finish(() => reject(new UploadCancelled(`Uploaden van ${o.fileName} is geannuleerd.`)));
      xhr.abort();
    };
    o.signal?.addEventListener("abort", onExternalAbort);

    xhr.upload.addEventListener("progress", (e) => {
      lastActivity = Date.now();
      if (!e.lengthComputable) return;
      o.onProgress?.({
        loaded: e.loaded,
        total: e.total,
        percent: Math.min(100, Math.round((e.loaded / e.total) * 100)),
      });
    });

    xhr.addEventListener("load", () => {
      lastActivity = Date.now();
      if (xhr.status >= 200 && xhr.status < 300) {
        // Op 100% zetten: het laatste progress-event komt niet altijd binnen.
        o.onProgress?.({ loaded: o.file.size, total: o.file.size, percent: 100 });
        finish(resolve);
        return;
      }
      fail(uploadErrorMessage(extractMessage(xhr.responseText, xhr.status), o.fileName));
    });

    xhr.addEventListener("error", () =>
      fail(
        `Uploaden van ${o.fileName} mislukt door een netwerkfout. Controleer je verbinding en probeer opnieuw.`,
      ),
    );
    xhr.addEventListener("abort", () => fail(`Uploaden van ${o.fileName} is afgebroken.`));

    xhr.open("POST", o.url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${o.token}`);
    xhr.setRequestHeader("apikey", o.apiKey);
    xhr.setRequestHeader("Content-Type", o.contentType);
    xhr.setRequestHeader("Cache-Control", "max-age=3600");
    // Geen overschrijven: het pad bevat een tijdstempel plus toeval, dus een
    // botsing betekent dat er iets anders mis is.
    xhr.setRequestHeader("x-upsert", "false");
    xhr.send(o.file);
  });
}

/** Haalt de bruikbare melding uit een storage-antwoord. */
function extractMessage(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    return parsed.message || parsed.error || `HTTP ${status}`;
  } catch {
    return body?.slice(0, 200) || `HTTP ${status}`;
  }
}

/**
 * De opslag geeft technische meldingen terug; dit vertaalt de gevallen die je
 * in de praktijk tegenkomt naar iets waar je wat aan hebt.
 */
export function uploadErrorMessage(raw: string, fileName: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("exceeded the maximum allowed size") ||
    lower.includes("payload too large") ||
    lower.includes("http 413")
  ) {
    return tooLargeMessage(fileName);
  }
  if (
    lower.includes("row-level security") ||
    lower.includes("unauthorized") ||
    lower.includes("http 401") ||
    lower.includes("http 403")
  ) {
    return "Geen toestemming om hier te uploaden. Log opnieuw in, of controleer of je toegang hebt tot deze klant.";
  }
  if (lower.includes("already exists") || lower.includes("http 409")) {
    return `Er bestaat al een bestand op deze plek. Probeer ${fileName} opnieuw te uploaden.`;
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

/** Bytes leesbaar maken voor naast de voortgangsbalk. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} kB`;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}
