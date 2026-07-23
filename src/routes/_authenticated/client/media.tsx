import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { EmptyState } from "@/components/empty-state";
import type { Tables } from "@/integrations/supabase/types";
import {
  Image as ImageIcon,
  Video,
  Download,
  Loader2,
  Sparkles,
  FileText,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/client/media")({
  component: ClientMedia,
});

type Kind = "image" | "video" | "other";
type Source = "upload" | "planner";

type MediaItem = {
  key: string;
  path: string;
  name: string;
  kind: Kind;
  createdAt: string;
  source: Source;
};

function guessKind(path: string, mime: string | null | undefined): Kind {
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("video/")) return "video";
  if (/\.(png|jpe?g|gif|webp|svg|heic)$/i.test(path)) return "image";
  if (/\.(mp4|mov|webm|m4v)$/i.test(path)) return "video";
  return "other";
}

function ClientMedia() {
  const { user } = useAuth();

  const { data: membership, isLoading: loadingMembership } = useQuery({
    queryKey: ["my-client", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_members")
        .select("client_id, clients(name)")
        .eq("user_id", user!.id)
        .order("client_id")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const clientId = (membership as { client_id?: string } | null)?.client_id;

  const { data: items, isLoading: loadingMedia } = useQuery({
    queryKey: ["client-media", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const [{ data: uploads }, { data: posts }] = await Promise.all([
        supabase
          .from("uploads")
          .select("id, file_path, file_name, file_type, created_at")
          .eq("client_id", clientId!)
          .eq("status", "approved")
          .order("created_at", { ascending: false }),
        supabase
          .from("scheduled_posts")
          .select("id, media_path, media_type, caption, created_at")
          .eq("client_id", clientId!)
          .not("media_path", "is", null)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
      ]);

      // Dedupliceren op storage-pad: uploads hebben voorrang boven planner-items.
      const byPath = new Map<string, MediaItem>();
      (uploads ?? []).forEach((u) => {
        byPath.set(u.file_path, {
          key: `upload-${u.id}`,
          path: u.file_path,
          name: u.file_name,
          kind: guessKind(u.file_path, u.file_type),
          createdAt: u.created_at,
          source: "upload",
        });
      });
      (posts ?? []).forEach((p) => {
        if (!p.media_path || byPath.has(p.media_path)) return;
        byPath.set(p.media_path, {
          key: `post-${p.id}`,
          path: p.media_path,
          name: p.caption?.slice(0, 60) || "Geplande post",
          kind: guessKind(p.media_path, p.media_type),
          createdAt: p.created_at,
          source: "planner",
        });
      });

      return [...byPath.values()].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },
  });

  const { data: pendingUploads } = useQuery({
    queryKey: ["client-media-pending", clientId],
    enabled: !!clientId,
    queryFn: async () =>
      (
        await supabase
          .from("uploads")
          .select("id, file_path, file_name, file_type, created_at")
          .eq("client_id", clientId!)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const filtered = useMemo(
    () => (items ?? []).filter((it) => filter === "all" || it.kind === filter),
    [items, filter],
  );

  if (loadingMembership || (clientId && loadingMedia)) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <ImageIcon className="h-8 w-8 text-gold mx-auto mb-3" />
        <h2 className="font-display text-2xl">Geen actieve klantkoppeling</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Zodra je gekoppeld bent aan een bedrijf verschijnt hier je mediabibliotheek.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Beeld & video</p>
        <h1 className="font-display text-4xl sm:text-5xl mt-2">Mediabibliotheek</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Al het beeldmateriaal van je merk op één plek — je eigen uploads en alles wat je team al
          voor je heeft ingepland.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "image", "video"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm inline-flex items-center gap-2 transition",
              filter === f
                ? "bg-gold/15 text-gold border-gold/40"
                : "border-border/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "all" ? "Alles" : f === "image" ? "Beelden" : "Video's"}
          </button>
        ))}
      </div>

      {pendingUploads && pendingUploads.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.22em] text-amber-300 inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> In behandeling ({pendingUploads.length})
          </div>
          <p className="text-xs text-muted-foreground">
            Deze uploads zijn ontvangen en wachten op goedkeuring door je Elevate-team voordat ze in
            de bibliotheek verschijnen.
          </p>
          <div className="media-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {pendingUploads.map((u) => (
              <PendingTile key={u.id} upload={u} />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-5 w-5" />}
          title="Nog geen media"
          description="Zodra er beeld of video voor je klaarstaat — via je eigen uploads of vanuit de planning — verschijnt het hier."
        />
      ) : (
        <div className="media-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((it) => (
            <Tile key={it.key} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({ item }: { item: MediaItem }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("client-uploads")
      .createSignedUrl(item.path, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl || "");
      });
    return () => {
      cancelled = true;
    };
  }, [item.path]);

  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-gold/10 bg-card">
      {url && item.kind === "image" && (
        <img
          src={url}
          alt={item.name}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
      )}
      {url && item.kind === "video" && (
        <video src={url} controls className="h-full w-full object-cover" />
      )}
      {url && item.kind === "other" && (
        <div className="flex h-full w-full items-center justify-center bg-surface-elevated/40">
          <FileText className="h-10 w-10 text-muted-foreground" />
        </div>
      )}
      {!url && (
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gold/60" />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-2 bg-gradient-to-b from-black/70 to-transparent">
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/90">
          {item.kind === "image" ? (
            <ImageIcon className="h-3 w-3" />
          ) : item.kind === "video" ? (
            <Video className="h-3 w-3" />
          ) : (
            <FileText className="h-3 w-3" />
          )}
        </span>
        {item.source === "planner" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 text-gold border border-gold/30 px-2 py-0.5 text-[10px]">
            <Sparkles className="h-3 w-3" /> Uit planner
          </span>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-2">
        <div className="min-w-0 text-[11px] text-white/90 truncate">{item.name}</div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title="Downloaden"
            className="shrink-0 grid min-h-11 min-w-11 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            <Download className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}

type PendingUpload = Pick<
  Tables<"uploads">,
  "id" | "file_path" | "file_name" | "file_type" | "created_at"
>;

function PendingTile({ upload }: { upload: PendingUpload }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("client-uploads")
      .createSignedUrl(upload.file_path, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl || "");
      });
    return () => {
      cancelled = true;
    };
  }, [upload.file_path]);
  const kind = guessKind(upload.file_path, upload.file_type);

  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-amber-400/30 bg-card opacity-80">
      {url && kind === "image" && (
        <img src={url} alt={upload.file_name} className="h-full w-full object-cover" />
      )}
      {url && kind === "video" && <video src={url} className="h-full w-full object-cover" />}
      {url && kind === "other" && (
        <div className="flex h-full w-full items-center justify-center bg-surface-elevated/40">
          <FileText className="h-10 w-10 text-muted-foreground" />
        </div>
      )}
      {!url && (
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gold/60" />
        </div>
      )}
      <div className="absolute inset-x-0 top-0 flex items-center p-2 bg-gradient-to-b from-black/70 to-transparent">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 text-[10px]">
          <Clock className="h-3 w-3" /> In behandeling
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <div className="min-w-0 text-[11px] text-white/90 truncate">{upload.file_name}</div>
      </div>
    </div>
  );
}
