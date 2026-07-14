import { Link, useRouterState } from "@tanstack/react-router";
import elevateLogoUrl from "@/assets/elevate-logo.png";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  CalendarDays,
  Send,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Clock,
  TrendingUp,
  Heart,
  FileBarChart,
  CheckSquare,
  MessageSquare,
  Bell,
  Plug,
  Building2,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUIStore } from "@/lib/stores/ui-store";
import { useClientStore } from "@/lib/stores/client-store";
import { useEffect, useState } from "react";

const elevateLogo = elevateLogoUrl;

type BadgeTone = "default" | "amber" | "red" | "green";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: { value: string | number; tone: BadgeTone };
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const badgeClasses: Record<BadgeTone, string> = {
  default: "bg-gold/15 text-gold",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

export function AdminSidebar() {
  const { sidebarCollapsed: collapsed, toggleSidebar } = useUIStore();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  // Counts for badges
  const { data: counts } = useQuery({
    queryKey: ["admin-sidebar-counts"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const in7 = new Date(Date.now() + 7 * 86400000).toISOString();
      const [sched, drafts, alerts, unread] = await Promise.all([
        supabase.from("scheduled_posts").select("id", { count: "exact", head: true }).eq("status", "scheduled").gte("scheduled_at", now).lte("scheduled_at", in7),
        supabase.from("scheduled_posts").select("id", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("sender_role", "client").is("read_at", null),
      ]);
      return {
        scheduled: sched.count ?? 0,
        drafts: drafts.count ?? 0,
        pending: 0,
        alerts: alerts.count ?? 0,
        unread: unread.count ?? 0,
      };
    },
    refetchInterval: 60000,
  });


  // Clients list
  const { data: clients } = useQuery({
    queryKey: ["admin-sidebar-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, brand_color, logo_url")
        .order("name");
      return data ?? [];
    },
  });

  const { activeClientId, setActiveClient } = useClientStore();

  // Dismiss "Nieuw" badge for AI after first visit
  const [aiBadgeDismissed, setAiBadgeDismissed] = useState(() => {
    try { return localStorage.getItem("elevate-ai-badge") === "dismissed"; } catch { return false; }
  });

  // Auto-select first client if none selected
  useEffect(() => {
    if (!activeClientId && clients && clients.length > 0) {
      const c = clients[0];
      setActiveClient({
        id: c.id,
        name: c.name,
        color: c.brand_color,
        logo_url: c.logo_url,
        initials: c.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase(),
      });
    }
  }, [activeClientId, clients, setActiveClient]);

  const sections: NavSection[] = [
    {
      label: "Werkruimte",
      items: [
        { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/admin/planner", label: "Planner", icon: CalendarDays, badge: counts?.scheduled ? { value: counts.scheduled, tone: "default" } : undefined },
        { to: "/admin/postiz", label: "Posts", icon: Send },
        { to: "/admin/queue", label: "Concepten", icon: FileText, badge: counts?.drafts ? { value: counts.drafts, tone: "amber" } : undefined },
        { to: "/admin/media", label: "Media", icon: ImageIcon },
      ],
    },
    {
      label: "AI tools",
      items: [
        { to: "/admin/ai", label: "AI Studio", icon: Sparkles, badge: aiBadgeDismissed ? undefined : { value: "Nieuw", tone: "green" } },
        { to: "/admin/besttime", label: "Best time", icon: Clock },
      ],
    },
    {
      label: "Analyse",
      items: [
        { to: "/admin/reach", label: "Bereik & groei", icon: TrendingUp },
        { to: "/admin/engagement", label: "Engagement", icon: Heart },
        { to: "/admin/reports", label: "Rapporten", icon: FileBarChart },
      ],
    },
    {
      label: "Beheer",
      items: [
        { to: "/admin/approvals", label: "Goedkeuring", icon: CheckSquare, badge: counts?.pending ? { value: counts.pending, tone: "red" } : undefined },
        { to: "/admin/messages", label: "Berichten", icon: MessageSquare, badge: counts?.unread ? { value: counts.unread, tone: "red" } : undefined },
        { to: "/admin/clients", label: "Klanten", icon: Building2 },
        { to: "/admin/settings", label: "Instellingen", icon: SettingsIcon, badge: counts?.alerts ? { value: counts.alerts, tone: "red" } : undefined },
      ],
    },
  ];

  const isActive = (to: string) => {
    if (to === "/admin/clients") return currentPath.startsWith("/admin/clients");
    return currentPath === to || currentPath.startsWith(to + "/");
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen hidden md:flex flex-col border-r border-gold/10 bg-sidebar transition-[width] duration-200 ease-out",
        collapsed ? "w-14" : "w-[260px]",
      )}
    >
      {/* Header */}
      <div className={cn("flex items-center px-3 py-4 border-b border-gold/10", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <Link to="/admin/dashboard" className="flex items-center gap-2">
            <img src={elevateLogo} alt="Elevate" width={28} height={28} className="h-7 w-7 object-contain" />
            <span className="font-display text-base tracking-tight">Elevate Design</span>
          </Link>
        )}
        {collapsed && (
          <img src={elevateLogo} alt="Elevate" width={28} height={28} className="h-7 w-7 object-contain" />
        )}
        <button
          onClick={toggleSidebar}
          className={cn(
            "h-6 w-6 grid place-items-center rounded-md border border-gold/15 hover:bg-accent/40 transition",
            collapsed && "absolute -right-3 top-5 bg-background",
          )}
          title={collapsed ? "Uitklappen" : "Inklappen"}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Quick action */}
      <div className="px-3 py-3 border-b border-gold/10">
        <Link
          to="/admin/compose"
          className={cn(
            "flex items-center gap-2 rounded-lg bg-gold text-primary-foreground font-medium text-sm transition hover:opacity-90",
            collapsed ? "h-9 w-9 justify-center mx-auto p-0" : "h-9 px-3 w-full justify-center",
          )}
          title="Nieuwe post"
        >
          <Plus className="h-4 w-4" />
          {!collapsed && <span>Nieuwe post</span>}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {sections.map((section) => (
          <div key={section.label} className="px-2 mb-3">
            {!collapsed && (
              <div className="px-2 mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-medium">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => {
                      if (item.to === "/admin/ai" && !aiBadgeDismissed) {
                        setAiBadgeDismissed(true);
                        try { localStorage.setItem("elevate-ai-badge", "dismissed"); } catch {}
                      }
                    }}
                    className={cn(
                      "flex items-center rounded-lg text-sm transition relative",
                      collapsed ? "h-9 w-9 justify-center mx-auto" : "gap-3 px-3 py-2",
                      active
                        ? "bg-gold/12 text-gold font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-gold before:rounded-r"
                        : "text-foreground/75 hover:bg-accent/40 hover:text-foreground",
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", active && "text-gold")} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none", badgeClasses[item.badge.tone])}>
                            {item.badge.value}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Client switcher */}
      <div className="border-t border-gold/10 p-2 max-h-[40%] overflow-y-auto scrollbar-thin">
        {!collapsed && (
          <div className="px-2 mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-medium">
            Klanten
          </div>
        )}
        <div className="space-y-0.5">
          {(clients ?? []).map((c) => {
            const active = c.id === activeClientId;
            const initials = c.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
            return (
              <button
                key={c.id}
                onClick={() =>
                  setActiveClient({
                    id: c.id,
                    name: c.name,
                    color: c.brand_color,
                    logo_url: c.logo_url,
                    initials,
                  })
                }
                className={cn(
                  "flex items-center w-full rounded-lg text-sm transition relative",
                  collapsed ? "h-9 w-9 justify-center mx-auto" : "gap-2.5 px-2 py-1.5",
                  active
                    ? "bg-gold/12 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-gold before:rounded-r"
                    : "hover:bg-accent/40",
                )}
                title={collapsed ? c.name : undefined}
              >
                {c.logo_url ? (
                  <img src={c.logo_url} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
                ) : (
                  <div
                    className="h-6 w-6 rounded-full grid place-items-center text-[10px] font-semibold text-white shrink-0"
                    style={{ background: c.brand_color || "var(--gold)" }}
                  >
                    {initials}
                  </div>
                )}
                {!collapsed && (
                  <span className={cn("flex-1 truncate text-left", active && "text-gold font-medium")}>{c.name}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
