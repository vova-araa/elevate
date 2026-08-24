import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClient } from "@/hooks/use-active-client";
import { EmptyState } from "@/components/empty-state";
import { ListChecks, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/tasks")({ component: ClientTasks });

function ClientTasks() {
  const qc = useQueryClient();
  const { clientId } = useActiveClient();

  const { data, isLoading: loadingTasks } = useQuery({
    queryKey: ["client-tasks", clientId],
    queryFn: async () =>
      (
        await supabase
          .from("tasks")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  async function setStatus(id: string, status: "todo" | "in_progress" | "done") {
    await supabase.from("tasks").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["client-tasks", clientId] });
  }

  const cols: { k: "todo" | "in_progress" | "done"; label: string }[] = [
    { k: "todo", label: "Te doen" },
    { k: "in_progress", label: "Bezig" },
    { k: "done", label: "Klaar" },
  ];

  if (loadingTasks) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Werklijst</p>
        <h1 className="font-display text-5xl mt-2">Taken</h1>
      </div>
      {(data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-5 w-5" />}
          title="Nog geen taken"
          description="Zodra je Elevate-team taken voor je aanmaakt verschijnen ze hier."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {cols.map((c) => (
            <div key={c.k} className="glass rounded-2xl p-4">
              <h3 className="font-display text-lg mb-3">{c.label}</h3>
              <div className="space-y-2">
                {data
                  ?.filter((x) => x.status === c.k)
                  .map((x) => (
                    <div key={x.id} className="rounded-lg bg-surface-elevated/60 p-3">
                      <div className="text-sm font-medium">{x.title}</div>
                      {x.description && (
                        <div className="text-xs text-muted-foreground mt-1">{x.description}</div>
                      )}
                      <div className="flex gap-1 mt-2">
                        {cols
                          .filter((cc) => cc.k !== c.k)
                          .map((cc) => (
                            <button
                              key={cc.k}
                              onClick={() => setStatus(x.id, cc.k)}
                              className="text-[10px] rounded px-2 py-0.5 bg-gold/15 text-gold hover:bg-gold/25"
                            >
                              → {cc.label}
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
