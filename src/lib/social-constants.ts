// Caption character limits per platform (best-practice / hard limits)
export const CAPTION_LIMITS: Record<string, { soft: number; hard: number; label: string }> = {
  instagram: { soft: 125, hard: 2200, label: "Instagram" },
  tiktok: { soft: 150, hard: 2200, label: "TikTok" },
  linkedin: { soft: 210, hard: 3000, label: "LinkedIn" },
  youtube: { soft: 100, hard: 5000, label: "YouTube" },
  facebook: { soft: 80, hard: 63206, label: "Facebook" },
};

export const DAY_LABELS = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
export const DAY_LABELS_LONG = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
