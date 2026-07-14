import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Compass, Clock, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/client/roadmap")({ component: ClientRoadmap });

const STATUS_META: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  pending: {
    label: "In afwachting",
    icon: Circle,
    color: "text-muted-foreground",
    bg: "bg-surface-elevated/60",
    border: "border-muted-foreground/20",
  },
  in_progress: {
    label: "Bezig",
    icon: ArrowRight,
    color: "text-gold",
    bg: "bg-gold/10",
    border: "border-gold/30",
  },
  completed: {
    label: "Voltooid",
    icon: CheckCircle2,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
};

const DELIVERABLE_LABELS: Record<string, string> = {
  image: "Afbeelding",
  video: "Video",
  copy: "Tekst",
  document: "Document",
  other: "Overig",
};

export function ClientRoadmap() {
  const { data, isLoading } = useQuery({
    queryKey: ["client-roadmaps"],
    queryFn: async () =>
      (await supabase.from("roadmaps").select("*, roadmap_steps(*)").order("created_at")).data ??
      [],
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Jouw traject</p>
          <h1 className="font-display text-5xl mt-2">Stappenplan</h1>
        </div>
        <div className="glass-strong rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Stappenplan laden…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Jouw traject</p>
        <h1 className="font-display text-5xl mt-2">Stappenplan</h1>
      </div>

      {data?.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Er staat nog geen stappenplan voor je klaar.
        </div>
      )}

      {data?.map((r: any) => {
        const steps = [...(r.roadmap_steps ?? [])].sort((a: any, b: any) => a.step_order - b.step_order);
        const completed = steps.filter((s: any) => s.status === "completed").length;
        const total = steps.length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

        return (
          <div key={r.id} className="glass-strong rounded-2xl p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl">{r.title}</h2>
                {r.description && (
                  <p className="text-sm text-muted-foreground mt-1 max-w-xl">{r.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-display text-3xl text-gold">{pct}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {completed} / {total} stappen
                  </div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-2 w-full rounded-full bg-surface-elevated/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-gold transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Timeline */}
            <div className="mt-8 relative pl-6 border-l-2 border-gold/20 space-y-6">
              {steps.map((s: any, idx: number) => {
                const meta = STATUS_META[s.status || "pending"] ?? STATUS_META.pending;
                const Icon = meta.icon;
                const isLast = idx === steps.length - 1;

                return (
                  <div key={s.id} className="relative">
                    {/* Connector dot */}
                    <span
                      className={cn(
                        "absolute -left-[29px] top-0 grid h-5 w-5 place-items-center rounded-full border-2 ring-4 ring-background",
                        s.status === "completed"
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : s.status === "in_progress"
                            ? "bg-gold border-gold text-primary-foreground"
                            : "bg-background border-muted-foreground/40"
                      )}
                    >
                      {s.status === "completed" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : s.status === "in_progress" ? (
                        <ArrowRight className="h-3 w-3" />
                      ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                      )}
                    </span>

                    <div
                      className={cn(
                        "rounded-xl border p-4 transition",
                        meta.border,
                        meta.bg,
                        s.status === "in_progress" && "gold-ring"
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider",
                            meta.border,
                            meta.color
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                        {s.deliverable_type && (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {DELIVERABLE_LABELS[s.deliverable_type] || s.deliverable_type}
                          </span>
                        )}
                        {s.due_date && (
                          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(s.due_date).toLocaleDateString("nl-NL")}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 font-display text-xl">{s.title}</div>
                      {s.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
