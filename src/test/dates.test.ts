import { describe, it, expect } from "vitest";
import { toLocalISODate, toLocalInputValue, addMonthsClamped } from "@/lib/dates";

/**
 * Twee tijdzone-valkuilen die in de app echt misgingen: "vandaag" via UTC (dan
 * staat er 's nachts de dag ervoor) en maandelijkse herhaling via setMonth
 * (dan springt 31 januari naar 3 maart).
 */

describe("toLocalISODate", () => {
  it("neemt de lokale datum, niet de UTC-datum", () => {
    // Een halfuur na middernacht lokale tijd. toISOString() zou hier in
    // Nederland de dag ervóór geven — precies de bug.
    const d = new Date(2026, 7, 20, 0, 30);
    expect(toLocalISODate(d)).toBe("2026-08-20");
  });

  it("vult maand en dag aan tot twee cijfers", () => {
    expect(toLocalISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("klopt ook op oudejaarsavond", () => {
    expect(toLocalISODate(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
});

describe("toLocalInputValue", () => {
  it("levert het formaat dat datetime-local verwacht", () => {
    expect(toLocalInputValue(new Date(2026, 7, 20, 9, 5))).toBe("2026-08-20T09:05");
  });
});

describe("addMonthsClamped", () => {
  it("laat 31 januari niet doorlopen naar maart", () => {
    // setMonth(+1) geeft hier 3 maart; dat was zichtbaar als posts op dagen die
    // de gebruiker nooit gekozen had.
    const uit = addMonthsClamped(new Date(2026, 0, 31), 1);
    expect(toLocalISODate(uit)).toBe("2026-02-28");
  });

  it("herkent een schrikkeljaar", () => {
    expect(toLocalISODate(addMonthsClamped(new Date(2028, 0, 31), 1))).toBe("2028-02-29");
  });

  it("houdt een reeks van twaalf maanden netjes op dezelfde dag", () => {
    const start = new Date(2026, 0, 31);
    const dagen = Array.from({ length: 12 }, (_, i) => addMonthsClamped(start, i).getDate());
    // Alleen februari (en 30-daagse maanden) wijken af, en dan naar de laatste
    // dag van díe maand — nooit naar de eerste van de volgende.
    expect(dagen).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  });

  it("laat de tijd ongemoeid", () => {
    const uit = addMonthsClamped(new Date(2026, 0, 15, 14, 30), 2);
    expect(uit.getHours()).toBe(14);
    expect(uit.getMinutes()).toBe(30);
    expect(toLocalISODate(uit)).toBe("2026-03-15");
  });

  it("werkt ook terug in de tijd", () => {
    expect(toLocalISODate(addMonthsClamped(new Date(2026, 2, 31), -1))).toBe("2026-02-28");
  });
});
