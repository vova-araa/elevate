import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Send, Save, Image as ImageIcon, X, Heart, MessageCircle, Repeat2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClientStore } from "@/lib/stores/client-store";
import { listPostizIntegrations, createPostizPost, uploadPostizMediaFromUrl } from "@/lib/postiz.functions";
import { cn } from "@/lib/utils";

type PostType = { id: string; label: string };

const PLATFORMS: { id: string; label: string; limit: number; types: PostType[] }[] = [
  { id: "instagram", label: "Instagram", limit: 2200, types: [
    { id: "feed", label: "Feed" }, { id: "reel", label: "Reel" }, { id: "story", label: "Story" },
  ]},
  { id: "linkedin", label: "LinkedIn", limit: 3000, types: [
    { id: "post", label: "Post" }, { id: "article", label: "Artikel" },
  ]},
  { id: "tiktok", label: "TikTok", limit: 300, types: [
    { id: "video", label: "Video" }, { id: "photo", label: "Foto" },
  ]},
  { id: "facebook", label: "Facebook", limit: 1500, types: [
    { id: "post", label: "Post" }, { id: "reel", label: "Reel" }, { id: "story", label: "Story" },
  ]},
  { id: "x", label: "X", limit: 280, types: [{ id: "tweet", label: "Tweet" }]},
  { id: "threads", label: "Threads", limit: 500, types: [{ id: "post", label: "Post" }]},
  { id: "youtube", label: "YouTube", limit: 1000, types: [
    { id: "short", label: "Short" }, { id: "video", label: "Video" },
  ]},
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
  const [selectedIntegrations, setSelectedIntegrations] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"schedule" | "now" | "draft">("schedule");
  const [scheduleAt, setScheduleAt] = useState<string>(
    search.at ?? new Date(Date.now() + 60 * 60000).toISOString().slice(0, 16),
  );
  const [media, setMedia] = useState<{ url: string; postizId?: string; name: string }[]>([]);
  const [previewPlatform, setPreviewPlatform] = useState<string>("instagram");

  useEffect(() => {
    const raw = sessionStorage.getItem("compose-pending-media");
    if (!raw) return;
    sessionStorage.removeItem("compose-pending-media");
    try {
      const parsed = JSON.parse(raw) as { media?: { url: string; postizId?: string; name: string }[]; caption?: string };
      if (parsed.media?.length) setMedia(parsed.media);
      if (parsed.caption) setContent(parsed.caption);
    } catch { /* ignore */ }
  }, []);

  const listFn = useServerFn(listPostizIntegrations);
  const createFn = useServerFn(createPostizPost);
  const uploadFn = useServerFn(uploadPostizMediaFromUrl);

  const { data: integrations } = useQuery({
    queryKey: ["postiz-integrations"],
    queryFn: () => listFn(),
  });

  const integrationsList: any[] = Array.isArray(integrations) ? integrations : [];

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (!activeClient) throw new Error("Selecteer een klant in de sidebar");
      const path = `${activeClient.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("client-uploads").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("client-uploads").getPublicUrl(path);
      const r: any = await uploadFn({ data: { url: data.publicUrl, filename: file.name } });
      const postizId = r?.[0]?.id ?? r?.id;
      return { url: data.publicUrl, postizId, name: file.name };
    },
    onSuccess: (m) => setMedia((prev) => [...prev, m]),
    onError: (e: any) => toast.error(e?.message ?? "Upload mislukt"),
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      const chosen = integrationsList.filter((i) => selectedIntegrations[i.id]);
      if (chosen.length === 0) throw new Error("Selecteer minstens één kanaal");
      if (!content.trim()) throw new Error("Schrijf eerst een caption");
      const dateISO = mode === "now" ? new Date().toISOString() : new Date(scheduleAt).toISOString();
      const image = media.length
        ? media.map((m) => ({ id: m.postizId, path: m.url }))
        : undefined;
      return await createFn({
        data: {
          type: mode,
          date: dateISO,
          shortLink: false,
          tags: [],
          posts: chosen.map((i) => ({
            integration: { id: i.id },
            value: [{ content, image }],
          })),
        },
      });
    },
    onSuccess: () => {
      toast.success("Post ingepland");
      qc.invalidateQueries({ queryKey: ["postiz-posts"] });
      navigate({ to: "/admin/planner" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Inplannen mislukt"),
  });

  const longest = Math.max(...selectedPlatforms.map((p) => PLATFORMS.find((x) => x.id === p)?.limit ?? 2200));

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
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Klant</div>
          <div className="text-sm font-medium">{activeClient?.name ?? "Selecteer een klant in de sidebar"}</div>
        </div>

        {/* Platforms + per-platform post type */}
        {(() => {
          const connectedIds = new Set(
            integrationsList
              .map((i) => String(i.providerIdentifier ?? i.platform ?? "").toLowerCase())
              .filter(Boolean),
          );
          const available = PLATFORMS.filter((p) => connectedIds.has(p.id));
          return (
            <div className="rounded-xl border border-gold/15 bg-card p-4 space-y-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Platforms & post type</div>
              {available.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nog geen accounts gekoppeld. Ga naar Kanalen om te koppelen.</p>
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
                            on ? "bg-gold/15 text-gold border-gold/40" : "border-border hover:bg-accent/40",
                          )}
                        >
                          {p.label}
                        </button>
                        {on && p.types.length > 1 && (
                          <div className="flex gap-1">
                            {p.types.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => { setPostTypes((pt) => ({ ...pt, [p.id]: t.id })); setPreviewPlatform(p.id); }}
                                className={cn(
                                  "px-2.5 h-7 rounded-md text-[11px] border transition",
                                  postTypes[p.id] === t.id ? "bg-gold/10 text-gold border-gold/30" : "border-border/60 text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {on && p.types.length === 1 && (
                          <span className="text-[11px] text-muted-foreground">{p.types[0].label}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Channels (Postiz integrations) */}
        <div className="rounded-xl border border-gold/15 bg-card p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Kanalen</div>
          {integrationsList.length === 0 ? (
            <p className="text-xs text-muted-foreground">Geen Postiz integraties gevonden.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {integrationsList.map((i) => (
                <label key={i.id} className="flex items-center gap-2 text-sm cursor-pointer rounded-lg border border-border px-3 py-2 hover:bg-accent/40">
                  <input
                    type="checkbox"
                    checked={!!selectedIntegrations[i.id]}
                    onChange={(e) => setSelectedIntegrations((p) => ({ ...p, [i.id]: e.target.checked }))}
                    className="accent-[var(--gold)]"
                  />
                  <span className="font-medium">{i.name ?? i.identifier ?? i.id}</span>
                  <span className="text-xs text-muted-foreground">{i.providerIdentifier ?? i.platform ?? ""}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Textarea */}
        <div className="rounded-xl border border-gold/15 bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Caption</div>
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
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Media</div>
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
              <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Uploaden…</span>
            ) : (
              <span className="inline-flex items-center gap-2 text-muted-foreground"><ImageIcon className="h-4 w-4" /> Klik om bestand toe te voegen</span>
            )}
          </label>
          {media.length > 0 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {media.map((m, i) => (
                <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-border">
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => setMedia((p) => p.filter((_, j) => j !== i))}
                    className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-background/80 grid place-items-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
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
                  mode === m ? "bg-gold/15 text-gold border-gold/40" : "border-border hover:bg-accent/40",
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
          {submitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "draft" ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {mode === "schedule" ? "Inplannen" : mode === "now" ? "Nu publiceren" : "Concept opslaan"}
        </button>
      </div>

      {/* Preview */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 rounded-xl border border-gold/15 bg-card/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Voorbeeld</div>
            {selectedPlatforms.length > 1 && (
              <select
                value={previewPlatform}
                onChange={(e) => setPreviewPlatform(e.target.value)}
                className="text-[11px] bg-transparent border border-border/60 rounded px-2 h-6"
              >
                {selectedPlatforms.map((id) => {
                  const p = PLATFORMS.find((x) => x.id === id);
                  return <option key={id} value={id}>{p?.label ?? id}</option>;
                })}
              </select>
            )}
          </div>
          <PlatformPreview
            platform={previewPlatform}
            type={postTypes[previewPlatform]}
            content={content}
            mediaUrl={media[0]?.url}
            clientName={activeClient?.name ?? "Klant"}
            clientLogo={activeClient?.logo_url}
          />
        </div>
      </aside>
    </div>
  );
}

function PlatformPreview({
  platform, type, content, mediaUrl, clientName, clientLogo,
}: {
  platform: string; type?: string; content: string; mediaUrl?: string; clientName: string; clientLogo?: string | null;
}) {
  const p = PLATFORMS.find((x) => x.id === platform);
  const typeLabel = p?.types.find((t) => t.id === type)?.label ?? p?.types[0]?.label ?? "";
  const isVertical = type === "reel" || type === "story" || type === "short" || (platform === "tiktok" && type === "video");

  const Header = (
    <div className="flex items-center gap-2">
      {clientLogo ? (
        <img src={clientLogo} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <div className="h-6 w-6 rounded-full bg-gradient-gold" />
      )}
      <span className="text-xs font-medium">{clientName}</span>
      <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wider">{p?.label} · {typeLabel}</span>
    </div>
  );

  const Media = mediaUrl ? (
    <img
      src={mediaUrl}
      alt=""
      className={cn("w-full object-cover rounded-md", isVertical ? "aspect-[9/16]" : "aspect-square")}
    />
  ) : (
    <div className={cn("w-full rounded-md bg-muted/40 grid place-items-center text-[10px] text-muted-foreground", isVertical ? "aspect-[9/16]" : "aspect-square")}>
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
