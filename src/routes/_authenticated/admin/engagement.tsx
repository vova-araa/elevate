import { createFileRoute } from "@tanstack/react-router";
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
import { MessageCircle, Video } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/engagement")({
  component: EngagementPage,
});

const COLORS = ["var(--gold)", "var(--gold-soft)", "var(--gold-deep)", "oklch(0.78 0.13 78)"];

function isVideo(media_type?: string | null, media_path?: string | null) {
  const mt = media_type ?? "";
  const mp = media_path ?? "";
  return mt.startsWith("video") || /\.(mp4|mov|webm)/i.test(mp);
}

function EngagementPage() {
  const { activeClient } = useClientStore();

  const { data: posts } = useQuery({
    queryKey: ["engagement-posts", activeClient?.id],
    queryFn: async () => {
      let q = supabase
        .from("scheduled_posts")
        .select("id, platform, status, media_path, media_type, caption, published_at")
        .eq("status", "published")
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
      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-xl border border-gold/15 bg-card p-4">
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

        <div className="rounded-xl border border-gold/15 bg-card p-4">
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
                <span className="text-muted-foreground tabular-nums">{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gold/15 bg-card p-4">
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
                <div className="flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground shrink-0">
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>—</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground mt-3">
          Reactietellingen worden gesynchroniseerd zodra de Postiz analytics-koppeling actief is.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Engagement-rates (likes/comments/shares) per post vereisen de Postiz analytics-koppeling.
      </p>
    </div>
  );
}
