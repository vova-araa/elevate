import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { PageTab } from "@/lib/page-tabs";

/**
 * Tabbladen bovenaan een pagina die bij elkaar horende schermen samenbindt.
 *
 * Het menu toont één ingang (bv. "Content"); de onderliggende schermen zijn
 * hier bereikbaar als tabs. Elk tabblad blijft zijn eigen route — zo verandert
 * er niets aan de bestaande pagina's, maar voelt het als één geheel.
 */
export function PageTabs({ tabs }: { tabs: PageTab[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="-mx-1 mb-6 flex gap-1 overflow-x-auto scrollbar-thin border-b border-gold/15 px-1">
      {tabs.map((t) => {
        const active = pathname === t.to || pathname.startsWith(t.to + "/");
        return (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              // min-h-11 = comfortabel tikdoel op mobiel
              "relative shrink-0 whitespace-nowrap px-3.5 min-h-11 flex items-center text-sm transition-colors",
              active
                ? "font-medium text-gold after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-full after:bg-gold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
