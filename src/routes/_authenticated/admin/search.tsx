import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  Search as SearchIcon,
  Loader2,
  Instagram,
  Music2,
  Linkedin,
  Youtube,
  Facebook,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/search")({
  component: SearchPage,
});

const ICONS: Record<string, LucideIcon> = {
  instagram: Instagram,
  tiktok: Music2,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook,
};

type SearchPostRow = Pick<
  Tables<"scheduled_posts">,
  "id" | "client_id" | "platform" | "caption" | "scheduled_at" | "status" | "notes"
> & { clients: Pick<Tables<"clients">, "name"> | null };

type SearchUploadRow = Pick<
  Tables<"uploads">,
  "id" | "client_id" | "file_name" | "file_type" | "caption" | "created_at"
> & { clients: Pick<Tables<"clients">, "name"> | null };

function SearchPage() {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"all" | "posts" | "uploads">("all");

  const { data: posts, isLoading: lp } = useQuery({
    queryKey: ["search-posts", q],
    enabled: q.trim().length >= 2 && (scope === "all" || scope === "posts"),
    queryFn: async () => {
      const { data } = await supabase
        .from("scheduled_posts")
        .select("id, client_id, platform, caption, scheduled_at, status, notes, clients(name)")
        .is("deleted_at", null)
        .or(`caption.ilike.%${q}%,notes.ilike.%${q}%`)
        .order("scheduled_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: uploads, isLoading: lu } = useQuery({
    queryKey: ["search-uploads", q],
    enabled: q.trim().length >= 2 && (scope === "all" || scope === "uploads"),
    queryFn: async () => {
      const { data } = await supabase
        .from("uploads")
        .select("id, client_id, file_name, file_type, caption, created_at, clients(name)")
        .or(`file_name.ilike.%${q}%,caption.ilike.%${q}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const empty = useMemo(
    () =>
      q.trim().length >= 2 &&
      !lp &&
      !lu &&
      (posts?.length ?? 0) === 0 &&
      (uploads?.length ?? 0) === 0,
    [q, lp, lu, posts, uploads],
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Zoeken</p>
        <h1 className="font-display text-5xl mt-2">Zoek door alles</h1>
      </div>

      <div className="glass-strong rounded-2xl p-4 space-y-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek in captions, notities, bestandsnamen…"
            className="w-full rounded-full bg-input/60 hairline pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40"
          />
        </div>
        <div className="inline-flex rounded-full glass p-1 text-xs">
          {(["all", "posts", "uploads"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`rounded-full px-3 py-1 ${scope === s ? "bg-gold/15 text-gold" : "text-muted-foreground"}`}
            >
              {s === "all" ? "Alles" : s === "posts" ? "Posts" : "Uploads"}
            </button>
          ))}
        </div>
      </div>

      {q.trim().length < 2 && (
        <div className="text-sm text-muted-foreground text-center py-8">
          Type minimaal 2 tekens om te zoeken.
        </div>
      )}

      {(lp || lu) && <Loader2 className="h-6 w-6 animate-spin text-gold mx-auto" />}

      {empty && (
        <div className="text-sm text-muted-foreground text-center py-8">
          Geen resultaten voor "{q}".
        </div>
      )}

      {(scope === "all" || scope === "posts") && posts && posts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-gold/70">Posts ({posts.length})</h2>
          {posts.map((p: SearchPostRow) => {
            const Icon = ICONS[p.platform] ?? Instagram;
            return (
              <Link
                key={p.id}
                to="/admin/planner"
                search={{ clientId: p.client_id, view: "agenda" }}
                className="block glass rounded-xl p-3 hover:bg-accent/30"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{p.clients?.name}</span>
                  <span>•</span>
                  <span>{new Date(p.scheduled_at).toLocaleDateString("nl-NL")}</span>
                  <span className="rounded-full bg-accent/30 px-2 py-0.5">{p.status}</span>
                </div>
                <p className="text-sm mt-1.5 line-clamp-2 whitespace-pre-wrap">
                  {p.caption || <em className="text-muted-foreground">Geen caption</em>}
                </p>
                {p.notes && <p className="text-xs text-gold/80 mt-1">📝 {p.notes}</p>}
              </Link>
            );
          })}
        </section>
      )}

      {(scope === "all" || scope === "uploads") && uploads && uploads.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-gold/70">
            Uploads ({uploads.length})
          </h2>
          {uploads.map((u: SearchUploadRow) => (
            <div key={u.id} className="glass rounded-xl p-3">
              <div className="text-sm">{u.file_name}</div>
              <div className="text-xs text-muted-foreground">
                {u.clients?.name} • {u.file_type} •{" "}
                {new Date(u.created_at).toLocaleDateString("nl-NL")}
              </div>
              {u.caption && <p className="text-xs mt-1">{u.caption}</p>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
