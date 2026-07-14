import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/media")({
  component: MediaLibrary,
});

type MediaFolder = Tables<"media_folders">;
type UploadWithClient = Tables<"uploads"> & {
  clients: Pick<Tables<"clients">, "name"> | null;
};

function MediaLibrary() {
  const qc = useQueryClient();
  const [clientId, setClientId] = useState<string>("");
  const [folderId, setFolderId] = useState<string | null>(null); // null = root van klant
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "image" | "video" | "other">("all");

  useEffect(() => {
    setFolderId(null);
  }, [clientId]);

  const { data: clients } = useQuery({
    queryKey: ["admin-clients-list"],
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

  const currentFolder = folders?.find((f: MediaFolder) => f.id === folderId);

  const filtered = (uploads ?? []).filter((u: UploadWithClient) => {
    if (q && !u.file_name?.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "image") return u.file_type?.startsWith("image/");
    if (filter === "video") return u.file_type?.startsWith("video/");
    if (filter === "other")
      return !u.file_type?.startsWith("image/") && !u.file_type?.startsWith("video/");
    return true;
  });

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
      !confirm(
        `Map "${f.name}" verwijderen? Bestanden blijven bewaard en gaan terug naar de hoofdmap.`,
      )
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
    if (!confirm(`"${u.file_name}" definitief verwijderen?`)) return;
    await supabase.storage.from("client-uploads").remove([u.file_path]);
    const { error } = await supabase.from("uploads").delete().eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success("Verwijderd");
    qc.invalidateQueries({ queryKey: ["admin-media"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Bibliotheek</p>
        <h1 className="font-display text-5xl mt-2">Media</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Alle beelden, video's en bestanden van klanten op één plek. Maak per bedrijf
          overzichtelijk mappen aan.
        </p>
      </div>

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
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} items</div>
      </div>

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
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
          {clientId
            ? folderId
              ? "Deze map is leeg"
              : "Geen losse bestanden — kies of maak een map"
            : "Geen media gevonden"}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((u: UploadWithClient) => (
            <Tile
              key={u.id}
              u={u}
              onDelete={() => remove(u)}
              onMove={clientId ? () => moveUpload(u) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({
  u,
  onDelete,
  onMove,
}: {
  u: UploadWithClient;
  onDelete: () => void;
  onMove?: () => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    supabase.storage
      .from("client-uploads")
      .createSignedUrl(u.file_path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl || ""));
  }, [u.file_path]);
  const isImage = u.file_type?.startsWith("image/");
  const isVideo = u.file_type?.startsWith("video/");
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl glass">
      {url && isImage && (
        <img
          src={url}
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
}
