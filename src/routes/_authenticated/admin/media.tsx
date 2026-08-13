import { createFileRoute } from "@tanstack/react-router";
import { PageTabs } from "@/components/page-tabs";
import { CONTENT_TABS } from "@/lib/page-tabs";
import { confirmDialog } from "@/components/ui/confirm";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import {
  Trash2,
  Download,
  Search as SearchIcon,
  Image as ImageIcon,
  Video,
  FileText,
  Loader2,
  FolderPlus,
  Folder,
  ChevronLeft,
  Pencil,
  FolderInput,
  Upload,
  Link2,
  Check,
  X as XIcon,
  Clock,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Archive,
  ImageOff,
  CheckSquare,
  Square,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { importMediaFromUrl } from "@/lib/media-import.functions";
import { DriveImportCard } from "@/components/drive-import-card";
import { getStorageUsage, purgePostedMedia, type StorageUsage } from "@/lib/storage.functions";
import { EmptyState } from "@/components/empty-state";
import { MAX_UPLOAD_BYTES, tooLargeMessage } from "@/lib/upload-limits";
import { useSignedUrls } from "@/lib/use-signed-url";

export const Route = createFileRoute("/_authenticated/admin/media")({
  component: MediaLibrary,
});

// Supabase Free = 1 GB; upgrade naar Pro = 100 GB — pas deze waarde aan je plan aan.
const STORAGE_LIMIT_GB = 1;

// Bytes → leesbaar (GB/MB). Gebruikt 1024-basis (binair), zoals opslagplannen.
function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) {
    return `${mb.toLocaleString("nl-NL", { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} GB`;
}

type MediaFolder = Tables<"media_folders">;
type UploadWithClient = Tables<"uploads"> & {
  clients: Pick<Tables<"clients">, "name"> | null;
};

function MediaLibrary() {
  const qc = useQueryClient();
  const importFromUrl = useServerFn(importMediaFromUrl);
  const storageUsage = useServerFn(getStorageUsage);
  const purgeMedia = useServerFn(purgePostedMedia);
  const [clientId, setClientId] = useState<string>("");
  const [folderId, setFolderId] = useState<string | null>(null); // null = root van klant
  const [q, setQ] = useState("");
  // Zoeken debouncen: zonder dit filtert én rerendert de hele grid (max 500
  // tegels) bij élke toetsaanslag.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 200);
    return () => clearTimeout(t);
  }, [q]);
  const [filter, setFilter] = useState<"all" | "image" | "video" | "other">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [dragActive, setDragActive] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(true);
  // Selectie voor bulk-acties (opruimen na publicatie).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    setFolderId(null);
    setSelectedIds(new Set());
  }, [clientId]);

  const { data: storage, isLoading: storageLoading } = useQuery({
    queryKey: ["storage-usage"],
    queryFn: () => storageUsage(),
    meta: { silent: true },
  });

  const { data: clients } = useQuery({
    queryKey: ["admin-clients-list"],
    // Klantenlijst wijzigt zelden — langer cachen scheelt herhaalde queries.
    staleTime: 10 * 60_000,
    queryFn: async () =>
      (await supabase.from("clients").select("id,name").order("name")).data ?? [],
  });

  const { data: folders } = useQuery({
    queryKey: ["media-folders", clientId],
    enabled: !!clientId,
    queryFn: async () =>
      (await supabase.from("media_folders").select("*").eq("client_id", clientId).order("name"))
        .data ?? [],
  });

  const { data: uploads, isLoading } = useQuery({
    queryKey: ["admin-media", clientId, folderId],
    queryFn: async () => {
      let query = supabase
        .from("uploads")
        .select("*, clients(name)")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(500);
      if (clientId) query = query.eq("client_id", clientId);
      if (clientId) {
        query = folderId ? query.eq("folder_id", folderId) : query.is("folder_id", null);
      }
      const { data } = await query;
      return data ?? [];
    },
  });

  // Klant-uploads die nog wachten op goedkeuring — over alle klanten heen zichtbaar,
  // ongeacht het actieve klant-/mapfilter, zodat de admin niets mist.
  const { data: pendingUploads } = useQuery({
    queryKey: ["admin-media-pending"],
    queryFn: async () =>
      (
        await supabase
          .from("uploads")
          .select("*, clients(name)")
          .eq("status", "pending")
          .order("created_at", { ascending: true })
      ).data ?? [],
  });
  const pendingCount = pendingUploads?.length ?? 0;

  const currentFolder = folders?.find((f: MediaFolder) => f.id === folderId);

  // Gememoïseerd: dit draaide eerder over max. 500 rijen bij élke toetsaanslag
  // in het zoekveld, en rerenderde daarmee ook alle tegels.
  const filtered = useMemo(() => {
    const needle = debouncedQ.toLowerCase();
    return (uploads ?? []).filter((u: UploadWithClient) => {
      if (needle && !u.file_name?.toLowerCase().includes(needle)) return false;
      if (filter === "image") return u.file_type?.startsWith("image/");
      if (filter === "video") return u.file_type?.startsWith("video/");
      if (filter === "other")
        return !u.file_type?.startsWith("image/") && !u.file_type?.startsWith("video/");
      return true;
    });
  }, [uploads, debouncedQ, filter]);

  const gridUrls = useSignedUrls(
    filtered.filter((u: UploadWithClient) => !u.media_purged_at).map((u) => u.file_path),
  );
  const pendingUrls = useSignedUrls((pendingUploads ?? []).map((u) => u.file_path));

  async function createFolder() {
    if (!clientId) return toast.error("Kies eerst een klant");
    const name = prompt("Naam van de nieuwe map");
    if (!name?.trim()) return;
    const { error } = await supabase
      .from("media_folders")
      .insert({ client_id: clientId, name: name.trim() });
    if (error) return toast.error(error.message);
    toast.success("Map aangemaakt");
    qc.invalidateQueries({ queryKey: ["media-folders", clientId] });
  }

  async function renameFolder(f: MediaFolder) {
    const name = prompt("Nieuwe naam", f.name);
    if (!name?.trim() || name === f.name) return;
    const { error } = await supabase
      .from("media_folders")
      .update({ name: name.trim() })
      .eq("id", f.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["media-folders", clientId] });
  }

  async function deleteFolder(f: MediaFolder) {
    if (
      !(await confirmDialog(
        `Map "${f.name}" verwijderen? Bestanden blijven bewaard en gaan terug naar de hoofdmap.`,
      ))
    )
      return;
    const { error } = await supabase.from("media_folders").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    if (folderId === f.id) setFolderId(null);
    toast.success("Map verwijderd");
    qc.invalidateQueries({ queryKey: ["media-folders", clientId] });
    qc.invalidateQueries({ queryKey: ["admin-media"] });
  }

  async function moveUpload(u: UploadWithClient) {
    if (!folders || folders.length === 0) return toast.error("Maak eerst een map aan");
    const options = ["(hoofdmap)", ...folders.map((f: MediaFolder) => f.name)]
      .map((n, i) => `${i}: ${n}`)
      .join("\n");
    const choice = prompt(`Verplaats naar welke map?\n\n${options}\n\nTyp het nummer:`);
    if (choice === null) return;
    const idx = parseInt(choice, 10);
    if (isNaN(idx) || idx < 0 || idx > folders.length) return;
    const target = idx === 0 ? null : folders[idx - 1].id;
    const { error } = await supabase.from("uploads").update({ folder_id: target }).eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success("Verplaatst");
    qc.invalidateQueries({ queryKey: ["admin-media"] });
  }

  async function remove(u: UploadWithClient) {
    if (!(await confirmDialog(`"${u.file_name}" definitief verwijderen?`))) return;
    const { error: storageError } = await supabase.storage
      .from("client-uploads")
      .remove([u.file_path]);
    if (storageError) return toast.error(storageError.message);
    const { error } = await supabase.from("uploads").delete().eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success("Verwijderd");
    qc.invalidateQueries({ queryKey: ["admin-media"] });
    qc.invalidateQueries({ queryKey: ["storage-usage"] });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function purgeSelected() {
    // Alleen nog-niet-opgeruimde items daadwerkelijk aanbieden aan de server.
    const ids = Array.from(selectedIds).filter((id) => {
      const u = (uploads ?? []).find((x: UploadWithClient) => x.id === id);
      return u && !u.media_purged_at;
    });
    if (ids.length === 0) {
      return toast.error("Geen op te ruimen bestanden geselecteerd");
    }
    const ok = await confirmDialog({
      title: "Bestanden opruimen?",
      description:
        "Dit verwijdert het mediabestand uit de opslag om ruimte vrij te maken. De registratie blijft bewaard, zodat je ziet dat het al gepubliceerd is. Alleen al gepubliceerde media wordt opgeruimd.",
      confirmLabel: "Opruimen",
      destructive: true,
    });
    if (!ok) return;
    setPurging(true);
    try {
      const res = await purgeMedia({ data: { uploadIds: ids } });
      toast.success(`${res.purged} opgeruimd, ${res.skipped} overgeslagen (nog niet gepubliceerd)`);
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["admin-media"] });
      qc.invalidateQueries({ queryKey: ["storage-usage"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Opruimen mislukt");
    } finally {
      setPurging(false);
    }
  }

  async function approveUpload(u: UploadWithClient) {
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("uploads")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: authData.user?.id ?? null,
      })
      .eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success("Goedgekeurd");
    qc.invalidateQueries({ queryKey: ["admin-media-pending"] });
    qc.invalidateQueries({ queryKey: ["admin-media"] });
  }

  async function rejectUpload(u: UploadWithClient) {
    if (!(await confirmDialog(`"${u.file_name}" afwijzen en verwijderen?`))) return;
    const { error: storageError } = await supabase.storage
      .from("client-uploads")
      .remove([u.file_path]);
    if (storageError) return toast.error(storageError.message);
    const { error } = await supabase.from("uploads").delete().eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success("Afgewezen");
    qc.invalidateQueries({ queryKey: ["admin-media-pending"] });
  }

  async function uploadFiles(files: File[]) {
    if (!clientId) return toast.error("Kies eerst een klant");
    if (files.length === 0) return;
    // Bestanden groter dan de per-bestand limiet overslaan (geen compressie —
    // originelen blijven vol kwaliteit).
    const uploadable = files.filter((file) => {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(tooLargeMessage(file.name));
        return false;
      }
      return true;
    });
    if (uploadable.length === 0) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: uploadable.length });
    const { data: u } = await supabase.auth.getUser();
    let successCount = 0;
    for (const file of uploadable) {
      const safeName = file.name.replace(/[\\/]/g, "_");
      const path = `${clientId}/${folderId ? `${folderId}/` : ""}${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("client-uploads")
        .upload(path, file);
      if (uploadError) {
        toast.error(`${file.name}: ${uploadError.message}`);
      } else {
        const { error: insertError } = await supabase.from("uploads").insert({
          client_id: clientId,
          file_path: path,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          folder_id: folderId,
          uploader_id: u.user?.id ?? null,
          status: "approved",
        });
        if (insertError) {
          toast.error(`${file.name}: ${insertError.message}`);
          await supabase.storage.from("client-uploads").remove([path]);
        } else {
          successCount++;
        }
      }
      setUploadProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
    }
    setUploading(false);
    setUploadProgress(null);
    if (successCount > 0) {
      toast.success(`${successCount} bestand${successCount === 1 ? "" : "en"} geüpload`);
    }
    qc.invalidateQueries({ queryKey: ["admin-media"] });
    qc.invalidateQueries({ queryKey: ["storage-usage"] });
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // reset zodat dezelfde bestanden opnieuw gekozen kunnen worden
    void uploadFiles(files);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (!clientId) return toast.error("Kies eerst een klant om te uploaden");
    const files = Array.from(e.dataTransfer.files ?? []);
    void uploadFiles(files);
  }

  async function handleImport() {
    if (!clientId) return toast.error("Kies eerst een klant");
    const url = importUrl.trim();
    if (!url) return toast.error("Vul een URL in");
    setImporting(true);
    try {
      const res = await importFromUrl({ data: { clientId, url, folderId } });
      toast.success(`"${res.fileName}" geïmporteerd`);
      setImportOpen(false);
      setImportUrl("");
      qc.invalidateQueries({ queryKey: ["admin-media"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Importeren mislukt");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageTabs tabs={CONTENT_TABS} />
      <div className="aurora">
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Bibliotheek</p>
        <h1 className="font-display text-4xl sm:text-5xl mt-2">Media</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Alle beelden, video's en bestanden van klanten op één plek. Maak per bedrijf
          overzichtelijk mappen aan.
        </p>
      </div>

      <StorageCard storage={storage} isLoading={storageLoading} />

      {pendingCount > 0 && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5">
          <button
            onClick={() => setPendingOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 p-4"
          >
            <div className="flex items-center gap-2 text-amber-300">
              <Clock className="h-4 w-4" />
              <span className="font-medium text-sm">Wacht op goedkeuring</span>
              <span className="rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-[11px] px-2 py-0.5 font-semibold">
                {pendingCount}
              </span>
            </div>
            {pendingOpen ? (
              <ChevronUp className="h-4 w-4 text-amber-300" />
            ) : (
              <ChevronDown className="h-4 w-4 text-amber-300" />
            )}
          </button>
          {pendingOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 px-4 pb-4">
              {pendingUploads?.map((u) => (
                <PendingTile
                  key={u.id}
                  u={u}
                  url={pendingUrls.get(u.file_path) ?? ""}
                  onApprove={() => approveUpload(u)}
                  onReject={() => rejectUpload(u)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek bestandsnaam…"
            className="rounded-lg bg-input/60 hairline pl-9 pr-3 py-2 text-sm w-64"
          />
        </div>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="rounded-lg bg-input/60 hairline px-3 py-2 text-sm"
        >
          <option value="">Alle klanten</option>
          {clients?.map((c: Pick<Tables<"clients">, "id" | "name">) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex rounded-lg hairline overflow-hidden text-sm">
          {(["all", "image", "video", "other"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 ${filter === f ? "bg-gold/20 text-gold" : "bg-input/40 hover:bg-accent/40"}`}
            >
              {f === "all" ? "Alles" : f === "image" ? "Beeld" : f === "video" ? "Video" : "Overig"}
            </button>
          ))}
        </div>
        {clientId && (
          <button
            onClick={createFolder}
            className="flex items-center gap-1.5 rounded-lg bg-gold/15 text-gold hairline px-3 py-2 text-sm hover:bg-gold/25"
          >
            <FolderPlus className="h-4 w-4" /> Nieuwe map
          </button>
        )}
        {clientId && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-gold text-black font-medium px-3 py-2 text-sm hover:opacity-90 disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload bestanden
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-input/60 hairline px-3 py-2 text-sm hover:bg-accent/40"
            >
              <Link2 className="h-4 w-4" /> Importeer uit Google Drive
            </button>
          </>
        )}
        {uploadProgress && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />
            {uploadProgress.done}/{uploadProgress.total} geüpload…
          </div>
        )}
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} items</div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gold/10 bg-card p-3">
          <span className="text-sm text-muted-foreground">{selectedIds.size} geselecteerd</span>
          <button
            onClick={purgeSelected}
            disabled={purging}
            className="flex items-center gap-1.5 rounded-lg bg-gold/15 text-gold hairline px-3 py-2 text-sm hover:bg-gold/25 disabled:opacity-60"
          >
            {purging ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            Bestanden opruimen (na publicatie)
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="rounded-lg bg-input/60 hairline px-3 py-2 text-sm hover:bg-accent/40"
          >
            Deselecteer
          </button>
        </div>
      )}

      <div
        onDragOver={(e) => {
          if (!clientId) return;
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`space-y-6 rounded-2xl transition ${
          dragActive ? "ring-2 ring-gold bg-gold/5" : ""
        }`}
      >
        {clientId && (
          <div className="space-y-3">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setFolderId(null)}
                className={`flex items-center gap-1 ${folderId ? "text-muted-foreground hover:text-foreground" : "text-gold"}`}
              >
                {folderId && <ChevronLeft className="h-4 w-4" />}
                <Folder className="h-4 w-4" /> Hoofdmap
              </button>
              {currentFolder && (
                <span className="text-muted-foreground">
                  / <span className="text-foreground">{currentFolder.name}</span>
                </span>
              )}
            </div>

            {/* Folders grid - alleen tonen in hoofdmap */}
            {!folderId && folders && folders.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {folders.map((f: MediaFolder) => (
                  <div key={f.id} className="group relative">
                    <button
                      onClick={() => setFolderId(f.id)}
                      className="w-full flex items-center gap-2 rounded-xl glass hairline p-3 hover:bg-accent/40 text-left"
                    >
                      <Folder className="h-5 w-5 text-gold shrink-0" />
                      <span className="text-sm truncate">{f.name}</span>
                    </button>
                    <div className="absolute right-1 top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => renameFolder(f)}
                        className="rounded-md bg-background/80 p-1 hover:bg-accent"
                        title="Hernoemen"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => deleteFolder(f)}
                        className="rounded-md bg-destructive/80 p-1 text-white hover:bg-destructive"
                        title="Verwijderen"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className="aspect-square w-full rounded-xl bg-muted-foreground/10 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ImageOff className="h-5 w-5" />}
            title={
              clientId ? (folderId ? "Deze map is leeg" : "Geen losse bestanden") : "Nog geen media"
            }
            description={
              clientId
                ? folderId
                  ? "Upload of importeer bestanden om ze hier te tonen."
                  : "Kies of maak een map, of upload bestanden in de hoofdmap."
                : "Kies een klant of upload media om je bibliotheek te vullen."
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map((u: UploadWithClient) => (
              <Tile
                key={u.id}
                u={u}
                url={gridUrls.get(u.file_path) ?? ""}
                selected={selectedIds.has(u.id)}
                onToggleSelect={() => toggleSelect(u.id)}
                onDelete={() => remove(u)}
                onMove={clientId ? () => moveUpload(u) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-gold">Media importeren</DialogTitle>
            <DialogDescription>
              Plak een Drive-map en we halen alles op, ook uit submappen. Zorg dat de map op
              &quot;Iedereen met de link&quot; staat.
            </DialogDescription>
          </DialogHeader>

          {clientId && (
            <DriveImportCard
              clientId={clientId}
              folderId={folderId}
              onImported={() => setImportOpen(false)}
            />
          )}

          {/* Losse link van buiten Drive (bv. WeTransfer, eigen server). */}
          <div className="rounded-xl border border-gold/10 bg-card p-4">
            <h3 className="font-display text-lg">Andere directe link</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Eén bestand van een andere plek — de URL moet direct naar het bestand wijzen.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://…/foto.jpg"
                className="min-h-11 flex-1 rounded-lg bg-input/60 hairline px-4 text-sm"
                disabled={importing}
              />
              <button
                onClick={handleImport}
                disabled={importing || !importUrl.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-gradient-gold text-black font-medium px-4 text-sm hover:opacity-90 disabled:opacity-60"
              >
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Importeren
              </button>
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => setImportOpen(false)}
              disabled={importing}
              className="rounded-lg bg-input/60 hairline px-4 py-2 text-sm hover:bg-accent/40 disabled:opacity-60"
            >
              Sluiten
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StorageCard({
  storage,
  isLoading,
}: {
  storage: StorageUsage | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !storage) {
    return (
      <div className="rounded-xl border border-gold/10 bg-card p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-24 rounded bg-muted-foreground/15" />
          <div className="h-8 w-40 rounded bg-muted-foreground/15" />
          <div className="h-2.5 w-full rounded-full bg-muted-foreground/10" />
          <div className="h-3 w-56 rounded bg-muted-foreground/15" />
        </div>
      </div>
    );
  }

  const limitBytes = STORAGE_LIMIT_GB * 1024 * 1024 * 1024;
  const usedGb = storage.totalBytes / (1024 * 1024 * 1024);
  const pct = limitBytes > 0 ? Math.min(100, (storage.totalBytes / limitBytes) * 100) : 0;
  const barColor = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-gradient-gold";
  const topClients = storage.perClient.slice(0, 5);

  return (
    <div className="rounded-xl border border-gold/10 bg-card p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-gold/80">
        <HardDrive className="h-3.5 w-3.5" />
        Opslag
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="font-display text-4xl leading-none">
            {storage.totalBytes === 0 ? "0 MB" : formatBytes(storage.totalBytes)}
          </div>
          <div className="mt-1.5 text-sm text-muted-foreground">
            {storage.totalBytes === 0
              ? "nog geen media"
              : `${storage.fileCount.toLocaleString("nl-NL")} bestand${
                  storage.fileCount === 1 ? "" : "en"
                }`}
          </div>

          <div className="mt-4">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted-foreground/10">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {usedGb.toLocaleString("nl-NL", { maximumFractionDigits: 2 })} GB van{" "}
                {STORAGE_LIMIT_GB} GB
              </span>
              <span className={pct > 90 ? "text-red-500" : pct > 70 ? "text-amber-500" : ""}>
                {pct.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}%
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Per klant</div>
          {topClients.length === 0 ? (
            <div className="mt-2 text-sm text-muted-foreground">Nog geen media.</div>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {topClients.map((c) => (
                <li key={c.clientId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{c.clientName}</span>
                  <span className="shrink-0 text-muted-foreground">{formatBytes(c.bytes)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Bestanden worden 30 dagen na publicatie automatisch opgeruimd; de registratie blijft
        bewaard.
      </p>
    </div>
  );
}

const Tile = memo(function Tile({
  u,
  url,
  selected,
  onToggleSelect,
  onDelete,
  onMove,
}: {
  u: UploadWithClient;
  /** Komt uit één gebundelde signed-URL-aanroep voor de hele grid. */
  url: string;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onMove?: () => void;
}) {
  const isPurged = !!u.media_purged_at;
  const isImage = u.file_type?.startsWith("image/");
  const isVideo = u.file_type?.startsWith("video/");

  if (isPurged) {
    return (
      <div className="group relative aspect-square overflow-hidden rounded-xl glass bg-card">
        <button
          onClick={onToggleSelect}
          className="absolute left-2 top-2 z-10 rounded-md bg-background/80 p-0.5 text-gold hover:bg-background"
          title={selected ? "Deselecteer" : "Selecteer"}
        >
          {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </button>
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted-foreground/10">
            {isImage || isVideo ? (
              <ImageOff className="h-6 w-6 text-muted-foreground" />
            ) : (
              <Archive className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold">
            <Archive className="h-3 w-3" /> Opgeruimd
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
          {u.file_name && <div className="text-[11px] text-white/90 truncate">{u.file_name}</div>}
          {u.media_purged_at && (
            <div className="text-[10px] text-white/60">
              Opgeruimd op {new Date(u.media_purged_at).toLocaleDateString("nl-NL")}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative aspect-square overflow-hidden rounded-xl glass ${
        selected ? "ring-2 ring-gold" : ""
      }`}
    >
      {url && isImage && (
        <img
          src={url}
          loading="lazy"
          alt={u.file_name}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
      )}
      {url && isVideo && <video src={url} className="h-full w-full object-cover" />}
      {!isImage && !isVideo && (
        <div className="flex h-full w-full items-center justify-center">
          <FileText className="h-10 w-10 text-muted-foreground" />
        </div>
      )}
      <button
        onClick={onToggleSelect}
        className={`absolute left-2 top-2 z-10 rounded-md bg-black/60 p-0.5 text-white transition hover:bg-black/80 ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        title={selected ? "Deselecteer" : "Selecteer"}
      >
        {selected ? <CheckSquare className="h-4 w-4 text-gold" /> : <Square className="h-4 w-4" />}
      </button>
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2 bg-gradient-to-b from-black/70 to-transparent">
        <span className="text-[10px] uppercase tracking-wider text-white/80 flex items-center gap-1 pl-6">
          {isImage ? (
            <ImageIcon className="h-3 w-3" />
          ) : isVideo ? (
            <Video className="h-3 w-3" />
          ) : (
            <FileText className="h-3 w-3" />
          )}
          {u.clients?.name ?? "—"}
        </span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          {onMove && (
            <button
              onClick={onMove}
              className="rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              title="Verplaats naar map"
            >
              <FolderInput className="h-3.5 w-3.5" />
            </button>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              title="Openen"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            onClick={onDelete}
            className="rounded-full bg-destructive/80 p-1.5 text-white hover:bg-destructive"
            title="Verwijderen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <div className="text-[11px] text-white/90 truncate">{u.file_name}</div>
        <div className="text-[10px] text-white/60">
          {new Date(u.created_at).toLocaleDateString("nl-NL")}
        </div>
      </div>
    </div>
  );
});

function PendingTile({
  u,
  url,
  onApprove,
  onReject,
}: {
  u: UploadWithClient;
  url: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isImage = u.file_type?.startsWith("image/");
  const isVideo = u.file_type?.startsWith("video/");
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl glass ring-1 ring-amber-400/30">
      {url && isImage && (
        <img
          src={url}
          loading="lazy"
          alt={u.file_name}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
      )}
      {url && isVideo && <video src={url} className="h-full w-full object-cover" />}
      {!isImage && !isVideo && (
        <div className="flex h-full w-full items-center justify-center">
          <FileText className="h-10 w-10 text-muted-foreground" />
        </div>
      )}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2 bg-gradient-to-b from-black/70 to-transparent">
        <span className="text-[10px] uppercase tracking-wider text-white/80 flex items-center gap-1">
          {isImage ? (
            <ImageIcon className="h-3 w-3" />
          ) : isVideo ? (
            <Video className="h-3 w-3" />
          ) : (
            <FileText className="h-3 w-3" />
          )}
          {u.clients?.name ?? "—"}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 space-y-1.5">
        <div className="text-[11px] text-white/90 truncate">{u.file_name}</div>
        <div className="flex gap-1.5">
          <button
            onClick={onApprove}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-emerald-500/90 text-white text-[11px] px-2 py-1 hover:bg-emerald-500"
            title="Goedkeuren"
          >
            <Check className="h-3 w-3" /> Goedkeuren
          </button>
          <button
            onClick={onReject}
            className="inline-flex items-center justify-center rounded-full bg-destructive/80 text-white p-1 hover:bg-destructive"
            title="Afwijzen"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
