import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/besttime")({ component: BestTimePage });

const PLATFORMS = ["instagram", "linkedin", "tiktok", "facebook"] as const;
type Platform = (typeof PLATFORMS)[number];
const DAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

function BestTimePage() {
  const [platform, setPlatform] = useState<Platform>("instagram");

  const { data: benchmarks } = useQuery({
    queryKey: ["best-time", platform],
    queryFn: async () => {
      const { data } = await supabase
        .from("best_time_benchmarks")
        .select("*")
        .eq("platform", platform);
      return data ?? [];
    },
  });

  const hourOf = (t: string | null) => {
    if (!t) return null;
    const h = parseInt(t.split(":")[0] ?? "", 10);
    return Number.isFinite(h) ? h : null;
  };

  // Build grid: [day][hour] -> score (0-100)
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const b of benchmarks ?? []) {
    const h = hourOf(b.time_of_day);
    if (typeof b.day_of_week === "number" && h !== null && typeof b.score === "number") {
      const d = (b.day_of_week + 6) % 7; // Mon-first
      grid[d][h] = b.score;
    }
  }
  const max = Math.max(...grid.flat(), 1);

  // Top 5 slots
  const flat = (benchmarks ?? [])
    .filter((b) => typeof b.score === "number")
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={cn(
              "px-3 h-8 rounded-full text-xs font-medium border capitalize transition",
              platform === p ? "bg-gold/15 text-gold border-gold/40" : "border-border hover:bg-accent/40",
            )}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="rounded-xl border border-gold/15 bg-card p-4 overflow-auto">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Heatmap</div>
          <div className="min-w-[700px]">
            <div className="grid grid-cols-[40px_repeat(24,1fr)] gap-0.5 text-[10px] text-muted-foreground mb-1">
              <div></div>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="text-center">{h}</div>
              ))}
            </div>
            {grid.map((row, d) => (
              <div key={d} className="grid grid-cols-[40px_repeat(24,1fr)] gap-0.5 mb-0.5">
                <div className="text-[10px] text-muted-foreground grid place-items-center">{DAYS[d]}</div>
                {row.map((s, h) => {
                  const alpha = s / max;
                  return (
                    <div
                      key={h}
                      className="aspect-square rounded-sm"
                      style={{ background: `oklch(0.72 0.13 75 / ${alpha * 0.85 + 0.05})` }}
                      title={`${DAYS[d]} ${h}:00 — score ${s}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gold/15 bg-card p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Top slots</div>
          {flat.length === 0 && <p className="text-sm text-muted-foreground">Nog geen benchmark data.</p>}
          <div className="space-y-2">
            {flat.map((b, i) => (
              <div key={b.id} className={cn("rounded-lg border p-3", i === 0 ? "border-gold/40 bg-gold/5" : "border-border")}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{DAYS[(b.day_of_week + 6) % 7]} • {(b.time_of_day ?? "").slice(0, 5)}</span>
                  <span className="text-xs text-gold font-semibold tabular-nums">{b.score}</span>
                </div>
                <Link
                  to="/admin/compose"
                  className="mt-2 text-xs h-7 px-2 rounded-md bg-gold/15 text-gold inline-flex items-center"
                >
                  Plan op dit tijdstip
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
