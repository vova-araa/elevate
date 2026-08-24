import type { CSSProperties } from "react";

/**
 * A19: klantavatars (initialen of een kale cirkel zonder logo) vulden zich
 * volledig met de eigen merkkleur van de klant — een fel paars naast een
 * warm-gouden interface bijvoorbeeld. De vulling blijft daarom altijd in het
 * eigen palet; de merkkleur van de klant komt terug als dunne rand, net als
 * de kleurstippen in de planner-legenda en de kalender.
 */
export function clientAvatarStyle(brandColor?: string | null): CSSProperties {
  return {
    background: "var(--gradient-gold)",
    ...(brandColor ? { boxShadow: `inset 0 0 0 2px ${brandColor}` } : {}),
  };
}
