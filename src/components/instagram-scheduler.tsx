import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Instagram,
  Plus,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Instagram preview + planner
 * - Toont een 3-kolomsraster zoals op Instagram met de mock-feed (bestaande posts)
 *   + alle geplande posts uit `scheduled_posts` (status != published).
 * - Bovenaan geplande posts; sleep ze naar elkaar om volgorde / moment om te ruilen.
 * - Knoppen voor: bestand uploaden, caption, datum/tijd, status.
 *
 * Echte OAuth + auto-publiceren naar Meta Graph API komt in fase 2 zodra de
 * Meta-app review approved is. Tot die tijd staat de status "scheduled" voor
 * "klaar om gepubliceerd te worden" en kan een admin handmatig op
 * "Markeer gepubliceerd" drukken.
 */

const MOCK_FEED = [
  "linear-gradient(135deg,#D4B97A,#8a6a2a)",
  "linear-gradient(135deg,#222,#555)",
  "linear-gradient(135deg,#3a2a1f,#7a5a3a)",
  "linear-gradient(135deg,#1a1a2e,#3a2a4f)",
  "linear-gradient(135deg,#2a3a2a,#4f5a3a)",
  "linear-gradient(135deg,#4a2a2a,#7a3a3a)",
];

type Post = Pick<
  Tables<"scheduled_posts">,
  | "id"
  | "client_id"
  | "caption"
  | "media_path"
  | "scheduled_at"
  | "status"
  | "platform_post_id"
  | "error_message"
>;

type ConnectionInfo = Pick<
  Tables<"social_connections">,
  "id" | "account_username" | "status" | "connected_at"
>;

export function InstagramScheduler({ clientId }: { clientId: string; igUrl: string | null }) {
  const qc = useQueryClient();

  // Alleen veilige kolommen — tokens blijven server-side (kolom-privileges in DB).
  const { data: connection } = useQuery<ConnectionInfo | null>({
    queryKey: ["social-conn", clientId, "instagram"],
    queryFn: async () =>
      (
        await supabase
          .from("social_connections")
          .select("id, account_username, status, connected_at")
          .eq("client_id", clientId)
          .eq("platform", "instagram")
          .maybeSingle()
      ).data,
  });

  const { data: posts } = useQuery<Post[]>({
    queryKey: ["scheduled-posts", clientId],
    queryFn: async () =>
      (
        await supabase
          .from("scheduled_posts")
          .select("*")
          .eq("client_id", clientId)
          .order("scheduled_at", { ascending: true })
      ).data ?? [],
  });

  // Koppelen/ontkoppelen loopt via de Kanalen-pagina (echte OAuth-flow).

  // Combined grid: scheduled (newest first) → mock feed
  const planned = (posts ?? []).filter((p) => p.status !== "published");
  const published = (posts ?? []).filter((p) => p.status === "published");

  return (
    <div className="space-y-5">
      {/* Header / connect */}
      <div className="glass-strong rounded-2xl p-5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-400 flex items-center justify-center text-white">
          <Instagram className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-xl">Instagram</div>
          {connection ? (
            <div className="text-sm text-muted-foreground">
              @{connection.account_username} — gekoppeld
              {connection.status !== "active" && (
                <span className="ml-2 text-amber-400 text-xs inline-flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> koppeling verlopen
                </span>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Nog niet gekoppeld</div>
          )}
        </div>
        <Link
          to="/admin/channels"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-amber-400 px-4 py-2 text-sm font-medium text-white"
        >
          <Instagram className="h-4 w-4" />
          {connection ? "Beheer koppeling" : "Verbind via Kanalen"}
        </Link>
      </div>

      {/* New post */}
      <NewPostForm clientId={clientId} />

      {/* Planned list */}
      {planned.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-gold/80">
            Gepland ({planned.length})
          </div>
          <div className="space-y-2">
            {planned.map((p, i) => (
              <PlannedRow key={p.id} post={p} allPlanned={planned} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Preview grid */}
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-gold/80 mb-2">Feed-preview</div>
        <div className="grid grid-cols-3 gap-1 rounded-2xl overflow-hidden hairline">
          {planned
            .slice()
            .reverse()
            .map((p) => (
              <PlannedTile key={p.id} post={p} />
            ))}
          {published.map((p) => (
            <PublishedTile key={p.id} post={p} />
          ))}
          {MOCK_FEED.slice(0, Math.max(0, 9 - planned.length - published.length)).map((bg, i) => (
            <div key={i} className="aspect-square" style={{ background: bg }} />
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Goudgekaderd = gepland · Met klok = wacht op publicatie · Grijs = mock voorbeeld
        </p>
      </div>
    </div>
  );
}

function PlannedTile({ post }: { post: Post }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    if (!post.media_path) return;
    supabase.storage
      .from("social-media")
      .createSignedUrl(post.media_path, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setUrl(data.signedUrl);
      });
  }, [post.media_path]);
  return (
    <div className="aspect-square relative ring-2 ring-gold/80 ring-inset bg-surface-elevated/60">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-gold/20 to-gold/5" />
      )}
      <div className="absolute top-1 left-1 inline-flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] text-gold">
        <Clock className="h-2.5 w-2.5" />{" "}
        {new Date(post.scheduled_at).toLocaleDateString("nl-NL", {
          day: "numeric",
          month: "short",
        })}
      </div>
    </div>
  );
}

function PublishedTile({ post }: { post: Post }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    if (!post.media_path) return;
    supabase.storage
      .from("social-media")
      .createSignedUrl(post.media_path, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setUrl(data.signedUrl);
      });
  }, [post.media_path]);
  return (
    <div className="aspect-square relative bg-surface-elevated/60">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-muted/30" />
      )}
      <div className="absolute top-1 right-1">
        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
      </div>
    </div>
  );
}

function PlannedRow({
  post,
  allPlanned,
  index,
}: {
  post: Post;
  allPlanned: Post[];
  index: number;
}) {
  const qc = useQueryClient();
  const [thumb, setThumb] = useState("");
  useEffect(() => {
    if (!post.media_path) return;
    supabase.storage
      .from("social-media")
      .createSignedUrl(post.media_path, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setThumb(data.signedUrl);
      });
  }, [post.media_path]);

  async function changeTime(value: string) {
    const iso = new Date(value).toISOString();
    await supabase.from("scheduled_posts").update({ scheduled_at: iso }).eq("id", post.id);
    qc.invalidateQueries({ queryKey: ["scheduled-posts", post.client_id] });
  }
  async function del() {
    if (!confirm("Geplande post verwijderen?")) return;
    await supabase.from("scheduled_posts").delete().eq("id", post.id);
    qc.invalidateQueries({ queryKey: ["scheduled-posts", post.client_id] });
  }
  async function swap(otherId: string) {
    const other = allPlanned.find((p) => p.id === otherId);
    if (!other || other.id === post.id) return;
    // ruil de scheduled_at om
    await supabase
      .from("scheduled_posts")
      .update({ scheduled_at: other.scheduled_at })
      .eq("id", post.id);
    await supabase
      .from("scheduled_posts")
      .update({ scheduled_at: post.scheduled_at })
      .eq("id", other.id);
    qc.invalidateQueries({ queryKey: ["scheduled-posts", post.client_id] });
    toast.success("Postmoment geruild");
  }
  async function markPublished() {
    await supabase
      .from("scheduled_posts")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", post.id);
    qc.invalidateQueries({ queryKey: ["scheduled-posts", post.client_id] });
  }

  const dt = new Date(post.scheduled_at);
  const inputValue = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  return (
    <div
      className={cn(
        "glass rounded-2xl p-3 flex gap-3 items-center cursor-grab active:cursor-grabbing",
        post.status === "failed" && "ring-1 ring-destructive/40",
      )}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", post.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        swap(e.dataTransfer.getData("text/plain"));
      }}
    >
      <div className="h-14 w-14 rounded-lg overflow-hidden shrink-0 ring-1 ring-gold/40 bg-surface-elevated/60">
        {thumb ? (
          <img src={thumb} className="h-full w-full object-cover" alt="" />
        ) : (
          <ImageIcon className="h-5 w-5 m-auto text-muted-foreground mt-4" />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="text-sm truncate">
          {post.caption || <span className="text-muted-foreground italic">geen caption</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={inputValue}
            onChange={(e) => changeTime(e.target.value)}
            className="rounded bg-input/60 hairline px-2 py-1 text-xs"
          />
          <span
            className={cn(
              "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full",
              post.status === "scheduled" && "bg-gold/15 text-gold",
              post.status === "draft" && "bg-muted/30 text-muted-foreground",
              post.status === "failed" && "bg-destructive/15 text-destructive",
              post.status === "publishing" && "bg-blue-500/15 text-blue-400",
            )}
          >
            {post.status}
          </span>
          {post.error_message && (
            <span className="text-[10px] text-destructive">{post.error_message}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button onClick={markPublished} className="text-[10px] text-emerald-400 hover:underline">
          Gepubliceerd
        </button>
        <button onClick={del} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function NewPostForm({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [caption, setCaption] = useState("");
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600_000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Kies een afbeelding");
    setBusy(true);
    const path = `${clientId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("social-media").upload(path, file);
    if (upErr) {
      setBusy(false);
      return toast.error(upErr.message);
    }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("scheduled_posts").insert({
      client_id: clientId,
      caption: caption || null,
      media_path: path,
      media_type: file.type,
      scheduled_at: new Date(when).toISOString(),
      status: "scheduled",
      created_by: u.user?.id ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setFile(null);
    setCaption("");
    qc.invalidateQueries({ queryKey: ["scheduled-posts", clientId] });
    toast.success("Ingepland");
  }

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-4 space-y-3">
      <div className="text-xs uppercase tracking-[0.2em] text-gold/80">Nieuwe post inplannen</div>
      <label className="flex items-center gap-3 rounded-lg hairline border-dashed px-3 py-2.5 text-sm cursor-pointer hover:bg-gold/5">
        <Upload className="h-4 w-4 text-gold" />
        <span className="flex-1 truncate">{file ? file.name : "Kies afbeelding..."}</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </label>
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Caption..."
        rows={3}
        className="w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
      />
      <div className="flex gap-2">
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="flex-1 rounded-lg bg-input/60 hairline px-3 py-2 text-sm"
        />
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{" "}
          Plannen
        </button>
      </div>
    </form>
  );
}
