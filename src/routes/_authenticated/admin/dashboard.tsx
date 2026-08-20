import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { endOfWeek, format, formatDistanceToNow, getISOWeek, startOfWeek } from "date-fns";
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
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  getClientAnalytics,
  getAgencyAnalytics,
  type ClientAnalytics,
  type AgencyAnalytics,
} from "@/lib/analytics.functions";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { PostingBoard } from "@/components/admin/posting-board";
import { InsightsCard } from "@/components/admin/insights-card";
import { LiveFeedCard } from "@/components/admin/live-feed-card";
import { MomentumCard } from "@/components/admin/momentum-card";
import { getPostingOverview } from "@/lib/posting-overview.functions";
import { getInsights } from "@/lib/insights.functions";
import { getMomentum } from "@/lib/momentum.functions";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CalendarCheck,
  FileText,
  Instagram,
  Linkedin,
  Loader2,
  Minus,
  Music2,
  Plug,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Youtube,
  Facebook,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const searchSchema = z.object({ clientId: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  validateSearch: searchSchema,
  component: AdminDashboard,
});

type ClientMini = Pick<Tables<"clients">, "id" | "name" | "brand_color" | "industry" | "logo_url">;
type Platform = Tables<"scheduled_posts">["platform"];
type PostStatus = Tables<"scheduled_posts">["status"];

const PLATFORM_ICONS: Record<Platform, LucideIcon> = {
  instagram: Instagram,
  tiktok: Music2,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook,
};

const STATUS_LABELS: Record<PostStatus, string> = {
  scheduled: "gepland",
  draft: "concept",
  publishing: "bezig",
  published: "live",
  failed: "mislukt",
};

function capitalize(value: string): string {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

function AdminDashboard() {
  const { clientId } = Route.useSearch();

  const { data: clients } = useQuery({
    queryKey: ["clients-all-mini"],
    // Klantenlijst wijzigt zelden — langer cachen scheelt herhaalde queries.
    staleTime: 10 * 60_000,
    queryFn: async () =>
      (await supabase.from("clients").select("id,name,brand_color,industry,logo_url").order("name"))
        .data ?? [],
  });

  const selected = clientId ? (clients?.find((c) => c.id === clientId) ?? null) : null;

  // Niet wachten op de klantenlijst voordat er iets in beeld komt: de kaarten
  // tonen hun eigen skeletons en laden parallel.
  return (
    <div className="space-y-8">
      <DashboardContent clients={clients ?? []} selected={selected} clientId={clientId ?? null} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Data + layout van de "Studio-editie"                                */
/* ------------------------------------------------------------------ */

type DraftFocusItem = {
  id: string;
  caption: string | null;
  created_at: string;
  platform: Platform;
  client_id: string;
  clients: { name: string } | null;
};

type FailedFocusItem = {
  id: string;
  caption: string | null;
  scheduled_at: string;
  platform: Platform;
  client_id: string;
  clients: { name: string } | null;
};

type ExpiredChannelItem = {
  id: string;
  platform: Platform;
  client_id: string;
  account_username: string | null;
  clients: { name: string } | null;
};

type FocusKind = "draft" | "failed" | "channel";
type FocusItem = {
  id: string;
  kind: FocusKind;
  title: string;
  detail: string;
  meta: string;
  href: string;
  actionLabel: string;
};

function buildFocusItems(
  drafts: DraftFocusItem[],
  failed: FailedFocusItem[],
  channels: ExpiredChannelItem[],
): FocusItem[] {
  const draftItems: FocusItem[] = drafts.map((d) => ({
    id: `draft-${d.id}`,
    kind: "draft",
    title: d.clients?.name ?? "Onbekende klant",
    detail: d.caption || "Geen caption",
    meta: `concept sinds ${formatDistanceToNow(new Date(d.created_at), { locale: nl })}`,
    href: "/admin/approvals",
    actionLabel: "Beoordelen",
  }));
  const failedItems: FocusItem[] = failed.map((f) => ({
    id: `failed-${f.id}`,
    kind: "failed",
    title: f.clients?.name ?? "Onbekende klant",
    detail: f.caption || "Geen caption",
    meta: "publicatie mislukt",
    href: "/admin/planner",
    actionLabel: "Bekijken",
  }));
  const channelItems: FocusItem[] = channels.map((c) => ({
    id: `channel-${c.id}`,
    kind: "channel",
    title: c.clients?.name ?? "Onbekende klant",
    detail: `${capitalize(c.platform)}${c.account_username ? ` · @${c.account_username}` : ""}`,
    meta: "koppeling verlopen",
    href: "/admin/channels",
    actionLabel: "Vernieuwen",
  }));
  return [...draftItems, ...failedItems, ...channelItems];
}

function DashboardContent({
  clients,
  selected,
  clientId,
}: {
  clients: ClientMini[];
  selected: ClientMini | null;
  clientId: string | null;
}) {
  // Postbord: één server-aanroep die alles voor de komende dagen samenstelt
  // (voorheen ~11 losse queries in twee golven).
  const [postingDays, setPostingDays] = useState(7);
  const postingFn = useServerFn(getPostingOverview);
  const {
    data: posting,
    isLoading: postingLoading,
    error: postingError,
    refetch: refetchPosting,
  } = useQuery({
    queryKey: ["posting-overview", clientId ?? "all", postingDays],
    queryFn: () => postingFn({ data: { days: postingDays, ...(clientId ? { clientId } : {}) } }),
  });

  // Aanscherpingen op basis van de eigen cijfers.
  const insightsFn = useServerFn(getInsights);
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ["insights", clientId ?? "all"],
    staleTime: 5 * 60_000,
    queryFn: () => insightsFn({ data: clientId ? { clientId } : {} }),
  });

  // Motoriek: draait de machine, en wat moet er nog gebeuren.
  const momentumFn = useServerFn(getMomentum);
  const {
    data: momentum,
    isLoading: momentumLoading,
    error: momentumError,
    refetch: refetchMomentum,
  } = useQuery({
    queryKey: ["momentum", clientId ?? "all"],
    staleTime: 60_000,
    queryFn: () => momentumFn({ data: clientId ? { clientId } : {} }),
  });

  // Kerncijfers voor de ticker-regel in de masthead
  const { data: ticker, isLoading: tickerLoading } = useQuery({
    queryKey: ["dashboard-ticker", clientId ?? "all"],
    queryFn: async () => {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      let scheduledQ = supabase
        .from("scheduled_posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "scheduled")
        .is("deleted_at", null)
        .gte("scheduled_at", weekStart.toISOString())
        .lte("scheduled_at", weekEnd.toISOString());
      if (clientId) scheduledQ = scheduledQ.eq("client_id", clientId);

      let draftsQ = supabase
        .from("scheduled_posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft")
        .is("deleted_at", null);
      if (clientId) draftsQ = draftsQ.eq("client_id", clientId);

      let expiredQ = supabase
        .from("social_connections")
        .select("id", { count: "exact", head: true })
        .eq("status", "expired");
      if (clientId) expiredQ = expiredQ.eq("client_id", clientId);

      const [scheduled, drafts, expired] = await Promise.all([scheduledQ, draftsQ, expiredQ]);
      return {
        scheduledThisWeek: scheduled.count ?? 0,
        waitingApproval: drafts.count ?? 0,
        expiredChannels: expired.count ?? 0,
      };
    },
  });

  // Focus nu: concepten die het langst wachten op akkoord
  const { data: focusDrafts, isLoading: focusDraftsLoading } = useQuery({
    queryKey: ["dashboard-focus-drafts", clientId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("scheduled_posts")
        .select("id,caption,created_at,platform,client_id,clients(name)")
        .eq("status", "draft")
        .is("deleted_at", null);
      if (clientId) q = q.eq("client_id", clientId);
      return (await q.order("created_at", { ascending: true }).limit(4)).data ?? [];
    },
  });

  // Focus nu: mislukte posts
  const { data: focusFailed, isLoading: focusFailedLoading } = useQuery({
    queryKey: ["dashboard-focus-failed", clientId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("scheduled_posts")
        .select("id,caption,scheduled_at,platform,client_id,clients(name)")
        .eq("status", "failed")
        .is("deleted_at", null);
      if (clientId) q = q.eq("client_id", clientId);
      return (await q.order("scheduled_at", { ascending: false }).limit(4)).data ?? [];
    },
  });

  // Focus nu: kanalen met een verlopen koppeling
  const { data: focusExpired, isLoading: focusExpiredLoading } = useQuery({
    queryKey: ["dashboard-focus-expired-channels", clientId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("social_connections")
        .select("id,platform,client_id,account_username,clients(name)")
        .eq("status", "expired");
      if (clientId) q = q.eq("client_id", clientId);
      return (await q.limit(4)).data ?? [];
    },
  });

  // Bereik: echte cijfers uit de gedeelde analytics-laag — gepubliceerde
  // posts per dag (echt, uit scheduled_posts) plus volgers/volgersgroei
  // (echt, uit social_connections + social_metrics_snapshots). Geen
  // geschatte/verzonnen bereikcijfers meer.
  const getClientAnalyticsFn = useServerFn(getClientAnalytics);
  const getAgencyAnalyticsFn = useServerFn(getAgencyAnalytics);
  const { data: reachAnalytics, isLoading: reachLoading } = useQuery<
    ClientAnalytics | AgencyAnalytics
  >({
    queryKey: ["dashboard-reach-analytics", clientId ?? "all"],
    queryFn: () =>
      clientId
        ? getClientAnalyticsFn({ data: { clientId, days: 30 } })
        : getAgencyAnalyticsFn({ data: { days: 30 } }),
  });
  const reachSeries = (reachAnalytics?.timeSeries ?? []).map((d) => ({
    date: format(new Date(d.date), "d MMM", { locale: nl }),
    count: d.published,
  }));

  const focusItems = useMemo(
    () => buildFocusItems(focusDrafts ?? [], focusFailed ?? [], focusExpired ?? []),
    [focusDrafts, focusFailed, focusExpired],
  );
  const focusLoading = focusDraftsLoading || focusFailedLoading || focusExpiredLoading;

  return (
    <>
      <Masthead
        clients={clients}
        selected={selected}
        ticker={ticker}
        tickerLoading={tickerLoading}
      />

      {/* Postbord: wat gaat er de komende dagen live, en bij welke klant staat
          de motor stil. Dit is de kernvraag van een social-bureau. */}
      <PostingBoard
        data={posting}
        loading={postingLoading}
        error={postingError}
        onRetry={() => void refetchPosting()}
        days={postingDays}
        setDays={setPostingDays}
      />

      {/* Focus nu — wat vraagt vandaag actie. De cijfers, de agenda en het
          klantoverzicht staan in het postbord hierboven. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Focus nu" icon={Sparkles}>
          {focusLoading ? (
            <ListSkeleton rows={3} />
          ) : focusItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="text-sm text-muted-foreground">Alles onder controle.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {focusItems.map((item) => (
                <FocusRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </Card>

        <InsightsCard insights={insights} loading={insightsLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <MomentumCard
          data={momentum}
          loading={momentumLoading}
          error={momentumError}
          onRetry={() => void refetchMomentum()}
        />
        {/* De echte feed van de klant die in de sidebar actief is. */}
        <LiveFeedCard />
      </div>

      {/* Bereik — brede kaart onderaan */}
      <Card
        title="Bereik"
        icon={TrendingUp}
        link={{ to: "/admin/reach", label: "Volledige analyse" }}
      >
        <ReachChart
          series={reachSeries}
          loading={reachLoading}
          followersTotal={reachAnalytics?.followersTotal ?? null}
          followerGrowth={reachAnalytics?.followerGrowth ?? null}
        />
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Grafische stat-tegelband                                            */
/* ------------------------------------------------------------------ */

function Sparkline({ series, tint }: { series: { date: string; count: number }[]; tint: string }) {
  if (series.length < 2) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 opacity-70">
      <ResponsiveContainer>
        <AreaChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${tint}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tint} stopOpacity={0.35} />
              <stop offset="100%" stopColor={tint} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="count"
            stroke={tint}
            strokeWidth={1.5}
            fill={`url(#spark-${tint})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
  to,
  tone,
  children,
}: {
  icon: LucideIcon;
  value: ReactNode;
  label: string;
  to: string;
  tone: string;
  children?: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="card-lift group relative overflow-hidden rounded-2xl border border-gold/15 bg-card p-5 shadow-sm"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-gold opacity-80"
      />
      <div className="flex items-center justify-between">
        <span className={cn("grid h-9 w-9 place-items-center rounded-lg", tone)}>
          <Icon className="h-5 w-5" />
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-gold" />
      </div>
      <div className="mt-3 font-display text-4xl leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Masthead                                                            */
/* ------------------------------------------------------------------ */

function Masthead({
  clients,
  selected,
  ticker,
  tickerLoading,
}: {
  clients: ClientMini[];
  selected: ClientMini | null;
  ticker?: { scheduledThisWeek: number; waitingApproval: number; expiredChannels: number };
  tickerLoading: boolean;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Goedemorgen" : hour < 18 ? "Goedemiddag" : "Goedenavond";
  const namePart = user?.email?.split("@")[0]?.split(/[._-]/)[0] ?? "";
  const displayName = namePart ? capitalize(namePart) : null;
  const dateLabel = capitalize(format(now, "EEEE d MMMM", { locale: nl }));
  const edition = getISOWeek(now);

  return (
    <div className="relative overflow-hidden border-b border-gold/20 pb-6">
      {/* Zacht gouden verloop-accent voor een levendiger kop */}
      <div
        className="pointer-events-none absolute -left-16 -top-24 h-56 w-[36rem] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--gold) 22%, transparent), transparent)",
        }}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.08em] text-gold/70">
            {dateLabel} · Editie #{edition}
          </p>
          <h1 className="mt-1 font-display text-3xl sm:text-5xl leading-tight">
            {greeting}
            {displayName ? `, ${displayName}` : ""}
          </h1>
        </div>

        <div className="relative">
          <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block mb-1">
            Bekijk per klant
          </label>
          <div className="relative">
            <select
              value={selected?.id ?? ""}
              onChange={(e) =>
                navigate({
                  to: "/admin/dashboard",
                  search: e.target.value ? { clientId: e.target.value } : {},
                })
              }
              className="appearance-none rounded-lg bg-input/60 hairline pl-3 pr-9 py-2 text-sm min-w-[200px] outline-none focus:ring-2 focus:ring-gold/40"
            >
              <option value="">Alle klanten</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
        {tickerLoading || !ticker ? (
          <Skeleton className="h-4 w-64" />
        ) : (
          <>
            <TickerLink
              to="/admin/planner"
              count={ticker.scheduledThisWeek}
              label="gepland deze week"
            />
            <TickerDot />
            <TickerLink
              to="/admin/approvals"
              count={ticker.waitingApproval}
              label="wachten op akkoord"
            />
            <TickerDot />
            <TickerLink
              to="/admin/channels"
              count={ticker.expiredChannels}
              label="kanalen te vernieuwen"
            />
          </>
        )}
      </div>
    </div>
  );
}

function TickerDot() {
  return <span className="text-gold/40">·</span>;
}

function TickerLink({ to, count, label }: { to: string; count: number; label: string }) {
  return (
    <Link to={to} className="text-muted-foreground transition hover:text-gold">
      <span className="font-medium text-gold">{count}</span> {label}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Vandaag & morgen — verticale tijdlijn                               */
/* ------------------------------------------------------------------ */

function StatusPill({ status }: { status: PostStatus }) {
  return (
    <span
      className={cn(
        "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider",
        status === "scheduled" && "bg-gold/15 text-gold",
        status === "draft" && "bg-muted/40 text-muted-foreground",
        status === "publishing" && "bg-sky-500/15 text-sky-500",
        status === "published" && "bg-emerald-500/15 text-emerald-500",
        status === "failed" && "bg-red-500/15 text-red-400",
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Focus nu — prioriteitskaarten                                       */
/* ------------------------------------------------------------------ */

const FOCUS_ICON: Record<FocusKind, LucideIcon> = {
  draft: FileText,
  failed: AlertTriangle,
  channel: Plug,
};
const FOCUS_TONE: Record<FocusKind, string> = {
  draft: "text-gold bg-gold/12",
  failed: "text-red-400 bg-red-500/12",
  channel: "text-amber-500 bg-amber-500/12",
};

function FocusRow({ item }: { item: FocusItem }) {
  const Icon = FOCUS_ICON[item.kind];
  return (
    <li className="rounded-lg bg-surface-elevated/50 p-3">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
            FOCUS_TONE[item.kind],
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{item.title}</div>
          <div className="text-xs text-muted-foreground truncate">{item.detail}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground/80">{item.meta}</div>
        </div>
      </div>
      <Link
        to={item.href}
        className="mt-2 inline-flex items-center gap-1 text-xs text-gold hover:underline"
      >
        {item.actionLabel} <ArrowRight className="h-3 w-3" />
      </Link>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Bereik — brede kaart onderaan                                       */
/* ------------------------------------------------------------------ */

function ReachChart({
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
          <span className="font-display text-lg text-foreground">{total}</span> gepubliceerd (30d)
        </span>
        <span>
          <span className="font-display text-lg text-foreground">{(total / 30).toFixed(1)}</span>{" "}
          gem./dag
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          <span className="font-display text-lg text-foreground">
            {followersTotal != null ? followersTotal.toLocaleString("nl-NL") : "—"}
          </span>{" "}
          volgers
        </span>
        <span className="flex items-center gap-1">
          <GrowthIcon className={cn("h-3.5 w-3.5", growthTint)} />
          <span className={cn("font-display text-lg", growthTint)}>
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

/* ------------------------------------------------------------------ */
/* Gedeelde UI-bouwstenen                                              */
/* ------------------------------------------------------------------ */

function Card({
  title,
  icon: Icon,
  link,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  link?: { to: string; label: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-gold/15 bg-card p-5 shadow-sm", className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold/12 text-gold">
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </h2>
        {link && (
          <Link
            to={link.to}
            className="text-xs text-gold hover:underline inline-flex items-center gap-1"
          >
            {link.label} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

function Empty({ body }: { body: string }) {
  return <p className="text-sm text-muted-foreground text-center py-6">{body}</p>;
}
