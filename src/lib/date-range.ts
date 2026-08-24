import { format, subDays, addDays } from "date-fns";
import { nl } from "date-fns/locale";

/**
 * Leesbare periode-aanduiding naast relatieve knoppen ("30 dagen"). Zonder dit
 * moet de gebruiker zelf "vandaag min 30" uitrekenen — op de analysepagina's
 * stond alleen het relatieve label, nergens de echte kalenderdata.
 * Zelfde maand: "1 – 30 augustus 2026". Andere maand: "28 juli – 4 augustus 2026".
 */
export function formatDateRange(days: number, end: Date = new Date()): string {
  const start = subDays(end, Math.max(0, days - 1));
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = format(start, sameMonth ? "d" : "d MMMM", { locale: nl });
  const endLabel = format(end, "d MMMM yyyy", { locale: nl });
  return `${startLabel} – ${endLabel}`;
}

/** Zelfde als formatDateRange, maar vooruit vanaf een gekozen startdatum —
 * voor generators die een periode plannen i.p.v. een periode terugkijken
 * (bv. de campagne-planner: "14 dagen" vanaf de gekozen startdatum). */
export function formatForwardDateRange(startIso: string, days: number): string {
  const start = new Date(`${startIso}T00:00:00`);
  const end = addDays(start, Math.max(0, days - 1));
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = format(start, sameMonth ? "d" : "d MMMM", { locale: nl });
  const endLabel = format(end, "d MMMM yyyy", { locale: nl });
  return `${startLabel} – ${endLabel}`;
}
