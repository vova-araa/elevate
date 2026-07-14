import { cn } from "@/lib/utils";
import { GOLD_FALLBACK } from "./planner-shared";

/**
 * Legenda met klanten: kleurstip in brand_color (fallback goud) + naam.
 * Klik op een klant om de hele planner op die klant te filteren.
 */
export function ClientLegend({
  clients,
  activeId,
  onSelect,
}: {
  clients: { id: string; name: string; brand_color: string | null }[];
  activeId?: string;
  onSelect: (id: string) => void;
}) {
  if (!clients?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Klanten</span>
      {clients.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs inline-flex items-center gap-1.5 transition",
            c.id === activeId
              ? "bg-gold/10 border-gold/40 text-foreground"
              : "border-border/40 text-muted-foreground hover:text-foreground hover:border-gold/30",
          )}
        >
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: c.brand_color || GOLD_FALLBACK }}
          />
          {c.name}
        </button>
      ))}
    </div>
  );
}
