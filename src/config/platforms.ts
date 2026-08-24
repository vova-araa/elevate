import { Instagram, Music2, Linkedin, Youtube, Facebook, type LucideIcon } from "lucide-react";

/**
 * Eén bron van waarheid voor welke social-platforms Elevate kent (A02).
 * Voorheen stond dit los gedupliceerd op zes-plus plekken, met steeds een
 * andere subset (3, 4 of 5 platforms) — nu rendert elke lijst in de app
 * hieruit en filtert op `enabled`.
 */
export type Platform = "instagram" | "tiktok" | "linkedin" | "youtube" | "facebook";

export interface PlatformMeta {
  id: Platform;
  label: string;
  Icon: LucideIcon;
  /** Wordt daadwerkelijk aangeboden om te koppelen/plannen. */
  enabled: boolean;
}

export const PLATFORMS: PlatformMeta[] = [
  { id: "instagram", label: "Instagram", Icon: Instagram, enabled: true },
  { id: "tiktok", label: "TikTok", Icon: Music2, enabled: true },
  { id: "facebook", label: "Facebook", Icon: Facebook, enabled: true },
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin, enabled: false },
  { id: "youtube", label: "YouTube", Icon: Youtube, enabled: false },
];

/** Alle platform-ids, ook de nog niet aangeboden — voor server-side validatie. */
export const ALL_PLATFORM_IDS: Platform[] = PLATFORMS.map((p) => p.id);

/** Alleen de platforms die nu daadwerkelijk aangeboden worden. */
export const VISIBLE_PLATFORMS: PlatformMeta[] = PLATFORMS.filter((p) => p.enabled);
export const ENABLED_PLATFORMS: Platform[] = VISIBLE_PLATFORMS.map((p) => p.id);

export function platformMeta(id: string): PlatformMeta | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

export function platformLabel(id: string): string {
  return platformMeta(id)?.label ?? id;
}
