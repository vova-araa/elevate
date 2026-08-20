/**
 * Datumhulpjes die rekening houden met de tijdzone van de gebruiker.
 *
 * Twee valkuilen kwamen in deze codebase herhaaldelijk voor:
 *
 *  1. `new Date().toISOString().slice(0, 10)` als "vandaag". Dat is de datum in
 *     UTC. In Nederland (UTC+1/+2) is dat tussen middernacht en 01:00/02:00 de
 *     dag ervóór — dan staat een nieuwe campagne of rapportperiode een dag te
 *     vroeg, precies wanneer iemand 's avonds laat nog wat inplant.
 *
 *  2. `setMonth(getMonth() + n)` voor een maandelijkse herhaling. Vanaf 31
 *     januari geeft dat 3 maart, want februari heeft geen 31e en JavaScript
 *     laat de datum dan doorlopen. Een reeks van twaalf maandelijkse posts
 *     belandde zo op willekeurige dagen.
 */

/** Vandaag als `YYYY-MM-DD`, in de tijdzone van de gebruiker. */
export function todayLocalISO(d: Date = new Date()): string {
  return toLocalISODate(d);
}

/** Een datum als `YYYY-MM-DD`, zonder omweg via UTC. */
export function toLocalISODate(d: Date): string {
  const maand = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${maand}-${dag}`;
}

/** Datum + tijd in het formaat dat `<input type="datetime-local">` verwacht. */
export function toLocalInputValue(d: Date): string {
  const uur = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${toLocalISODate(d)}T${uur}:${min}`;
}

/**
 * Tel maanden op zonder over te lopen naar de volgende maand.
 *
 * 31 januari + 1 maand wordt 28 (of 29) februari, niet 3 maart. De dag van de
 * maand wordt afgekapt op de laatste dag die de doelmaand heeft; tijd blijft
 * ongemoeid.
 */
export function addMonthsClamped(base: Date, months: number): Date {
  const d = new Date(base);
  const gewensteDag = d.getDate();
  // Eerst naar de 1e: anders loopt de maandwissel zelf al over.
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const laatsteDag = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(gewensteDag, laatsteDag));
  return d;
}
