import { Instagram, Linkedin, Music2, Facebook } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { StudioPlatform } from "@/lib/ai-studio.functions";

/**
 * De platforms waar we ook echt voor publiceren. X en Threads stonden hier ook,
 * maar er is geen koppeling voor — dan kun je er beter geen content voor laten
 * schrijven die vervolgens nergens heen kan.
 */
export const STUDIO_PLATFORMS: { id: StudioPlatform; label: string; Icon: LucideIcon }[] = [
  { id: "instagram", label: "Instagram", Icon: Instagram },
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin },
  { id: "tiktok", label: "TikTok", Icon: Music2 },
  { id: "facebook", label: "Facebook", Icon: Facebook },
];

export function platformLabel(id: string): string {
  return STUDIO_PLATFORMS.find((p) => p.id === id)?.label ?? id;
}
