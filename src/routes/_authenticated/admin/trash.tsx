import { createFileRoute, Link } from "@tanstack/react-router";
import { confirmDialog } from "@/components/ui/confirm";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Trash2, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/trash")({
  component: TrashPage,
});

function TrashPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["trash-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scheduled_posts")
        .select("*, clients(name)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      return data ?? [];
    },
  });

  const allSelected = (data?.length ?? 0) > 0 && (data ?? []).every((p) => selected.has(p.id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      if (allSelected) return new Set();
      return new Set((data ?? []).map((p) => p.id));
    });
  }

  async function restore(id: string) {
    const { error } = await supabase
      .from("scheduled_posts")
      .update({ deleted_at: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Hersteld");
    qc.invalidateQueries({ queryKey: ["trash-posts"] });
  }

  async function purge(
    id: string,
    clientName: string | null,
    platform: string,
    caption: string | null,
  ) {
    const preview = caption?.trim() ? `"${caption.trim().slice(0, 80)}"` : "(geen caption)";
    if (
      !(await confirmDialog({
        title: "Definitief verwijderen",
        description: `De ${platform}-post ${preview}${clientName ? ` voor ${clientName}` : ""} verdwijnt hiermee blijvend — dit kan niet ongedaan gemaakt worden.`,
        confirmLabel: "Definitief verwijderen",
        destructive: true,
      }))
    )
      return;
    // Haal eerst het media-pad op zodat we het bijbehorende bestand uit storage
    // kunnen opruimen — anders blijft het bestand achter (opslag-lek).
    const { data: post } = await supabase
      .from("scheduled_posts")
      .select("media_path")
      .eq("id", id)
      .maybeSingle();
    if (post?.media_path) {
      // Storage-fouten mogen de purge niet blokkeren (bestand kan al weg zijn).
      const { error: storageError } = await supabase.storage
        .from("client-uploads")
        .remove([post.media_path]);
      if (storageError) {
        console.warn("Media-bestand kon niet worden verwijderd:", storageError.message);
      }
    }
    const { error } = await supabase.from("scheduled_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Definitief verwijderd");
    qc.invalidateQueries({ queryKey: ["trash-posts"] });
  }

  async function bulkRestore() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const { error } = await supabase
        .from("scheduled_posts")
        .update({ deleted_at: null })
        .in("id", ids);
      if (error) return toast.error(error.message);
      toast.success(`${ids.length} hersteld`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["trash-posts"] });
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkPurge() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (
      !(await confirmDialog({
        title: `${ids.length} post${ids.length === 1 ? "" : "s"} definitief verwijderen?`,
        description:
          "Deze posts verdwijnen hiermee blijvend, inclusief bijbehorend beeldmateriaal — dit kan niet ongedaan gemaakt worden.",
        confirmLabel: "Definitief verwijderen",
        destructive: true,
      }))
    )
      return;
    setBulkBusy(true);
    try {
      const targets = (data ?? []).filter((p) => selected.has(p.id));
      const mediaPaths = targets.map((p) => p.media_path).filter((p): p is string => !!p);
      if (mediaPaths.length) {
        const { error: storageError } = await supabase.storage
          .from("client-uploads")
          .remove(mediaPaths);
        if (storageError) {
          console.warn("Media-bestanden konden niet worden verwijderd:", storageError.message);
        }
      }
      const { error } = await supabase.from("scheduled_posts").delete().in("id", ids);
      if (error) return toast.error(error.message);
      toast.success(`${ids.length} definitief verwijderd`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["trash-posts"] });
    } finally {
      setBulkBusy(false);
    }
  }

  function daysLeft(deletedAt: string) {
    const days = 30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000);
    return Math.max(0, days);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Prullenbak</p>
        <h1 className="font-display text-5xl mt-2">Verwijderde posts</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          Verwijderde posts blijven 30 dagen bewaard. Daarna worden ze definitief verwijderd.
        </p>
      </div>

      {isLoading && <Loader2 className="h-6 w-6 animate-spin text-gold" />}

      {!isLoading && data?.length === 0 && (
        <div className="glass-strong rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Prullenbak is leeg.
        </div>
      )}

      {(data?.length ?? 0) > 0 && (
        <div
          className={
            selected.size > 0
              ? "sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-gold/20 bg-background/95 backdrop-blur px-4 py-3 shadow-sm"
              : "flex items-center"
          }
        >
          {selected.size > 0 && (
            <span className="text-sm font-medium text-gold">{selected.size} geselecteerd</span>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <button
              onClick={toggleSelectAll}
              disabled={bulkBusy}
              className="min-h-9 inline-flex items-center justify-center rounded-lg border border-gold/20 px-3 py-1.5 text-xs hover:bg-accent/40 disabled:opacity-60"
            >
              {allSelected ? "Deselecteer alles" : "Selecteer alles"}
            </button>
            {selected.size > 0 && (
              <>
                <button
                  onClick={bulkRestore}
                  disabled={bulkBusy}
                  className="min-h-9 inline-flex items-center justify-center gap-1.5 rounded-lg border border-gold/40 text-gold px-3 py-1.5 text-xs hover:bg-gold/10 disabled:opacity-60"
                >
                  {bulkBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Herstel ({selected.size})
                </button>
                <button
                  onClick={bulkPurge}
                  disabled={bulkBusy}
                  className="min-h-9 inline-flex items-center justify-center gap-1.5 rounded-lg border border-destructive/40 text-destructive px-3 py-1.5 text-xs hover:bg-destructive/10 disabled:opacity-60"
                >
                  {bulkBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Definitief verwijderen ({selected.size})
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {data?.map((p) => {
          const left = daysLeft(p.deleted_at);
          return (
            <div
              key={p.id}
              className="glass-strong rounded-xl p-4 flex items-start justify-between gap-4"
            >
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggleSelect(p.id)}
                aria-label="Selecteer post"
                className="mt-1 h-4 w-4 shrink-0 rounded border-gold/40 accent-gold"
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-gold">{p.clients?.name}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{p.platform}</span>
                  <span className="text-muted-foreground">•</span>
                  <span
                    className={
                      left <= 3
                        ? "text-destructive inline-flex items-center gap-1"
                        : "text-muted-foreground"
                    }
                  >
                    {left <= 3 && <AlertTriangle className="h-3 w-3" />}
                    Nog {left} dagen
                  </span>
                </div>
                <p className="text-sm mt-2 line-clamp-2 whitespace-pre-wrap">
                  {p.caption || <span className="text-muted-foreground italic">Geen caption</span>}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <button
                  onClick={() => restore(p.id)}
                  className="text-xs rounded-full border border-gold/40 text-gold hover:bg-gold/10 px-3 py-1.5 inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3 w-3" /> Herstel
                </button>
                {/* Ruimte + eigen rand houdt deze knop visueel weg van
                    Herstel — een misklik hier is niet ongedaan te maken. */}
                <button
                  onClick={() => purge(p.id, p.clients?.name ?? null, p.platform, p.caption)}
                  className="mt-3 text-xs rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 px-3 py-1.5 inline-flex items-center gap-1.5"
                >
                  <Trash2 className="h-3 w-3" /> Definitief verwijderen
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-muted-foreground">
        <Link to="/admin/planner" className="hover:text-gold">
          ← Terug naar planner
        </Link>
      </div>
    </div>
  );
}
