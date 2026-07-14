import { Link, useRouterState } from "@tanstack/react-router";
import { useUIStore } from "@/lib/stores/ui-store";
import { useClientStore } from "@/lib/stores/client-store";
import { Bell, Menu, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";

const TITLES: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/planner": "Planner",
  "/admin/compose": "Nieuwe post",
  "/admin/postiz": "Posts",
  "/admin/queue": "Concepten",
  "/admin/media": "Media",
  "/admin/ai": "AI Studio",
  "/admin/besttime": "Best time",
  "/admin/reach": "Bereik & groei",
  "/admin/engagement": "Engagement",
  "/admin/reports": "Rapporten",
  "/admin/approvals": "Goedkeuring",
  "/admin/automations": "Alerts",
  "/admin/clients": "Klanten",
  "/admin/webhooks": "Kanalen",
  "/admin/settings": "Instellingen",
};

export function AdminTopbar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { setMobileSheetOpen, setCommandPaletteOpen } = useUIStore();
  const { activeClient } = useClientStore();
  const { user } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();

  const title = Object.entries(TITLES).find(([k]) => path.startsWith(k))?.[1] ?? "Elevate";

  const initials =
    user?.email?.slice(0, 2).toUpperCase() ?? "EL";

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
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-medium">⌘K</kbd>
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
          {theme === "dark" ? <Sun className="h-4 w-4 text-gold" /> : <Moon className="h-4 w-4 text-gold" />}
        </button>
        <Link to="/admin/automations" className="rounded-full p-2 hover:bg-accent/40">
          <Bell className="h-4 w-4 text-gold" />
        </Link>
        <div className="h-8 w-8 rounded-full bg-gradient-gold grid place-items-center text-[11px] font-semibold text-white">
          {initials}
        </div>
      </div>
    </header>
  );
}
