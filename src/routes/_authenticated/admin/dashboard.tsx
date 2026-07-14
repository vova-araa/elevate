import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { z } from "zod";
import {
  Calendar,
  ListChecks,
  Sparkles,
  Instagram,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Megaphone,
  Bell,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const searchSchema = z.object({ clientId: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  validateSearch: searchSchema,
  component: AdminDashboard,
});

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

function Header({ clients, selected }: { clients: any[]; selected: any | null }) {
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
  const filterBy = (q: any) => (clientId ? q.eq("client_id", clientId) : q);

  const { data: posts } = useQuery({
    queryKey: ["dash-posts", clientId ?? "all"],
    queryFn: async () =>
      ((
        await filterBy(supabase.from("scheduled_posts" as any).select("*")).order("scheduled_at", {
          ascending: true,
        })
      ).data ?? []) as any[],
  });
  const { data: tasks } = useQuery({
    queryKey: ["dash-tasks", clientId ?? "all"],
    queryFn: async () =>
      (
        await filterBy(supabase.from("tasks").select("id,title,due_date,status,priority,client_id"))
          .neq("status", "done")
          .order("due_date", { nullsFirst: false })
          .limit(8)
      ).data ?? [],
  });
  const { data: results } = useQuery({
    queryKey: ["dash-results", clientId ?? "all"],
    queryFn: async () =>
      (
        await filterBy(
          supabase.from("calendar_items").select("id,title,date,status,deliverable_type"),
        )
          .eq("status", "approved")
          .order("date", { ascending: false })
          .limit(6)
      ).data ?? [],
  });
  const { data: notifications } = useQuery({
    queryKey: ["dash-notif", userId],
    enabled: !!userId,
    queryFn: async () =>
      (
        await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(8)
      ).data ?? [],
  });

  const planned = (posts ?? []).filter((p) => p.status === "scheduled" || p.status === "draft");
  const failed = (posts ?? []).filter((p) => p.status === "failed");
  const published = (posts ?? []).filter((p) => p.status === "published");
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTasks = (tasks ?? []).filter((t: any) => t.due_date === todayStr);

  return (
    <>
      {/* Stat strip */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Geplande posts" value={planned.length} icon={Calendar} accent="gold" />
        <Stat
          label="Open taken"
          value={tasks?.length ?? 0}
          icon={ListChecks}
          sub={todayTasks.length ? `${todayTasks.length} vandaag` : undefined}
        />
        <Stat label="Gepubliceerd" value={published.length} icon={CheckCircle2} accent="emerald" />
        <Stat
          label="Mislukt"
          value={failed.length}
          icon={AlertCircle}
          accent={failed.length ? "red" : undefined}
        />
      </div>

      {/* Snelkoppelingen */}
      <div className="grid gap-3 md:grid-cols-3">
        <QuickAction
          to={clientId ? "/admin/clients/$id" : "/admin/compose"}
          params={clientId ? { id: clientId } : undefined}
          hash={clientId ? "planner" : undefined}
          icon={Plus}
          title="Nieuwe post inplannen"
          subtitle={clientId ? "Direct naar de planner" : "Kies een klant in de composer"}
        />
        <QuickAction
          to="/admin/tasks"
          icon={ListChecks}
          title="Nieuwe taak"
          subtitle="Werkbord openen"
        />
        <QuickAction
          to="/admin/planner"
          icon={Calendar}
          title="Agenda deze week"
          subtitle={`${todayTasks.length} item${todayTasks.length === 1 ? "" : "s"} vandaag`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Geplande posts */}
        <Card
          title="Geplande posts"
          icon={Instagram}
          link={
            clientId
              ? { to: "/admin/clients/$id", params: { id: clientId }, label: "Open planner" }
              : { to: "/admin/planner", label: "Open planner" }
          }
          className="lg:col-span-2"
        >
          {planned.length === 0 ? (
            <Empty body="Geen geplande posts." />
          ) : (
            <ul className="space-y-2">
              {planned.slice(0, 6).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg bg-surface-elevated/50 p-3"
                >
                  <div className="h-9 w-9 rounded-md bg-gradient-to-br from-fuchsia-500/30 via-pink-500/30 to-amber-400/30 ring-1 ring-gold/30 shrink-0 flex items-center justify-center">
                    <Instagram className="h-4 w-4 text-gold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">
                      {p.caption || (
                        <span className="italic text-muted-foreground">geen caption</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {new Date(p.scheduled_at).toLocaleString("nl-NL", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0",
                      p.status === "scheduled" && "bg-gold/15 text-gold",
                      p.status === "draft" && "bg-muted/30 text-muted-foreground",
                    )}
                  >
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Notificaties */}
        <Card title="Meldingen" icon={Bell}>
          {(notifications ?? []).length === 0 ? (
            <Empty body="Geen meldingen." />
          ) : (
            <ul className="space-y-2">
              {notifications!.slice(0, 8).map((n: any) => (
                <li
                  key={n.id}
                  className={cn(
                    "rounded-lg p-2.5 text-sm",
                    n.read ? "bg-surface-elevated/40" : "bg-gold/8 ring-1 ring-gold/30",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <NotifDot type={n.type} />
                    <div className="font-medium text-sm truncate flex-1">{n.title}</div>
                  </div>
                  {n.body && (
                    <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {n.body}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString("nl-NL", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
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
          {(tasks ?? []).length === 0 ? (
            <Empty body="Geen openstaande taken." />
          ) : (
            <ul className="divide-y divide-border/50">
              {tasks!.map((t: any) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      t.priority === "high" && "bg-red-400",
                      t.priority === "medium" && "bg-amber-400",
                      t.priority === "low" && "bg-sky-400",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{t.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {t.due_date
                        ? new Date(t.due_date).toLocaleDateString("nl-NL", {
                            day: "numeric",
                            month: "short",
                          })
                        : "geen deadline"}{" "}
                      · {t.status}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Ads overzicht (placeholder pre-OAuth) */}
        <Card title="Ads-overzicht" icon={Megaphone}>
          <div className="space-y-3">
            <AdsPlaceholderRow platform="Meta Ads" />
            <AdsPlaceholderRow platform="Google Ads" />
            <AdsPlaceholderRow platform="TikTok Ads" />
            <p className="text-[10px] text-muted-foreground pt-1">
              Live data verschijnt zodra de ads-accounts gekoppeld zijn in Account &amp; Bedrijf.
            </p>
          </div>
        </Card>

        {/* Recente resultaten */}
        <Card title="Recente resultaten" icon={TrendingUp} className="lg:col-span-3">
          {(results ?? []).length === 0 ? (
            <Empty body="Nog geen goedgekeurde deliverables." />
          ) : (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {results!.map((r: any) => (
                <div key={r.id} className="rounded-lg bg-surface-elevated/50 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div className="text-sm font-medium truncate">{r.title}</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {new Date(r.date).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · {r.deliverable_type}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: any;
  label: string;
  value: number;
  sub?: string;
  accent?: "gold" | "emerald" | "red";
}) {
  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </span>
        <Icon
          className={cn(
            "h-4 w-4",
            accent === "gold" && "text-gold",
            accent === "emerald" && "text-emerald-400",
            accent === "red" && "text-red-400",
            !accent && "text-muted-foreground",
          )}
        />
      </div>
      <div
        className={cn(
          "mt-2 font-display text-3xl sm:text-4xl",
          accent === "gold" && "text-gradient-gold",
          accent === "emerald" && "text-emerald-400",
          accent === "red" && "text-red-400",
          !accent && "text-foreground",
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Card({ title, icon: Icon, link, children, className }: any) {
  return (
    <div className={cn("glass rounded-2xl p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg flex items-center gap-2">
          <Icon className="h-4 w-4 text-gold" /> {title}
        </h2>
        {link && (
          <Link
            to={link.to}
            params={link.params}
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

function Empty({ body }: { body: string }) {
  return <p className="text-sm text-muted-foreground text-center py-6">{body}</p>;
}

function QuickAction({ to, params, hash, icon: Icon, title, subtitle }: any) {
  return (
    <Link
      to={to}
      params={params}
      hash={hash}
      className="glass rounded-2xl p-4 transition hover:gold-ring group flex items-center gap-3"
    >
      <div className="h-11 w-11 rounded-full bg-gold/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
        <Icon className="h-5 w-5 text-gold" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-base">{title}</div>
        <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-gold opacity-0 group-hover:opacity-100 transition" />
    </Link>
  );
}

function NotifDot({ type }: { type: string }) {
  const color =
    type === "new_upload"
      ? "bg-sky-400"
      : type === "new_message"
        ? "bg-fuchsia-400"
        : type === "post_published"
          ? "bg-emerald-400"
          : type === "post_failed"
            ? "bg-red-400"
            : type === "awaiting_approval"
              ? "bg-amber-400"
              : type === "ad_budget"
                ? "bg-orange-400"
                : "bg-gold";
  return <span className={cn("h-2 w-2 rounded-full shrink-0", color)} />;
}

function AdsPlaceholderRow({ platform }: { platform: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-elevated/40 p-2.5">
      <div className="flex items-center gap-2">
        <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm">{platform}</span>
      </div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        niet gekoppeld
      </span>
    </div>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { to: string; label: string };
}) {
  return (
    <div className="glass rounded-2xl p-10 text-center">
      <Sparkles className="h-8 w-8 text-gold mx-auto mb-3" />
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="text-sm text-muted-foreground mt-2 mb-5">{body}</p>
      <Link
        to={cta.to}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <Plus className="h-4 w-4" /> {cta.label}
      </Link>
    </div>
  );
}
