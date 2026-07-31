import type { ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Optionele retry — toont een "Opnieuw proberen"-knop. */
  onRetry?: () => void;
  icon?: ReactNode;
  className?: string;
}

/**
 * Herbruikbare foutstaat in de huisstijl (rode variant van EmptyState):
 * gestippelde rand, zachte vlek, gecentreerde inhoud en optionele retry.
 */
export function ErrorState({
  title = "Kon niet laden",
  description = "Er ging iets mis bij het ophalen. Probeer het opnieuw.",
  onRetry,
  icon,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "fade-in-up flex flex-col items-center justify-center rounded-xl border border-dashed border-destructive/25 bg-destructive/[0.04] px-6 py-8 text-center",
        className,
      )}
    >
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-full border border-destructive/15 bg-destructive/10 text-destructive">
        {icon ?? <AlertTriangle className="h-5 w-5" />}
      </div>
      <p className="font-display text-lg text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={() => onRetry()}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-accent/50"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Opnieuw proberen
        </button>
      )}
    </div>
  );
}
