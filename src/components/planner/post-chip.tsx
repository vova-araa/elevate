import { cn } from "@/lib/utils";
import { PLATFORMS, STATUS_META, GOLD_FALLBACK, type PostStatus } from "./planner-shared";

/**
 * Compact (maand) of ruim (week) post-item in de kalender.
 * - Linker rand (3px) in de brand_color van de klant (fallback goud).
 * - Versleepbaar behalve wanneer de post al gepubliceerd is.
 */
export function PostChip({
  post,
  brandColor,
  variant = "compact",
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  post: any;
  brandColor?: string | null;
  variant?: "compact" | "roomy";
  onDragStart: () => void;
  onDragEnd?: () => void;
  onOpen: () => void;
}) {
  const meta = PLATFORMS.find((x) => x.id === post.platform);
  const sm = STATUS_META[post.status as PostStatus] ?? STATUS_META.draft;
  const draggable = post.status !== "published";
  const accent = brandColor || GOLD_FALLBACK;
  const time = new Date(post.scheduled_at).toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (variant === "roomy") {
    return (
      <button
        draggable={draggable}
        onDragStart={
          draggable
            ? (e) => {
                e.stopPropagation();
                onDragStart();
              }
            : undefined
        }
        onDragEnd={onDragEnd}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        title={
          draggable
            ? "Sleep naar een andere dag om te verplaatsen"
            : "Gepubliceerd — niet versleepbaar"
        }
        className={cn(
          "w-full text-left text-[11px] rounded-lg px-2 py-1.5 border transition hover:brightness-110",
          sm.cls,
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        )}
        style={{ borderLeftWidth: 3, borderLeftColor: accent }}
      >
        <span className="flex items-center gap-1.5">
          {meta && <meta.Icon className="h-3 w-3 shrink-0" />}
          <span className="font-medium">{time}</span>
          <span className={cn("ml-auto h-1.5 w-1.5 rounded-full shrink-0", sm.dot)} />
        </span>
        <span className="block mt-1 line-clamp-3 whitespace-pre-wrap leading-snug text-foreground/80">
          {post.caption || <span className="italic text-muted-foreground">Geen caption</span>}
        </span>
      </button>
    );
  }

  return (
    <button
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              e.stopPropagation();
              onDragStart();
            }
          : undefined
      }
      onDragEnd={onDragEnd}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      title={
        draggable
          ? "Sleep naar een andere dag om te verplaatsen"
          : "Gepubliceerd — niet versleepbaar"
      }
      className={cn(
        "w-full text-left text-[10px] rounded px-1.5 py-1 truncate inline-flex items-center gap-1 border",
        sm.cls,
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      {meta && <meta.Icon className="h-3 w-3 shrink-0" />}
      <span className="truncate">
        {time} {post.caption?.slice(0, 24) || "Geen caption"}
      </span>
    </button>
  );
}
