import { RotateCcw } from "lucide-react";
import { LOOKS, NEUTRAL_GRADE, isNeutral, type Grade } from "@/lib/color-grade";
import { cn } from "@/lib/utils";

/**
 * De regelaars voor de kleurgrade. Bewust in twee lagen: bovenaan een look die
 * je in één klik zet, daaronder de schuiven om hem bij te stellen. Vrijwel
 * niemand begint bij "warmte +28" — die begint bij "warm goud" en draait daarna
 * bij.
 */

interface SliderSpec {
  key: keyof Grade;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Waarde tonen als percentage-afwijking in plaats van rauw getal. */
  asPercent?: boolean;
}

const SLIDERS: SliderSpec[] = [
  { key: "exposure", label: "Belichting", min: 0.6, max: 1.6, step: 0.01, asPercent: true },
  { key: "contrast", label: "Contrast", min: 0.6, max: 1.6, step: 0.01, asPercent: true },
  { key: "saturation", label: "Verzadiging", min: 0, max: 2, step: 0.01, asPercent: true },
  { key: "warmth", label: "Warmte", min: -100, max: 100, step: 1 },
  { key: "tint", label: "Tint", min: -100, max: 100, step: 1 },
  { key: "fade", label: "Fade", min: 0, max: 100, step: 1 },
  { key: "vignette", label: "Vignet", min: 0, max: 100, step: 1 },
  { key: "grain", label: "Korrel", min: 0, max: 100, step: 1 },
];

function displayValue(spec: SliderSpec, value: number): string {
  if (spec.asPercent) {
    const pct = Math.round((value - 1) * 100);
    return pct === 0 ? "0" : `${pct > 0 ? "+" : ""}${pct}`;
  }
  return value === 0 ? "0" : `${value > 0 ? "+" : ""}${Math.round(value)}`;
}

export function GradePanel({ grade, onChange }: { grade: Grade; onChange: (g: Grade) => void }) {
  const activeLook = LOOKS.find((l) =>
    (Object.keys(NEUTRAL_GRADE) as (keyof Grade)[]).every(
      (k) => Math.abs(l.grade[k] - grade[k]) < 0.001,
    ),
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Look
          </span>
          {!isNeutral(grade) && (
            <button
              type="button"
              onClick={() => onChange({ ...NEUTRAL_GRADE })}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-gold"
            >
              <RotateCcw className="h-3 w-3" /> Terugzetten
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LOOKS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onChange({ ...l.grade })}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs transition hairline",
                activeLook?.id === l.id ? "bg-gold/20 text-gold" : "bg-input/40 hover:bg-accent/40",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {SLIDERS.map((s) => (
          <label key={s.key} className="block">
            <span className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="tabular-nums lining-nums text-foreground/70">
                {displayValue(s, grade[s.key])}
              </span>
            </span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={grade[s.key]}
              onChange={(e) => onChange({ ...grade, [s.key]: parseFloat(e.target.value) })}
              className="mt-1 w-full accent-[var(--gold)]"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
