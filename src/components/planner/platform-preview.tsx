import type { LucideIcon } from "lucide-react";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  ThumbsUp,
  Repeat2,
  Play,
  Music2,
} from "lucide-react";
import { clientAvatarStyle } from "@/lib/client-avatar";
import { cn } from "@/lib/utils";
import type { Platform } from "@/config/platforms";

/**
 * Postvenster #5, item 1: de "Live preview" toonde alleen een kale
 * aspect-ratio-box met de media erin — je keurde iets goed dat er live heel
 * anders uitziet (geen profielregel, geen caption-overlay, geen iconen).
 * Deze kaart bootst de echte layout van elk platform na (feed-kaart voor
 * Instagram/Facebook/LinkedIn, full-bleed verticale kaart met overlay-chrome
 * voor TikTok, thumbnail+play voor YouTube) zodat de crop en de context
 * kloppen met wat een klant straks live ziet. Puur presentatie — beïnvloedt
 * niets aan wat er daadwerkelijk gepubliceerd wordt.
 */

type Props = {
  platform: Platform;
  ratio: string;
  mediaUrl: string | null;
  mediaType: string | null;
  caption: string;
  clientName: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  fallbackIcon: LucideIcon;
  fallbackGradient: string;
};

function Avatar({
  clientName,
  brandColor,
  logoUrl,
  size = "h-7 w-7",
}: {
  clientName: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  size?: string;
}) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" className={cn(size, "rounded-full object-cover shrink-0")} />;
  }
  return (
    <div
      className={cn(
        size,
        "rounded-full shrink-0 grid place-items-center text-[10px] font-medium text-white",
      )}
      style={clientAvatarStyle(brandColor)}
    >
      {clientName.slice(0, 1).toUpperCase()}
    </div>
  );
}

function Media({
  mediaUrl,
  mediaType,
  fallbackIcon: FallbackIcon,
  fallbackGradient,
  className,
}: {
  mediaUrl: string | null;
  mediaType: string | null;
  fallbackIcon: LucideIcon;
  fallbackGradient: string;
  className?: string;
}) {
  if (mediaUrl) {
    return mediaType?.startsWith("video") ? (
      <video src={mediaUrl} controls className={cn("h-full w-full object-cover", className)} />
    ) : (
      <img src={mediaUrl} alt="" className={cn("h-full w-full object-cover", className)} />
    );
  }
  return (
    <div
      className={cn(
        "h-full w-full bg-gradient-to-br grid place-items-center",
        fallbackGradient,
        className,
      )}
    >
      <FallbackIcon className="h-10 w-10 text-white/80" />
    </div>
  );
}

export function PlatformPreviewCard(props: Props) {
  const { platform, caption } = props;

  if (platform === "tiktok") {
    return (
      <div
        className="relative overflow-hidden rounded-lg bg-black mx-auto"
        style={{ aspectRatio: props.ratio, maxWidth: 220 }}
      >
        <Media {...props} className="opacity-95" />
        {/* Rechterrand: icoonrail zoals TikTok 'm toont — profiel, hart, reactie, delen. */}
        <div className="pointer-events-none absolute right-2 bottom-14 flex flex-col items-center gap-3 text-white">
          <Avatar {...props} size="h-8 w-8" />
          <div className="flex flex-col items-center gap-0.5">
            <Heart className="h-6 w-6 drop-shadow" />
            <span className="text-[10px] drop-shadow">—</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <MessageCircle className="h-6 w-6 drop-shadow" />
            <span className="text-[10px] drop-shadow">—</span>
          </div>
          <Send className="h-5 w-5 drop-shadow" />
        </div>
        {/* Onder: caption + naam, zoals TikTok's overlay. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-3 pt-8 text-white">
          <div className="text-xs font-medium">
            @{props.clientName.toLowerCase().replace(/\s+/g, "")}
          </div>
          {caption && <p className="mt-1 text-[11px] leading-snug line-clamp-2 pr-8">{caption}</p>}
          <div className="mt-1 flex items-center gap-1 text-[10px] text-white/80">
            <Music2 className="h-2.5 w-2.5" /> Origineel geluid
          </div>
        </div>
      </div>
    );
  }

  if (platform === "youtube") {
    return (
      <div className="rounded-lg overflow-hidden border border-border/30 bg-surface/40">
        <div className="relative" style={{ aspectRatio: props.ratio }}>
          <Media {...props} />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/30">
              <Play className="h-5 w-5 translate-x-0.5 fill-current" />
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2 p-2.5">
          <Avatar {...props} />
          <div className="min-w-0">
            <p className="text-xs font-medium line-clamp-2">
              {caption || "Geen titel/omschrijving"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{props.clientName}</p>
          </div>
        </div>
      </div>
    );
  }

  // Instagram / Facebook / LinkedIn: feed-kaart met profielregel + media + reactie-iconen.
  const isLinkedIn = platform === "linkedin";
  return (
    <div className="rounded-lg overflow-hidden border border-border/30 bg-surface/40">
      <div className="flex items-center gap-2 p-2.5">
        <Avatar {...props} />
        <div className="text-xs font-medium">{props.clientName}</div>
      </div>
      {isLinkedIn && caption && (
        <p className="px-2.5 pb-2 text-[11px] leading-snug line-clamp-3">{caption}</p>
      )}
      <div style={{ aspectRatio: props.ratio }}>
        <Media {...props} />
      </div>
      <div className="flex items-center gap-3 px-2.5 py-2 text-muted-foreground">
        {isLinkedIn ? (
          <>
            <ThumbsUp className="h-4 w-4" />
            <MessageCircle className="h-4 w-4" />
            <Repeat2 className="h-4 w-4" />
            <Send className="h-4 w-4" />
          </>
        ) : (
          <>
            <Heart className="h-4 w-4" />
            <MessageCircle className="h-4 w-4" />
            <Send className="h-4 w-4" />
            <Bookmark className="h-4 w-4 ml-auto" />
          </>
        )}
      </div>
      {!isLinkedIn && caption && (
        <p className="px-2.5 pb-2.5 text-[11px] leading-snug line-clamp-3">
          <span className="font-medium">{props.clientName}</span> {caption}
        </p>
      )}
    </div>
  );
}
