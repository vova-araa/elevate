import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

type FollowerGrowthPoint = { date: string; total: number };

/**
 * "Volgersgroei"-kaart op het klantoverzicht: kop + de grafiek als één
 * geheel. Los bestand zodat recharts niet in de client/overview-route-bundel
 * belandt — zie ChartInView, dat dit lazy-laadt.
 */
export default function FollowerGrowthCard({
  series,
  loading,
}: {
  series: FollowerGrowthPoint[];
  loading: boolean;
}) {
  return (
    <div className="card-surface bg-card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-gold" />
        <h2 className="font-display text-xl">Volgersgroei</h2>
      </div>

      {loading ? (
        <Skeleton className="mt-4 h-56 w-full rounded-lg" />
      ) : series.length < 2 ? (
        <EmptyState
          icon={<TrendingUp className="h-5 w-5" />}
          title="Nog niet genoeg data"
          description="Volgersgroei verschijnt zodra we langer meten."
          className="mt-4 py-8"
        />
      ) : (
        <div className="mt-4 h-56">
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="follower-growth-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval={Math.max(0, Math.ceil(series.length / 8) - 1)}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={10}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(value) => Number(value).toLocaleString("nl-NL")}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--foreground)",
                }}
                labelStyle={{ color: "var(--foreground)" }}
                formatter={(value) => [Number(value).toLocaleString("nl-NL"), "Volgers"]}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="var(--gold)"
                strokeWidth={2.5}
                fill="url(#follower-growth-fill)"
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
