// Gedeelde navigatie-definitie voor de admin-omgeving.
// Zowel de desktop-sidebar als het mobiele slide-menu gebruiken deze bron,
// zodat de twee altijd exact dezelfde items en groepen tonen.
import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  Image as ImageIcon,
  Crop,
  Upload,
  Sparkles,
  Target,
  Wand2,
  Bot,
  Clock,
  TrendingUp,
  Heart,
  FileBarChart,
  CheckSquare,
  MessageSquare,
  Building2,
  Plug,
  Users,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";

export type BadgeKey = "scheduled" | "drafts" | "pending" | "unread" | "alerts";
export type BadgeTone = "default" | "amber" | "red" | "green";

export interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: BadgeKey;
  badgeTone?: BadgeTone;
  /**
   * Minder gebruikte pagina's staan standaard ingeklapt achter "Meer", zodat
   * het menu rustig blijft en de dagelijkse flow (posten) bovenaan staat.
   */
  secondary?: boolean;
}

export interface AdminNavSection {
  label: string;
  items: AdminNavItem[];
}

/**
 * Menu-indeling volgt de dagelijkse werkstroom: eerst posten, dan het maken van
 * content, dan de klant, dan resultaten, dan beheer. Alles wat bij elkaar hoort
 * staat bij elkaar; wat je zelden nodig hebt zit achter "Meer".
 */
export const ADMIN_NAV: AdminNavSection[] = [
  {
    label: "Posten",
    items: [
      { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/admin/planner", label: "Planner", icon: CalendarDays, badgeKey: "scheduled" },
      {
        to: "/admin/queue",
        label: "Concepten",
        icon: FileText,
        badgeKey: "drafts",
        badgeTone: "amber",
      },
      {
        to: "/admin/approvals",
        label: "Goedkeuring",
        icon: CheckSquare,
        badgeKey: "pending",
        badgeTone: "red",
      },
    ],
  },
  {
    label: "Content & AI",
    items: [
      { to: "/admin/media", label: "Media", icon: ImageIcon },
      { to: "/admin/ai", label: "AI Studio", icon: Sparkles },
      { to: "/admin/strategy", label: "Strategie", icon: Target },
      { to: "/admin/campaigns", label: "Campagnes", icon: Wand2, secondary: true },
      { to: "/admin/editor", label: "Beeld-editor", icon: Crop, secondary: true },
      { to: "/admin/bulk", label: "Bulk import", icon: Upload, secondary: true },
      { to: "/admin/assistant", label: "AI Assistent", icon: Bot, secondary: true },
      { to: "/admin/besttime", label: "Beste tijd", icon: Clock, secondary: true },
    ],
  },
  {
    label: "Klanten",
    items: [
      { to: "/admin/clients", label: "Klanten", icon: Building2 },
      { to: "/admin/channels", label: "Kanalen", icon: Plug },
      {
        to: "/admin/messages",
        label: "Berichten",
        icon: MessageSquare,
        badgeKey: "unread",
        badgeTone: "red",
      },
    ],
  },
  {
    label: "Resultaten",
    items: [
      { to: "/admin/reach", label: "Bereik & groei", icon: TrendingUp },
      { to: "/admin/reports", label: "Rapporten", icon: FileBarChart },
      { to: "/admin/engagement", label: "Engagement", icon: Heart, secondary: true },
    ],
  },
  {
    label: "Beheer",
    items: [
      { to: "/admin/team", label: "Team", icon: Users },
      {
        to: "/admin/settings",
        label: "Instellingen",
        icon: SettingsIcon,
        badgeKey: "alerts",
        badgeTone: "red",
      },
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
