import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Minus, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * "Bereik"-kaart op het dashboard: kop-cijfers + de gepubliceerde-posts
 * grafiek als één geheel. Los bestand zodat recharts niet in de
 * dashboard-route-bundel belandt — zie ChartInView, dat dit lazy-laadt.
 */
export default function ReachChart({
  series,
  loading,
  followersTotal,
  followerGrowth,
}: {
  series: { date: string; count: number }[];
  loading: boolean;
  followersTotal: number | null;
  followerGrowth: number | null;
}) {
  if (loading) return <Skeleton className="h-48 w-full rounded-lg" />;
  const total = series.reduce((sum, p) => sum + p.count, 0);

  const GrowthIcon =
    followerGrowth == null || followerGrowth === 0
      ? Minus
      : followerGrowth > 0
        ? TrendingUp
        : TrendingDown;
  const growthTint =
    followerGrowth == null
      ? "text-foreground"
      : followerGrowth > 0
        ? "text-emerald-400"
        : followerGrowth < 0
          ? "text-red-400"
          : "text-foreground";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span>
          <span className="font-display text-lg tabular-nums lining-nums text-foreground">
            {total}
          </span>{" "}
          gepubliceerd (30d)
        </span>
        <span>
          <span className="font-display text-lg tabular-nums lining-nums text-foreground">
            {(total / 30).toFixed(1)}
          </span>{" "}
          gem./dag
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          <span className="font-display text-lg tabular-nums lining-nums text-foreground">
            {followersTotal != null ? followersTotal.toLocaleString("nl-NL") : "—"}
          </span>{" "}
          volgers
        </span>
        <span className="flex items-center gap-1">
          <GrowthIcon className={cn("h-3.5 w-3.5", growthTint)} />
          <span className={cn("font-display text-lg tabular-nums lining-nums", growthTint)}>
            {followerGrowth != null
              ? `${followerGrowth > 0 ? "+" : ""}${followerGrowth.toLocaleString("nl-NL")}`
              : "—"}
          </span>{" "}
          volgersgroei
        </span>
      </div>
      {total === 0 ? (
        <Empty body="Nog geen gepubliceerde posts in de afgelopen 30 dagen." />
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="reach-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="oklch(0.85 0.015 75 / 30%)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="oklch(0.48 0.018 65)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval={Math.max(0, Math.ceil(series.length / 8) - 1)}
              />
              <YAxis
                stroke="oklch(0.48 0.018 65)"
                fontSize={10}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--gold)"
                strokeWidth={2.5}
                fill="url(#reach-fill)"
                dot={false}
                activeDot={{ r: 4, fill: "var(--gold)", stroke: "var(--card)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Empty({ body }: { body: string }) {
  return <p className="text-sm text-muted-foreground text-center py-6">{body}</p>;
}
