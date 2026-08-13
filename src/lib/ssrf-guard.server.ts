import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Eén gedeelde SSRF-bescherming voor álle plekken waar de server een
 * door gebruikers aangeleverde URL ophaalt (media-import, webhooks,
 * automation-acties).
 *
 * Belangrijk: een puur tekstuele controle op de hostname is niet genoeg. Een
 * aanvaller kan een eigen domein laten wijzen naar 169.254.169.254 (cloud
 * metadata) of 10.x.x.x, of een alternatieve IP-notatie gebruiken
 * (http://127.1, http://2130706433, http://[::ffff:127.0.0.1]). Daarom lossen
 * we de hostname eerst op via DNS en toetsen we het resulterende IP-adres.
 */

function ipIsPrivate(ip: string): boolean {
  const v = isIP(ip);

  if (v === 4) {
    const [a, b] = ip.split(".").map((n) => parseInt(n, 10));
    return (
      a === 0 || // "dit netwerk"
      a === 10 || // privé
      a === 127 || // loopback
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local + cloud metadata
      (a === 172 && b >= 16 && b <= 31) || // privé
      (a === 192 && b === 168) || // privé
      a >= 224 // multicast/gereserveerd
    );
  }

  if (v === 6) {
    const ip6 = ip.toLowerCase();
    // IPv4-mapped adressen apart toetsen op het IPv4-deel. Let op: Node
    // normaliseert "::ffff:169.254.169.254" naar de hex-vorm "::ffff:a9fe:a9fe",
    // dus beide notaties moeten hier langs.
    const mappedDotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip6);
    if (mappedDotted) return ipIsPrivate(mappedDotted[1]);
    const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(ip6);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      return ipIsPrivate(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return (
      ip6 === "::1" || // loopback
      ip6 === "::" ||
      ip6.startsWith("fc") || // unique local
      ip6.startsWith("fd") ||
      ip6.startsWith("fe80") || // link-local
      ip6.startsWith("ff") // multicast
    );
  }

  // Onbekend formaat → niet vertrouwen.
  return true;
}

export interface SsrfGuardOptions {
  /** Sta ook http:// toe (standaard alleen https). */
  allowHttp?: boolean;
}

/**
 * Valideert een URL en werpt bij een onveilig doel. Geeft de geparste URL terug.
 * Let op: dit is TOCTOU-gevoelig (DNS kan tussen check en fetch wijzigen); voor
 * onze use-cases — importeren van media en het afvuren van webhooks — is dit de
 * gangbare, praktische afweging.
 */
export async function assertSafeExternalUrl(
  raw: string,
  opts: SsrfGuardOptions = {},
): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Ongeldige URL");
  }

  const allowed = opts.allowHttp ? ["https:", "http:"] : ["https:"];
  if (!allowed.includes(u.protocol)) {
    throw new Error(
      opts.allowHttp
        ? "Alleen http(s)-URL's zijn toegestaan"
        : "Alleen https-URL's zijn toegestaan",
    );
  }

  // Trailing dot ("localhost.") normaliseren, anders glipt die langs naamchecks.
  const host = u.hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Interne hostnames zijn niet toegestaan");
  }

  // Is het al een IP-literal? Dan direct toetsen; anders eerst DNS resolven.
  let address = host;
  if (!isIP(host)) {
    try {
      const res = await lookup(host);
      address = res.address;
    } catch {
      throw new Error("Hostname kon niet worden opgezocht");
    }
  }

  if (ipIsPrivate(address)) {
    throw new Error("Dit adres verwijst naar een intern netwerk en is niet toegestaan");
  }

  return u;
}
