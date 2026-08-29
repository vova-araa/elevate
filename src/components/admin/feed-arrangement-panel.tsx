import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GripVertical, ImageOff, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/ui/confirm";
import { EmptyState } from "@/components/empty-state";
import { VISIBLE_PLATFORMS, type Platform } from "@/config/platforms";
import {
  clearFeedArrangement,
  fillFeedArrangementFromLive,
  getFeedArrangement,
  saveFeedArrangement,
  type FeedArrangementSlot,
} from "@/lib/feed-arrangement.functions";
import { applyFeedDrop, type FeedDragPayload } from "@/lib/feed-drag";

function ratioFor(platform: Platform): string {
  if (platform === "tiktok") return "9 / 16";
  if (platform === "youtube") return "16 / 9";
  if (platform === "instagram") return "1 / 1";
  return "1.91 / 1";
}

function colsFor(platform: Platform): string {
  return platform === "instagram" || platform === "tiktok"
    ? "grid-cols-3"
    : "grid-cols-3 sm:grid-cols-4";
}

export function FeedArrangementPanel({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [platform, setPlatform] = useState<Platform>(VISIBLE_PLATFORMS[0]!.id);
  const [filling, setFilling] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const getFn = useServerFn(getFeedArrangement);
  const saveFn = useServerFn(saveFeedArrangement);
  const fillFn = useServerFn(fillFeedArrangementFromLive);
  const clearFn = useServerFn(clearFeedArrangement);

  const queryKey = ["feed-arrangement", clientId, platform];
  const { data: slots, isLoading } = useQuery({
    queryKey,
    queryFn: () => getFn({ data: { clientId, platform } }),
    enabled: open && !!clientId,
  });

  function toSlotInput(s: FeedArrangementSlot) {
    return s.uploadId
      ? { uploadId: s.uploadId }
      : {
          snapshotMediaUrl: s.mediaUrl ?? undefined,
          snapshotCaption: s.caption ?? undefined,
          snapshotIsVideo: s.isVideo,
        };
  }

  async function persist(next: FeedArrangementSlot[]) {
    // Optimistisch: het raster voelt meteen aan, de server bevestigt op de
    // achtergrond. Bij een fout halen we de vorige stand terug op.
    qc.setQueryData(queryKey, next);
    try {
      await saveFn({ data: { clientId, platform, slots: next.map(toSlotInput) } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Opslaan van het raster mislukt");
      qc.invalidateQueries({ queryKey });
    }
  }

  function handleDrop(targetIndex: number, e: React.DragEvent) {
    e.preventDefault();
    setDragOverIndex(null);
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    let payload: FeedDragPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    void persist(applyFeedDrop(slots ?? [], payload, targetIndex));
  }

  function removeSlot(index: number) {
    const next = (slots ?? []).filter((_, i) => i !== index);
    void persist(next);
  }

  async function fillFromLive() {
    setFilling(true);
    try {
      const res = await fillFn({ data: { clientId, platform } });
      qc.invalidateQueries({ queryKey });
      toast.success(
        res.count > 0
          ? `Raster gevuld met ${res.count} post${res.count === 1 ? "" : "s"}${res.note ? " (eigen registratie — zie toelichting)" : ""}`
          : "Nog niets gevonden om te tonen voor dit platform",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Live feed ophalen mislukt");
    } finally {
      setFilling(false);
    }
  }

  async function clearAll() {
    if ((slots ?? []).length === 0) return;
    const ok = await confirmDialog({
      title: "Raster leegmaken?",
      description:
        "Alle tegels in deze feed-preview verdwijnen. De bestanden zelf blijven bestaan.",
      confirmLabel: "Leegmaken",
      destructive: true,
    });
    if (!ok) return;
    setClearing(true);
    try {
      await clearFn({ data: { clientId, platform } });
      qc.setQueryData(queryKey, []);
      toast.success("Raster leeggemaakt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Leegmaken mislukt");
    } finally {
      setClearing(false);
    }
  }

  const ratio = ratioFor(platform);
  const cols = colsFor(platform);
  const filled = slots ?? [];
  // Altijd wat lege plekken tonen om naar te slepen — minimaal 3, en genoeg
  // om op een veelvoud van 3 uit te komen zodat het raster netjes oogt.
  const trailingEmpty = filled.length === 0 ? 6 : (3 - (filled.length % 3)) % 3 || 3;

  return (
    <div className="card-surface-lg bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg">Feed-indeling</h2>
          <span className="text-xs text-muted-foreground">
            Sleep foto&apos;s hierin om te zien hoe de feed er het mooist uitziet
          </span>
        </div>
        <button
          onClick={() => onOpenChange(!open)}
          className="rounded-full glass px-3 py-1.5 text-xs hover:bg-gold/10"
        >
          {open ? "Verberg feed" : "Toon feed"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-full glass p-1 text-[11px]">
              {VISIBLE_PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  className={cn(
                    "rounded-full px-2.5 py-1 inline-flex items-center gap-1 transition",
                    platform === p.id
                      ? "bg-gold/15 text-gold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <p.Icon className="h-3 w-3" /> {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fillFromLive}
                disabled={filling}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-gold/30 px-3 text-xs text-gold hover:bg-gold/10 disabled:opacity-50"
              >
                {filling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Vul met live feed
              </button>
              <button
                onClick={clearAll}
                disabled={clearing || filled.length === 0}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-muted-foreground hover:bg-accent/40 disabled:opacity-40"
              >
                {clearing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Leegmaken
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
            </div>
          ) : (
            <div className={cn("grid gap-1.5", cols)}>
              {filled.map((slot, i) => (
                <ArrangedTile
                  key={slot.id}
                  slot={slot}
                  index={i}
                  ratio={ratio}
                  dragOver={dragOverIndex === i}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverIndex(i);
                  }}
                  onDragLeave={() => setDragOverIndex((v) => (v === i ? null : v))}
                  onDrop={(e) => handleDrop(i, e)}
                  onRemove={() => removeSlot(i)}
                />
              ))}
              {Array.from({ length: trailingEmpty }, (_, i) => {
                const idx = filled.length + i;
                return (
                  <EmptySlot
                    key={`empty-${idx}`}
                    dragOver={dragOverIndex === idx}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverIndex(idx);
                    }}
                    onDragLeave={() => setDragOverIndex((v) => (v === idx ? null : v))}
                    onDrop={(e) => handleDrop(filled.length, e)}
                    ratio={ratio}
                  />
                );
              })}
            </div>
          )}

          {!isLoading && filled.length === 0 && (
            <EmptyState
              icon={<ImageOff className="h-5 w-5" />}
              title="Nog geen indeling"
              description="Sleep bestanden uit de bibliotheek hieronder naar het raster, of vul het met wat er al live staat."
              className="py-6"
            />
          )}
        </div>
      )}
    </div>
  );
}

function ArrangedTile({
  slot,
  index,
  ratio,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemove,
}: {
  slot: FeedArrangementSlot;
  index: number;
  ratio: string;
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        const payload: FeedDragPayload = { kind: "slot", index };
        e.dataTransfer.setData("text/plain", JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{ aspectRatio: ratio }}
      className={cn(
        "group relative overflow-hidden rounded-lg bg-surface-elevated/60 ring-1 ring-inset ring-border/40 cursor-grab active:cursor-grabbing transition",
        dragOver && "ring-2 ring-gold",
      )}
    >
      {slot.mediaUrl ? (
        slot.isVideo ? (
          <video src={slot.mediaUrl} className="h-full w-full object-cover" muted playsInline />
        ) : (
          <img src={slot.mediaUrl} alt="" className="h-full w-full object-cover" />
        )
      ) : (
        <div className="grid h-full w-full place-items-center text-muted-foreground/50">
          <ImageOff className="h-5 w-5" />
        </div>
      )}
      <div className="absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition">
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <button
        onClick={onRemove}
        aria-label="Uit raster halen"
        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition hover:bg-black/80"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function EmptySlot({
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  ratio,
}: {
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  ratio: string;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{ aspectRatio: ratio }}
      className={cn(
        "grid place-items-center rounded-lg border border-dashed border-border/50 text-muted-foreground/40 transition",
        dragOver && "border-gold bg-gold/5 text-gold",
      )}
    >
      <ImageOff className="h-4 w-4" />
    </div>
  );
}
