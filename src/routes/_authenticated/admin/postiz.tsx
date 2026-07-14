import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  Send,
  Trash2,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Plug,
} from "lucide-react";
import {
  listPostizIntegrations,
  listPostizPosts,
  createPostizPost,
  deletePostizPost,
  uploadPostizMediaFromUrl,
} from "@/lib/postiz.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/postiz")({
  component: PostizPage,
});

function PostizPage() {
  const qc = useQueryClient();
  const listIntegrations = useServerFn(listPostizIntegrations);
  const listPosts = useServerFn(listPostizPosts);
  const createPost = useServerFn(createPostizPost);
  const deletePost = useServerFn(deletePostizPost);
  const uploadMedia = useServerFn(uploadPostizMediaFromUrl);

  const integrationsQ = useQuery({
    queryKey: ["postiz-integrations"],
    queryFn: () => listIntegrations(),
  });

  const range = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const end = new Date();
    end.setDate(end.getDate() + 30);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, []);

  const postsQ = useQuery({
    queryKey: ["postiz-posts", range],
    queryFn: () => listPosts({ data: range }),
  });

  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [mode, setMode] = useState<"schedule" | "now" | "draft">("schedule");
  const [imagePaths, setImagePaths] = useState<{ path: string }[]>([]);
  const [tagsRaw, setTagsRaw] = useState("");

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      // upload to media bucket and pass public URL to postiz
      const ext = file.name.split(".").pop() || "bin";
      const path = `postiz/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("client-uploads")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("client-uploads").getPublicUrl(path);
      const res: any = await uploadMedia({ data: { url: data.publicUrl, filename: file.name } });
      const path2: string | undefined = res?.path || res?.url || data.publicUrl;
      const id: string | undefined = res?.id;
      return id ? { id, path: path2! } : { path: path2! };
    },
    onSuccess: (img) => setImagePaths((p) => [...p, img]),
    onError: (e: any) => toast.error(e.message),
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!content.trim()) throw new Error("Schrijf eerst content");
      if (selectedIntegrations.length === 0) throw new Error("Kies minimaal 1 social-account");
      const date = mode === "now" ? new Date().toISOString() : new Date(when).toISOString();
      const tags = tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const posts = selectedIntegrations.map((id) => ({
        integration: { id },
        value: [{ content, image: imagePaths }],
      }));
      return await createPost({ data: { type: mode, date, shortLink: false, tags, posts } });
    },
    onSuccess: () => {
      toast.success("Post verzonden naar Postiz");
      setContent("");
      setImagePaths([]);
      setTagsRaw("");
      qc.invalidateQueries({ queryKey: ["postiz-posts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => deletePost({ data: { id } }),
    onSuccess: () => {
      toast.success("Verwijderd");
      qc.invalidateQueries({ queryKey: ["postiz-posts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const integrationsErr = integrationsQ.error as Error | null;
  const integrations: any[] = Array.isArray(integrationsQ.data)
    ? (integrationsQ.data as any[])
    : ((integrationsQ.data as any)?.integrations ?? []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Externe scheduler</p>
          <h1 className="font-display text-4xl">Postiz</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plan posts via je gekoppelde Postiz-account totdat we social media intern hebben
            geïntegreerd.
          </p>
        </div>
        <button
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["postiz-integrations"] });
            qc.invalidateQueries({ queryKey: ["postiz-posts"] });
          }}
          className="inline-flex items-center gap-2 rounded-full hairline px-4 py-2 text-sm text-gold hover:bg-gold/10"
        >
          <RefreshCw className="h-4 w-4" /> Vernieuwen
        </button>
      </div>

      {integrationsErr && (
        <div className="glass-strong rounded-xl p-4 border border-destructive/30 text-sm text-destructive">
          {integrationsErr.message}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
        {/* Compose */}
        <div className="glass-strong rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-gold" />
            <h2 className="font-display text-xl">Nieuwe post</h2>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Plug className="h-3 w-3" /> Accounts
            </label>
            {integrationsQ.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mt-2 text-gold" />
            ) : integrations.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-2">
                Geen accounts gevonden. Koppel social-accounts eerst in Postiz.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {integrations.map((i) => {
                  const on = selectedIntegrations.includes(i.id);
                  return (
                    <button
                      key={i.id}
                      onClick={() =>
                        setSelectedIntegrations((s) =>
                          on ? s.filter((x) => x !== i.id) : [...s, i.id],
                        )
                      }
                      className={
                        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition " +
                        (on
                          ? "bg-gold text-primary-foreground"
                          : "hairline text-muted-foreground hover:bg-gold/10")
                      }
                    >
                      {i.picture && <img src={i.picture} className="h-4 w-4 rounded-full" />}
                      <span>{i.name || i.identifier}</span>
                      <span className="opacity-60">· {i.providerIdentifier || i.identifier}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              maxLength={5000}
              placeholder="Wat ga je posten?"
              className="mt-1 w-full rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm"
            />
            <div className="text-[10px] text-muted-foreground text-right">
              {content.length} / 5000
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ImageIcon className="h-3 w-3" /> Afbeeldingen / video
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {imagePaths.map((img, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={img.path}
                    className="h-16 w-16 rounded object-cover border border-gold/20"
                  />
                  <button
                    onClick={() => setImagePaths((p) => p.filter((_, i) => i !== idx))}
                    className="absolute -top-1 -right-1 bg-destructive text-white rounded-full h-5 w-5 text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
              <label className="cursor-pointer h-16 w-16 rounded border border-dashed border-gold/30 flex items-center justify-center text-xs text-muted-foreground hover:bg-gold/5">
                {uploadMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "+"}
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadMut.mutate(e.target.files[0])}
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Modus
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm"
              >
                <option value="schedule">Inplannen</option>
                <option value="now">Nu posten</option>
                <option value="draft">Concept</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Datum & tijd
              </label>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                disabled={mode === "now"}
                className="mt-1 w-full rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Tags (komma gescheiden)
            </label>
            <input
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="campagne, najaar"
              className="mt-1 w-full rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={() => submitMut.mutate()}
            disabled={submitMut.isPending}
            className="w-full rounded-lg bg-gradient-gold px-4 py-2.5 text-sm font-medium text-primary-foreground inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {mode === "now" ? "Nu posten" : mode === "draft" ? "Opslaan als concept" : "Inplannen"}
          </button>
        </div>

        {/* Posts list */}
        <div className="glass-strong rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="h-4 w-4 text-gold" />
            <h2 className="font-display text-xl">Geplande posts</h2>
            <span className="text-xs text-muted-foreground">(laatste 7 dagen + komende 30)</span>
          </div>
          {postsQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
          ) : (
            <PostsList
              posts={Array.isArray(postsQ.data) ? postsQ.data : (postsQ.data?.posts ?? [])}
              onDelete={(id) => delMut.mutate(id)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PostsList({ posts, onDelete }: { posts: any[]; onDelete: (id: string) => void }) {
  if (!posts.length) {
    return <p className="text-sm text-muted-foreground">Nog geen posts in deze periode.</p>;
  }
  return (
    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
      {posts.map((p) => {
        const id = p.id || p.postId;
        const date = p.publishDate || p.date || p.scheduledAt;
        const status = p.state || p.status;
        const content = p.content || p.value?.[0]?.content || "";
        const provider = p.providerIdentifier || p.integration?.providerIdentifier;
        const link = p.releaseURL || p.releaseUrl;
        return (
          <div key={id} className="rounded-lg hairline p-3 hover:bg-gold/5 transition">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {provider && <span className="text-gold">{provider}</span>}
                  {status && <span>· {status}</span>}
                  {date && <span>· {new Date(date).toLocaleString("nl-NL")}</span>}
                </div>
                <p className="text-sm mt-1 line-clamp-3 whitespace-pre-wrap">{content || "—"}</p>
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-gold mt-1 hover:underline"
                  >
                    Bekijk <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {id && (
                <button
                  onClick={() => onDelete(id)}
                  className="text-muted-foreground hover:text-destructive p-1"
                  title="Verwijder"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
