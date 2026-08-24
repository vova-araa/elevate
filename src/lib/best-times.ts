/**
 * "Beste tijd"-suggesties uit echte publicatiegeschiedenis (A03) — geen
 * benchmark-tabel met verzonnen scores meer. Simpele telling: welk dag/uur-
 * moment is voor dit platform het vaakst daadwerkelijk gebruikt om te
 * publiceren. Leeg zolang er nog niets gepubliceerd is.
 */
export interface BestTimeSlot {
  /** Native `Date.getDay()`-conventie: 0 = zondag .. 6 = zaterdag. */
  day: number;
  hour: number;
  count: number;
}

export function computeBestTimeSlots(publishedAt: (string | null)[], limit = 5): BestTimeSlot[] {
  const counts = new Map<string, number>();
  for (const ts of publishedAt) {
    if (!ts) continue;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;
    const day = d.getDay();
    const hour = d.getHours();
    const key = `${day}-${hour}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [day, hour] = key.split("-").map(Number);
      return { day, hour, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
