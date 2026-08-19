import type { QueryClient } from "@tanstack/react-query";

/**
 * Klantenlijsten leven onder verschillende query keys door de app heen:
 * de klant-switcher in de sidebar ("admin-sidebar-clients"), de klantenpagina
 * ("clients"), en allerlei dropdowns ("clients-min", "clients-list", ...).
 *
 * Na het aanmaken, bewerken of verwijderen van een klant moeten ze állemaal
 * verversen — anders blijft bijvoorbeeld de switcher een nieuwe klant
 * verzwijgen tot een harde reload. Eén aanroep hier dekt ze allemaal.
 */
export function invalidateClientLists(qc: QueryClient) {
  void qc.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey[0];
      return (
        typeof k === "string" &&
        (k === "admin-sidebar-clients" || k === "recent-clients" || k.startsWith("clients"))
      );
    },
  });
}
