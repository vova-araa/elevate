// Gedeelde navigatie-definitie voor de admin-omgeving.
// Zowel de desktop-sidebar als het mobiele slide-menu gebruiken deze bron,
// zodat de twee altijd exact dezelfde items en groepen tonen.
import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  Image as ImageIcon,
  Upload,
  Sparkles,
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
}

export interface AdminNavSection {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavSection[] = [
  {
    label: "Werkruimte",
    items: [
      { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/admin/planner", label: "Planner", icon: CalendarDays, badgeKey: "scheduled" },
      { to: "/admin/queue", label: "Concepten", icon: FileText, badgeKey: "drafts", badgeTone: "amber" },
      { to: "/admin/media", label: "Media", icon: ImageIcon },
      { to: "/admin/bulk", label: "Bulk import", icon: Upload },
    ],
  },
  {
    label: "AI tools",
    items: [
      { to: "/admin/ai", label: "AI Studio", icon: Sparkles },
      { to: "/admin/campaigns", label: "Campagnes", icon: Wand2 },
      { to: "/admin/assistant", label: "AI Assistent", icon: Bot },
      { to: "/admin/besttime", label: "Beste tijd", icon: Clock },
    ],
  },
  {
    label: "Analyse",
    items: [
      { to: "/admin/reach", label: "Bereik & groei", icon: TrendingUp },
      { to: "/admin/engagement", label: "Engagement", icon: Heart },
      { to: "/admin/reports", label: "Rapporten", icon: FileBarChart },
    ],
  },
  {
    label: "Beheer",
    items: [
      { to: "/admin/approvals", label: "Goedkeuring", icon: CheckSquare, badgeKey: "pending", badgeTone: "red" },
      { to: "/admin/messages", label: "Berichten", icon: MessageSquare, badgeKey: "unread", badgeTone: "red" },
      { to: "/admin/clients", label: "Klanten", icon: Building2 },
      { to: "/admin/channels", label: "Kanalen", icon: Plug },
      { to: "/admin/team", label: "Team", icon: Users },
      { to: "/admin/settings", label: "Instellingen", icon: SettingsIcon, badgeKey: "alerts", badgeTone: "red" },
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
