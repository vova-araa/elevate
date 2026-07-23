import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { Bell, Menu, Moon, Search, Sun } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationCenter, useNotificationCenter } from "@/components/notification-center";

const TITLES: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/planner": "Planner",
  "/admin/compose": "Nieuwe post",
  "/admin/queue": "Concepten",
  "/admin/media": "Media",
  "/admin/bulk": "Bulk import",
  "/admin/ai": "AI Studio",
  "/admin/strategy": "Strategie",
  "/admin/campaigns": "Campagnes",
  "/admin/assistant": "AI Assistent",
  "/admin/besttime": "Best time",
  "/admin/reach": "Bereik & groei",
  "/admin/engagement": "Engagement",
  "/admin/reports": "Rapporten",
  "/admin/approvals": "Goedkeuring",
  "/admin/automations": "Alerts",
  "/admin/clients": "Klanten",
  "/admin/tasks": "Taken",
  "/admin/messages": "Berichten",
  "/admin/team": "Team",
  "/admin/channels": "Kanalen",
  "/admin/users": "Gebruikers",
  "/admin/api-keys": "API-sleutels",
  "/admin/webhooks": "Webhooks",
  "/admin/settings": "Instellingen",
};

export function AdminTopbar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { setMobileSheetOpen, setCommandPaletteOpen } = useUIStore();
  const { user } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();

  const [notifOpen, setNotifOpen] = useState(false);
  const notificationCenter = useNotificationCenter();
  const { unreadCount } = notificationCenter;

  const title = Object.entries(TITLES).find(([k]) => path.startsWith(k))?.[1] ?? "Elevate";

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "EL";

  return (
    <header className="h-14 sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-gold/10 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={() => setMobileSheetOpen(true)}
          className="md:hidden rounded-md p-1.5 hover:bg-accent/40"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="font-display text-lg md:text-xl truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden md:flex items-center gap-2 rounded-full border border-gold/15 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground hover:border-gold/30 hover:text-foreground transition"
          aria-label="Zoeken (Cmd+K)"
        >
          <Search className="h-3.5 w-3.5" />
          Zoeken…
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="md:hidden rounded-full p-2 hover:bg-accent/40"
          aria-label="Zoeken"
        >
          <Search className="h-4 w-4 text-gold" />
        </button>
        <button
          onClick={toggleTheme}
          className="rounded-full p-2 hover:bg-accent/40"
          aria-label="Thema wisselen"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-gold" />
          ) : (
            <Moon className="h-4 w-4 text-gold" />
          )}
        </button>
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <button
              className="relative rounded-full p-2 hover:bg-accent/40"
              aria-label={unreadCount > 0 ? `Meldingen (${unreadCount} ongelezen)` : "Meldingen"}
            >
              <Bell className="h-4 w-4 text-gold" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold leading-none text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            collisionPadding={12}
            className="flex w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] max-h-[min(32rem,calc(100vh-5rem))] flex-col overflow-hidden rounded-xl border border-gold/10 bg-card p-0 shadow-elegant"
          >
            <NotificationCenter center={notificationCenter} onClose={() => setNotifOpen(false)} />
          </PopoverContent>
        </Popover>
        <div className="h-8 w-8 rounded-full bg-gradient-gold grid place-items-center text-[11px] font-semibold text-white">
          {initials}
        </div>
      </div>
    </header>
  );
}
