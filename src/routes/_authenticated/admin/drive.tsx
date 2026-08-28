import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  HardDrive,
  Search,
  Folder,
  FileImage,
  FileVideo,
  File as FileIcon,
  ArrowLeft,
  Loader2,
  Sparkles,
  CalendarCheck2,
  Unplug,
  CheckCircle2,
  X,
} from "lucide-react";
import { useClientStore } from "@/lib/stores/client-store";
import { todayLocalISO } from "@/lib/dates";
import { PLATFORMS } from "@/components/planner/planner-shared";
import {
  getDriveConnectionStatus,
  getDriveAuthorizeUrl,
  disconnectDriveConnection,
} from "@/lib/drive-connection.functions";
import {
  searchDriveShared,
  browseDriveFolder,
  type DriveBrowseItem,
} from "@/lib/drive-browse.functions";
import {
  generateDriveReleasePlan,
  commitDriveReleasePlan,
  type DriveReleaseItem,
} from "@/lib/drive-release-plan.functions";
import { DEFAULT_HOUR, type CampaignPlatform } from "@/lib/campaigns.functions";

const searchSchema = z.object({
  connected: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/admin/drive")({
  validateSearch: searchSchema,
  component: DrivePage,
});

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb < 1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`;
}

function iconFor(item: DriveBrowseItem) {
  if (item.isFolder) return Folder;
  if (item.mimeType.startsWith("image/")) return FileImage;
  if (item.mimeType.startsWith("video/")) return FileVideo;
  return FileIcon;
}

interface SelectedFile {
  id: string;
  name: string;
  mimeType: string;
}

function DrivePage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const { activeClient } = useClientStore();
  const clientId = activeClient?.id ?? null;

  useEffect(() => {
    if (search.connected) toast.success(`Drive gekoppeld: ${search.connected}`);
    if (search.error) toast.error(search.error);
    // Alleen bij binnenkomst tonen, niet bij elke re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusFn = useServerFn(getDriveConnectionStatus);
  const authorizeFn = useServerFn(getDriveAuthorizeUrl);
  const disconnectFn = useServerFn(disconnectDriveConnection);
  const searchFn = useServerFn(searchDriveShared);
  const browseFn = useServerFn(browseDriveFolder);
  const generatePlanFn = useServerFn(generateDriveReleasePlan);
  const commitPlanFn = useServerFn(commitDriveReleasePlan);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["drive-connection-status"],
    queryFn: () => statusFn(),
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { url } = await authorizeFn({
        data: { returnTo: "/admin/drive", origin: window.location.origin },
      });
      window.location.href = url;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Koppelen mislukt"),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drive-connection-status"] });
      toast.success("Drive-koppeling verbroken");
    },
  });

  // ── Bladeren + zoeken ────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const currentFolder = folderStack[folderStack.length - 1] ?? null;

  const { data: searchResult, isLoading: searchLoading } = useQuery({
    queryKey: ["drive-search", debouncedQuery],
    enabled: status?.connected === true && !currentFolder,
    queryFn: () => searchFn({ data: { query: debouncedQuery || undefined } }),
  });
  const { data: folderResult, isLoading: folderLoading } = useQuery({
    queryKey: ["drive-folder", currentFolder?.id],
    enabled: status?.connected === true && !!currentFolder,
    queryFn: () => browseFn({ data: { folderId: currentFolder!.id } }),
  });

  const items = currentFolder ? (folderResult?.items ?? []) : (searchResult?.items ?? []);
  const itemsLoading = currentFolder ? folderLoading : searchLoading;

  // ── Selectie (blijft staan over mappen/zoekopdrachten heen) ─────────────
  const [selected, setSelected] = useState<Map<string, SelectedFile>>(new Map());
  function toggleSelect(item: DriveBrowseItem) {
    setSelected((cur) => {
      const next = new Map(cur);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, { id: item.id, name: item.name, mimeType: item.mimeType });
      return next;
    });
  }
  const selectedList = useMemo(() => [...selected.values()], [selected]);

  // ── Releaseplanning genereren + akkoord ──────────────────────────────────
  const [planOpen, setPlanOpen] = useState(false);
  const [platforms, setPlatforms] = useState<CampaignPlatform[]>(["instagram"]);
  const [days, setDays] = useState(14);
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState(todayLocalISO());
  const [plan, setPlan] = useState<(DriveReleaseItem & { id: string })[]>([]);
  const [committing, setCommitting] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () =>
      generatePlanFn({
        data: {
          clientId: clientId!,
          files: selectedList,
          platforms,
          days,
          notes: notes || undefined,
        },
      }),
    onSuccess: (res) => {
      setPlan(res.items.map((it, i) => ({ ...it, id: `${i}-${it.driveFileId}` })));
      if (res.items.length === 0) toast.info("Geen releaseplanning gegenereerd, probeer opnieuw.");
      else toast.success(`${res.items.length} posts voorgesteld`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Genereren mislukt"),
  });

  function scheduledAtFor(item: DriveReleaseItem): string {
    const d = new Date(`${startDate}T00:00:00`);
    d.setDate(d.getDate() + item.dayOffset);
    d.setHours(DEFAULT_HOUR[item.platform] ?? 9, 0, 0, 0);
    return d.toISOString();
  }

  async function onCommitPlan() {
    if (!clientId || plan.length === 0) return;
    setCommitting(true);
    let remainingItems = plan.map((p) => ({
      scheduledAt: scheduledAtFor(p),
      platform: p.platform,
      caption: p.hashtags.length
        ? `${p.caption}\n\n${p.hashtags.map((h) => `#${h}`).join(" ")}`
        : p.caption,
      driveFileId: p.driveFileId,
      driveFileName: p.driveFileName,
    }));
    let totalCreated = 0;
    const allFailed: { name: string; reason: string }[] = [];
    try {
      while (remainingItems.length > 0) {
        const res = await commitPlanFn({ data: { clientId, items: remainingItems } });
        totalCreated += res.created;
        allFailed.push(...res.failed);
        remainingItems = remainingItems.slice(remainingItems.length - res.remaining);
      }
      toast.success(
        `${totalCreated} post${totalCreated === 1 ? "" : "s"} ingepland als concept` +
          (allFailed.length ? `, ${allFailed.length} mislukt` : ""),
      );
      if (allFailed.length) {
        allFailed.forEach((f) => toast.error(`${f.name}: ${f.reason}`));
      }
      setPlan([]);
      setSelected(new Map());
      setPlanOpen(false);
      navigate({ to: "/admin/queue" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Inplannen mislukt");
    } finally {
      setCommitting(false);
    }
  }

  function togglePlatform(p: CampaignPlatform) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!status?.configured) {
    return (
      <div className="max-w-2xl">
        <Header />
        <div className="card-surface bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET zijn nog niet ingesteld — zonder die
            omgevingsvariabelen kan er geen Drive-koppeling gemaakt worden.
          </p>
        </div>
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className="max-w-2xl">
        <Header />
        <div className="card-surface bg-card p-10 text-center space-y-4">
          <HardDrive className="h-8 w-8 text-gold mx-auto" />
          <div>
            <h2 className="font-display text-2xl">Nog geen Drive-koppeling</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Koppel elevate.plannen@gmail.com om te doorzoeken wat er met dat account gedeeld is.
            </p>
          </div>
          <button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-105 transition disabled:opacity-50"
          >
            {connectMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <HardDrive className="h-4 w-4" />
            )}
            Koppel Google Drive
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl pb-32">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Header />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          Gekoppeld als {status.accountEmail}
          <button
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 hover:border-red-400/50 hover:text-red-400 transition"
          >
            <Unplug className="h-3 w-3" /> Ontkoppelen
          </button>
        </div>
      </div>

      {!clientId && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
          Kies eerst een actieve klant (⌘K of via Klanten) — geïmporteerde bestanden en de
          releaseplanning worden aan die klant gekoppeld.
        </div>
      )}

      {/* Zoeken / bladeren */}
      <div className="card-surface bg-card p-4">
        <div className="flex items-center gap-2">
          {currentFolder ? (
            <button
              onClick={() => setFolderStack((s) => s.slice(0, -1))}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Terug
            </button>
          ) : (
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          {currentFolder ? (
            <span className="text-sm font-medium truncate">{currentFolder.name}</span>
          ) : (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoek op bestands- of mapnaam…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          )}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {itemsLoading ? (
            <div className="col-span-full flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
            </div>
          ) : items.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              {currentFolder
                ? "Deze map is leeg."
                : query
                  ? "Niets gevonden met die zoekterm."
                  : "Niets gedeeld met dit account, of nog niet zichtbaar."}
            </p>
          ) : (
            items.map((item) => {
              const Icon = iconFor(item);
              const isSelected = selected.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    item.isFolder
                      ? setFolderStack((s) => [...s, { id: item.id, name: item.name }])
                      : item.isMedia
                        ? toggleSelect(item)
                        : undefined
                  }
                  disabled={!item.isFolder && !item.isMedia}
                  className={
                    "flex items-center gap-2.5 rounded-lg border p-3 text-left transition " +
                    (isSelected
                      ? "border-gold bg-gold/10"
                      : "border-border/40 bg-surface/30 hover:border-gold/25") +
                    (!item.isFolder && !item.isMedia ? " opacity-50 cursor-default" : "")
                  }
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background/60">
                    <Icon className="h-4 w-4 text-gold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{item.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {item.isFolder
                        ? "Map"
                        : [item.ownerName, formatBytes(item.size)].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {!item.isFolder && item.isMedia && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="h-4 w-4 shrink-0 accent-[var(--gold)]"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Voorgestelde releaseplanning */}
      {plan.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 bg-luxe/80 backdrop-blur py-2">
            <div className="text-sm text-muted-foreground">
              {plan.length} post{plan.length === 1 ? "" : "s"} voorgesteld · {activeClient?.name}
            </div>
            <button
              onClick={onCommitPlan}
              disabled={committing}
              className="h-10 px-4 rounded-lg bg-gold text-primary-foreground text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
            >
              {committing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarCheck2 className="h-4 w-4" />
              )}
              Akkoord — uploaden & inplannen
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {plan.map((p) => {
              const meta = PLATFORMS.find((x) => x.id === p.platform);
              const Icon = meta?.Icon ?? Sparkles;
              const date = new Date(`${startDate}T00:00:00`);
              date.setDate(date.getDate() + p.dayOffset);
              return (
                <div key={p.id} className="card-surface bg-card p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="inline-flex items-center gap-2 text-sm">
                      <Icon className="h-4 w-4 text-gold" />
                      <span className="font-medium">{meta?.label ?? p.platform}</span>
                      <span className="text-muted-foreground">
                        · {format(date, "EEE d MMM", { locale: nl })}
                      </span>
                    </div>
                    <button
                      onClick={() => setPlan((cur) => cur.filter((x) => x.id !== p.id))}
                      className="p-1 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                      title="Verwijderen uit planning"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                    {p.driveFileName}
                  </div>
                  <textarea
                    value={p.caption}
                    onChange={(e) =>
                      setPlan((cur) =>
                        cur.map((x) => (x.id === p.id ? { ...x, caption: e.target.value } : x)),
                      )
                    }
                    rows={3}
                    className="w-full rounded-lg border border-gold/10 bg-background/50 px-3 py-2 text-sm resize-y"
                  />
                  {p.hashtags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.hashtags.map((h) => (
                        <span
                          key={h}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-gold/10 text-gold"
                        >
                          #{h}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selectiebalk onderaan */}
      {selectedList.length > 0 && plan.length === 0 && (
        <div className="fixed bottom-[calc(60px+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 z-20 border-t border-gold/15 bg-card/95 backdrop-blur px-4 py-3 md:pl-72">
          {!planOpen ? (
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <b>{selectedList.length}</b> bestand{selectedList.length === 1 ? "" : "en"}{" "}
                geselecteerd
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelected(new Map())}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Wissen
                </button>
                <button
                  onClick={() => setPlanOpen(true)}
                  disabled={!clientId}
                  className="h-10 px-4 rounded-lg bg-gradient-gold text-primary-foreground text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  Genereer releaseplanning met AI
                </button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-6xl grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
              <div className="lg:col-span-2">
                <label className="text-xs text-muted-foreground">Platforms</label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {PLATFORMS.map(({ id, label, Icon }) => {
                    const active = platforms.includes(id as CampaignPlatform);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => togglePlatform(id as CampaignPlatform)}
                        className={
                          "inline-flex items-center gap-1 h-7 px-2.5 text-[11px] rounded-full border transition " +
                          (active
                            ? "border-gold bg-gold/15 text-foreground"
                            : "border-gold/20 bg-card text-muted-foreground hover:bg-gold/10")
                        }
                      >
                        <Icon className={"h-3 w-3 " + (active ? "text-gold" : "")} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Periode</label>
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gold/15 bg-background/60 px-2 h-9 text-sm"
                >
                  <option value={7}>7 dagen</option>
                  <option value={14}>14 dagen</option>
                  <option value={30}>30 dagen</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPlanOpen(false)}
                  className="h-9 px-3 rounded-lg border border-border/60 text-sm text-muted-foreground"
                >
                  Annuleren
                </button>
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending || platforms.length === 0 || !clientId}
                  className="h-9 flex-1 px-3 rounded-lg bg-gradient-gold text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Genereer
                </button>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="text-xs text-muted-foreground">Aanwijzingen (optioneel)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="bv. campagnethema, toon, welke bestanden bij elkaar horen…"
                  className="mt-1 w-full rounded-lg border border-gold/15 bg-background/60 px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.25em] text-gold/70">Media</p>
      <h1 className="font-display text-3xl sm:text-4xl mt-1 inline-flex items-center gap-2">
        <HardDrive className="h-7 w-7 text-gold" />
        Drive
      </h1>
      <p className="text-sm text-muted-foreground mt-1 max-w-xl">
        Doorzoek wat er met elevate.plannen@gmail.com gedeeld is, selecteer bestanden en laat AI er
        een releaseplanning van maken.
      </p>
    </div>
  );
}
