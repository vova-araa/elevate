import { createFileRoute } from "@tanstack/react-router";
import { ErrorState } from "@/components/error-state";
import { PageTabs } from "@/components/page-tabs";
import { ANALYSE_TABS } from "@/lib/page-tabs";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getClientAnalytics,
  getAgencyAnalytics,
  type ClientAnalytics,
  type AgencyAnalytics,
} from "@/lib/analytics.functions";
import { useClientStore } from "@/lib/stores/client-store";
import { lazy, useState } from "react";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateRange } from "@/lib/date-range";
import { Reveal } from "@/components/reveal";
import { ChartInView } from "@/components/charts/chart-in-view";

export const Route = createFileRoute("/_authenticated/admin/reach")({ component: ReachPage });

// Recharts (~375KB) pas ophalen zodra de grafiek in beeld scrolt — zie
// ChartInView.
const ReachTimeSeriesChart = lazy(() => import("@/components/charts/reach-time-series-chart"));

const PERIODS = [
  { id: "7", label: "7 dagen" },
  { id: "30", label: "30 dagen" },
  { id: "90", label: "90 dagen" },
];

function ReachPage() {
  const { activeClient } = useClientStore();
  const [period, setPeriod] = useState("30");
  const days = Number(period);

  const getClient = useServerFn(getClientAnalytics);
  const getAgency = useServerFn(getAgencyAnalytics);

  const {
    data: analytics,
    isLoading,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useQuery<ClientAnalytics | AgencyAnalytics>({
    queryKey: ["reach-analytics", activeClient?.id ?? "all", days],
    queryFn: () =>
      activeClient?.id
        ? getClient({ data: { clientId: activeClient.id, days } })
        : getAgency({ data: { days } }),
  });

  const series = (analytics?.timeSeries ?? []).map((d) => ({
    date: d.date.slice(5),
    posts: d.published,
  }));
  const totalPublished = analytics?.posts.published ?? 0;

  return (
    <div className="space-y-5 max-w-6xl">
      <PageTabs tabs={ANALYSE_TABS} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "px-3 h-8 rounded-full text-xs font-medium border transition",
                period === p.id
                  ? "bg-gold/15 text-gold border-gold/40"
                  : "border-border hover:bg-accent/40",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{formatDateRange(days)}</span>
      </div>

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      ) : analyticsError ? (
        <ErrorState
          title="Cijfers konden niet geladen worden"
          description="De server gaf geen antwoord. De getallen hieronder zouden onjuist zijn, dus tonen we ze niet."
          onRetry={() => void refetchAnalytics()}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Volgers totaal"
              value={
                analytics?.followersTotal != null
                  ? analytics.followersTotal.toLocaleString("nl-NL")
                  : "—"
              }
            />
            <FollowerGrowthStat growth={analytics?.followerGrowth ?? null} />
            <StatCard label="Posts gepubliceerd" value={totalPublished} />
            <StatCard label="Klant" value={activeClient?.name ?? "Alle"} small />
          </div>

          <div className="card-surface bg-card p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Gepubliceerde posts over tijd
              </div>
              <div className="text-xs text-muted-foreground">{formatDateRange(days)}</div>
            </div>
            <ChartInView className="h-[300px] sm:h-[360px]">
              <ReachTimeSeriesChart series={series} />
            </ChartInView>
          </div>

          {analytics && analytics.followersByPlatform.length > 0 && (
            <Reveal className="card-surface bg-card p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
                Volgers per platform
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {analytics.followersByPlatform.map((f) => (
                  <div key={f.platform} className="rounded-lg bg-surface p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground capitalize">
                      {f.platform}
                    </div>
                    <div className="mt-1 font-display text-lg tabular-nums lining-nums">
                      {f.followers != null ? f.followers.toLocaleString("nl-NL") : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          <p className="text-xs text-muted-foreground">
            Volgers en volgersgroei komen uit de echte kanaalkoppelingen (bijgewerkt bij elke
            ververs-actie). Bereik en impressies per post vereisen een insights-koppeling per
            platform die er nu nog niet is — daarom tonen we hier alleen wat we echt weten: het
            aantal gepubliceerde posts en de volgersontwikkeling.
          </p>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  small,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="rounded-lg bg-surface p-3.5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 font-display tabular-nums lining-nums",
          small ? "text-base truncate" : "text-2xl",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function FollowerGrowthStat({ growth }: { growth: number | null }) {
  const Icon = growth == null || growth === 0 ? Minus : growth > 0 ? TrendingUp : TrendingDown;
  const tint =
    growth == null ? "" : growth > 0 ? "text-emerald-400" : growth < 0 ? "text-red-400" : "";
  const value = growth == null ? "—" : `${growth > 0 ? "+" : ""}${growth.toLocaleString("nl-NL")}`;
  return (
    <div className="rounded-lg bg-surface p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3 w-3" /> Volgersgroei
      </div>
      <div className={cn("mt-1 font-display text-2xl tabular-nums lining-nums", tint)}>{value}</div>
    </div>
  );
}
