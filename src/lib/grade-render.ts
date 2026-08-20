import { gradeOverlays, grainAlpha, vignetteAlpha, type Grade } from "@/lib/color-grade";

/**
 * De grade daadwerkelijk op een canvas zetten, voor de export.
 *
 * De toon-bewerkingen (belichting/contrast/verzadiging) zitten al in
 * `ctx.filter` op het moment dat het beeld getekend wordt; hier komen de lagen
 * erbovenop in dezelfde volgorde als het voorbeeld in de browser: kleurzweem,
 * fade, vignet, korrel.
 */

let noiseTile: HTMLCanvasElement | null = null;

/**
 * Eén korreltegel die we hergebruiken. Ruis per pixel over een foto van 4000px
 * genereren kost seconden; een tegel van 128px die je herhaalt is niet van echt
 * te onderscheiden en is meteen klaar.
 */
export function getNoiseTile(size = 128): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    // Monochrome ruis: gekleurde ruis leest als een defect, niet als film.
    const v = 110 + Math.random() * 90;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseTile = c;
  return c;
}

/** Dezelfde korreltegel als data-URL, zodat het voorbeeld in CSS hem kan tonen. */
export function noiseDataUrl(): string {
  return getNoiseTile().toDataURL("image/png");
}

export function paintGradeLayers(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grade: Grade,
): void {
  const prevFilter = ctx.filter;
  ctx.filter = "none";

  for (const layer of gradeOverlays(grade)) {
    ctx.save();
    ctx.globalCompositeOperation = layer.blend;
    ctx.globalAlpha = layer.alpha;
    ctx.fillStyle = layer.color;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  const vig = vignetteAlpha(grade);
  if (vig > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    // Straal tot de dichtstbijzijnde zijde — hetzelfde als `closest-side` in de
    // CSS-variant, anders valt het vignet in de export veel wijder uit.
    const r = Math.min(width, height) / 2;
    const g = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, r);
    // Het midden moet volledig doorzichtig zijn, niet ondoorzichtig wit. Met
    // wit in het midden tekende de browser hier een lichte vlek in plaats van
    // niets — de export kreeg een gloed die in het voorbeeld niet zat.
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.45, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${vig.toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  const grain = grainAlpha(grade);
  if (grain > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = grain;
    const pattern = ctx.createPattern(getNoiseTile(), "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  ctx.filter = prevFilter;
}
