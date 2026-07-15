import { cn } from "@/lib/utils";
import type { StudioPlatform } from "@/lib/ai-studio.functions";
import { STUDIO_PLATFORMS } from "./platform-meta";

export function PlatformChips({
  selected,
  onToggle,
}: {
  selected: StudioPlatform[];
  onToggle: (id: StudioPlatform) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {STUDIO_PLATFORMS.map(({ id, label, Icon }) => {
        const active = selected.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onToggle(id)}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-full border transition",
              active
                ? "border-gold bg-gold/15 text-foreground"
                : "border-gold/20 bg-card text-muted-foreground hover:bg-gold/10",
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", active ? "text-gold" : "")} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
