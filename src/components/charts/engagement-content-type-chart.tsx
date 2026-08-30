import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

// Zelfde kleuren als de COLORS-constante in engagement.tsx (die de legenda
// eronder kleurt). Gedupliceerd i.p.v. geïmporteerd zodat de route dit
// bestand — en daarmee recharts — niet statisch binnenhaalt; blijf ze
// gelijk houden als één van de twee wijzigt.
const COLORS = ["var(--gold)", "var(--gold-soft)", "var(--gold-deep)", "oklch(0.78 0.13 78)"];

/**
 * "Content-types"-taartdiagram op /admin/engagement (de legenda eronder
 * blijft in de route). Los bestand zodat recharts niet in de route-bundel
 * belandt — zie ChartInView.
 */
export default function ContentTypeChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((_, i) => (
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
  );
}
