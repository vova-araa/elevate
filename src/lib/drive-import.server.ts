import { assertSafeExternalUrl } from "@/lib/ssrf-guard.server";

/**
 * Google Drive-mappen inlezen en bestanden ophalen in originele kwaliteit.
 *
 * Waarom via de Drive-API en niet via `drive.google.com/uc?export=download`:
 * die route geeft bij grotere bestanden een HTML-tussenpagina ("kan niet op
 * virussen scannen") terug in plaats van bytes, en werkt sowieso niet voor
 * mappen. De API geeft de originele bytes — geen hercompressie, geen verlies.
 *
 * Authenticatie gaat met een simpele API-sleutel (GOOGLE_DRIVE_API_KEY). Die is
 * genoeg voor mappen die op "iedereen met de link" staan, en dat is precies wat
 * een klant deelt. Geen OAuth-scherm, geen Google-verificatietraject.
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  /** Bytes; Google-documenten (Docs/Sheets) hebben er geen. */
  size: number | null;
  /** Pad binnen de gedeelde map, voor herkenbaarheid in de bibliotheek. */
  path: string;
}

export interface DriveListing {
  folderId: string;
  folderName: string;
  files: DriveFile[];
  /** Mappen die we niet konden openen (bv. niet meegedeeld). */
  skippedFolders: string[];
  /** Aangeraakt maximum bereikt — er staat meer in de map dan we ophaalden. */
  truncated: boolean;
}

export function driveApiKey(): string {
  const key = process.env.GOOGLE_DRIVE_API_KEY;
  if (!key) {
    throw new Error(
      "Google Drive-import is nog niet ingesteld — zet GOOGLE_DRIVE_API_KEY in de omgeving.",
    );
  }
  return key;
}

export function driveImportConfigured(): boolean {
  return !!process.env.GOOGLE_DRIVE_API_KEY;
}

/**
 * Haalt het id uit elke vorm van Drive-link die iemand kan plakken:
 * .../drive/folders/<id>, .../drive/u/0/folders/<id>, .../file/d/<id>/view,
 * ...?id=<id>, of het kale id zelf.
 */
export function parseDriveTarget(raw: string): { kind: "folder" | "file" | "unknown"; id: string } {
  const input = raw.trim();

  const folder = input.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (folder) return { kind: "folder", id: folder[1] };

  const file = input.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (file) return { kind: "file", id: file[1] };

  try {
    const u = new URL(input);
    const id = u.searchParams.get("id");
    if (id) return { kind: "unknown", id };
  } catch {
    // geen URL — misschien een kaal id
  }

  if (/^[a-zA-Z0-9_-]{20,}$/.test(input)) return { kind: "unknown", id: input };

  throw new Error(
    "Dit lijkt geen Google Drive-link. Plak de link van een map of bestand uit Drive.",
  );
}

async function driveJson(url: string): Promise<Record<string, unknown>> {
  // Vaste Google-host, maar de guard blijft staan: hij dwingt https af en
  // controleert dat we niet alsnog op een intern adres uitkomen.
  await assertSafeExternalUrl(url);
  const res = await fetch(url);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { message?: string; code?: number };
  };
  if (!res.ok) {
    if (res.status === 404 || res.status === 403) {
      throw new Error(
        'Geen toegang tot deze map of dit bestand. Zet de deel-instelling in Drive op "Iedereen met de link".',
      );
    }
    throw new Error(json.error?.message ?? `Google Drive gaf een fout (${res.status})`);
  }
  return json;
}

/** Naam en soort van een Drive-item. */
export async function driveMetadata(id: string): Promise<{ name: string; mimeType: string }> {
  const json = await driveJson(
    `${DRIVE_API}/files/${encodeURIComponent(id)}?key=${driveApiKey()}` +
      `&fields=id,name,mimeType&supportsAllDrives=true`,
  );
  return { name: String(json.name ?? "Drive"), mimeType: String(json.mimeType ?? "") };
}

/** Wat er in één map zit, één niveau diep. */
async function listChildren(folderId: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const url =
      `${DRIVE_API}/files?q=${q}&key=${driveApiKey()}` +
      `&fields=nextPageToken,files(id,name,mimeType,size)&pageSize=1000` +
      `&supportsAllDrives=true&includeItemsFromAllDrives=true` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const json = await driveJson(url);
    for (const f of (json.files as Record<string, unknown>[]) ?? []) {
      out.push({
        id: String(f.id),
        name: String(f.name ?? "bestand"),
        mimeType: String(f.mimeType ?? ""),
        size: f.size !== undefined && f.size !== null ? Number(f.size) : null,
        path: "",
      });
    }
    pageToken = typeof json.nextPageToken === "string" ? json.nextPageToken : undefined;
  } while (pageToken);
  return out;
}

/** Hoeveel bestanden we maximaal uit één gedeelde map halen. */
const MAX_FILES = 500;
/** Hoe diep we submappen volgen. */
const MAX_DEPTH = 5;

/**
 * Loopt de map recursief af. Submappen tellen mee — een klant deelt vaak één
 * map "Social maart" met daaronder "foto's" en "video's", en dan moet alles
 * meekomen zonder dat hij per submap een link stuurt.
 */
export async function listDriveFolder(folderId: string): Promise<DriveListing> {
  const root = await driveMetadata(folderId);
  if (root.mimeType !== FOLDER_MIME) {
    throw new Error("Deze link wijst naar een bestand, niet naar een map.");
  }

  const files: DriveFile[] = [];
  const skippedFolders: string[] = [];
  let truncated = false;

  const queue: { id: string; path: string; depth: number }[] = [
    { id: folderId, path: root.name, depth: 0 },
  ];
  const seen = new Set<string>([folderId]);

  while (queue.length) {
    const current = queue.shift()!;
    let children: DriveFile[];
    try {
      children = await listChildren(current.id);
    } catch {
      skippedFolders.push(current.path);
      continue;
    }

    for (const child of children) {
      if (child.mimeType === FOLDER_MIME) {
        if (current.depth + 1 > MAX_DEPTH || seen.has(child.id)) continue;
        seen.add(child.id);
        queue.push({
          id: child.id,
          path: `${current.path}/${child.name}`,
          depth: current.depth + 1,
        });
        continue;
      }
      if (files.length >= MAX_FILES) {
        truncated = true;
        continue;
      }
      files.push({ ...child, path: current.path });
    }
  }

  return { folderId, folderName: root.name, files, skippedFolders, truncated };
}

/** Alleen beeld en video importeren — de rest hoort niet in een mediabibliotheek. */
export function isImportableMedia(mimeType: string, name: string): boolean {
  if (mimeType.startsWith("image/") || mimeType.startsWith("video/")) return true;
  // Drive geeft voor sommige bestanden application/octet-stream terug; dan
  // beslist de extensie.
  return /\.(jpe?g|png|gif|webp|heic|heif|avif|tiff?|mp4|mov|m4v|webm|avi|mkv)$/i.test(name);
}

/**
 * Haalt de originele bytes op. `alt=media` levert het bestand zoals het in Drive
 * staat — geen hercompressie, geen tussenpagina.
 */
export async function downloadDriveFile(
  fileId: string,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const url = `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&key=${driveApiKey()}&supportsAllDrives=true`;
  await assertSafeExternalUrl(url);
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(
      'Kon het bestand niet ophalen — staat de map op "Iedereen met de link" in Drive?',
    );
  }

  const declared = res.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    throw new Error("groter dan de uploadlimiet");
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("groter dan de uploadlimiet");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    bytes,
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
  };
}

// ── OAuth-varianten (Authorization-header i.p.v. API-sleutel) ───────────────
//
// De functies hierboven werken met GOOGLE_DRIVE_API_KEY, genoeg voor een
// enkele map die een klant "voor iedereen met de link" deelt. Doorzoeken van
// álles wat met elevate.plannen@gmail.com gedeeld is kan dat niet — daarvoor
// is een ingelogde sessie nodig (zie drive-connection.functions.ts). Zelfde
// Drive-API, zelfde SSRF-guard, alleen de auth verschilt.

export interface DriveSharedItem {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  isFolder: boolean;
  ownerName: string | null;
  modifiedTime: string | null;
}

async function driveJsonAuthed(url: string, accessToken: string): Promise<Record<string, unknown>> {
  await assertSafeExternalUrl(url);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { message?: string; code?: number };
  };
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Drive-koppeling is niet meer geldig — koppel opnieuw op /admin/drive.");
    }
    throw new Error(json.error?.message ?? `Google Drive gaf een fout (${res.status})`);
  }
  return json;
}

/**
 * Alles wat met het gekoppelde account gedeeld is, optioneel gefilterd op
 * naam. Toont zowel mappen als losse bestanden — de admin klikt een map open
 * om verder te bladeren, of importeert een los bestand direct.
 */
export async function listSharedWithMe(
  accessToken: string,
  query?: string,
): Promise<DriveSharedItem[]> {
  const clauses = ["sharedWithMe = true", "trashed = false"];
  if (query?.trim()) {
    // Enkele quotes in Drive's query-taal escapen met \'.
    const escaped = query.trim().replace(/'/g, "\\'");
    clauses.push(`name contains '${escaped}'`);
  }
  const out: DriveSharedItem[] = [];
  let pageToken: string | undefined;
  do {
    const url =
      `${DRIVE_API}/files?q=${encodeURIComponent(clauses.join(" and "))}` +
      `&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime,owners(displayName))` +
      `&pageSize=100&orderBy=folder,modifiedTime desc` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const json = await driveJsonAuthed(url, accessToken);
    for (const f of (json.files as Record<string, unknown>[]) ?? []) {
      const owners = (f.owners as { displayName?: string }[] | undefined) ?? [];
      out.push({
        id: String(f.id),
        name: String(f.name ?? "bestand"),
        mimeType: String(f.mimeType ?? ""),
        size: f.size !== undefined && f.size !== null ? Number(f.size) : null,
        isFolder: f.mimeType === FOLDER_MIME,
        ownerName: owners[0]?.displayName ?? null,
        modifiedTime: typeof f.modifiedTime === "string" ? f.modifiedTime : null,
      });
    }
    pageToken = typeof json.nextPageToken === "string" ? json.nextPageToken : undefined;
    // Zoekresultaten hoeven niet compleet te zijn — 100 is ruim genoeg om
    // iets te herkennen en desnoods de zoekterm aan te scherpen.
  } while (pageToken && out.length < 300);
  return out;
}

/** Inhoud van één map, één niveau diep — voor het doorklikken vanuit de zoekresultaten. */
export async function listFolderContentsAuthed(
  folderId: string,
  accessToken: string,
): Promise<DriveSharedItem[]> {
  const out: DriveSharedItem[] = [];
  let pageToken: string | undefined;
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const url =
      `${DRIVE_API}/files?q=${q}` +
      `&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime,owners(displayName))` +
      `&pageSize=200&orderBy=folder,name` +
      `&supportsAllDrives=true&includeItemsFromAllDrives=true` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const json = await driveJsonAuthed(url, accessToken);
    for (const f of (json.files as Record<string, unknown>[]) ?? []) {
      const owners = (f.owners as { displayName?: string }[] | undefined) ?? [];
      out.push({
        id: String(f.id),
        name: String(f.name ?? "bestand"),
        mimeType: String(f.mimeType ?? ""),
        size: f.size !== undefined && f.size !== null ? Number(f.size) : null,
        isFolder: f.mimeType === FOLDER_MIME,
        ownerName: owners[0]?.displayName ?? null,
        modifiedTime: typeof f.modifiedTime === "string" ? f.modifiedTime : null,
      });
    }
    pageToken = typeof json.nextPageToken === "string" ? json.nextPageToken : undefined;
  } while (pageToken);
  return out;
}

export async function driveMetadataAuthed(
  id: string,
  accessToken: string,
): Promise<{ name: string; mimeType: string }> {
  const json = await driveJsonAuthed(
    `${DRIVE_API}/files/${encodeURIComponent(id)}?fields=id,name,mimeType&supportsAllDrives=true`,
    accessToken,
  );
  return { name: String(json.name ?? "Drive"), mimeType: String(json.mimeType ?? "") };
}

/** Zelfde als downloadDriveFile, maar met een Drive-koppeling in plaats van de API-sleutel. */
export async function downloadDriveFileAuthed(
  fileId: string,
  accessToken: string,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const url = `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  await assertSafeExternalUrl(url);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok || !res.body) {
    throw new Error("Kon het bestand niet ophalen uit Drive.");
  }

  const declared = res.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    throw new Error("groter dan de uploadlimiet");
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("groter dan de uploadlimiet");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    bytes,
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
  };
}
