import { getRequest } from "@tanstack/react-start/server";

/**
 * Rate limiting in het serverproces zelf.
 *
 * De app draait als één Node-proces (Render), dus een Map in het geheugen dekt
 * de werkelijkheid: elke aanvraag komt langs ditzelfde proces. Zou de app ooit
 * horizontaal schalen, dan moet dit naar iets gedeelds — maar een limiter die
 * per instance telt is ook dán nog een rem, alleen een ruimere.
 *
 * Vast venster in plaats van sliding window: bij deze limieten (tientallen per
 * minuut) is het verschil academisch, en een vast venster kost één getal per
 * sleutel in plaats van een lijst tijdstempels.
 */

interface Bucket {
  count: number;
  /** Wanneer dit venster afloopt (ms-epoch). */
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Voorkom onbegrensde geheugengroei bij veel unieke sleutels (bv. IP-scans). */
const MAX_BUCKETS = 10_000;

function sweep(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Nog steeds vol na het opruimen van verlopen vensters? Dan zit iemand
  // sleutels te spuiten; gooi de oudste helft weg. Iets te ruim toelaten is
  // hier beter dan onbegrensd geheugen.
  if (buckets.size >= MAX_BUCKETS) {
    let i = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (++i >= MAX_BUCKETS / 2) break;
    }
  }
}

/**
 * Telt één aanvraag voor `key` en zegt of die nog binnen de limiet valt.
 * `true` = doorlaten, `false` = weigeren.
 */
export function allowRequest(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= max;
}

/** Alleen voor tests: alles vergeten. */
export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * Afzender-IP van de huidige aanvraag, voor IP-gebaseerde limieten.
 *
 * Bewust de LAATSTE waarde uit x-forwarded-for, niet de eerste. Die header is
 * een keten waar elke proxy achteraan aanplakt; de eerste waarde komt van de
 * client en is dus vrij invulbaar. Wie zelf een willekeurig IP vooraan zette
 * kreeg per aanvraag een verse emmer, waarmee de limiet feitelijk niets deed.
 * De laatste hop is degene die onze eigen proxy heeft toegevoegd.
 */
export function requestIp(request?: Request): string {
  const req = request ?? getRequest();
  const fwd = req?.headers.get("x-forwarded-for");
  if (fwd) {
    const hops = fwd
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    if (hops.length) return hops[hops.length - 1]!;
  }
  return req?.headers.get("x-real-ip") ?? "onbekend";
}

/** 429-antwoord met Retry-After, voor route-handlers. */
export function tooManyRequests(retryAfterSeconds = 60): Response {
  return new Response(JSON.stringify({ error: "Te veel aanvragen — probeer het straks opnieuw" }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfterSeconds),
    },
  });
}
