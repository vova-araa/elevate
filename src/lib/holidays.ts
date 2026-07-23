/**
 * Nederlandse feestdagen (vast + berekend t.o.v. Pasen), puur functioneel en
 * zonder afhankelijkheden — bruikbaar in de kalenderweergaven van planner en klant.
 */

export interface DutchHoliday {
  /** ISO-datum, bv. "2026-04-27" */
  date: string;
  /** Nederlandse naam van de feestdag */
  name: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Formatteert jaar/maand(1-12)/dag naar "YYYY-MM-DD". */
function toKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function dateToKey(d: Date): string {
  return toKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Berekent paaszondag met het Anonymous Gregorian (Meeus/Jones/Butcher) algoritme.
 * Werkt voor elk jaar in de Gregoriaanse kalender.
 */
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = maart, 4 = april
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Geeft alle Nederlandse feestdagen voor een jaar, gesorteerd op datum.
 * Vaste dagen (Nieuwjaar, Bevrijdingsdag, Kerst) plus dagen berekend t.o.v. Pasen
 * (Goede Vrijdag, Pasen, Hemelvaart, Pinksteren) en Koningsdag (27-4, of 26-4 op zondag).
 */
export function dutchHolidays(year: number): DutchHoliday[] {
  const easter = calculateEaster(year);

  const kingsDayDefault = new Date(year, 3, 27); // 27 april
  const kingsDay = kingsDayDefault.getDay() === 0 ? new Date(year, 3, 26) : kingsDayDefault;

  const holidays: DutchHoliday[] = [
    { date: toKey(year, 1, 1), name: "Nieuwjaarsdag" },
    { date: dateToKey(addDays(easter, -2)), name: "Goede Vrijdag" },
    { date: dateToKey(easter), name: "1e Paasdag" },
    { date: dateToKey(addDays(easter, 1)), name: "2e Paasdag" },
    { date: dateToKey(kingsDay), name: "Koningsdag" },
    { date: toKey(year, 5, 5), name: "Bevrijdingsdag" },
    { date: dateToKey(addDays(easter, 39)), name: "Hemelvaartsdag" },
    { date: dateToKey(addDays(easter, 49)), name: "1e Pinksterdag" },
    { date: dateToKey(addDays(easter, 50)), name: "2e Pinksterdag" },
    { date: toKey(year, 12, 25), name: "1e Kerstdag" },
    { date: toKey(year, 12, 26), name: "2e Kerstdag" },
  ];

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}
