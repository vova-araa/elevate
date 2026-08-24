import { PLATFORMS as PLATFORM_CONFIG, type Platform } from "@/config/platforms";

export type { Platform };
export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed";

// Beeldverhouding + kaartkleur zijn planner-specifiek en horen niet in de
// centrale platformlijst (src/config/platforms.ts, A02) — id/label/Icon en
// welke platforms aangeboden worden komen wél vandaar.
const PLANNER_VISUALS: Record<Platform, { ratio: string; color: string }> = {
  instagram: { ratio: "4 / 5", color: "from-pink-500 to-orange-400" },
  tiktok: { ratio: "9 / 16", color: "from-fuchsia-500 to-cyan-400" },
  linkedin: { ratio: "1.91 / 1", color: "from-sky-600 to-sky-400" },
  youtube: { ratio: "16 / 9", color: "from-red-600 to-red-400" },
  facebook: { ratio: "1.91 / 1", color: "from-blue-600 to-blue-400" },
};

export const PLATFORMS = PLATFORM_CONFIG.map((p) => ({ ...p, ...PLANNER_VISUALS[p.id] }));

export const ENABLED_PLATFORMS: Platform[] = PLATFORM_CONFIG.filter((p) => p.enabled).map(
  (p) => p.id,
);
export const VISIBLE_PLATFORMS = PLATFORMS.filter((p) => p.enabled);

export const STATUS_META: Record<PostStatus, { label: string; cls: string; dot: string }> = {
  draft: {
    label: "Wacht op goedkeuring",
    cls: "border-amber-400/40 text-amber-300 bg-amber-500/10",
    dot: "bg-amber-400",
  },
  scheduled: {
    label: "Goedgekeurd / Ingepland",
    cls: "border-sky-400/40 text-sky-300 bg-sky-500/10",
    dot: "bg-sky-400",
  },
  publishing: {
    label: "Bezig met publiceren",
    cls: "border-violet-400/40 text-violet-300 bg-violet-500/10",
    dot: "bg-violet-400",
  },
  published: {
    label: "Gepubliceerd",
    cls: "border-emerald-400/40 text-emerald-300 bg-emerald-500/10",
    dot: "bg-emerald-400",
  },
  failed: {
    label: "Mislukt",
    cls: "border-red-400/40 text-red-300 bg-red-500/10",
    dot: "bg-red-400",
  },
};

/** Fallback-accentkleur (goud) als een klant geen brand_color heeft. */
export const GOLD_FALLBACK = "var(--gold)";

export const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
