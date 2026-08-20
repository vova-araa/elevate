import { Link, useRouterState } from "@tanstack/react-router";
import elevateLogoUrl from "@/assets/elevate-logo.png";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  ChevronsUpDown,
  Check,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useUIStore } from "@/lib/stores/ui-store";
import { useClientStore } from "@/lib/stores/client-store";
import { useEffect, useState } from "react";
import {
  ADMIN_NAV,
  badgeClasses,
  initials,
  type AdminNavItem,
  type SidebarCounts,
} from "@/lib/admin-nav";

export function AdminSidebar() {
  const { sidebarCollapsed: collapsed, toggleSidebar } = useUIStore();
  const { isSuperAdmin } = useAuth();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const { data: counts } = useQuery<SidebarCounts>({
    queryKey: ["admin-sidebar-counts"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const in7 = new Date(Date.now() + 7 * 86400000).toISOString();
      const [sched, drafts, alerts, unread] = await Promise.all([
        supabase
          .from("scheduled_posts")
          .select("id", { count: "exact", head: true })
          .eq("status", "scheduled")
          .gte("scheduled_at", now)
          .lte("scheduled_at", in7),
        supabase
          .from("scheduled_posts")
          .select("id", { count: "exact", head: true })
          .eq("status", "draft"),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("read", false),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("type", "new_message")
          .eq("read", false),
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
  const activeClient = clients?.find((c) => c.id === activeClientId) ?? null;

  const selectClient = (c: {
    id: string;
    name: string;
    brand_color: string | null;
    logo_url: string | null;
  }) => {
    setActiveClient({
      id: c.id,
      name: c.name,
      color: c.brand_color,
      logo_url: c.logo_url,
      initials: initials(c.name),
    });
  };

  // Selecteer automatisch de eerste klant als er nog geen actief is — of als de
  // actieve klant inmiddels is verwijderd (anders blijft de app tegen een
  // niet-bestaande klant aan praten).
  useEffect(() => {
    if (!clients || clients.length === 0) return;
    if (!activeClientId || !clients.some((c) => c.id === activeClientId)) {
      selectClient(clients[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClientId, clients]);

  const isActive = (to: string) => {
    if (to === "/admin/clients") return currentPath.startsWith("/admin/clients");
    return currentPath === to || currentPath.startsWith(to + "/");
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-gold/10 bg-sidebar transition-[width] duration-200 ease-out md:flex",
        collapsed ? "w-16" : "w-[264px]",
      )}
    >
      {/* Kop met logo */}
      <div
        className={cn(
          "flex items-center border-b border-gold/10 px-3 py-4",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed ? (
          <Link to="/admin/dashboard" className="flex items-center gap-2">
            <img src={elevateLogoUrl} alt="Elevate" className="h-7 w-7 object-contain" />
            <span className="font-display text-base tracking-tight">Elevate Design</span>
          </Link>
        ) : (
          <img src={elevateLogoUrl} alt="Elevate" className="h-7 w-7 object-contain" />
        )}
        <button
          onClick={toggleSidebar}
          className={cn(
            "grid h-6 w-6 place-items-center rounded-md border border-gold/15 text-muted-foreground transition-colors duration-150 hover:border-gold/30 hover:bg-accent/40 hover:text-foreground",
            collapsed && "absolute -right-3 top-5 bg-background",
          )}
          title={collapsed ? "Uitklappen" : "Inklappen"}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Actieve klant — prominent bovenaan */}
      {!collapsed && clients && clients.length > 0 && (
        <div className="border-b border-gold/10 px-3 py-3">
          <div className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
            Actieve klant
          </div>
          <button
            onClick={() => setSwitcherOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-gold/20 bg-gradient-to-br from-gold/10 to-transparent px-2.5 py-2 text-left transition hover:border-gold/35"
          >
            {activeClient?.logo_url ? (
              <img src={activeClient.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <span
                className="grid h-9 w-9 place-items-center rounded-lg text-xs font-semibold text-white"
                style={{ background: activeClient?.brand_color || "var(--gold)" }}
              >
                {activeClient ? initials(activeClient.name) : "?"}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {activeClient?.name ?? "Kies een klant"}
              </span>
              <span className="block text-[11px] text-muted-foreground">Wissel van klant</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          {switcherOpen && (
            <div className="mt-1.5 max-h-52 space-y-0.5 overflow-y-auto scrollbar-thin rounded-xl border border-gold/10 bg-background/60 p-1">
              {clients.map((c) => {
                const active = c.id === activeClientId;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      selectClient(c);
                      setSwitcherOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition",
                      active ? "bg-gold/12 text-gold" : "hover:bg-accent/40",
                    )}
                  >
                    {c.logo_url ? (
                      <img src={c.logo_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <span
                        className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold text-white"
                        style={{ background: c.brand_color || "var(--gold)" }}
                      >
                        {initials(c.name)}
                      </span>
                    )}
                    <span className="flex-1 truncate">{c.name}</span>
                    {active && <Check className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
              <Link
                to="/admin/clients/new"
                onClick={() => setSwitcherOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg border-t border-gold/10 px-2 py-1.5 text-left text-sm text-gold transition hover:bg-gold/10"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-gold/40">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                Nieuwe klant
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Snelle actie */}
      <div className="border-b border-gold/10 px-3 py-3">
        <Link
          to="/admin/compose"
          className={cn(
            "flex items-center gap-2 rounded-xl bg-gradient-gold text-sm font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:brightness-105 hover:shadow-md active:scale-[0.98]",
            collapsed ? "mx-auto h-9 w-9 justify-center p-0" : "h-9 w-full justify-center px-3",
          )}
          title="Nieuwe post"
        >
          <Plus className="h-4 w-4" />
          {!collapsed && <span>Nieuwe post</span>}
        </Link>
      </div>

      {/* Navigatie */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {/* Super-admin-ingang — alleen zichtbaar voor super admins */}
        {isSuperAdmin && (
          <div className="mb-3 px-2">
            {!collapsed && (
              <div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-[0.18em] text-gold/70">
                Super admin
              </div>
            )}
            <Link
              to="/admin/super"
              className={cn(
                "group relative flex items-center rounded-xl text-sm transition-colors duration-150 active:scale-[0.99]",
                collapsed ? "mx-auto h-10 w-10 justify-center" : "gap-3 px-2 py-2",
                isActive("/admin/super")
                  ? "bg-gold/12 font-medium text-gold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-gold"
                  : "text-foreground/75 hover:bg-accent/40 hover:text-foreground",
              )}
              title={collapsed ? "Super admin" : undefined}
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-150",
                  isActive("/admin/super")
                    ? "bg-gold/15 text-gold"
                    : "bg-background/50 text-muted-foreground group-hover:text-foreground",
                )}
              >
                <Shield className="h-4 w-4" />
              </span>
              {!collapsed && <span className="flex-1 truncate">Bureau-overzicht</span>}
            </Link>
          </div>
        )}
        {ADMIN_NAV.map((item) => (
          <NavEntry
            key={item.to}
            item={item}
            collapsed={collapsed}
            counts={counts}
            isActive={isActive}
          />
        ))}
      </nav>
    </aside>
  );
}

/**
 * Eén hoofdingang met zijn onderdelen. De subitems staan ingeklapt; ze klappen
 * uit bij een klik op de chevron, en automatisch wanneer je op een van die
 * pagina's bent.
 */
function NavEntry({
  item,
  collapsed,
  counts,
  isActive,
}: {
  item: AdminNavItem;
  collapsed: boolean;
  counts?: SidebarCounts;
  isActive: (to: string) => boolean;
}) {
  const children = item.children ?? [];
  const childActive = children.some((c) => isActive(c.to));
  const [open, setOpen] = useState(false);
  const expanded = open || childActive;
  const active = isActive(item.to);
  const badgeValue = item.badgeKey ? (counts?.[item.badgeKey] ?? 0) : 0;

  // Tel de badges van ingeklapte kinderen op bij de ouder, zodat je niets mist
  // wanneer de groep dicht staat.
  const hiddenBadges = expanded
    ? 0
    : children.reduce((sum, c) => sum + (c.badgeKey ? (counts?.[c.badgeKey] ?? 0) : 0), 0);

  return (
    <div className="px-2">
      <div className="flex items-center">
        <Link
          to={item.to}
          className={cn(
            "group relative flex flex-1 items-center rounded-xl text-sm transition-colors duration-150 active:scale-[0.99]",
            collapsed ? "mx-auto h-10 w-10 justify-center" : "gap-3 px-2 py-2",
            active || childActive
              ? "bg-gold/12 font-medium text-gold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-gold"
              : "text-foreground/75 hover:bg-accent/40 hover:text-foreground",
          )}
          title={collapsed ? item.label : undefined}
        >
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-150",
              active || childActive
                ? "bg-gold/15 text-gold"
                : "bg-background/50 text-muted-foreground group-hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{item.label}</span>
              {badgeValue + hiddenBadges > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                    badgeClasses[item.badgeTone ?? "default"],
                  )}
                >
                  {badgeValue + hiddenBadges}
                </span>
              )}
            </>
          )}
        </Link>
        {!collapsed && children.length > 0 && (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={expanded}
            aria-label={`${item.label} ${expanded ? "inklappen" : "uitklappen"}`}
            className="grid h-8 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground/70 transition hover:bg-accent/40 hover:text-foreground"
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
            />
          </button>
        )}
      </div>

      {!collapsed && expanded && children.length > 0 && (
        <div className="mb-1 ml-[26px] space-y-0.5 border-l border-gold/15 pl-3">
          {children.map((c) => {
            const cActive = isActive(c.to);
            const cBadge = c.badgeKey ? (counts?.[c.badgeKey] ?? 0) : 0;
            return (
              <Link
                key={c.to}
                to={c.to}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
                  cActive
                    ? "bg-gold/10 font-medium text-gold"
                    : "text-foreground/65 hover:bg-accent/40 hover:text-foreground",
                )}
              >
                <span className="flex-1 truncate">{c.label}</span>
                {cBadge > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                      badgeClasses[c.badgeTone ?? "default"],
                    )}
                  >
                    {cBadge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
