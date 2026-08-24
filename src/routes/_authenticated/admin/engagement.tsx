import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTabs } from "@/components/page-tabs";
import { ANALYSE_TABS } from "@/lib/page-tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientStore } from "@/lib/stores/client-store";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Sparkles, Video } from "lucide-react";
import { useState } from "react";
import { subDays } from "date-fns";
import { formatDateRange } from "@/lib/date-range";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/reveal";

export const Route = createFileRoute("/_authenticated/admin/engagement")({
  component: EngagementPage,
});

const COLORS = ["var(--gold)", "var(--gold-soft)", "var(--gold-deep)", "oklch(0.78 0.13 78)"];

const PERIODS = [
  { id: "7", label: "7 dagen" },
  { id: "30", label: "30 dagen" },
  { id: "90", label: "90 dagen" },
];

function isVideo(media_type?: string | null, media_path?: string | null) {
  const mt = media_type ?? "";
  const mp = media_path ?? "";
  return mt.startsWith("video") || /\.(mp4|mov|webm)/i.test(mp);
}

function EngagementPage() {
  const { activeClient } = useClientStore();
  // Voorheen ontbrak elke datumafbakening hier: de lijst toonde "alles ooit
  // gepubliceerd" zonder dat ergens te zeggen. Zelfde periode-patroon als
  // /admin/reach, zodat "posts per platform" niet blijft groeien richting het
  // begin van de tijd.
  const [period, setPeriod] = useState("30");
  const days = Number(period);
  const sinceIso = subDays(new Date(), days).toISOString();

  const { data: posts } = useQuery({
    queryKey: ["engagement-posts", activeClient?.id, days],
    queryFn: async () => {
      let q = supabase
        .from("scheduled_posts")
        .select("id, platform, status, media_path, media_type, caption, published_at")
        .eq("status", "published")
        .gte("published_at", sinceIso)
        .order("published_at", { ascending: false });
      if (activeClient?.id) q = q.eq("client_id", activeClient.id);
      const { data } = await q;
      return data ?? [];
    },
  });

  const platformCounts: Record<string, number> = {};
  const typeCounts = { image: 0, video: 0, text: 0 };
  for (const p of posts ?? []) {
    if (p.platform) platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
    if (!p.media_path) typeCounts.text++;
    else if (isVideo(p.media_type, p.media_path)) typeCounts.video++;
    else typeCounts.image++;
  }
  const platformData = Object.entries(platformCounts).map(([platform, count]) => ({
    platform,
    count,
  }));
  const typeData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));

  const videoPosts = (posts ?? []).filter((p) => isVideo(p.media_type, p.media_path));

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
      <div className="grid md:grid-cols-2 gap-5">
        <div className="card-surface bg-card p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
            Posts per platform
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <BarChart data={platformData} layout="vertical" margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0.015 75 / 30%)" />
                <XAxis
                  type="number"
                  stroke="oklch(0.48 0.018 65)"
                  fontSize={11}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="platform"
                  stroke="oklch(0.48 0.018 65)"
                  fontSize={11}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="count" fill="var(--gold)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-surface bg-card p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
            Content-types
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={typeData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {typeData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-xs mt-2">
            {typeData.map((t, i) => (
              <div key={t.name} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="capitalize">{t.name}</span>
                <span className="text-muted-foreground tabular-nums lining-nums">{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Reveal className="card-surface bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Reacties op video's
          </div>
          <span className="text-[10px] text-muted-foreground">
            {videoPosts.length} video{videoPosts.length === 1 ? "" : "s"}
          </span>
        </div>

        {videoPosts.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Nog geen gepubliceerde video's.
          </div>
        ) : (
          <ul className="divide-y divide-gold/10">
            {videoPosts.map((p) => (
              <li key={p.id} className="py-3 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                  <Video className="h-4 w-4 text-gold" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{p.caption || "(geen caption)"}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span className="capitalize">{p.platform}</span>
                    {p.published_at && (
                      <span>· {new Date(p.published_at).toLocaleDateString("nl-NL")}</span>
                    )}
                  </div>
                </div>
                <div
                  className="flex items-center gap-1.5 shrink-0 rounded-full border border-gold/20 bg-gold/5 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground"
                  title="Reactietellingen vereisen een insights-koppeling per platform die er nu nog niet is."
                >
                  <Sparkles className="h-3 w-3" />
                  Na koppeling insights
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground mt-3">
          Reactietellingen zijn nog niet beschikbaar — dat vereist een insights-koppeling per
          platform. Zodra die actief is, verschijnen hier echte cijfers in plaats van deze staat.
        </p>
      </Reveal>

      <p className="text-xs text-muted-foreground">
        De cijfers hierboven (posts per platform, content-type-verdeling) gaan over de gekozen
        periode ({formatDateRange(days)}) en komen rechtstreeks uit de gepubliceerde posts — dat is
        echte data. Engagement-rates (likes/comments/ shares) per post zijn nog niet beschikbaar en
        vereisen een insights-koppeling per{" "}
        <Link to="/admin/channels" className="text-gold underline">
          gekoppeld account
        </Link>
        . Die tonen we hier eerlijk als "beschikbaar na koppeling insights" in plaats van een kaal
        streepje.
      </p>
    </div>
  );
}
