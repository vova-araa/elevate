import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, CalendarDays, Sparkles, CheckSquare, Menu } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUIStore } from "@/lib/stores/ui-store";

const items = [
  { to: "/admin/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/admin/planner", label: "Planner", icon: CalendarDays },
  { to: "/admin/ai", label: "AI", icon: Sparkles },
  { to: "/admin/approvals", label: "Review", icon: CheckSquare, withBadge: true },
];

export function MobileBottomNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { setMobileSheetOpen } = useUIStore();

  const { data: pending } = useQuery({
    queryKey: ["mobile-pending"],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
    refetchInterval: 60000,
  });

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-[60px] bg-background/95 backdrop-blur-md border-t border-gold/15 flex">
      {items.map((it) => {
        const active = path === it.to || path.startsWith(it.to + "/");
        return (
          <Link
            key={it.to}
            to={it.to}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors duration-150 active:scale-95",
              active ? "text-gold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {/* Gouden accent-balkje bovenaan voor het actieve item */}
            <span
              className={cn(
                "absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-gold transition-opacity duration-200",
                active ? "opacity-100" : "opacity-0",
              )}
            />
            <it.icon
              className={cn("h-5 w-5 transition-transform duration-200", active && "scale-105")}
            />
            <span className="text-[10px] font-medium">{it.label}</span>
            {it.withBadge && pending ? (
              <span className="absolute top-2 right-1/4 h-4 min-w-4 rounded-full bg-red-500 text-white text-[9px] font-bold grid place-items-center px-1">
                {pending}
              </span>
            ) : null}
          </Link>
        );
      })}
      <button
        onClick={() => setMobileSheetOpen(true)}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors duration-150 hover:text-foreground active:scale-95"
      >
        <Menu className="h-5 w-5" />
        <span className="text-[10px] font-medium">Meer</span>
      </button>
    </nav>
  );
}
