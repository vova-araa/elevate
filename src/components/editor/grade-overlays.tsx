import { useMemo } from "react";
import { gradeOverlays, grainAlpha, vignetteAlpha, type Grade } from "@/lib/color-grade";
import { noiseDataUrl } from "@/lib/grade-render";

/**
 * De kleurlagen van een grade als voorbeeld in de browser.
 *
 * Zelfde lagen, zelfde volgorde en dezelfde blend-modi als bij het exporteren —
 * daarom kan wat je hier ziet niet afwijken van het bestand dat eruit komt.
 * Leg deze component over het beeld heen; de toonbewerkingen zelf zitten in de
 * `filter`-stijl van de afbeelding.
 */
export function GradeOverlays({ grade }: { grade: Grade }) {
  const layers = gradeOverlays(grade);
  const vig = vignetteAlpha(grade);
  const grain = grainAlpha(grade);
  // De korreltegel wordt één keer gemaakt en daarna hergebruikt.
  const noise = useMemo(() => (grain > 0 ? noiseDataUrl() : null), [grain]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {layers.map((l, i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={{ background: l.color, mixBlendMode: l.blend, opacity: l.alpha }}
        />
      ))}
      {vig > 0 && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(closest-side, rgba(255,255,255,0) 45%, rgba(0,0,0,${vig}) 100%)`,
            mixBlendMode: "multiply",
          }}
        />
      )}
      {noise && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${noise})`,
            backgroundRepeat: "repeat",
            mixBlendMode: "overlay",
            opacity: grain,
          }}
        />
      )}
    </div>
  );
}
