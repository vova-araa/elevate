import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { getClientAnalytics } from "@/lib/analytics.functions";
import { z } from "zod";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Instagram,
  Music2,
  Linkedin,
  Youtube,
  Facebook,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  clientId: z.string().uuid().optional(),
  range: z.enum(["7d", "30d", "90d"]).optional(),
});

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  validateSearch: searchSchema,
  component: AnalyticsPage,
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

function rangeToDays(r?: string) {
  return r === "7d" ? 7 : r === "90d" ? 90 : 30;
}

function AnalyticsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const range = search.range ?? "30d";
  const days = rangeToDays(range);

  const { data: clients } = useQuery({
    queryKey: ["clients-analytics"],
    queryFn: async () =>
      (await supabase.from("clients").select("id,name,brand_color").order("name")).data ?? [],
  });

  const selected = clients?.find((c) => c.id === search.clientId) ?? clients?.[0];
  const clientId = selected?.id;

  // Zet een default clientId in de URL — in een effect, niet tijdens render
  // (geen state-update tijdens render).
  useEffect(() => {
    if (!search.clientId && clientId) {
      navigate({ to: "/admin/analytics", search: { clientId, range }, replace: true });
    }
  }, [search.clientId, clientId, range, navigate]);

  const getAnalytics = useServerFn(getClientAnalytics);
  const { data: analytics, isLoading } = useQuery({
    enabled: !!clientId,
    queryKey: ["client-analytics", clientId, days],
    queryFn: () => getAnalytics({ data: { clientId: clientId!, days } }),
  });

  // Alleen voor de "Recent gepubliceerd"-lijst — echte, recente posts met caption.
  const { data: recentPublished } = useQuery({
    enabled: !!clientId,
    queryKey: ["analytics-recent-published", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("scheduled_posts")
        .select("id, caption, platform, published_at, scheduled_at")
        .eq("client_id", clientId!)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  if (!clients) return <AnalyticsSkeleton />;
  if (clients.length === 0) {
    return (
      <div className="glass-strong rounded-xl p-8 text-center text-muted-foreground">
        Voeg eerst een klant toe om analytics te zien.
      </div>
    );
  }

  const posts = analytics?.posts;
  const total = posts?.total ?? 0;
  const published = posts?.published ?? 0;
  const scheduled = posts?.scheduled ?? 0;
  const failed = posts?.failed ?? 0;
  const draft = posts?.draft ?? 0;
  const successRate = total > 0 ? Math.round((published / total) * 100) : 0;

  const platformData = analytics?.postsByPlatform ?? [];
  const timeSeries = analytics?.timeSeries ?? [];

  const statusData = [
    { name: "Gepubliceerd", value: published, color: "#10B981" },
    { name: "Gepland", value: scheduled, color: "#D4B97A" },
    { name: "Concept", value: draft, color: "#6B7280" },
    { name: "Mislukt", value: failed, color: "#EF4444" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-gold/70">Per klant</div>
          <h1 className="font-display text-3xl sm:text-4xl text-gold mt-1">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inzicht in posting performance, platforms en trends per klant.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={clientId ?? ""}
            onChange={(e) =>
              navigate({ to: "/admin/analytics", search: { clientId: e.target.value, range } })
            }
            className="rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg border border-gold/20 overflow-hidden">
            {(["7d", "30d", "90d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => navigate({ to: "/admin/analytics", search: { clientId, range: r } })}
                className={cn(
                  "px-3 py-2 text-xs uppercase tracking-wider",
                  range === r ? "bg-gold/20 text-gold" : "text-muted-foreground hover:bg-accent/40",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <AnalyticsSkeleton />
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

          {/* Echte volgerscijfers + posts per week */}
          <div className="grid md:grid-cols-3 gap-3">
            <StatCard
              icon={Users}
              label="Volgers totaal"
              value={
                analytics?.followersTotal != null
                  ? analytics.followersTotal.toLocaleString("nl-NL")
                  : "—"
              }
              hint={
                analytics?.followersTotal != null
                  ? "Som van bekende volgersaantallen over gekoppelde kanalen."
                  : "Nog geen kanaal gekoppeld met een leverbaar volgersaantal."
              }
            />
            <FollowerGrowthCard growth={analytics?.followerGrowth ?? null} days={days} />
            <StatCard
              icon={BarChart3}
              label="Posts per week"
              value={(total / (days / 7)).toFixed(1)}
              hint={`Gemiddeld over de laatste ${days} dagen.`}
            />
          </div>

          {analytics && analytics.followersByPlatform.length > 0 && (
            <div className="glass-strong rounded-xl p-5">
              <div className="text-sm uppercase tracking-[0.2em] text-gold/70 mb-4">
                Volgers per platform
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {analytics.followersByPlatform.map((f) => {
                  const Icon = PLATFORM_ICONS[f.platform];
                  return (
                    <div key={f.platform} className="rounded-lg border border-gold/15 p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground capitalize">
                        {Icon && (
                          <Icon
                            className="h-3.5 w-3.5"
                            style={{ color: PLATFORM_COLORS[f.platform] }}
                          />
                        )}
                        {f.platform}
                      </div>
                      <div className="mt-1 text-xl font-display">
                        {f.followers != null ? f.followers.toLocaleString("nl-NL") : "—"}
                      </div>
                      {f.followers == null && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Platform levert geen volgersaantal via de API.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Time series */}
          <div className="glass-strong rounded-xl p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-gold/70 mb-4">
              Activiteit over tijd
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeries}>
                  <CartesianGrid stroke="rgba(212,185,122,0.08)" />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    fontSize={11}
                    tickFormatter={(d) =>
                      new Date(d).toLocaleDateString("nl-NL", { month: "short", day: "numeric" })
                    }
                  />
                  <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--foreground)",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="published"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="Gepubliceerd"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="scheduled"
                    stroke="#D4B97A"
                    strokeWidth={2}
                    name="Gepland"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="failed"
                    stroke="#EF4444"
                    strokeWidth={2}
                    name="Mislukt"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Platform breakdown */}
            <div className="glass-strong rounded-xl p-5">
              <div className="text-sm uppercase tracking-[0.2em] text-gold/70 mb-4">
                Per platform
              </div>
              {platformData.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog geen posts in deze periode.</p>
              ) : (
                <>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={platformData}>
                        <CartesianGrid stroke="rgba(212,185,122,0.08)" />
                        <XAxis dataKey="platform" stroke="#9ca3af" fontSize={11} />
                        <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            background: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            color: "var(--foreground)",
                          }}
                        />
                        <Bar dataKey="total" name="Totaal" radius={[6, 6, 0, 0]}>
                          {platformData.map((p) => (
                            <Cell
                              key={p.platform}
                              fill={PLATFORM_COLORS[p.platform] ?? "#D4B97A"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {platformData.map((p) => {
                      const Icon = PLATFORM_ICONS[p.platform];
                      return (
                        <div key={p.platform} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {Icon && (
                              <Icon
                                className="h-4 w-4"
                                style={{ color: PLATFORM_COLORS[p.platform] }}
                              />
                            )}
                            <span className="capitalize">{p.platform}</span>
                          </div>
                          <div className="text-muted-foreground">
                            {p.published}/{p.total} gepubliceerd
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

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

          {/* Ads placeholder */}
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
        </>
      )}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      {/* Stat cards */}
      <div className="grid md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
      {/* Grafiek */}
      <Skeleton className="h-80 w-full rounded-xl" />
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
      <div className={cn("mt-2 text-2xl font-display", tint ?? "text-foreground")}>{value}</div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="glass-strong rounded-xl p-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-gold/70">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 text-3xl font-display text-gold">{value}</div>
      <div className="text-xs text-muted-foreground mt-2">{hint}</div>
    </div>
  );
}

function FollowerGrowthCard({ growth, days }: { growth: number | null; days: number }) {
  const Icon = growth == null || growth === 0 ? Minus : growth > 0 ? TrendingUp : TrendingDown;
  const tint =
    growth == null
      ? "text-gold"
      : growth > 0
        ? "text-emerald-400"
        : growth < 0
          ? "text-red-400"
          : "text-gold";
  const value = growth == null ? "—" : `${growth > 0 ? "+" : ""}${growth.toLocaleString("nl-NL")}`;
  const hint =
    growth == null
      ? `Beschikbaar zodra er minstens 2 metingen zijn (na koppelen/verversen van een kanaal). Nog geen historie over de laatste ${days} dagen.`
      : `Verschil tussen de oudste en nieuwste meting in de laatste ${days} dagen.`;
  return (
    <div className="glass-strong rounded-xl p-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-gold/70">
        <Icon className={cn("h-3.5 w-3.5", tint)} /> Volgersgroei
      </div>
      <div className={cn("mt-2 text-3xl font-display", tint)}>{value}</div>
      <div className="text-xs text-muted-foreground mt-2">{hint}</div>
    </div>
  );
}
