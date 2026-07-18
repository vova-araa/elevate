import { cn } from "@/lib/utils";

/**
 * Compacte SVG-voortgangsring voor de klant-gezondheidsscore (0-100) op het
 * "Studio-editie"-dashboard. Kleur schaalt mee met de score: goud bij een
 * gezonde klant, amber bij aandachtspunten, rood bij problemen.
 */
export function HealthRing({
  score,
  size = 40,
  strokeWidth = 4,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const tone = clamped >= 80 ? "text-gold" : clamped >= 50 ? "text-amber-500" : "text-red-400";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-border/60"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-500", tone)}
          stroke="currentColor"
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 grid place-items-center text-[10px] font-medium tabular-nums",
          tone,
        )}
      >
        {clamped}
      </span>
    </div>
  );
}
