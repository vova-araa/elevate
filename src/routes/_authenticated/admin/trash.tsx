import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/trash")({
  component: TrashPage,
});

function TrashPage() {
  const qc = useQueryClient();
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

  async function restore(id: string) {
    const { error } = await supabase
      .from("scheduled_posts")
      .update({ deleted_at: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Hersteld");
    qc.invalidateQueries({ queryKey: ["trash-posts"] });
  }

  async function purge(id: string) {
    if (!confirm("Definitief verwijderen? Dit kan niet ongedaan gemaakt worden.")) return;
    const { error } = await supabase.from("scheduled_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Definitief verwijderd");
    qc.invalidateQueries({ queryKey: ["trash-posts"] });
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

      <div className="space-y-3">
        {data?.map((p: any) => {
          const left = daysLeft(p.deleted_at);
          return (
            <div
              key={p.id}
              className="glass-strong rounded-xl p-4 flex items-start justify-between gap-4"
            >
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
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => restore(p.id)}
                  className="text-xs rounded-full border border-gold/40 text-gold hover:bg-gold/10 px-3 py-1.5 inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3 w-3" /> Herstel
                </button>
                <button
                  onClick={() => purge(p.id)}
                  className="text-xs rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 px-3 py-1.5 inline-flex items-center gap-1.5"
                >
                  <Trash2 className="h-3 w-3" /> Voor altijd
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
