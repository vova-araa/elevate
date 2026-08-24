import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTabs } from "@/components/page-tabs";
import { CONTENT_TABS } from "@/lib/page-tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { VISIBLE_PLATFORMS, type Platform } from "@/config/platforms";
import { computeBestTimeSlots } from "@/lib/best-times";

export const Route = createFileRoute("/_authenticated/admin/besttime")({ component: BestTimePage });

const DAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

/**
 * A03: dit scherm toonde TOP SLOTS met scores 92-86 uit `best_time_benchmarks`
 * — een tabel met verzonnen cijfers, terwijl er nul posts gepubliceerd waren.
 * Elders in de app (Bereik, Engagement) staat juist eerlijk "nog geen data".
 *
 * Gekozen aanpak (optie B): geen losse benchmark-tabel meer. De heatmap komt
 * nu uit echt gepubliceerde posts (scheduled_posts.published_at) — een simpele
 * telling per dag/uur, geen verzonnen "score". Zolang die telling leeg is,
 * tonen we dezelfde eerlijke lege staat als de rest van de analyse-schermen.
 */
function BestTimePage() {
  const [platform, setPlatform] = useState<Platform>(VISIBLE_PLATFORMS[0]?.id ?? "instagram");

  const { data: published, isLoading } = useQuery({
    queryKey: ["best-time-published", platform],
    queryFn: async () =>
      (
        await supabase
          .from("scheduled_posts")
          .select("published_at")
          .eq("platform", platform)
          .eq("status", "published")
          .is("deleted_at", null)
          .not("published_at", "is", null)
      ).data ?? [],
  });

  // Build grid: [day][hour] -> aantal publicaties op dat moment (géén score)
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const p of published ?? []) {
    if (!p.published_at) continue;
    const d = new Date(p.published_at);
    const day = (d.getDay() + 6) % 7; // Mon-first
    grid[day][d.getHours()] += 1;
  }
  const max = Math.max(...grid.flat(), 1);
  const total = published?.length ?? 0;
  const flat = computeBestTimeSlots((published ?? []).map((p) => p.published_at));

  return (
    <div className="space-y-5 max-w-6xl">
      <PageTabs tabs={CONTENT_TABS} />
      <div className="flex flex-wrap gap-2">
        {VISIBLE_PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPlatform(p.id)}
            className={cn(
              "px-3 h-8 rounded-full text-xs font-medium border transition",
              platform === p.id
                ? "bg-gold/15 text-gold border-gold/40"
                : "border-border hover:bg-accent/40",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!isLoading && total === 0 ? (
        <div className="rounded-xl border border-dashed border-gold/25 bg-gold/[0.04] p-8 text-center">
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Nog geen gepubliceerde {VISIBLE_PLATFORMS.find((p) => p.id === platform)?.label ?? ""}
            -posts om een patroon uit af te leiden. Zodra er posts gepubliceerd zijn, verschijnt
            hier een heatmap op basis van je eigen publicatiemomenten — geen benchmark, je eigen
            data.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-5">
          <div className="rounded-xl border border-gold/15 bg-card p-4 overflow-auto">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Heatmap — publicaties per dag/uur ({total} in totaal)
            </div>
            <div className="min-w-[700px]">
              <div className="grid grid-cols-[40px_repeat(24,1fr)] gap-0.5 text-[10px] text-muted-foreground mb-1">
                <div></div>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-center">
                    {h}
                  </div>
                ))}
              </div>
              {grid.map((row, d) => (
                <div key={d} className="grid grid-cols-[40px_repeat(24,1fr)] gap-0.5 mb-0.5">
                  <div className="text-[10px] text-muted-foreground grid place-items-center">
                    {DAYS[d]}
                  </div>
                  {row.map((count, h) => {
                    const alpha = count / max;
                    return (
                      <div
                        key={h}
                        className="aspect-square rounded-sm"
                        style={{ background: `oklch(0.72 0.13 75 / ${alpha * 0.85 + 0.05})` }}
                        title={`${DAYS[d]} ${h}:00 — ${count} publicatie${count === 1 ? "" : "s"}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gold/15 bg-card p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Meest gebruikte tijdstippen
            </div>
            <div className="space-y-2">
              {flat.map((s, i) => (
                <div
                  key={`${s.day}-${s.hour}`}
                  className={cn(
                    "rounded-lg border p-3",
                    i === 0 ? "border-gold/40 bg-gold/5" : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {DAYS[(s.day + 6) % 7]} • {String(s.hour).padStart(2, "0")}:00
                    </span>
                    <span className="text-xs text-gold font-semibold tabular-nums">{s.count}×</span>
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
      )}
    </div>
  );
}
