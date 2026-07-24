import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, subDays } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Users,
  Share2,
  CalendarClock,
  Inbox,
  ListChecks,
  Compass,
  ArrowRight,
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
  Music2,
  Send,
  FileBarChart,
  Link2,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { listClientChannels } from "@/lib/channels.functions";
import { EmptyState } from "@/components/empty-state";
import { ReportCard } from "@/components/client-portal/report-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/client/overview")({
  component: ClientOverview,
});

type Platform = "instagram" | "tiktok" | "linkedin" | "youtube" | "facebook";

const PLATFORM_META: Record<Platform, { label: string; Icon: LucideIcon; tint: string }> = {
  instagram: { label: "Instagram", Icon: Instagram, tint: "text-fuchsia-500 dark:text-rose-300" },
  tiktok: { label: "TikTok", Icon: Music2, tint: "text-cyan-600 dark:text-cyan-300" },
  linkedin: { label: "LinkedIn", Icon: Linkedin, tint: "text-sky-600 dark:text-sky-300" },
  youtube: { label: "YouTube", Icon: Youtube, tint: "text-red-500 dark:text-red-300" },
  facebook: { label: "Facebook", Icon: Facebook, tint: "text-indigo-500 dark:text-indigo-300" },
};

const PLATFORM_ORDER: Platform[] = ["instagram", "tiktok", "linkedin", "youtube", "facebook"];

function ClientOverview() {
  const { user } = useAuth();
  const listChannels = useServerFn(listClientChannels);

  const { data: membership, isLoading: loadingMembership } = useQuery({
    queryKey: ["my-client", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_members")
        .select("client_id, clients(name)")
        .eq("user_id", user!.id)
        .order("client_id")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const clientId = (membership as { client_id?: string } | null)?.client_id;
  const clientName =
    (membership as { clients?: { name?: string | null } | null } | null)?.clients?.name ?? null;

  // Kanalen + volgers (client-safe server function)
  const { data: channelData, isLoading: loadingChannels } = useQuery({
    queryKey: ["overview-channels", clientId],
    enabled: !!clientId,
    queryFn: () => listChannels({ data: {} }),
  });

  // Volgersgroei: echte metingen uit social_metrics_snapshots (klant mag zijn
  // eigen client lezen via RLS — user_has_client_access). Laatste ~90 dagen,
  // per dag de som van de laatste meting per platform.
  const ninetyDaysAgoIso = useMemo(() => subDays(new Date(), 90).toISOString(), []);

  const { data: followerGrowth, isLoading: loadingGrowth } = useQuery({
    queryKey: ["overview-follower-growth", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("social_metrics_snapshots")
        .select("platform, followers, captured_at")
        .eq("client_id", clientId!)
        .gte("captured_at", ninetyDaysAgoIso)
        .order("captured_at", { ascending: true });
      return aggregateFollowerGrowth(data ?? []);
    },
  });

  // Eerstvolgende geplande posts (+ totaal-count)
  const nowIso = useMemo(() => new Date().toISOString(), []);

  const { data: upcoming, isLoading: loadingUpcoming } = useQuery({
    queryKey: ["overview-upcoming-posts", clientId],
    enabled: !!clientId,
    queryFn: async () =>
      (
        await supabase
          .from("scheduled_posts")
          .select("id, platform, caption, scheduled_at, status, media_path, media_type")
          .eq("client_id", clientId!)
          .eq("status", "scheduled")
          .is("deleted_at", null)
          .gte("scheduled_at", nowIso)
          .order("scheduled_at")
          .limit(5)
      ).data ?? [],
  });

  const { data: scheduledCount, isLoading: loadingScheduledCount } = useQuery({
    queryKey: ["overview-scheduled-count", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { count } = await supabase
        .from("scheduled_posts")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId!)
        .eq("status", "scheduled")
        .is("deleted_at", null)
        .gte("scheduled_at", nowIso);
      return count ?? 0;
    },
  });

  // Wacht op jouw akkoord (kalender-items: pending/delivered)
  const { data: approvalCount, isLoading: loadingApprovalCount } = useQuery({
    queryKey: ["overview-approval-count", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { count } = await supabase
        .from("calendar_items")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId!)
        .in("status", ["pending", "delivered"]);
      return count ?? 0;
    },
  });

  // Open taken (alles wat niet 'done' is)
  const { data: openTasks, isLoading: loadingTasks } = useQuery({
    queryKey: ["overview-open-tasks", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId!)
        .neq("status", "done");
      return count ?? 0;
    },
  });

  // Stappenplan-voortgang
  const { data: roadmaps, isLoading: loadingRoadmaps } = useQuery({
    queryKey: ["overview-roadmaps", clientId],
    enabled: !!clientId,
    queryFn: async () =>
      ((
        await supabase
          .from("roadmaps")
          .select("*, roadmap_steps(*)")
          .eq("client_id", clientId!)
          .order("created_at")
      ).data ?? []) as (Tables<"roadmaps"> & { roadmap_steps: Tables<"roadmap_steps">[] })[],
  });

  // Laatste rapport
  const { data: latestReport, isLoading: loadingReport } = useQuery({
    queryKey: ["overview-latest-report", clientId],
    enabled: !!clientId,
    queryFn: async () =>
      (
        await supabase
          .from("reports")
          .select("*")
          .eq("client_id", clientId!)
          .order("created_at", { ascending: false })
          .limit(1)
      ).data?.[0] ?? null,
  });

  // Afgeleide waarden
  const channels = channelData?.channels ?? [];
  const followerValues = channels
    .map((c) => c.follower_count)
    .filter((n): n is number => typeof n === "number");
  const followerTotal =
    followerValues.length > 0 ? followerValues.reduce((a, b) => a + b, 0) : null;
  const connectedChannels = channels.filter((c) => c.status === "active").length;

  const roadmapProgress = useMemo(() => {
    const steps = (roadmaps ?? []).flatMap((r) => r.roadmap_steps ?? []);
    const total = steps.length;
    const completed = steps.filter((s) => s.status === "completed").length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }, [roadmaps]);

  // --- Laad-/lege staten ---
  if (loadingMembership) {
    return <OverviewSkeleton />;
  }

  if (!membership) {
    return (
      <div className="max-w-2xl">
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Nog geen bedrijf gekoppeld"
          description="Zodra je Elevate-team je aan een bedrijf koppelt, verschijnt hier je persoonlijke dashboard met kanalen, planning en resultaten."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Kop */}
      <header>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">
          {clientName ?? "Elevate"}
        </p>
        <h1 className="font-display text-4xl sm:text-5xl mt-2">Welkom terug</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Een overzicht van je social-media in één blik: je kanalen, wat er gepland staat en wat er
          op jou wacht.
        </p>
      </header>

      {/* Stat-tegelband */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile
          to="/client/channels"
          Icon={Users}
          label="Volgers totaal"
          value={
            loadingChannels
              ? null
              : followerTotal === null
                ? "—"
                : followerTotal.toLocaleString("nl-NL")
          }
        />
        <StatTile
          to="/client/channels"
          Icon={Share2}
          label="Gekoppelde kanalen"
          value={loadingChannels ? null : connectedChannels.toLocaleString("nl-NL")}
        />
        <StatTile
          to="/client/calendar"
          Icon={CalendarClock}
          label="Geplande posts"
          value={loadingScheduledCount ? null : (scheduledCount ?? 0).toLocaleString("nl-NL")}
        />
        <StatTile
          to="/client/calendar"
          Icon={Inbox}
          label="Wacht op akkoord"
          value={loadingApprovalCount ? null : (approvalCount ?? 0).toLocaleString("nl-NL")}
          accent={(approvalCount ?? 0) > 0}
        />
        <StatTile
          to="/client/tasks"
          Icon={ListChecks}
          label="Open taken"
          value={loadingTasks ? null : (openTasks ?? 0).toLocaleString("nl-NL")}
        />
      </div>

      {/* Volgersgroei — echte metingen uit snapshots */}
      <FollowerGrowthCard series={followerGrowth ?? []} loading={loadingGrowth} />

      {/* Twee kolommen: eerstvolgende posts + stappenplan */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Eerstvolgende posts */}
        <div className="lg:col-span-2 rounded-xl border border-gold/10 bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-gold" />
              <h2 className="font-display text-xl">Eerstvolgende posts</h2>
            </div>
            <Link
              to="/client/calendar"
              className="text-xs text-gold hover:underline inline-flex items-center gap-1"
            >
              Kalender <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {loadingUpcoming ? (
              <>
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </>
            ) : (upcoming?.length ?? 0) === 0 ? (
              <EmptyState
                icon={<CalendarClock className="h-5 w-5" />}
                title="Nog niets ingepland"
                description="Zodra je team posts inplant, verschijnen ze hier op volgorde van publicatie."
                className="py-8"
              />
            ) : (
              upcoming!.map((p) => {
                const meta = PLATFORM_META[p.platform as Platform];
                const Icon = meta?.Icon ?? Send;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg border border-border/40 bg-surface/40 p-3"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-background/50">
                      <Icon className={cn("h-5 w-5", meta?.tint ?? "text-gold")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {p.caption?.trim() || (meta?.label ?? p.platform)}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {format(new Date(p.scheduled_at), "EEE d MMM · HH:mm", { locale: nl })}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold">
                      {meta?.label ?? p.platform}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Stappenplan-voortgang */}
        <div className="rounded-xl border border-gold/10 bg-card p-5 sm:p-6 flex flex-col">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-gold" />
            <h2 className="font-display text-xl">Stappenplan</h2>
          </div>

          <div className="mt-4 flex flex-1 flex-col items-center justify-center text-center">
            {loadingRoadmaps ? (
              <Skeleton className="h-32 w-32 rounded-full" />
            ) : roadmapProgress.total === 0 ? (
              <p className="text-sm text-muted-foreground py-6">
                Er staat nog geen stappenplan voor je klaar.
              </p>
            ) : (
              <>
                <ProgressRing pct={roadmapProgress.pct} />
                <p className="mt-3 text-sm text-muted-foreground">
                  {roadmapProgress.completed} van {roadmapProgress.total} stappen voltooid
                </p>
              </>
            )}
          </div>

          <Link
            to="/client/roadmap"
            className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold/15 px-4 py-2.5 text-sm font-medium text-gold hover:bg-gold/25"
          >
            Bekijk stappenplan <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Kanalen-statusrij */}
      <div className="rounded-xl border border-gold/10 bg-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-gold" />
            <h2 className="font-display text-xl">Kanalen</h2>
          </div>
          <Link
            to="/client/channels"
            className="text-xs text-gold hover:underline inline-flex items-center gap-1"
          >
            Beheren <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loadingChannels
            ? PLATFORM_ORDER.map((id) => <Skeleton key={id} className="h-16 w-full rounded-lg" />)
            : PLATFORM_ORDER.map((id) => {
                const meta = PLATFORM_META[id];
                const ch = channels.find((c) => c.platform === id);
                const active = !!ch && ch.status === "active";
                const Icon = meta.Icon;
                return (
                  <div
                    key={id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3",
                      active ? "border-gold/20 bg-gold/[0.03]" : "border-border/40 bg-surface/30",
                    )}
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-background/50">
                      <Icon className={cn("h-5 w-5", meta.tint)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{meta.label}</div>
                      {active ? (
                        <div className="text-xs text-muted-foreground truncate">
                          {ch!.account_username ?? "—"}
                          {typeof ch!.follower_count === "number" && (
                            <> · {ch!.follower_count.toLocaleString("nl-NL")} volgers</>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Link2 className="h-3 w-3" /> Niet gekoppeld
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
        </div>
      </div>

      {/* Laatste rapport */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-gold" />
            <h2 className="font-display text-xl">Laatste rapport</h2>
          </div>
          <Link
            to="/client/reports"
            className="text-xs text-gold hover:underline inline-flex items-center gap-1"
          >
            Alle rapporten <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {loadingReport ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : latestReport ? (
          <ReportCard report={latestReport} />
        ) : (
          <EmptyState
            icon={<FileBarChart className="h-5 w-5" />}
            title="Nog geen rapporten"
            description="Je eerste maandrapport verschijnt hier zodra je team het klaargezet heeft."
            className="py-8"
          />
        )}
      </div>
    </div>
  );
}

type FollowerGrowthPoint = { date: string; total: number };

/**
 * Zet ruwe snapshots om naar een dagreeks: per dag de laatste meting per
 * platform, gesommeerd over platforms. Rijen komen oplopend op captured_at
 * binnen, dus de laatste set() per (dag, platform) is de meest recente meting.
 */
function aggregateFollowerGrowth(
  rows: { platform: string; followers: number | null; captured_at: string }[],
): FollowerGrowthPoint[] {
  const perDay = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (typeof row.followers !== "number") continue;
    const dayKey = format(new Date(row.captured_at), "yyyy-MM-dd");
    let platforms = perDay.get(dayKey);
    if (!platforms) {
      platforms = new Map<string, number>();
      perDay.set(dayKey, platforms);
    }
    platforms.set(row.platform, row.followers);
  }
  return Array.from(perDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, platforms]) => ({
      date: format(new Date(day), "d MMM", { locale: nl }),
      total: Array.from(platforms.values()).reduce((a, b) => a + b, 0),
    }));
}

/** Volgersgroei-grafiek op basis van echte metingen (geen verzonnen cijfers). */
function FollowerGrowthCard({
  series,
  loading,
}: {
  series: FollowerGrowthPoint[];
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-gold/10 bg-card p-5 sm:p-6">
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

function StatTile({
  to,
  Icon,
  label,
  value,
  accent = false,
}: {
  to: string;
  Icon: LucideIcon;
  label: string;
  value: string | null;
  accent?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-elegant",
        accent ? "border-gold/40 gold-ring" : "border-gold/10 hover:border-gold/25",
      )}
    >
      <div
        className={cn(
          "grid h-9 w-9 place-items-center rounded-lg",
          accent ? "bg-gradient-gold text-primary-foreground" : "bg-gold/10 text-gold",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      {value === null ? (
        <Skeleton className="mt-3 h-8 w-16" />
      ) : (
        <div
          className={cn(
            "mt-3 font-display text-3xl tabular-nums",
            accent ? "text-gold" : "text-foreground",
          )}
        >
          {value}
        </div>
      )}
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </Link>
  );
}

/** Gouden voortgangsring voor het stappenplan (0-100). */
function ProgressRing({ pct }: { pct: number }) {
  const size = 132;
  const strokeWidth = 10;
  const clamped = Math.max(0, Math.min(100, pct));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-border/50"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          stroke="currentColor"
          className="text-gold transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display text-4xl tabular-nums text-gold">{clamped}%</span>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-12 w-64" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 w-full rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
