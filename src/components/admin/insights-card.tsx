import { Link } from "@tanstack/react-router";
import { ArrowRight, Lightbulb, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Insight, InsightTone } from "@/lib/insights.functions";

const TONE: Record<InsightTone, { icon: typeof Lightbulb; cls: string; label: string }> = {
  warning: {
    icon: AlertTriangle,
    cls: "text-red-400 bg-red-500/12",
    label: "Let op",
  },
  opportunity: {
    icon: Lightbulb,
    cls: "text-amber-500 bg-amber-500/12",
    label: "Kans",
  },
  win: {
    icon: TrendingUp,
    cls: "text-emerald-500 bg-emerald-500/12",
    label: "Goed bezig",
  },
};

/**
 * Aanscherpingen op basis van de eigen cijfers — elk advies is terug te leiden
 * naar echte data (publicatieritme, mislukte posts, volgersgroei, media).
 */
export function InsightsCard({
  insights,
  loading,
}: {
  insights: Insight[] | undefined;
  loading: boolean;
}) {
  return (
    <div className="card-surface-lg bg-card p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold/12 text-gold">
          <Sparkles className="h-4 w-4" />
        </span>
        <h2 className="font-display text-xl">Aanscherpingen</h2>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : !insights || insights.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nog te weinig data voor inzichten — die verschijnen zodra er posts live staan.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {insights.map((i) => {
            const tone = TONE[i.tone];
            const Icon = tone.icon;
            return (
              <li key={i.id} className="rounded-lg bg-surface-elevated/50 p-3">
                <div className="flex items-start gap-3">
                  <span
                    className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", tone.cls)}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{i.title}</div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{i.detail}</p>
                    <Link
                      to={i.href}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs text-gold hover:underline"
                    >
                      {i.actionLabel} <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
