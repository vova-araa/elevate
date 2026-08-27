import { Link, useRouterState } from "@tanstack/react-router";
import { Plus, Link2 } from "lucide-react";

const FAB_ROUTES = ["/admin/dashboard", "/admin/planner", "/admin/queue"];

/**
 * Twee vaste knoppen onderin op mobiel: een secundaire pil ("Kanalen") naast
 * de grote ronde hoofdknop ("Nieuwe post") — zodat de meest gebruikte
 * vervolgstap (een kanaal koppelen) altijd één tik weg is, niet drie tikken
 * diep in het menu.
 */
export function MobileFab() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  if (!FAB_ROUTES.some((r) => path === r || path.startsWith(r + "/"))) return null;
  return (
    <div className="md:hidden fixed inset-x-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 flex items-center justify-between gap-3">
      <Link
        to="/admin/channels"
        className="flex h-12 items-center gap-2 rounded-full border border-gold/20 bg-card/95 px-4 text-sm font-medium text-foreground shadow-elegant backdrop-blur transition-all duration-200 active:scale-95"
      >
        <Link2 className="h-4 w-4 text-gold" />
        Kanalen
      </Link>
      <Link
        to="/admin/compose"
        className="h-14 w-14 shrink-0 rounded-full bg-gradient-gold text-primary-foreground grid place-items-center glow-gold transition-all duration-200 hover:scale-105 hover:brightness-105 active:scale-95"
        aria-label="Nieuwe post"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}
