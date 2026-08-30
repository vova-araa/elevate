import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * "Posts per platform"-staafdiagram op /admin/engagement. Los bestand zodat
 * recharts niet in de route-bundel belandt — zie ChartInView.
 */
export default function PlatformBarChart({
  data,
}: {
  data: { platform: string; count: number }[];
}) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0.015 75 / 30%)" />
        <XAxis type="number" stroke="oklch(0.48 0.018 65)" fontSize={11} allowDecimals={false} />
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
  );
}
