// Gedeelde navigatie-definitie voor de admin-omgeving.
// Zowel de desktop-sidebar als het mobiele slide-menu gebruiken deze bron,
// zodat de twee altijd exact dezelfde items en groepen tonen.
import {
  LayoutDashboard,
  CalendarDays,
  Image as ImageIcon,
  Sparkles,
  TrendingUp,
  Building2,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";

export type BadgeKey = "scheduled" | "drafts" | "pending" | "unread" | "alerts";
export type BadgeTone = "default" | "amber" | "red" | "green";

export interface AdminNavChild {
  to: string;
  label: string;
  badgeKey?: BadgeKey;
  badgeTone?: BadgeTone;
}

/**
 * Eén hoofditem in het menu. Onderliggende pagina's hangen als `children`
 * eronder en zijn standaard ingeklapt — zo zie je zeven regels in plaats van
 * twintig, en staat alles wat bij elkaar hoort ook bij elkaar.
 */
export interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: BadgeKey;
  badgeTone?: BadgeTone;
  children?: AdminNavChild[];
}

/**
 * Zeven hoofdingangen, elk met zijn eigen onderdelen eronder. Alles wat met
 * plannen te maken heeft hangt onder Planner, alles met beeld onder Media,
 * enzovoort — zo blijft het menu kort en weet je meteen waar je moet zijn.
 */
export const ADMIN_NAV: AdminNavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    to: "/admin/planner",
    label: "Planner",
    icon: CalendarDays,
    badgeKey: "scheduled",
    children: [
      { to: "/admin/queue", label: "Concepten", badgeKey: "drafts", badgeTone: "amber" },
      { to: "/admin/approvals", label: "Goedkeuring", badgeKey: "pending", badgeTone: "red" },
    ],
  },
  {
    to: "/admin/media",
    label: "Content",
    icon: ImageIcon,
    children: [
      { to: "/admin/editor", label: "Beeld-editor" },
      { to: "/admin/besttime", label: "Beste tijden" },
      { to: "/admin/bulk", label: "Bulk import" },
    ],
  },
  { to: "/admin/ai", label: "AI Studio", icon: Sparkles },
  {
    to: "/admin/clients",
    label: "Klanten",
    icon: Building2,
    children: [
      { to: "/admin/channels", label: "Kanalen" },
      { to: "/admin/messages", label: "Berichten", badgeKey: "unread", badgeTone: "red" },
    ],
  },
  {
    to: "/admin/reach",
    label: "Analyse",
    icon: TrendingUp,
    children: [
      { to: "/admin/engagement", label: "Engagement" },
      { to: "/admin/reports", label: "Rapporten" },
      { to: "/admin/strategy", label: "Strategie" },
      { to: "/admin/campaigns", label: "Campagnes" },
    ],
  },
  {
    to: "/admin/settings",
    label: "Instellingen",
    icon: SettingsIcon,
    badgeKey: "alerts",
    badgeTone: "red",
    children: [
      { to: "/admin/team", label: "Team" },
      { to: "/admin/assistant", label: "AI Assistent" },
    ],
  },
];

export const badgeClasses: Record<BadgeTone, string> = {
  default: "bg-gold/15 text-gold",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

export type SidebarCounts = Record<BadgeKey, number>;

export function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
