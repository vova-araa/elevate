import { platformLabel } from "@/config/platforms";

// Caption character limits per platform (best-practice / hard limits). Getal
// blijft hier de bron van waarheid; het label komt uit config/platforms.ts
// (A02) zodat een naam nooit op twee plekken kan afwijken.
export const CAPTION_LIMITS: Record<string, { soft: number; hard: number; label: string }> = {
  instagram: { soft: 125, hard: 2200, label: platformLabel("instagram") },
  tiktok: { soft: 150, hard: 2200, label: platformLabel("tiktok") },
  linkedin: { soft: 210, hard: 3000, label: platformLabel("linkedin") },
  youtube: { soft: 100, hard: 5000, label: platformLabel("youtube") },
  facebook: { soft: 80, hard: 63206, label: platformLabel("facebook") },
};

export const DAY_LABELS = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
export const DAY_LABELS_LONG = [
  "Zondag",
  "Maandag",
  "Dinsdag",
  "Woensdag",
  "Donderdag",
  "Vrijdag",
  "Zaterdag",
];
