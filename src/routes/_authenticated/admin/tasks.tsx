import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Flag, Calendar, ListChecks, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/tasks")({ component: AdminTasks });

type Status = "todo" | "in_progress" | "done";
type Priority = "low" | "medium" | "high" | "urgent";

const STATUS_COLS: { k: Status; label: string }[] = [
  { k: "todo", label: "Te doen" },
  { k: "in_progress", label: "Bezig" },
  { k: "done", label: "Klaar" },
];

const PRIO_META: Record<Priority, string> = {
  low: "text-sky-300 border-sky-400/40 bg-sky-500/10",
  medium: "text-amber-300 border-amber-400/40 bg-amber-500/10",
  high: "text-orange-300 border-orange-400/40 bg-orange-500/10",
  urgent: "text-red-300 border-red-400/40 bg-red-500/10",
};

function AdminTasks() {
  const qc = useQueryClient();
  const [filterClient, setFilterClient] = useState<string>("all");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickClient, setQuickClient] = useState<string>("");
  const [quickPrio, setQuickPrio] = useState<Priority>("medium");
  const [quickDue, setQuickDue] = useState("");

  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () =>
      (await supabase.from("clients").select("id,name").order("name")).data ?? [],
  });

  const { data: tasks } = useQuery({
    queryKey: ["admin-tasks"],
    queryFn: async () =>
      (await supabase.from("tasks").select("*").order("created_at", { ascending: false })).data ??
      [],
  });

  const clientName = (id: string) => clients?.find((c: any) => c.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    if (!tasks) return [];
    return filterClient === "all" ? tasks : tasks.filter((t: any) => t.client_id === filterClient);
  }, [tasks, filterClient]);

  async function quickAdd() {
    if (!quickTitle.trim() || !quickClient) return toast.error("Titel en klant verplicht");
    const { error } = await supabase.from("tasks").insert({
      title: quickTitle.trim(),
      client_id: quickClient,
      priority: quickPrio,
      due_date: quickDue || null,
      status: "todo",
    });
    if (error) return toast.error(error.message);
    setQuickTitle("");
    setQuickDue("");
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
  }

  async function setStatus(id: string, status: Status) {
    await supabase.from("tasks").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
  }
  async function del(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
  }

  const counts = useMemo(() => {
    const c = { todo: 0, in_progress: 0, done: 0 } as Record<Status, number>;
    filtered.forEach((t: any) => {
      c[t.status as Status] = (c[t.status as Status] ?? 0) + 1;
    });
    return c;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Werklijst</p>
        <h1 className="font-display text-4xl md:text-5xl mt-2">Taken</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ClickUp-stijl overzicht van alle klantentaken.
        </p>
      </div>

      {/* Quick add */}
      <div className="glass-strong rounded-2xl p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_180px_140px_160px_auto]">
          <input
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && quickAdd()}
            placeholder="Snel toevoegen: taakomschrijving..."
            className="rounded-lg bg-input/60 hairline px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40"
          />
          <select
            value={quickClient}
            onChange={(e) => setQuickClient(e.target.value)}
            className="rounded-lg bg-input/60 hairline px-3 py-2.5 text-sm"
          >
            <option value="">Klant kiezen…</option>
            {clients?.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={quickPrio}
            onChange={(e) => setQuickPrio(e.target.value as Priority)}
            className="rounded-lg bg-input/60 hairline px-3 py-2.5 text-sm"
          >
            <option value="low">Laag</option>
            <option value="medium">Normaal</option>
            <option value="high">Hoog</option>
            <option value="urgent">Urgent</option>
          </select>
          <input
            type="date"
            value={quickDue}
            onChange={(e) => setQuickDue(e.target.value)}
            className="rounded-lg bg-input/60 hairline px-3 py-2.5 text-sm"
          />
          <button
            onClick={quickAdd}
            className="rounded-lg bg-gradient-gold px-4 py-2.5 text-sm font-medium text-primary-foreground inline-flex items-center gap-1"
          >
            <Plus className="h-4 w-4" /> Voeg toe
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-gold/70" />
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="rounded-lg bg-input/60 hairline px-3 py-2 text-sm"
        >
          <option value="all">Alle klanten</option>
          {clients?.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="text-xs text-muted-foreground ml-auto">
          {counts.todo} open · {counts.in_progress} bezig · {counts.done} klaar
        </div>
      </div>

      {/* Board */}
      <div className="grid gap-4 md:grid-cols-3">
        {STATUS_COLS.map((col) => {
          const items = filtered.filter((t: any) => t.status === col.k);
          return (
            <div key={col.k} className="glass rounded-2xl p-3 min-h-[300px]">
              <div className="flex items-center justify-between px-2 mb-3">
                <h3 className="font-display text-lg flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-gold" />
                  {col.label}
                </h3>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((t: any) => (
                  <div
                    key={t.id}
                    className="rounded-xl bg-surface-elevated/60 p-3 border border-border/30 hover:border-gold/30 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium leading-snug">{t.title}</div>
                        {t.description && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {t.description}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => del(t.id)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="rounded-full bg-gold/15 text-gold px-2 py-0.5">
                        {clientName(t.client_id)}
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 inline-flex items-center gap-1",
                          PRIO_META[t.priority as Priority] ?? PRIO_META.medium,
                        )}
                      >
                        <Flag className="h-2.5 w-2.5" /> {t.priority}
                      </span>
                      {t.due_date && (
                        <span className="rounded-full border border-border/40 text-muted-foreground px-2 py-0.5 inline-flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" />{" "}
                          {new Date(t.due_date).toLocaleDateString("nl-NL", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex gap-1">
                      {STATUS_COLS.filter((c) => c.k !== col.k).map((c) => (
                        <button
                          key={c.k}
                          onClick={() => setStatus(t.id, c.k)}
                          className="text-[10px] rounded px-2 py-0.5 bg-accent/40 hover:bg-gold/15 hover:text-gold transition"
                        >
                          → {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-8 border border-dashed border-border/30 rounded-xl">
                    Leeg
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
