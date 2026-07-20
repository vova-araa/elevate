import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Loader2,
  Send,
  Save,
  Image as ImageIcon,
  X,
  Heart,
  MessageCircle,
  Repeat2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClientStore } from "@/lib/stores/client-store";
import { publishScheduledPost } from "@/lib/publish.functions";
import type { Platform } from "@/components/planner/planner-shared";
import type { TablesInsert } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type PostType = { id: string; label: string };

const PLATFORMS: { id: string; label: string; limit: number; types: PostType[] }[] = [
  {
    id: "instagram",
    label: "Instagram",
    limit: 2200,
    types: [
      { id: "feed", label: "Feed" },
      { id: "reel", label: "Reel" },
      { id: "story", label: "Story" },
    ],
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    limit: 3000,
    types: [
      { id: "post", label: "Post" },
      { id: "article", label: "Artikel" },
    ],
  },
  {
    id: "tiktok",
    label: "TikTok",
    limit: 300,
    types: [
      { id: "video", label: "Video" },
      { id: "photo", label: "Foto" },
    ],
  },
  {
    id: "facebook",
    label: "Facebook",
    limit: 1500,
    types: [
      { id: "post", label: "Post" },
      { id: "reel", label: "Reel" },
      { id: "story", label: "Story" },
    ],
  },
  {
    id: "youtube",
    label: "YouTube",
    limit: 1000,
    types: [
      { id: "short", label: "Short" },
      { id: "video", label: "Video" },
    ],
  },
];

const searchSchema = z.object({ at: z.string().optional() });

export const Route = createFileRoute("/_authenticated/admin/compose")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ComposePage,
});

function ComposePage() {
  const search = useSearch({ from: "/_authenticated/admin/compose" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeClient } = useClientStore();

  const [content, setContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram"]);
  const [postTypes, setPostTypes] = useState<Record<string, string>>({ instagram: "feed" });
  const [mode, setMode] = useState<"schedule" | "now" | "draft">("schedule");
  const [scheduleAt, setScheduleAt] = useState<string>(
    search.at ?? new Date(Date.now() + 60 * 60000).toISOString().slice(0, 16),
  );
  const [mediaPath, setMediaPath] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState<string>("instagram");

  useEffect(() => {
    const raw = sessionStorage.getItem("compose-pending-media");
    if (!raw) return;
    sessionStorage.removeItem("compose-pending-media");
    try {
      const parsed = JSON.parse(raw) as {
        media?: { path: string; type?: string; name: string }[];
        caption?: string;
      };
      const first = parsed.media?.[0];
      if (first) {
        setMediaPath(first.path);
        setMediaType(first.type ?? null);
      }
      if (parsed.caption) setContent(parsed.caption);
    } catch {
      /* ignore */
    }
  }, []);

  const publishFn = useServerFn(publishScheduledPost);

  // Per-klant gekoppelde kanalen — bepaalt welke platforms beschikbaar zijn om naar te posten.
  const { data: clientChannels } = useQuery({
    queryKey: ["client-social-connections", activeClient?.id],
    enabled: !!activeClient?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("social_connections")
        .select("platform, status")
        .eq("client_id", activeClient!.id);
      return data ?? [];
    },
  });
  const clientConnected = new Set<string>(
    (clientChannels ?? []).filter((c) => c.status === "active").map((c) => c.platform),
  );
  const missingForClient = activeClient
    ? selectedPlatforms.filter((p) => !clientConnected.has(p))
    : [];

  const mediaUrl = mediaPath
    ? supabase.storage.from("client-uploads").getPublicUrl(mediaPath).data.publicUrl
    : null;

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (!activeClient) throw new Error("Selecteer een klant in de sidebar");
      const path = `${activeClient.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("client-uploads")
        .upload(path, file, { contentType: file.type });
      if (error) throw error;
      return { path, type: file.type };
    },
    onSuccess: ({ path, type }) => {
      setMediaPath(path);
      setMediaType(type);
    },
    onError: (e: Error) => toast.error(e?.message ?? "Upload mislukt"),
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!activeClient) throw new Error("Selecteer een klant in de sidebar");
      if (selectedPlatforms.length === 0) throw new Error("Selecteer minstens één platform");
      if (!content.trim()) throw new Error("Schrijf eerst een caption");
      const status: "draft" | "scheduled" = mode === "draft" ? "draft" : "scheduled";
      const scheduledISO =
        mode === "now" ? new Date().toISOString() : new Date(scheduleAt).toISOString();
      const rows: TablesInsert<"scheduled_posts">[] = selectedPlatforms.map((p) => ({
        client_id: activeClient.id,
        platform: p as Platform,
        caption: content,
        media_path: mediaPath,
        media_type: mediaType,
        scheduled_at: scheduledISO,
        status,
      }));
      const { data: inserted, error } = await supabase
        .from("scheduled_posts")
        .insert(rows)
        .select("id, platform");
      if (error) throw new Error(error.message);

      if (mode === "now" && inserted) {
        const failures: string[] = [];
        for (const row of inserted) {
          try {
            await publishFn({ data: { postId: row.id } });
          } catch (e) {
            const label = PLATFORMS.find((pl) => pl.id === row.platform)?.label ?? row.platform;
            failures.push(`${label}: ${e instanceof Error ? e.message : "onbekende fout"}`);
          }
        }
        if (failures.length > 0) throw new Error(failures.join(" · "));
      }
    },
    onSuccess: () => {
      toast.success(
        mode === "now" ? "Gepubliceerd" : mode === "draft" ? "Concept opgeslagen" : "Ingepland",
      );
      qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
      navigate({ to: "/admin/planner", search: { clientId: activeClient?.id } });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Opslaan mislukt"),
  });

  const longest = Math.max(
    ...selectedPlatforms.map((p) => PLATFORMS.find((x) => x.id === p)?.limit ?? 2200),
  );

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) => {
      const on = prev.includes(id);
      const next = on ? prev.filter((x) => x !== id) : [...prev, id];
      if (!on) {
        const def = PLATFORMS.find((p) => p.id === id)?.types[0]?.id;
        if (def) setPostTypes((pt) => ({ ...pt, [id]: def }));
        setPreviewPlatform(id);
      }
      return next;
    });
  };

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 max-w-6xl">
      {/* Editor */}
      <div className="space-y-5">
        {/* Active client */}
        <div className="rounded-xl border border-gold/15 bg-card p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Klant
          </div>
          <div className="text-sm font-medium">
            {activeClient?.name ?? "Selecteer een klant in de sidebar"}
          </div>
          {missingForClient.length > 0 && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
              Nog niet gekoppeld voor {activeClient?.name}:{" "}
              {missingForClient
                .map((id) => PLATFORMS.find((p) => p.id === id)?.label ?? id)
                .join(", ")}{" "}
              —{" "}
              <Link to="/admin/channels" className="underline text-gold">
                koppel eerst
              </Link>
            </p>
          )}
        </div>

        {/* Platforms + per-platform post type */}
        {(() => {
          const available = PLATFORMS.filter((p) => clientConnected.has(p.id));
          return (
            <div className="rounded-xl border border-gold/15 bg-card p-4 space-y-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Platforms & post type
              </div>
              {available.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nog geen accounts gekoppeld. Ga naar Kanalen om te koppelen.
                </p>
              ) : (
                <div className="space-y-2">
                  {available.map((p) => {
                    const on = selectedPlatforms.includes(p.id);
                    return (
                      <div key={p.id} className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => togglePlatform(p.id)}
                          className={cn(
                            "px-3 h-8 rounded-full text-xs font-medium border transition min-w-[110px]",
                            on
                              ? "bg-gold/15 text-gold border-gold/40"
                              : "border-border hover:bg-accent/40",
                          )}
                        >
                          {p.label}
                        </button>
                        {on && p.types.length > 1 && (
                          <div className="flex gap-1">
                            {p.types.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => {
                                  setPostTypes((pt) => ({ ...pt, [p.id]: t.id }));
                                  setPreviewPlatform(p.id);
                                }}
                                className={cn(
                                  "px-2.5 h-7 rounded-md text-[11px] border transition",
                                  postTypes[p.id] === t.id
                                    ? "bg-gold/10 text-gold border-gold/30"
                                    : "border-border/60 text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {on && p.types.length === 1 && (
                          <span className="text-[11px] text-muted-foreground">
                            {p.types[0].label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Textarea */}
        <div className="rounded-xl border border-gold/15 bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Caption
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {content.length} / {longest}
            </div>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Schrijf je post..."
            className="w-full min-h-[160px] rounded-lg bg-transparent border border-border p-3 text-sm outline-none focus:border-gold/50"
          />
        </div>

        {/* Media */}
        <div className="rounded-xl border border-gold/15 bg-card p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Media
          </div>
          <label className="block rounded-lg border-2 border-dashed border-border p-6 text-center text-sm cursor-pointer hover:border-gold/40">
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadMut.mutate(f);
                e.target.value = "";
              }}
            />
            {uploadMut.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Uploaden…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <ImageIcon className="h-4 w-4" /> Klik om bestand toe te voegen
              </span>
            )}
          </label>
          {mediaPath && (
            <div className="mt-3 flex gap-2 flex-wrap">
              <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-border">
                {mediaType?.startsWith("video") ? (
                  <video src={mediaUrl ?? undefined} className="h-full w-full object-cover" />
                ) : (
                  <img src={mediaUrl ?? undefined} alt="" className="h-full w-full object-cover" />
                )}
                <button
                  onClick={() => {
                    setMediaPath(null);
                    setMediaType(null);
                  }}
                  className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-background/80 grid place-items-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="rounded-xl border border-gold/15 bg-card p-4">
          <div className="flex gap-2 mb-3">
            {(["schedule", "now", "draft"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "px-3 h-8 rounded-full text-xs font-medium border transition",
                  mode === m
                    ? "bg-gold/15 text-gold border-gold/40"
                    : "border-border hover:bg-accent/40",
                )}
              >
                {m === "schedule" ? "Inplannen" : m === "now" ? "Nu publiceren" : "Concept"}
              </button>
            ))}
          </div>
          {mode === "schedule" && (
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="rounded-lg border border-border bg-transparent px-3 h-9 text-sm"
            />
          )}
        </div>

        <button
          onClick={() => submitMut.mutate()}
          disabled={submitMut.isPending}
          className="w-full h-11 rounded-lg bg-gold text-primary-foreground font-medium inline-flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
        >
          {submitMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : mode === "draft" ? (
            <Save className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {mode === "schedule" ? "Inplannen" : mode === "now" ? "Nu publiceren" : "Concept opslaan"}
        </button>
      </div>

      {/* Preview */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 rounded-xl border border-gold/15 bg-card/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Voorbeeld
            </div>
            {selectedPlatforms.length > 1 && (
              <select
                value={previewPlatform}
                onChange={(e) => setPreviewPlatform(e.target.value)}
                className="text-[11px] bg-transparent border border-border/60 rounded px-2 h-6"
              >
                {selectedPlatforms.map((id) => {
                  const p = PLATFORMS.find((x) => x.id === id);
                  return (
                    <option key={id} value={id}>
                      {p?.label ?? id}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
          <PlatformPreview
            platform={previewPlatform}
            type={postTypes[previewPlatform]}
            content={content}
            mediaUrl={mediaUrl ?? undefined}
            clientName={activeClient?.name ?? "Klant"}
            clientLogo={activeClient?.logo_url}
          />
        </div>
      </aside>
    </div>
  );
}

function PlatformPreview({
  platform,
  type,
  content,
  mediaUrl,
  clientName,
  clientLogo,
}: {
  platform: string;
  type?: string;
  content: string;
  mediaUrl?: string;
  clientName: string;
  clientLogo?: string | null;
}) {
  const p = PLATFORMS.find((x) => x.id === platform);
  const typeLabel = p?.types.find((t) => t.id === type)?.label ?? p?.types[0]?.label ?? "";
  const isVertical =
    type === "reel" ||
    type === "story" ||
    type === "short" ||
    (platform === "tiktok" && type === "video");

  const Header = (
    <div className="flex items-center gap-2">
      {clientLogo ? (
        <img src={clientLogo} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <div className="h-6 w-6 rounded-full bg-gradient-gold" />
      )}
      <span className="text-xs font-medium">{clientName}</span>
      <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wider">
        {p?.label} · {typeLabel}
      </span>
    </div>
  );

  const Media = mediaUrl ? (
    <img
      src={mediaUrl}
      alt=""
      className={cn(
        "w-full object-cover rounded-md",
        isVertical ? "aspect-[9/16]" : "aspect-square",
      )}
    />
  ) : (
    <div
      className={cn(
        "w-full rounded-md bg-muted/40 grid place-items-center text-[10px] text-muted-foreground",
        isVertical ? "aspect-[9/16]" : "aspect-square",
      )}
    >
      geen media
    </div>
  );

  const Caption = (
    <p className="text-xs text-foreground/90 whitespace-pre-wrap line-clamp-4">
      {content || <span className="text-muted-foreground italic">Je caption verschijnt hier…</span>}
    </p>
  );

  const Actions = (
    <div className="flex items-center gap-3 text-muted-foreground">
      <Heart className="h-3.5 w-3.5" />
      <MessageCircle className="h-3.5 w-3.5" />
      <Repeat2 className="h-3.5 w-3.5" />
    </div>
  );

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2">
      {Header}
      {Media}
      {Actions}
      {Caption}
    </div>
  );
}
