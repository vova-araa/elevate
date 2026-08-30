/**
 * Tab-sets voor pagina's die bij elkaar horen. Het menu toont één ingang; de
 * onderliggende schermen zijn als tabblad bereikbaar. Losgetrokken van het
 * component zodat het puur data blijft.
 */
export interface PageTab {
  to: string;
  label: string;
}

export const CONTENT_TABS: PageTab[] = [
  { to: "/admin/media", label: "Bibliotheek" },
  { to: "/admin/editor", label: "Beeld-editor" },
  { to: "/admin/besttime", label: "Beste tijden" },
  { to: "/admin/bulk", label: "Bulk import" },
];

export const ANALYSE_TABS: PageTab[] = [
  { to: "/admin/analytics", label: "Overzicht" },
  { to: "/admin/reach", label: "Bereik" },
  { to: "/admin/engagement", label: "Engagement" },
  { to: "/admin/reports", label: "Rapporten" },
  { to: "/admin/strategy", label: "Strategie" },
  { to: "/admin/campaigns", label: "Campagnes" },
];

export const PLANNER_TABS: PageTab[] = [
  { to: "/admin/planner", label: "Kalender" },
  { to: "/admin/queue", label: "Concepten" },
  { to: "/admin/approvals", label: "Goedkeuring" },
];
