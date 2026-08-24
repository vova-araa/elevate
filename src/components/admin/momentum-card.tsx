import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Activity, ArrowRight, CheckCircle2, ListChecks, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { acceptSuggestedTask, type MomentumOverview } from "@/lib/momentum.functions";

/** Kleur volgt de score: rood onder de 50, amber tot 75, groen daarboven. */
function toneFor(score: number, max = 100): string {
  const pct = (score / max) * 100;
  if (pct < 50) return "text-red-400";
  if (pct < 75) return "text-amber-500";
  return "text-emerald-500";
}

export function MomentumCard({
  data,
  loading,
  error,
  onRetry,
}: {
  data: MomentumOverview | undefined;
  loading: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  const qc = useQueryClient();
  const accept = useServerFn(acceptSuggestedTask);
  const [adding, setAdding] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gold/15 bg-card p-5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-4 h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Motoriek kon niet laden"
        description="De score en openstaande taken zijn niet opgehaald."
        onRetry={onRetry}
      />
    );
  }

  const circumference = 2 * Math.PI * 34;
  const offset = circumference * (1 - data.score / 100);

  async function addTask(s: MomentumOverview["suggestions"][number]) {
    setAdding(s.key);
    try {
      await accept({
        data: {
          clientId: s.clientId,
          title: s.title,
          description: s.why,
          priority: s.priority === "high" ? "high" : s.priority === "low" ? "low" : "medium",
        },
      });
      toast.success("Taak toegevoegd");
      qc.invalidateQueries({ queryKey: ["momentum"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Toevoegen mislukt");
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="rounded-2xl border border-gold/15 bg-card p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold/12 text-gold">
          <Activity className="h-4 w-4" />
        </span>
        <h2 className="font-display text-xl">Motoriek</h2>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        {/* Score-ring */}
        <div className="relative grid h-24 w-24 shrink-0 place-items-center">
          <svg className="h-24 w-24 -rotate-90" viewBox="0 0 80 80" aria-hidden>
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              strokeWidth="7"
              className="stroke-muted/30"
            />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={cn("transition-all duration-700", toneFor(data.score))}
              stroke="currentColor"
            />
          </svg>
          <span className="absolute font-display text-2xl tabular-nums lining-nums">
            {data.score}
          </span>
        </div>

        {/* Onderdelen */}
        <div className="min-w-[200px] flex-1 space-y-2">
          {data.parts.map((p) => (
            <div key={p.key}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{p.label}</span>
                <span className={cn("tabular-nums lining-nums", toneFor(p.score, p.max))}>
                  {p.score}/{p.max}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/30">
                <div
                  className="h-full rounded-full bg-gradient-gold transition-all duration-700"
                  style={{ width: `${(p.score / p.max) * 100}%` }}
                />
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{p.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Voorgestelde taken */}
      {data.suggestions.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-gold" /> Voorgesteld — voegt echt iets toe
          </div>
          <ul className="space-y-2">
            {data.suggestions.map((s) => (
              <li
                key={s.key}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-elevated/50 p-3"
              >
                <div className="min-w-[180px] flex-1">
                  <div className="text-sm font-medium">{s.title}</div>
                  <p className="text-xs text-muted-foreground">{s.why}</p>
                </div>
                <button
                  onClick={() => addTask(s)}
                  disabled={adding === s.key}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-gold/30 px-3 text-xs text-gold transition hover:bg-gold/10 disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" /> Als taak
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Openstaande taken */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <ListChecks className="h-3 w-3" /> Nog te doen
          </div>
          <Link
            to="/admin/tasks"
            className="inline-flex items-center gap-1 text-xs text-gold hover:underline"
          >
            Alle taken <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {data.openTasks.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Geen openstaande taken.
          </div>
        ) : (
          <ul className="space-y-1">
            {data.openTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    t.priority === "urgent" || t.priority === "high"
                      ? "bg-red-400"
                      : t.priority === "medium"
                        ? "bg-amber-400"
                        : "bg-muted-foreground/40",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                {t.clientName && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">{t.clientName}</span>
                )}
                {t.dueDate && (
                  <span
                    className={cn(
                      "shrink-0 text-[11px]",
                      t.overdue ? "text-red-400" : "text-muted-foreground",
                    )}
                  >
                    {new Date(t.dueDate).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
