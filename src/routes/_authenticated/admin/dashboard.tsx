import type { ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, formatDistanceToNow, isToday, startOfDay } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import {
  ArrowRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  FileText,
  Instagram,
  Linkedin,
  ListChecks,
  Loader2,
  MessageSquare,
  Music2,
  Plus,
  Sparkles,
  TrendingUp,
  UserPlus,
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

const PLATFORM_ICONS: Record<Platform, LucideIcon> = {
  instagram: Instagram,
  tiktok: Music2,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook,
};

function AdminDashboard() {
  const { clientId } = Route.useSearch();
  const { user } = useAuth();

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
      <Header clients={clients} selected={selected} />
      <DashboardBody clientId={clientId ?? null} userId={user?.id} />
    </div>
  );
}

function Header({ clients, selected }: { clients: ClientMini[]; selected: ClientMini | null }) {
  const navigate = useNavigate();
  const isAll = !selected;
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Dashboard</p>
        <div className="mt-2 flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center font-display text-lg text-primary-foreground shrink-0 overflow-hidden"
            style={{
              background: isAll
                ? "var(--gradient-gold)"
                : selected.logo_url
                  ? "transparent"
                  : selected.brand_color || "var(--gradient-gold)",
            }}
          >
            {isAll ? (
              <Sparkles className="h-5 w-5" />
            ) : selected.logo_url ? (
              <img
                src={selected.logo_url}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              selected.name?.[0]?.toUpperCase()
            )}
          </div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl leading-none">
              {isAll ? "Alle klanten" : selected.name}
            </h1>
            <div className="text-xs text-muted-foreground mt-1">
              {isAll
                ? `${clients.length} klant${clients.length === 1 ? "" : "en"} totaal`
                : selected.industry || "—"}
            </div>
          </div>
        </div>
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
            className="appearance-none rounded-lg bg-input/60 hairline pl-3 pr-9 py-2 text-sm min-w-[220px] outline-none focus:ring-2 focus:ring-gold/40"
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
  );
}

function DashboardBody({ clientId, userId }: { clientId: string | null; userId?: string }) {
  // KPI's voor de tegels bovenaan
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["dashboard-kpis", clientId ?? "all", userId ?? "anon"],
    queryFn: async () => {
      const now = new Date();
      const in7 = addDays(now, 7);

      let scheduledQ = supabase
        .from("scheduled_posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "scheduled")
        .is("deleted_at", null)
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", in7.toISOString());
      if (clientId) scheduledQ = scheduledQ.eq("client_id", clientId);

      let draftsQ = supabase
        .from("scheduled_posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft")
        .is("deleted_at", null);
      if (clientId) draftsQ = draftsQ.eq("client_id", clientId);

      let tasksQ = supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .neq("status", "done");
      if (clientId) tasksQ = tasksQ.eq("client_id", clientId);

      // "Ongelezen klantberichten": de messages-tabel heeft geen gelezen-status,
      // dus we tellen de ongelezen new_message-notificaties van deze gebruiker.
      const messagesQ = userId
        ? supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("type", "new_message")
            .eq("read", false)
        : null;

      const [sched, drafts, tasks, msgs] = await Promise.all([
        scheduledQ,
        draftsQ,
        tasksQ,
        messagesQ,
      ]);
      return {
        scheduled: sched.count ?? 0,
        drafts: drafts.count ?? 0,
        tasks: tasks.count ?? 0,
        messages: msgs?.count ?? 0,
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

  // Recente feedback van klanten op posts
  const { data: feedback, isLoading: feedbackLoading } = useQuery({
    queryKey: ["dashboard-feedback", clientId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("post_comments")
        .select("id,body,created_at,client_id,clients(name)")
        .eq("author_role", "client");
      if (clientId) q = q.eq("client_id", clientId);
      return (await q.order("created_at", { ascending: false }).limit(6)).data ?? [];
    },
  });

  // Openstaande taken
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["dashboard-tasks", clientId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("tasks")
        .select("id,title,due_date,status,priority,client_id")
        .neq("status", "done");
      if (clientId) q = q.eq("client_id", clientId);
      return (await q.order("due_date", { nullsFirst: false }).limit(8)).data ?? [];
    },
  });

  // Recent goedgekeurde deliverables
  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ["dashboard-results", clientId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("calendar_items")
        .select("id,title,date,status,deliverable_type")
        .eq("status", "approved");
      if (clientId) q = q.eq("client_id", clientId);
      return (await q.order("date", { ascending: false }).limit(6)).data ?? [];
    },
  });

  const todayItems = (agenda ?? []).filter((p) => isToday(new Date(p.scheduled_at)));
  const tomorrowItems = (agenda ?? []).filter((p) => !isToday(new Date(p.scheduled_at)));

  return (
    <>
      {/* KPI-tegels */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiTile
          to="/admin/planner"
          icon={Calendar}
          label="Gepland (7 dagen)"
          value={kpis?.scheduled}
          loading={kpisLoading}
          accent="gold"
        />
        <KpiTile
          to="/admin/queue"
          icon={FileText}
          label="Concepten wachtend"
          value={kpis?.drafts}
          loading={kpisLoading}
          accent="amber"
        />
        <KpiTile
          to="/admin/messages"
          icon={MessageSquare}
          label="Ongelezen klantberichten"
          value={kpis?.messages}
          loading={kpisLoading}
          accent="sky"
        />
        <KpiTile
          to="/admin/tasks"
          icon={ListChecks}
          label="Open taken"
          value={kpis?.tasks}
          loading={kpisLoading}
          accent="emerald"
        />
      </div>

      {/* Snelacties */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <QuickAction
          to="/admin/compose"
          icon={Plus}
          title="Nieuwe post"
          subtitle="Composer openen"
        />
        <QuickAction
          to="/admin/ai"
          icon={Sparkles}
          title="AI Studio"
          subtitle="Content genereren"
        />
        <QuickAction
          to="/admin/clients/new"
          icon={UserPlus}
          title="Nieuwe klant"
          subtitle="Klant toevoegen"
        />
        <QuickAction
          to="/admin/approvals"
          icon={CheckSquare}
          title="Goedkeuringen"
          subtitle="Concepten beoordelen"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Vandaag & morgen */}
        <Card
          title="Vandaag & morgen"
          icon={CalendarClock}
          link={{ to: "/admin/planner", label: "Open planner" }}
          className="lg:col-span-2"
        >
          {agendaLoading ? (
            <ListSkeleton rows={4} />
          ) : (agenda ?? []).length === 0 ? (
            <Empty body="Geen posts gepland voor vandaag of morgen." />
          ) : (
            <div className="space-y-4">
              <AgendaSection label="Vandaag" items={todayItems} />
              <AgendaSection label="Morgen" items={tomorrowItems} />
            </div>
          )}
        </Card>

        {/* Recente feedback van klanten */}
        <Card
          title="Feedback van klanten"
          icon={MessageSquare}
          link={{ to: "/admin/approvals", label: "Goedkeuringen" }}
        >
          {feedbackLoading ? (
            <ListSkeleton rows={3} />
          ) : (feedback ?? []).length === 0 ? (
            <Empty body="Nog geen feedback van klanten." />
          ) : (
            <ul className="space-y-2">
              {(feedback ?? []).map((c) => (
                <li key={c.id}>
                  <Link
                    to="/admin/approvals"
                    className="block rounded-lg bg-surface-elevated/50 p-3 transition hover:bg-accent/40"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-gold shrink-0" />
                      <span className="text-xs font-medium truncate">
                        {c.clients?.name ?? "Onbekende klant"}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(c.created_at), {
                          addSuffix: true,
                          locale: nl,
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{c.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Aankomende taken */}
        <Card
          title="Aankomende taken"
          icon={ListChecks}
          link={{ to: "/admin/tasks", label: "Alle taken" }}
          className="lg:col-span-2"
        >
          {tasksLoading ? (
            <ListSkeleton rows={4} />
          ) : (tasks ?? []).length === 0 ? (
            <Empty body="Geen openstaande taken." />
          ) : (
            <ul className="divide-y divide-border/50">
              {(tasks ?? []).map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      (t.priority === "high" || t.priority === "urgent") && "bg-red-400",
                      t.priority === "medium" && "bg-amber-400",
                      t.priority === "low" && "bg-sky-400",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{t.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {t.due_date
                        ? format(new Date(t.due_date), "d MMM", { locale: nl })
                        : "geen deadline"}{" "}
                      · {t.status === "in_progress" ? "bezig" : "open"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recente resultaten */}
        <Card title="Recente resultaten" icon={TrendingUp}>
          {resultsLoading ? (
            <ListSkeleton rows={3} />
          ) : (results ?? []).length === 0 ? (
            <Empty body="Nog geen goedgekeurde deliverables." />
          ) : (
            <ul className="space-y-2">
              {(results ?? []).map((r) => (
                <li key={r.id} className="rounded-lg bg-surface-elevated/50 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div className="text-sm font-medium truncate">{r.title}</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {format(new Date(r.date), "d MMM", { locale: nl })} · {r.deliverable_type}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

type AgendaItem = {
  id: string;
  caption: string | null;
  scheduled_at: string;
  platform: Platform;
  status: Tables<"scheduled_posts">["status"];
  client_id: string;
  clients: { name: string } | null;
};

function AgendaSection({ label, items }: { label: string; items: AgendaItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <ul className="space-y-2">
        {items.map((p) => {
          const Icon = PLATFORM_ICONS[p.platform] ?? Instagram;
          return (
            <li key={p.id}>
              <Link
                to="/admin/planner"
                className="flex items-center gap-3 rounded-lg bg-surface-elevated/50 p-3 transition hover:bg-accent/40"
              >
                <div className="w-12 shrink-0 text-sm font-medium tabular-nums text-gold">
                  {format(new Date(p.scheduled_at), "HH:mm", { locale: nl })}
                </div>
                <div className="h-8 w-8 rounded-md bg-gold/10 ring-1 ring-gold/25 shrink-0 grid place-items-center">
                  <Icon className="h-4 w-4 text-gold" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">
                    {p.clients?.name ?? "Onbekende klant"}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {p.caption || <span className="italic">geen caption</span>}
                  </div>
                </div>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0",
                    p.status === "scheduled" && "bg-gold/15 text-gold",
                    p.status === "draft" && "bg-muted/40 text-muted-foreground",
                    p.status === "publishing" && "bg-sky-500/15 text-sky-500",
                    p.status === "published" && "bg-emerald-500/15 text-emerald-500",
                  )}
                >
                  {p.status === "scheduled"
                    ? "gepland"
                    : p.status === "draft"
                      ? "concept"
                      : p.status === "publishing"
                        ? "bezig"
                        : "live"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const KPI_ACCENTS = {
  gold: "text-gold bg-gold/12",
  amber: "text-amber-500 bg-amber-500/12",
  sky: "text-sky-500 bg-sky-500/12",
  emerald: "text-emerald-500 bg-emerald-500/12",
} as const;

function KpiTile({
  to,
  icon: Icon,
  label,
  value,
  loading,
  accent,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  value: number | undefined;
  loading: boolean;
  accent: keyof typeof KPI_ACCENTS;
}) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-gold/10 bg-card p-4 sm:p-5 transition hover:border-gold/30 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] sm:text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span
          className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", KPI_ACCENTS[accent])}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-9 w-14" />
      ) : (
        <div className="mt-2 font-display text-3xl sm:text-4xl">{value ?? 0}</div>
      )}
      <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-gold opacity-0 transition group-hover:opacity-100">
        Bekijken <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}

function QuickAction({
  to,
  icon: Icon,
  title,
  subtitle,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-gold/10 bg-card p-4 transition hover:border-gold/30"
    >
      <div className="h-10 w-10 rounded-full bg-gold/15 grid place-items-center shrink-0 transition-transform group-hover:scale-105">
        <Icon className="h-4.5 w-4.5 text-gold" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-sm sm:text-base truncate">{title}</div>
        <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-gold opacity-0 group-hover:opacity-100 transition shrink-0" />
    </Link>
  );
}

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
