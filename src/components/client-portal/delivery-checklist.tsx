import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, differenceInCalendarDays } from "date-fns";
import { nl } from "date-fns/locale";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  ImageIcon,
  KeyRound,
  MessageSquareQuote,
  PartyPopper,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { HealthRing } from "@/components/admin/health-ring";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getDeliveryOverview,
  setDeliveryRequestStatus,
  type DeliveryItem,
  type DeliveryKind,
} from "@/lib/deliverables.functions";
import { cn } from "@/lib/utils";

/**
 * "Wat moet ik nog aanleveren?" voor de klant.
 *
 * Bewust één lijst waarin expliciete verzoeken van het bureau en signalen uit de
 * data door elkaar staan: voor de klant is het onderscheid niet interessant, de
 * vraag "wat wordt er van mij verwacht" wel.
 */

const KIND_META: Record<DeliveryKind, { Icon: LucideIcon; label: string }> = {
  media: { Icon: ImageIcon, label: "Beeld & video" },
  info: { Icon: MessageSquareQuote, label: "Informatie" },
  access: { Icon: KeyRound, label: "Toegang" },
  approval: { Icon: ThumbsUp, label: "Akkoord" },
};

function dueLabel(due: string | null): string | null {
  if (!due) return null;
  const days = differenceInCalendarDays(new Date(`${due}T12:00:00`), new Date());
  if (days < 0) return `${Math.abs(days)} dag${Math.abs(days) === 1 ? "" : "en"} te laat`;
  if (days === 0) return "Vandaag";
  if (days === 1) return "Morgen";
  if (days <= 7) return `Over ${days} dagen`;
  return format(new Date(`${due}T12:00:00`), "d MMMM", { locale: nl });
}

export function DeliveryChecklist({
  clientId,
  compact = false,
}: {
  clientId: string;
  /** Compacte variant voor op het overzicht: alleen wat nog open staat. */
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const fetchOverview = useServerFn(getDeliveryOverview);
  const setStatus = useServerFn(setDeliveryRequestStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["delivery-overview", clientId],
    enabled: !!clientId,
    queryFn: () => fetchOverview({ data: { clientId } }),
  });

  const toggle = useMutation({
    mutationFn: (vars: { id: string; status: "open" | "done" }) =>
      setStatus({ data: { id: vars.id, status: vars.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delivery-overview", clientId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }
  if (!data) return null;

  const visible = compact ? data.items.filter((i) => i.status !== "done") : data.items;

  return (
    <section className="rounded-2xl border border-gold/10 bg-card p-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-gold/80">Aanleverlijst</p>
          <h2 className="font-display text-2xl mt-1">Wat er nog van je nodig is</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {data.openCount === 0
              ? "Niets openstaand — je bent helemaal bij."
              : `${data.openCount} punt${data.openCount === 1 ? "" : "en"} open${
                  data.overdueCount > 0 ? `, waarvan ${data.overdueCount} over tijd` : ""
                }.`}
          </p>
        </div>
        <HealthRing score={data.progress} size={52} strokeWidth={5} />
      </header>

      {visible.length === 0 ? (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-gold/20 bg-gold/5 p-4">
          <PartyPopper className="h-5 w-5 shrink-0 text-gold" />
          <p className="text-sm">
            Alles is aangeleverd. Wij gaan verder met plannen en publiceren — je hoort van ons.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {visible.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              onToggle={
                item.source === "request"
                  ? () =>
                      toggle.mutate({
                        id: item.id,
                        status: item.status === "done" ? "open" : "done",
                      })
                  : undefined
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ChecklistRow({ item, onToggle }: { item: DeliveryItem; onToggle?: () => void }) {
  const { Icon, label } = KIND_META[item.kind];
  const done = item.status === "done";
  const due = dueLabel(item.dueDate);

  return (
    <li
      className={cn(
        "rounded-xl border p-3.5 transition",
        item.overdue
          ? "border-red-400/40 bg-red-500/5"
          : done
            ? "border-border/60 bg-muted/20"
            : "border-gold/10 bg-background/40 hover:border-gold/30",
      )}
    >
      <div className="flex items-start gap-3">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={done ? "Markeer als open" : "Markeer als aangeleverd"}
            className="mt-0.5 shrink-0 text-gold"
          >
            {done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
          </button>
        ) : (
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("text-sm font-medium", done && "line-through opacity-60")}>
              {item.title}
            </span>
            <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            {due && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[11px]",
                  item.overdue ? "text-red-400" : "text-muted-foreground",
                )}
              >
                <Clock className="h-3 w-3" /> {due}
              </span>
            )}
          </div>

          {item.description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
          )}

          {item.kind === "media" && item.needed > 1 && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                <div
                  className="h-full rounded-full bg-gradient-gold transition-[width] duration-500"
                  style={{ width: `${Math.min(100, (item.delivered / item.needed) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                {item.delivered} van {item.needed} aangeleverd
              </p>
            </div>
          )}

          {item.actionTo && !done && (
            <Link
              to={item.actionTo}
              className="mt-2 inline-flex items-center gap-1 text-xs text-gold hover:underline"
            >
              {item.actionLabel} <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
