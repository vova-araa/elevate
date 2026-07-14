import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientStore } from "@/lib/stores/client-store";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/reach")({ component: ReachPage });

const PERIODS = [
  { id: "7", label: "7 dagen" },
  { id: "30", label: "30 dagen" },
  { id: "90", label: "90 dagen" },
];

function ReachPage() {
  const { activeClient } = useClientStore();
  const [period, setPeriod] = useState("30");

  const { data: posts } = useQuery({
    queryKey: ["reach-posts", activeClient?.id, period],
    queryFn: async () => {
      const from = new Date(Date.now() - Number(period) * 86400000).toISOString();
      let q = supabase
        .from("scheduled_posts")
        .select("scheduled_at, platform, status")
        .gte("scheduled_at", from)
        .eq("status", "published");
      if (activeClient?.id) q = q.eq("client_id", activeClient.id);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Build daily series — uses post-count as proxy for reach until Postiz analytics endpoint is wired
  const days = Number(period);
  const buckets: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    buckets[d] = 0;
  }
  for (const p of posts ?? []) {
    const d = (p.scheduled_at ?? "").slice(0, 10);
    if (buckets[d] !== undefined) buckets[d] += 1;
  }
  const series = Object.entries(buckets).map(([date, posts]) => ({ date: date.slice(5), posts }));
  const total = Object.values(buckets).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={cn(
              "px-3 h-8 rounded-full text-xs font-medium border transition",
              period === p.id ? "bg-gold/15 text-gold border-gold/40" : "border-border hover:bg-accent/40",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Posts gepubliceerd" value={total} />
        <StatCard label="Gem. per dag" value={(total / days).toFixed(1)} />
        <StatCard label="Periode" value={`${days}d`} />
        <StatCard label="Klant" value={activeClient?.name ?? "Alle"} small />
      </div>

      <div className="rounded-xl border border-gold/15 bg-card p-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Activiteit over tijd</div>
        <div className="h-[260px]">
          <ResponsiveContainer>
            <LineChart data={series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0.015 75 / 30%)" />
              <XAxis dataKey="date" stroke="oklch(0.48 0.018 65)" fontSize={11} />
              <YAxis stroke="oklch(0.48 0.018 65)" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="posts" stroke="var(--gold)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Live bereik-cijfers per platform vereisen de Postiz analytics-koppeling. Zodra die endpoint actief is, worden hier follower-aantallen, impressies en profielbezoeken getoond.
      </p>
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: any; small?: boolean }) {
  return (
    <div className="rounded-lg bg-surface p-3.5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-display tabular-nums", small ? "text-base truncate" : "text-2xl")}>{value}</div>
    </div>
  );
}
