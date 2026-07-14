import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { nl } from "date-fns/locale";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toKey } from "./planner-shared";
import { PostChip } from "./post-chip";

/**
 * Week-weergave zonder uren: 7 kolommen met per dag gestapelde posts,
 * met genoeg ruimte per item om captions te lezen. Drop op een kolom
 * verplaatst de post naar die dag (tijdstip blijft behouden).
 */
export function WeekView({
  cursor,
  byDay,
  brandColor,
  onClickDay,
  onDropPost,
  dragId,
  setDragId,
  onOpenPost,
}: {
  cursor: Date;
  byDay: Record<string, any[]>;
  brandColor?: string | null;
  onClickDay: (d: Date) => void;
  onDropPost: (d: Date, id: string) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onOpenPost: (id: string) => void;
}) {
  const start = startOfWeek(cursor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();

  return (
    <div className="glass-strong rounded-2xl p-3 overflow-x-auto">
      <div className="grid grid-cols-7 gap-2 min-w-[840px]">
        {days.map((d) => {
          const k = toKey(d);
          const items = byDay[k] || [];
          const isToday = isSameDay(d, today);
          return (
            <div
              key={k}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) {
                  onDropPost(d, dragId);
                  setDragId(null);
                }
              }}
              className={cn(
                "rounded-xl border bg-surface/40 p-2 min-h-72 flex flex-col transition",
                isToday ? "border-gold/40" : "border-border/20",
                dragId && "hover:border-gold/50 hover:bg-gold/5",
              )}
            >
              <div className={cn("text-center pb-2", isToday && "text-gold")}>
                <div className="uppercase tracking-wider text-[10px] text-muted-foreground">
                  {format(d, "EEE", { locale: nl })}
                </div>
                <div
                  className={cn(
                    "font-display text-lg inline-flex items-center justify-center h-8 w-8 rounded-full",
                    isToday && "bg-gold text-primary-foreground",
                  )}
                >
                  {format(d, "d")}
                </div>
              </div>
              <div className="space-y-1.5 flex-1">
                {items.map((p: any) => (
                  <PostChip
                    key={p.id}
                    post={p}
                    brandColor={brandColor}
                    variant="roomy"
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => setDragId(null)}
                    onOpen={() => onOpenPost(p.id)}
                  />
                ))}
              </div>
              <button
                onClick={() => onClickDay(d)}
                className="mt-2 w-full rounded-lg border border-dashed border-border/40 py-1.5 text-[11px] text-muted-foreground hover:text-gold hover:border-gold/40 inline-flex items-center justify-center gap-1 transition"
              >
                <Plus className="h-3 w-3" /> Post
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
