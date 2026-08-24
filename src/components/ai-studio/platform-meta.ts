import { VISIBLE_PLATFORMS } from "@/config/platforms";
import type { StudioPlatform } from "@/lib/ai-studio.functions";

/**
 * De platforms waar we ook echt voor publiceren (src/config/platforms.ts,
 * A02). X, Threads en LinkedIn stonden hier ook, maar daar is geen koppeling
 * voor — dan kun je er beter geen content voor laten schrijven die vervolgens
 * nergens heen kan.
 */
export const STUDIO_PLATFORMS = VISIBLE_PLATFORMS as {
  id: StudioPlatform;
  label: string;
  Icon: (typeof VISIBLE_PLATFORMS)[number]["Icon"];
}[];

export function platformLabel(id: string): string {
  return STUDIO_PLATFORMS.find((p) => p.id === id)?.label ?? id;
}
