import type { ReactNode } from "react";
import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  endOfWeek,
  format,
  formatDistanceToNow,
  getISOWeek,
  isToday,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";
import { nl } from "date-fns/locale";
import {
  CartesianGrid,
  Line,
  LineChart,
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
import { HealthRing } from "@/components/admin/health-ring";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
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
    queryFn: async () =>
      (await supabase.from("clients").select("id,name,brand_color,industry,logo_url").order("name"))
        .data ?? [],
  });

  const selected = clientId ? (clients?.find((c) => c.id === clientId) ?? null) : null;

  if (!clients) return <Loader2 className="h-6 w-6 animate-spin text-gold" />;

  return (
    <div className="space-y-8">
      <DashboardContent clients={clients} selected={selected} clientId={clientId ?? null} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Data + layout van de "Studio-editie"                                */
/* ------------------------------------------------------------------ */

type AgendaItem = {
  id: string;
  caption: string | null;
  scheduled_at: string;
  platform: Platform;
  status: PostStatus;
  client_id: string;
  clients: { name: string } | null;
};

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

type HealthData = {
  upcomingSet: Set<string>;
  oldDraftSet: Set<string>;
  channelCounts: Map<string, number>;
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

function computeHealthScore(clientId: string, health: HealthData): number {
  let score = 0;
  if (health.upcomingSet.has(clientId)) score += 40;
  if (!health.oldDraftSet.has(clientId)) score += 30;
  if ((health.channelCounts.get(clientId) ?? 0) > 0) score += 30;
  return score;
}

function healthStatusLabel(clientId: string, health: HealthData): string {
  if ((health.channelCounts.get(clientId) ?? 0) === 0) return "Geen kanaal gekoppeld";
  if (health.oldDraftSet.has(clientId)) return "Concepten wachten al > 5 dagen";
  if (!health.upcomingSet.has(clientId)) return "Niets gepland deze week";
  return "Alles op schema";
}

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

  // Agenda: geplande posts van vandaag en morgen
  const { data: agenda, isLoading: agendaLoading } = useQuery({
    queryKey: ["dashboard-agenda", clientId ?? "all"],
    queryFn: async () => {
      const start = startOfDay(new Date());
      const end = addDays(start, 2);
      let q = supabase
        .from("scheduled_posts")
        .select("id,caption,scheduled_at,platform,status,client_id,clients(name)")
        .is("deleted_at", null)
        .neq("status", "failed")
        .gte("scheduled_at", start.toISOString())
        .lt("scheduled_at", end.toISOString());
      if (clientId) q = q.eq("client_id", clientId);
      return (await q.order("scheduled_at", { ascending: true })).data ?? [];
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

  // Klant-gezondheid: ruwe data om per klant een score 0-100 te berekenen
  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["dashboard-client-health", clientId ?? "all"],
    queryFn: async (): Promise<HealthData> => {
      const now = new Date();
      const in7 = addDays(now, 7);
      const fiveDaysAgo = subDays(now, 5);

      let upcomingQ = supabase
        .from("scheduled_posts")
        .select("client_id")
        .eq("status", "scheduled")
        .is("deleted_at", null)
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", in7.toISOString());
      if (clientId) upcomingQ = upcomingQ.eq("client_id", clientId);

      let oldDraftsQ = supabase
        .from("scheduled_posts")
        .select("client_id")
        .eq("status", "draft")
        .is("deleted_at", null)
        .lt("created_at", fiveDaysAgo.toISOString());
      if (clientId) oldDraftsQ = oldDraftsQ.eq("client_id", clientId);

      let channelsQ = supabase.from("social_connections").select("client_id");
      if (clientId) channelsQ = channelsQ.eq("client_id", clientId);

      const [upcoming, oldDrafts, channels] = await Promise.all([upcomingQ, oldDraftsQ, channelsQ]);

      const channelCounts = new Map<string, number>();
      for (const row of channels.data ?? []) {
        channelCounts.set(row.client_id, (channelCounts.get(row.client_id) ?? 0) + 1);
      }

      return {
        upcomingSet: new Set((upcoming.data ?? []).map((r) => r.client_id)),
        oldDraftSet: new Set((oldDrafts.data ?? []).map((r) => r.client_id)),
        channelCounts,
      };
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

  const todayItems = (agenda ?? []).filter((p) => isToday(new Date(p.scheduled_at)));
  const tomorrowItems = (agenda ?? []).filter((p) => !isToday(new Date(p.scheduled_at)));

  const focusItems = useMemo(
    () => buildFocusItems(focusDrafts ?? [], focusFailed ?? [], focusExpired ?? []),
    [focusDrafts, focusFailed, focusExpired],
  );
  const focusLoading = focusDraftsLoading || focusFailedLoading || focusExpiredLoading;

  const healthRows = useMemo(() => {
    if (!health) return [];
    const relevantClients = selected ? [selected] : clients;
    return relevantClients
      .map((c) => ({
        client: c,
        score: computeHealthScore(c.id, health),
        status: healthStatusLabel(c.id, health),
      }))
      .sort((a, b) => a.score - b.score);
  }, [clients, selected, health]);

  return (
    <>
      <Masthead
        clients={clients}
        selected={selected}
        ticker={ticker}
        tickerLoading={tickerLoading}
      />

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_1.4fr_1fr]">
        {/* Vandaag & morgen */}
        <Card
          title="Vandaag & morgen"
          icon={CalendarClock}
          link={{ to: "/admin/planner", label: "Open planner" }}
        >
          {agendaLoading ? (
            <ListSkeleton rows={4} />
          ) : (agenda ?? []).length === 0 ? (
            <Empty body="Geen posts gepland voor vandaag of morgen." />
          ) : (
            <div className="space-y-6">
              <TimelineDay label="Vandaag" items={todayItems} />
              <TimelineDay label="Morgen" items={tomorrowItems} />
            </div>
          )}
        </Card>

        {/* Focus nu */}
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

        {/* Klanten */}
        <Card title="Klanten" icon={Users}>
          {healthLoading || !health ? (
            <ListSkeleton rows={4} />
          ) : healthRows.length === 0 ? (
            <Empty body="Nog geen klanten." />
          ) : (
            <ul className="space-y-1">
              {healthRows.map(({ client, score, status }) => (
                <li key={client.id}>
                  <Link
                    to="/admin/clients/$id"
                    params={{ id: client.id }}
                    className="flex items-center gap-3 rounded-lg p-2 -mx-2 transition hover:bg-accent/40"
                  >
                    <HealthRing score={score} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{client.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{status}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
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
    <div className="border-b border-gold/20 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
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

function TimelineDay({ label, items }: { label: string; items: AgendaItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <ul className="border-l-2 border-gold/30 ml-1">
        {items.map((p) => {
          const Icon = PLATFORM_ICONS[p.platform] ?? Instagram;
          return (
            <li key={p.id} className="relative pl-5 pb-5 last:pb-0">
              <span className="absolute -left-[7px] top-0.5 h-3 w-3 rounded-full border-2 border-gold bg-card" />
              <Link
                to="/admin/planner"
                className="block -ml-2 rounded-lg p-2 transition hover:bg-accent/40"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium tabular-nums text-gold">
                    {format(new Date(p.scheduled_at), "HH:mm", { locale: nl })}
                  </span>
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">
                    {p.clients?.name ?? "Onbekende klant"}
                  </span>
                  <StatusPill status={p.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground truncate">
                  {p.caption || <span className="italic">geen caption</span>}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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
        <div className="h-[200px]">
          <ResponsiveContainer>
            <LineChart data={series} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
              <Line
                type="monotone"
                dataKey="count"
                stroke="var(--gold)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
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
    <div className={cn("rounded-xl border border-gold/10 bg-card p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg flex items-center gap-2">
          <Icon className="h-4 w-4 text-gold" /> {title}
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
