import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Icoon bovenin, bijv. `<Inbox className="h-5 w-5" />` */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Optionele actie, bijv. een `<Button>` */
  action?: ReactNode;
  className?: string;
}

/**
 * Herbruikbare lege-staat in de huisstijl: gestippelde gouden rand,
 * zachte cream-vlek en gecentreerde inhoud.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "fade-in-up flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/25 bg-gold/[0.04] px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-full border border-gold/15 bg-gold/10 text-gold">
          {icon}
        </div>
      )}
      <h3 className="font-display text-xl text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
