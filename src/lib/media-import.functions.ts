import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// ── Auth (zelfde patroon als de overige *.functions.ts bestanden) ───────────

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Alleen admins mogen media importeren");
  }
}

// Block SSRF: alleen publieke https-URL's toestaan, geen localhost/privé-IP's
// (zelfde aanpak als assertSafeWebhookUrl in automation-admin.functions.ts).
function assertSafeImportUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Ongeldige URL");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("Alleen http(s)-URL's zijn toegestaan");
  }
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error("Interne hostnames zijn niet toegestaan");
  }
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1], 10), parseInt(ipv4[2], 10)];
    if (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0
    ) {
      throw new Error("Privé IP-adressen zijn niet toegestaan");
    }
  }
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
    throw new Error("Privé IPv6-adressen zijn niet toegestaan");
  }
  return u;
}

const MAX_IMPORT_SIZE = 50 * 1024 * 1024; // 50MB

// Herkent Google Drive share-links en zet ze om naar een directe download-URL.
// Andere URL's worden ongewijzigd gebruikt.
function toDirectDownloadUrl(raw: string): string {
  const driveFileMatch = raw.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveFileMatch) {
    return `https://drive.google.com/uc?export=download&id=${driveFileMatch[1]}`;
  }
  try {
    const u = new URL(raw);
    if (u.hostname.includes("drive.google.com")) {
      const id = u.searchParams.get("id");
      if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
    }
  } catch {
    // negeren — validatie gebeurt in assertSafeImportUrl
  }
  return raw;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/]/g, "_").trim() || "bestand";
}

function fileNameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // val terug op de eenvoudige match hieronder
    }
  }
  const simpleMatch = header.match(/filename="?([^";]+)"?/i);
  return simpleMatch ? simpleMatch[1] : null;
}

function fileNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return last && last.length > 0 ? last : "geimporteerd-bestand";
  } catch {
    return "geimporteerd-bestand";
  }
}

export const importMediaFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        url: z.string().trim().min(1, "Vul een URL in").max(2000),
        folderId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const directUrl = toDirectDownloadUrl(data.url);
    assertSafeImportUrl(directUrl);

    const FETCH_FAILED = new Error(
      'Kon het bestand niet ophalen — is de Drive-link openbaar gedeeld ("iedereen met de link")?',
    );

    // SSRF-bescherming geldt niet alleen voor de opgegeven URL, maar voor elke
    // hop: redirects (bv. Google Drive → googleusercontent.com) volgen we zelf
    // op ("redirect: manual") en elke Location wordt opnieuw gevalideerd —
    // anders zou een kwaadwillende URL via een redirect alsnog naar een
    // interne/privé host kunnen wijzen die assertSafeImportUrl niet ziet.
    const MAX_REDIRECTS = 5;
    let currentUrl = directUrl;
    let response: Response;
    for (let hop = 0; ; hop++) {
      try {
        response = await fetch(currentUrl, { redirect: "manual" });
      } catch {
        throw FETCH_FAILED;
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || hop >= MAX_REDIRECTS) throw FETCH_FAILED;
        const nextUrl = new URL(location, currentUrl).toString();
        currentUrl = assertSafeImportUrl(nextUrl).toString();
        continue;
      }
      break;
    }

    if (!response.ok || !response.body) {
      throw FETCH_FAILED;
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    if (contentType.includes("text/html")) {
      throw new Error(
        'Dit lijkt geen direct bestand maar een webpagina — controleer of de Drive-link op "iedereen met de link" staat.',
      );
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_IMPORT_SIZE) {
      throw new Error("Bestand is groter dan 50MB en kan niet geïmporteerd worden");
    }

    // Lees gestreamd in met een harde limiet, voor het geval content-length ontbreekt.
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_IMPORT_SIZE) {
          await reader.cancel();
          throw new Error("Bestand is groter dan 50MB en kan niet geïmporteerd worden");
        }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const rawName =
      fileNameFromContentDisposition(response.headers.get("content-disposition")) ??
      fileNameFromUrl(data.url);
    const safeName = sanitizeFileName(rawName);
    const path = `${data.clientId}/imported/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("client-uploads")
      .upload(path, bytes, { contentType });
    if (uploadError) {
      throw new Error(`Uploaden mislukt: ${uploadError.message}`);
    }

    const { error: insertError } = await supabaseAdmin.from("uploads").insert({
      client_id: data.clientId,
      file_path: path,
      file_name: safeName,
      file_type: contentType,
      file_size: total,
      folder_id: data.folderId ?? null,
      uploader_id: context.userId,
    });
    if (insertError) {
      await supabaseAdmin.storage.from("client-uploads").remove([path]);
      throw new Error(`Opslaan mislukt: ${insertError.message}`);
    }

    return { ok: true as const, fileName: safeName };
  });
