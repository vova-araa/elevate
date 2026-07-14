import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Loader2, TrendingUp, CheckCircle2, AlertCircle, Clock,
  Instagram, Music2, Linkedin, Youtube, Facebook, BarChart3,
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

const PLATFORM_ICONS: Record<string, any> = {
  instagram: Instagram, tiktok: Music2, linkedin: Linkedin,
  youtube: Youtube, facebook: Facebook,
};
const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F", tiktok: "#000000", linkedin: "#0A66C2",
  youtube: "#FF0000", facebook: "#1877F2",
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

  if (!search.clientId && clientId) {
    navigate({ to: "/admin/analytics", search: { clientId, range }, replace: true });
  }

  const since = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString();
  }, [days]);

  const { data: posts, isLoading } = useQuery({
    enabled: !!clientId,
    queryKey: ["analytics-posts", clientId, days],
    queryFn: async () => {
      const { data } = await supabase.from("scheduled_posts")
        .select("*").eq("client_id", clientId!).gte("scheduled_at", since)
        .order("scheduled_at", { ascending: true });
      return data ?? [];
    },
  });

  if (!clients) return <Loader2 className="h-6 w-6 animate-spin text-gold" />;
  if (clients.length === 0) {
    return <div className="glass-strong rounded-xl p-8 text-center text-muted-foreground">
      Voeg eerst een klant toe om analytics te zien.
    </div>;
  }

  // Aggregate stats
  const total = posts?.length ?? 0;
  const published = posts?.filter((p) => p.status === "published").length ?? 0;
  const scheduled = posts?.filter((p) => p.status === "scheduled").length ?? 0;
  const failed = posts?.filter((p) => p.status === "failed").length ?? 0;
  const draft = posts?.filter((p) => p.status === "draft").length ?? 0;

  // Per-platform breakdown
  const byPlatform = (posts ?? []).reduce<Record<string, { name: string; total: number; published: number }>>((acc, p) => {
    const k = p.platform;
    acc[k] = acc[k] || { name: k, total: 0, published: 0 };
    acc[k].total++;
    if (p.status === "published") acc[k].published++;
    return acc;
  }, {});
  const platformData = Object.values(byPlatform);

  // Time series — posts per day
  const byDay = new Map<string, { date: string; published: number; scheduled: number; failed: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { date: key, published: 0, scheduled: 0, failed: 0 });
  }
  (posts ?? []).forEach((p) => {
    const key = (p.scheduled_at ?? p.published_at ?? "").slice(0, 10);
    const row = byDay.get(key);
    if (!row) return;
    if (p.status === "published") row.published++;
    else if (p.status === "failed") row.failed++;
    else row.scheduled++;
  });
  const timeSeries = Array.from(byDay.values());

  // Status pie
  const statusData = [
    { name: "Gepubliceerd", value: published, color: "#10B981" },
    { name: "Gepland", value: scheduled, color: "#D4B97A" },
    { name: "Concept", value: draft, color: "#6B7280" },
    { name: "Mislukt", value: failed, color: "#EF4444" },
  ].filter((d) => d.value > 0);

  // Simulated engagement estimate (real APIs not connected yet)
  const estReach = published * 1200;
  const estEngagement = published * 86;
  const successRate = total > 0 ? Math.round((published / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-gold/70">Module 4</div>
          <h1 className="font-display text-3xl sm:text-4xl text-gold mt-1">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inzicht in posting performance, platforms en trends per klant.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={clientId ?? ""}
            onChange={(e) => navigate({ to: "/admin/analytics", search: { clientId: e.target.value, range } })}
            className="rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm"
          >
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex rounded-lg border border-gold/20 overflow-hidden">
            {(["7d", "30d", "90d"] as const).map((r) => (
              <button key={r}
                onClick={() => navigate({ to: "/admin/analytics", search: { clientId, range: r } })}
                className={cn("px-3 py-2 text-xs uppercase tracking-wider",
                  range === r ? "bg-gold/20 text-gold" : "text-muted-foreground hover:bg-accent/40")}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi icon={BarChart3} label="Totaal posts" value={total} />
            <Kpi icon={CheckCircle2} label="Gepubliceerd" value={published} tint="text-emerald-400" />
            <Kpi icon={Clock} label="Gepland" value={scheduled} tint="text-gold" />
            <Kpi icon={AlertCircle} label="Mislukt" value={failed} tint="text-red-400" />
            <Kpi icon={TrendingUp} label="Succesratio" value={`${successRate}%`} tint="text-emerald-400" />
          </div>

          {/* Estimated reach */}
          <div className="grid md:grid-cols-3 gap-3">
            <EstimateCard label="Geschatte bereik" value={estReach.toLocaleString("nl-NL")}
              hint="Op basis van gepubliceerde posts. Koppel social accounts voor echte cijfers." />
            <EstimateCard label="Geschatte engagement" value={estEngagement.toLocaleString("nl-NL")}
              hint="Reacties + likes (schatting)." />
            <EstimateCard label="Posts per week" value={(total / (days / 7)).toFixed(1)}
              hint={`Gemiddeld over de laatste ${days} dagen.`} />
          </div>

          {/* Time series */}
          <div className="glass-strong rounded-xl p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-gold/70 mb-4">Activiteit over tijd</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeries}>
                  <CartesianGrid stroke="rgba(212,185,122,0.08)" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={11}
                    tickFormatter={(d) => new Date(d).toLocaleDateString("nl-NL", { month: "short", day: "numeric" })} />
                  <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "rgba(20,20,20,0.95)", border: "1px solid rgba(212,185,122,0.2)", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="published" stroke="#10B981" strokeWidth={2} name="Gepubliceerd" dot={false} />
                  <Line type="monotone" dataKey="scheduled" stroke="#D4B97A" strokeWidth={2} name="Gepland" dot={false} />
                  <Line type="monotone" dataKey="failed" stroke="#EF4444" strokeWidth={2} name="Mislukt" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Platform breakdown */}
            <div className="glass-strong rounded-xl p-5">
              <div className="text-sm uppercase tracking-[0.2em] text-gold/70 mb-4">Per platform</div>
              {platformData.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog geen posts in deze periode.</p>
              ) : (
                <>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={platformData}>
                        <CartesianGrid stroke="rgba(212,185,122,0.08)" />
                        <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                        <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: "rgba(20,20,20,0.95)", border: "1px solid rgba(212,185,122,0.2)", borderRadius: 8 }} />
                        <Bar dataKey="total" name="Totaal" radius={[6, 6, 0, 0]}>
                          {platformData.map((p) => (
                            <Cell key={p.name} fill={PLATFORM_COLORS[p.name] ?? "#D4B97A"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {platformData.map((p) => {
                      const Icon = PLATFORM_ICONS[p.name];
                      return (
                        <div key={p.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {Icon && <Icon className="h-4 w-4" style={{ color: PLATFORM_COLORS[p.name] }} />}
                            <span className="capitalize">{p.name}</span>
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
              <div className="text-sm uppercase tracking-[0.2em] text-gold/70 mb-4">Status verdeling</div>
              {statusData.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog geen data.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name"
                        innerRadius={50} outerRadius={90} paddingAngle={2}>
                        {statusData.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "rgba(20,20,20,0.95)", border: "1px solid rgba(212,185,122,0.2)", borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Recent published */}
          <div className="glass-strong rounded-xl p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-gold/70 mb-4">Recent gepubliceerd</div>
            <div className="divide-y divide-gold/10">
              {(posts ?? []).filter((p) => p.status === "published").slice(-8).reverse().map((p) => {
                const Icon = PLATFORM_ICONS[p.platform];
                return (
                  <div key={p.id} className="flex items-start gap-3 py-3">
                    {Icon && <Icon className="h-4 w-4 mt-1" style={{ color: PLATFORM_COLORS[p.platform] }} />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm line-clamp-1">{p.caption || "Geen caption"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(p.published_at ?? p.scheduled_at).toLocaleString("nl-NL")}
                      </div>
                    </div>
                  </div>
                );
              })}
              {(posts ?? []).filter((p) => p.status === "published").length === 0 && (
                <p className="text-sm text-muted-foreground py-2">Nog niets gepubliceerd in deze periode.</p>
              )}
            </div>
          </div>

          {/* Ads placeholder */}
          <div className="glass-strong rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm uppercase tracking-[0.2em] text-gold/70">Paid ads overzicht</div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Binnenkort</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {["Meta Ads", "Google Ads", "TikTok Ads"].map((n) => (
                <div key={n} className="rounded-lg border border-gold/15 p-4">
                  <div className="text-sm font-medium">{n}</div>
                  <div className="text-xs text-muted-foreground mt-1">Koppel API voor live spend, CTR en ROAS.</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tint }: any) {
  return (
    <div className="glass-strong rounded-xl p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", tint ?? "text-gold")} /> {label}
      </div>
      <div className={cn("mt-2 text-2xl font-display", tint ?? "text-foreground")}>{value}</div>
    </div>
  );
}

function EstimateCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="glass-strong rounded-xl p-5">
      <div className="text-[10px] uppercase tracking-[0.2em] text-gold/70">{label}</div>
      <div className="mt-2 text-3xl font-display text-gold">{value}</div>
      <div className="text-xs text-muted-foreground mt-2">{hint}</div>
    </div>
  );
}
