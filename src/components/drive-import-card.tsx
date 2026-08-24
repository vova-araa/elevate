import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, FolderSymlink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  importDriveBatch,
  previewDriveImport,
  type DrivePreview,
} from "@/lib/drive-import.functions";
import { cn } from "@/lib/utils";

/**
 * Google Drive-map importeren.
 *
 * De klant hoeft niets te slepen: hij deelt één map en plakt de link. Wij lezen
 * de map uit (inclusief submappen), laten eerst zien wát er binnenkomt, en halen
 * daarna alles in porties op met live voortgang. Bestanden komen in originele
 * kwaliteit binnen — de Drive-API geeft de bytes zoals ze zijn.
 */

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "onbekend";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function DriveImportCard({
  clientId,
  folderId = null,
  deliveryRequestId = null,
  onImported,
}: {
  clientId: string;
  /** Doelmap in de mediabibliotheek; leeg = map met de naam van de Drive-map. */
  folderId?: string | null;
  deliveryRequestId?: string | null;
  onImported?: () => void;
}) {
  const qc = useQueryClient();
  const preview = useServerFn(previewDriveImport);
  const importBatch = useServerFn(importDriveBatch);

  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [info, setInfo] = useState<DrivePreview | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failures, setFailures] = useState<{ name: string; reason: string }[]>([]);

  async function check() {
    if (!clientId) return toast.error("Kies eerst een klant");
    const link = url.trim();
    if (!link) return toast.error("Plak eerst een Drive-link");
    setChecking(true);
    setInfo(null);
    setFailures([]);
    try {
      const res = await preview({ data: { clientId, url: link } });
      if (!res.configured) {
        toast.error("Drive-import staat nog niet aan — zet GOOGLE_DRIVE_API_KEY in de omgeving.");
        return;
      }
      setInfo(res);
      if (res.toImport === 0 && res.mediaCount > 0) {
        toast.success("Alles uit deze map is al binnengehaald");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kon de map niet lezen");
    } finally {
      setChecking(false);
    }
  }

  async function runImport() {
    if (!info) return;
    const link = url.trim();
    const total = info.toImport;
    setProgress({ done: 0, total });
    const allFailures: { name: string; reason: string }[] = [];

    try {
      // Porties blijven komen tot de server meldt dat er niets meer over is.
      // De teller telt ook mislukte bestanden mee, anders loopt de balk vast.
      let done = 0;
      for (let round = 0; round < 200; round++) {
        const res = await importBatch({
          data: { clientId, url: link, folderId, deliveryRequestId },
        });
        done += res.imported + res.failed.length;
        allFailures.push(...res.failed);
        setProgress({ done: Math.min(done, total), total });
        if (res.remaining === 0) break;
        // Alleen mislukkingen en niets meer geïmporteerd? Dan blijven we hangen.
        if (res.imported === 0 && res.failed.length === 0) break;
      }

      setFailures(allFailures);
      const ok = done - allFailures.length;
      if (ok > 0) {
        toast.success(`${ok} bestand${ok === 1 ? "" : "en"} geïmporteerd uit "${info.folderName}"`);
      }
      if (allFailures.length > 0) {
        toast.error(`${allFailures.length} bestand(en) lukten niet — zie de lijst hieronder`);
      }
      qc.invalidateQueries({ queryKey: ["admin-media"] });
      qc.invalidateQueries({ queryKey: ["uploads-client", clientId] });
      qc.invalidateQueries({ queryKey: ["delivery-overview", clientId] });
      onImported?.();
      setInfo(null);
      setUrl("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Importeren mislukt");
    } finally {
      setProgress(null);
    }
  }

  const busy = checking || progress !== null;

  return (
    <div className="card-surface bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <FolderSymlink className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg">Importeer uit Google Drive</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Deel een map op &quot;Iedereen met de link&quot; en plak hem hier. Wij halen alles op,
            ook uit submappen, in originele kwaliteit.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) void check();
          }}
          placeholder="https://drive.google.com/drive/folders/..."
          disabled={busy}
          className="min-h-11 flex-1 rounded-lg bg-input/60 hairline px-4 text-sm"
        />
        <button
          type="button"
          onClick={() => void check()}
          disabled={busy || !url.trim()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gold/30 px-4 text-sm text-gold hover:bg-gold/10 disabled:opacity-50"
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Map bekijken
        </button>
      </div>

      {info && (
        <div className="mt-4 rounded-lg border border-gold/15 bg-background/40 p-3.5">
          <p className="text-sm">
            <b>{info.folderName}</b> — {info.mediaCount} bestand
            {info.mediaCount === 1 ? "" : "en"} met beeld of video
            {info.alreadyImported > 0 && `, waarvan ${info.alreadyImported} al binnen`}.
          </p>
          {info.toImport > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {info.toImport} nieuw, samen ongeveer {formatBytes(info.totalBytes)}.
              {info.skippedOther > 0 &&
                ` ${info.skippedOther} ander bestand${info.skippedOther === 1 ? "" : "en"} wordt overgeslagen.`}
            </p>
          ) : (
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-gold" /> Niets nieuws in deze map.
            </p>
          )}

          {info.sample.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {info.sample.map((f) => (
                <li key={`${f.path}/${f.name}`} className="truncate">
                  {f.path ? `${f.path}/` : ""}
                  {f.name}
                </li>
              ))}
              {info.toImport > info.sample.length && (
                <li>en nog {info.toImport - info.sample.length}…</li>
              )}
            </ul>
          )}

          {info.truncated && (
            <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-amber-500">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Deze map bevat meer dan we in één keer ophalen. Importeer nogmaals voor de rest.
            </p>
          )}
          {info.skippedFolders.length > 0 && (
            <p className="mt-2 text-xs text-amber-500">
              Niet kunnen openen: {info.skippedFolders.join(", ")}
            </p>
          )}

          {info.toImport > 0 && (
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={busy}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {progress
                ? `Bezig… ${progress.done} van ${progress.total}`
                : `Alles importeren (${info.toImport})`}
            </button>
          )}

          {progress && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-gold transition-[width] duration-300",
                )}
                style={{
                  width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {failures.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-red-400">
          {failures.slice(0, 10).map((f) => (
            <li key={f.name}>
              {f.name}: {f.reason}
            </li>
          ))}
          {failures.length > 10 && <li>en nog {failures.length - 10}…</li>}
        </ul>
      )}
    </div>
  );
}
