import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Plus, LogOut, Check, Moon, Sun } from "lucide-react";
import elevateLogoUrl from "@/assets/elevate-logo.png";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUIStore } from "@/lib/stores/ui-store";
import { useClientStore } from "@/lib/stores/client-store";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ADMIN_NAV, badgeClasses, initials, type SidebarCounts } from "@/lib/admin-nav";

// Volwaardig mobiel navigatiemenu dat vanaf links inschuift.
// Opent via de "Meer"-knop in de onderbalk of de hamburger in de topbar.
export function MobileNavSheet() {
  const open = useUIStore((s) => s.mobileSheetOpen);
  const setOpen = useUIStore((s) => s.setMobileSheetOpen);
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { activeClientId, setActiveClient } = useClientStore();
  const { signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();

  // Sluit het menu automatisch bij navigatie.
  useEffect(() => {
    setOpen(false);
  }, [currentPath, setOpen]);

  // Voorkom scrollen van de achtergrond terwijl het menu open is.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

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

  const isActive = (to: string) => {
    if (to === "/admin/clients") return currentPath.startsWith("/admin/clients");
    return currentPath === to || currentPath.startsWith(to + "/");
  };

  return (
    <div className="md:hidden" aria-hidden={!open}>
      {/* Verduisterde achtergrond */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-50 bg-background/70 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      {/* Inschuivend paneel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[86%] max-w-[320px] flex-col bg-sidebar shadow-2xl",
          "rounded-r-[22px] border-r border-gold/15 transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Kop */}
        <div className="flex items-center justify-between border-b border-gold/10 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <img src={elevateLogoUrl} alt="Elevate" className="h-8 w-8 object-contain" />
            <span className="font-display text-lg tracking-tight">Elevate Design</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-full border border-gold/15 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            aria-label="Menu sluiten"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Actieve klant */}
        {clients && clients.length > 0 && (
          <div className="border-b border-gold/10 px-3 py-3">
            <div className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
              Actieve klant
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
              {clients.map((c) => {
                const active = c.id === activeClientId;
                return (
                  <button
                    key={c.id}
                    onClick={() =>
                      setActiveClient({
                        id: c.id,
                        name: c.name,
                        color: c.brand_color,
                        logo_url: c.logo_url,
                        initials: initials(c.name),
                      })
                    }
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs transition",
                      active
                        ? "border-gold/40 bg-gold/12 font-medium text-gold"
                        : "border-gold/10 bg-background/40 text-foreground/80",
                    )}
                  >
                    {c.logo_url ? (
                      <img src={c.logo_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                    ) : (
                      <span
                        className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-semibold text-white"
                        style={{ background: c.brand_color || "var(--gold)" }}
                      >
                        {initials(c.name)}
                      </span>
                    )}
                    <span className="max-w-[120px] truncate">{c.name}</span>
                    {active && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Snelle actie */}
        <div className="px-3 pt-3">
          <Link
            to="/admin/compose"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold text-sm font-medium text-primary-foreground shadow-sm active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> Nieuwe post
          </Link>
        </div>

        {/* Navigatie */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3">
          {ADMIN_NAV.map((section) => (
            <div key={section.label} className="mb-4">
              <div className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.to);
                  const badgeValue = item.badgeKey ? (counts?.[item.badgeKey] ?? 0) : 0;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-gold/12 font-medium text-gold"
                          : "text-foreground/80 hover:bg-accent/40 hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
                          active
                            ? "bg-gold/15 text-gold"
                            : "bg-background/60 text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {badgeValue > 0 && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                            badgeClasses[item.badgeTone ?? "default"],
                          )}
                        >
                          {badgeValue}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Voettekst */}
        <div className="flex items-center gap-2 border-t border-gold/10 p-3">
          <button
            onClick={toggleTheme}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gold/15 py-2 text-sm text-foreground/80 hover:bg-accent/40"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Licht" : "Donker"}
          </button>
          <button
            onClick={() => signOut()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gold/15 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Uitloggen
          </button>
        </div>
      </aside>
    </div>
  );
}
