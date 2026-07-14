import { Instagram, Music2, Linkedin, Youtube, Facebook } from "lucide-react";

export type Platform = "instagram" | "tiktok" | "linkedin" | "youtube" | "facebook";
export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed";

export const PLATFORMS: { id: Platform; label: string; Icon: any; ratio: string; color: string }[] =
  [
    {
      id: "instagram",
      label: "Instagram",
      Icon: Instagram,
      ratio: "4 / 5",
      color: "from-pink-500 to-orange-400",
    },
    {
      id: "tiktok",
      label: "TikTok",
      Icon: Music2,
      ratio: "9 / 16",
      color: "from-fuchsia-500 to-cyan-400",
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      Icon: Linkedin,
      ratio: "1.91 / 1",
      color: "from-sky-600 to-sky-400",
    },
    {
      id: "youtube",
      label: "YouTube",
      Icon: Youtube,
      ratio: "16 / 9",
      color: "from-red-600 to-red-400",
    },
    {
      id: "facebook",
      label: "Facebook",
      Icon: Facebook,
      ratio: "1.91 / 1",
      color: "from-blue-600 to-blue-400",
    },
  ];

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
