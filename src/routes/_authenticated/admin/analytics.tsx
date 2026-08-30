import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageTabs } from "@/components/page-tabs";
import { ANALYSE_TABS } from "@/lib/page-tabs";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getClientAnalytics,
  getAgencyAnalytics,
  type ClientAnalytics,
  type AgencyAnalytics,
} from "@/lib/analytics.functions";
import { FEATURE_PAID_ADS } from "@/config/feature-flags";
import { useState } from "react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { formatDateRange } from "@/lib/date-range";
import { Reveal } from "@/components/reveal";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Instagram,
  Music2,
  Linkedin,
  Youtube,
  Facebook,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { useClientStore } from "@/lib/stores/client-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: OverviewPage,
});

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  instagram: Instagram,
  tiktok: Music2,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook,
};
const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F",
  // Dark-veilig grijs i.p.v. puur zwart, anders is het icoon onzichtbaar op
  // een donkere kaart.
  tiktok: "#4b5563",
  linkedin: "#0A66C2",
  youtube: "#FF0000",
  facebook: "#1877F2",
};

const PERIODS = [
  { id: "7", label: "7 dagen" },
  { id: "30", label: "30 dagen" },
  { id: "90", label: "90 dagen" },
];

/**
 * "Overzicht" gaat over de post-pipeline: wat is er verstuurd, wat mislukte,
 * wat staat er nog klaar. Volgersgroei en platformverdeling staan al op
 * Bereik en Engagement — dat hier herhalen was precies het probleem (A12):
 * drie schermen die alle drie hetzelfde lieten zien.
 */
function OverviewPage() {
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
    queryKey: ["overview-analytics", activeClient?.id ?? "all", days],
    queryFn: () =>
      activeClient?.id
        ? getClient({ data: { clientId: activeClient.id, days } })
        : getAgency({ data: { days } }),
  });

  // Alleen voor de "Recent gepubliceerd"-lijst — echte, recente posts met caption.
  const { data: recentPublished } = useQuery({
    queryKey: ["analytics-recent-published", activeClient?.id ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("scheduled_posts")
        .select("id, caption, platform, published_at, scheduled_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(8);
      if (activeClient?.id) q = q.eq("client_id", activeClient.id);
      const { data } = await q;
      return data ?? [];
    },
  });

  const posts = analytics?.posts;
  const total = posts?.total ?? 0;
  const published = posts?.published ?? 0;
  const scheduled = posts?.scheduled ?? 0;
  const failed = posts?.failed ?? 0;
  const draft = posts?.draft ?? 0;
  const successRate = total > 0 ? Math.round((published / total) * 100) : 0;
  const timeSeries = analytics?.timeSeries ?? [];

  const statusData = [
    { name: "Gepubliceerd", value: published, color: "#10B981" },
    { name: "Gepland", value: scheduled, color: "#D4B97A" },
    { name: "Concept", value: draft, color: "#6B7280" },
    { name: "Mislukt", value: failed, color: "#EF4444" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <PageTabs tabs={ANALYSE_TABS} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Post-pipeline</p>
          <h1 className="font-display text-4xl sm:text-5xl mt-2">Overzicht</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Wat is er verstuurd, wat mislukte en wat staat er nog klaar
            {activeClient ? ` voor ${activeClient.name}` : " voor alle klanten"}. Volgersgroei staat
            op Bereik, platformverdeling op Engagement.
          </p>
        </div>
        <div className="flex rounded-lg border border-gold/20 overflow-hidden h-9">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "px-3 text-xs uppercase tracking-wider",
                period === p.id
                  ? "bg-gold/20 text-gold"
                  : "text-muted-foreground hover:bg-accent/40",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-4">{formatDateRange(days)}</p>

      {isLoading ? (
        <OverviewSkeleton />
      ) : analyticsError ? (
        // Zonder deze tak stond hier een compleet ingevuld dashboard vol
        // nullen, alsof er niets gepubliceerd was.
        <ErrorState
          title="Cijfers konden niet geladen worden"
          description="De server gaf geen antwoord. De getallen hieronder zouden onjuist zijn, dus tonen we ze niet."
          onRetry={() => void refetchAnalytics()}
        />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi icon={BarChart3} label="Totaal posts" value={total} />
            <Kpi
              icon={CheckCircle2}
              label="Gepubliceerd"
              value={published}
              tint="text-emerald-400"
            />
            <Kpi icon={Clock} label="Gepland" value={scheduled} tint="text-gold" />
            <Kpi icon={AlertCircle} label="Mislukt" value={failed} tint="text-red-400" />
            <Kpi
              icon={TrendingUp}
              label="Succesratio"
              value={`${successRate}%`}
              tint="text-emerald-400"
            />
          </div>

          {/* Pipeline over tijd */}
          <div className="glass-strong rounded-xl p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="text-sm uppercase tracking-[0.2em] text-gold/70">
                Pipeline over tijd
              </div>
              <div className="text-xs text-muted-foreground">{formatDateRange(days)}</div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeries}>
                  <defs>
                    <linearGradient id="activity-published" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="activity-scheduled" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="activity-failed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(212,185,122,0.08)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.max(0, Math.ceil(timeSeries.length / 9) - 1)}
                    tickFormatter={(d) =>
                      new Date(d).toLocaleDateString("nl-NL", { month: "short", day: "numeric" })
                    }
                  />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={11}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    labelFormatter={(d) =>
                      new Date(d).toLocaleDateString("nl-NL", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })
                    }
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--foreground)",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="published"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fill="url(#activity-published)"
                    name="Gepubliceerd"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="scheduled"
                    stroke="var(--gold)"
                    strokeWidth={2.5}
                    fill="url(#activity-scheduled)"
                    name="Gepland"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    stroke="#EF4444"
                    strokeWidth={2.5}
                    fill="url(#activity-failed)"
                    name="Mislukt"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <Reveal className="grid lg:grid-cols-2 gap-4">
            {/* Status pie */}
            <div className="glass-strong rounded-xl p-5">
              <div className="text-sm uppercase tracking-[0.2em] text-gold/70 mb-4">
                Status verdeling
              </div>
              {statusData.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog geen data.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {statusData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          color: "var(--foreground)",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Recent published */}
            <div className="glass-strong rounded-xl p-5">
              <div className="text-sm uppercase tracking-[0.2em] text-gold/70 mb-4">
                Recent gepubliceerd
              </div>
              <div className="divide-y divide-gold/10">
                {(recentPublished ?? []).map((p) => {
                  const Icon = PLATFORM_ICONS[p.platform];
                  return (
                    <div key={p.id} className="flex items-start gap-3 py-3">
                      {Icon && (
                        <Icon
                          className="h-4 w-4 mt-1"
                          style={{ color: PLATFORM_COLORS[p.platform] }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm line-clamp-1">{p.caption || "Geen caption"}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(p.published_at ?? p.scheduled_at).toLocaleString("nl-NL")}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(recentPublished ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">
                    Nog niets gepubliceerd in deze periode.
                  </p>
                )}
              </div>
            </div>
          </Reveal>

          {/* A14: geen API-koppeling — dit blok blijft verborgen tot dat er is. */}
          {FEATURE_PAID_ADS && (
            <div className="glass-strong rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm uppercase tracking-[0.2em] text-gold/70">
                  Paid ads overzicht
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Binnenkort
                </span>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {["Meta Ads", "Google Ads", "TikTok Ads"].map((n) => (
                  <div key={n} className="rounded-lg border border-gold/15 p-4">
                    <div className="text-sm font-medium">{n}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Koppel API voor live spend, CTR en ROAS.
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tint?: string;
}) {
  return (
    <div className="glass-strong rounded-xl p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", tint ?? "text-gold")} /> {label}
      </div>
      <div
        className={cn(
          "mt-2 text-2xl font-display tabular-nums lining-nums",
          tint ?? "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}
