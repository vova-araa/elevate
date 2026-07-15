import { Instagram, Linkedin, Music2, Facebook, Twitter, AtSign } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { StudioPlatform } from "@/lib/ai-studio.functions";

export const STUDIO_PLATFORMS: { id: StudioPlatform; label: string; Icon: LucideIcon }[] = [
  { id: "instagram", label: "Instagram", Icon: Instagram },
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin },
  { id: "tiktok", label: "TikTok", Icon: Music2 },
  { id: "facebook", label: "Facebook", Icon: Facebook },
  { id: "x", label: "X", Icon: Twitter },
  { id: "threads", label: "Threads", Icon: AtSign },
];

export function platformLabel(id: string): string {
  return STUDIO_PLATFORMS.find((p) => p.id === id)?.label ?? id;
}
