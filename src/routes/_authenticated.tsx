import {
  createFileRoute,
  Outlet,
  Link,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  Bell,
  LogOut,
  LayoutDashboard,
  Users,
  Briefcase,
  Compass,
  Calendar,
  Upload,
  ListChecks,
  MessageSquare,
  Menu,
  X,
  Home,
  CalendarDays,
  Sparkles,
  BarChart3,
  CheckSquare,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Layers,
  Trash2,
  Search,
  Zap,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { role, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Wacht tot rol geladen is voor we de juiste UI tonen
  useEffect(() => {
    if (loading || !role) return;
    // Client mag niet in /admin
    if (role === "client" && pathname.startsWith("/admin")) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [role, loading, pathname, navigate]);

  if (loading || !role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-luxe">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  const effectiveRole: "admin" | "client" = role;

  const isAdminRoute = pathname.startsWith("/admin");

  if (isAdminRoute) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-screen bg-luxe">
      <Sidebar
        role={effectiveRole}
        onLogout={async () => {
          await signOut();
          navigate({ to: "/auth" });
        }}
      />

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-gold/15 p-5 overflow-y-auto"
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="mb-4 rounded-full p-2 hover:bg-accent/40"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              role={effectiveRole}
              onLogout={async () => {
                await signOut();
                navigate({ to: "/auth" });
              }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Sidebar({ role, onLogout }: { role: "admin" | "client"; onLogout: () => void }) {
  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-gold/10 bg-sidebar/60 backdrop-blur p-5">
      <SidebarContent role={role} onLogout={onLogout} />
    </aside>
  );
}

function SidebarContent({ role, onLogout }: { role: "admin" | "client"; onLogout: () => void }) {
  const adminGroups = [
    {
      label: "Overzicht",
      items: [
        { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      ],
    },
    {
      label: "Content",
      items: [
        { to: "/admin/planner", label: "Planner", icon: CalendarDays },
        { to: "/admin/queue", label: "Queue & bulk", icon: Layers },
        { to: "/admin/create", label: "AI Create", icon: Sparkles },
        { to: "/admin/media", label: "Media bibliotheek", icon: ImageIcon },
        { to: "/admin/approvals", label: "Goedkeuringen", icon: CheckSquare },
      ],
    },
    {
      label: "Werk",
      items: [
        { to: "/admin/clients", label: "Klanten", icon: Briefcase },
        { to: "/admin/tasks", label: "Taken", icon: ListChecks },
        { to: "/admin/messages", label: "Berichten", icon: MessageSquare },
      ],
    },
    {
      label: "Systeem",
      items: [
        { to: "/admin/automations", label: "Automatisering", icon: Zap },
        { to: "/admin/search", label: "Zoeken", icon: Search },
        { to: "/admin/trash", label: "Prullenbak", icon: Trash2 },
        { to: "/admin/settings", label: "Instellingen", icon: SettingsIcon },
      ],
    },
  ];
  const clientGroups = [
    {
      label: "Overzicht",
      items: [
        { to: "/dashboard", label: "Overzicht", icon: LayoutDashboard },
        { to: "/client/calendar", label: "Kalender", icon: Calendar },
      ],
    },
    {
      label: "Werk",
      items: [
        { to: "/client/roadmap", label: "Stappenplan", icon: Compass },
        { to: "/client/tasks", label: "Taken", icon: ListChecks },
        { to: "/client/uploads", label: "Uploads", icon: Upload },
        { to: "/client/media", label: "Media", icon: ImageIcon },
        { to: "/client/reports", label: "Rapporten", icon: BarChart3 },
        { to: "/client/messages", label: "Berichten", icon: MessageSquare },
      ],
    },
  ];
  const groups = role === "admin" ? adminGroups : clientGroups;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      <Link to="/" className="flex items-center gap-2 px-2 py-2">
        <div className="h-7 w-7 rounded-full bg-gradient-gold" />
        <span className="font-display text-lg">Elevate</span>
      </Link>
      <div className="mt-2 mb-4 px-2 text-[10px] uppercase tracking-[0.25em] text-gold/70">
        {role === "admin" ? "Admin" : "Client portal"}
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto scrollbar-thin pr-1">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
              {g.label}
            </div>
            <div className="space-y-0.5">
              {g.items.map((l) => {
                const active = pathname === l.to || pathname.startsWith(l.to + "/");
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                      active
                        ? "bg-gold/15 text-gold gold-ring"
                        : "text-foreground/80 hover:bg-accent/40",
                    )}
                  >
                    <l.icon className="h-4 w-4 shrink-0" />{" "}
                    <span className="truncate">{l.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <button
        onClick={onLogout}
        className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4" /> Uitloggen
      </button>
    </>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { user, role } = useAuth();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Tables<"notifications">[]>([]);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/dashboard" || pathname === "/";

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("notif-" + user.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  async function load() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems(data ?? []);
    setUnread((data ?? []).filter((n) => !n.read).length);
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    load();
  }

  return (
    <header className="flex items-center justify-between border-b border-gold/10 bg-background/40 px-4 sm:px-6 py-3 sm:py-4 backdrop-blur gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <button onClick={onMenu} className="md:hidden rounded-full p-2 hover:bg-accent/40">
          <Menu className="h-5 w-5" />
        </button>
        {!isHome && (
          <Link
            to="/dashboard"
            className="rounded-full p-2 hover:bg-accent/40 text-gold"
            aria-label="Terug naar home"
          >
            <Home className="h-5 w-5" />
          </Link>
        )}
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.22em] text-gold/70">
            {role === "admin" ? "Admin" : "Client"}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground truncate">
            {user?.email ?? "Account"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <ThemeToggle />
        <div className="relative">
          <button
            onClick={() => {
              setOpen(!open);
              if (!open) markAllRead();
            }}
            className="relative rounded-full p-2 hover:bg-accent/40"
          >
            <Bell className="h-5 w-5 text-gold" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold text-primary-foreground">
                {unread}
              </span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] glass-strong rounded-xl p-3 shadow-elegant z-50 max-h-96 overflow-y-auto scrollbar-thin">
              <div className="px-2 pb-2 text-xs uppercase tracking-[0.2em] text-gold/70">
                Notificaties
              </div>
              {items.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">Niets nieuws</div>
              )}
              {items.map((n) => (
                <a
                  key={n.id}
                  href={n.link || "#"}
                  className="block rounded-lg p-3 hover:bg-accent/40"
                >
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString("nl-NL")}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} title="Thema wisselen" className="rounded-full p-2 hover:bg-accent/40">
      {theme === "dark" ? (
        <Sun className="h-5 w-5 text-gold" />
      ) : (
        <Moon className="h-5 w-5 text-gold" />
      )}
    </button>
  );
}
