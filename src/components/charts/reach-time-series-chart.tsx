import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * "08-14" is geen datum die je leest, en met dertig van die labels naast elkaar
 * wordt het een grijze streep. Kort Nederlands formaat, en in de tooltip het
 * volledige.
 */
function shortDate(value: string, long = false): string {
  const d = new Date(value.length <= 5 ? `${new Date().getFullYear()}-${value}` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: long ? "long" : "short",
    ...(long ? { weekday: "long" } : {}),
  });
}

/**
 * "Gepubliceerde posts over tijd"-grafiek op /admin/reach. Los bestand zodat
 * recharts niet in de route-bundel belandt — zie ChartInView.
 */
export default function ReachTimeSeriesChart({
  series,
}: {
  series: { date: string; posts: number }[];
}) {
  return (
    <ResponsiveContainer>
      <AreaChart data={series} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="reach-page-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0.015 75 / 30%)" vertical={false} />
        {/* Bij 30 of 90 dagen paste elk datumlabel niet meer naast
            elkaar; Recharts tekende ze dan tegen elkaar aan. We laten
            hooguit ~8 labels staan en schrijven ze als "14 aug". */}
        <XAxis
          dataKey="date"
          stroke="oklch(0.48 0.018 65)"
          fontSize={11}
          minTickGap={24}
          interval={Math.max(0, Math.ceil(series.length / 8) - 1)}
          tickFormatter={(v: string) => shortDate(v)}
          tickMargin={8}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="oklch(0.48 0.018 65)"
          fontSize={11}
          allowDecimals={false}
          width={32}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          labelFormatter={(v: string) => shortDate(v, true)}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="posts"
          stroke="var(--gold)"
          strokeWidth={2.5}
          fill="url(#reach-page-fill)"
          dot={false}
          activeDot={{ r: 4, fill: "var(--gold)", stroke: "var(--card)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
