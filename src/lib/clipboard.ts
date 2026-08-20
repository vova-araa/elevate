import { toast } from "sonner";

/**
 * Kopiëren naar het klembord, met een melding die de waarheid vertelt.
 *
 * Aanleiding: op vijftien plekken stond `navigator.clipboard.writeText(x)`
 * zonder await en zonder catch, direct gevolgd door een groene "Gekopieerd".
 * Faalt het schrijven — geweigerde permissie, of een pagina die niet als
 * beveiligde context telt — dan staat er niets op het klembord terwijl de
 * gebruiker een bevestiging ziet. Bij de API-sleutel is dat onherstelbaar: die
 * wordt maar één keer getoond.
 *
 * De terugvaloptie met een verborgen textarea werkt ook zonder de Clipboard
 * API. Verouderd, maar het is het verschil tussen wel en niet kopiëren.
 */
export async function copyToClipboard(text: string, label = "Gekopieerd"): Promise<boolean> {
  if (!text) {
    toast.error("Er is niets om te kopiëren.");
    return false;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
      return true;
    } catch {
      // Valt door naar de terugvaloptie hieronder.
    }
  }

  if (legacyCopy(text)) {
    toast.success(label);
    return true;
  }

  toast.error("Kopiëren is niet gelukt — selecteer de tekst en kopieer handmatig.");
  return false;
}

/** Terugvaloptie voor browsers of contexten zonder Clipboard API. */
function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = text;
  // Buiten beeld maar wel selecteerbaar; `display:none` werkt hier niet.
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "-1000px";
  area.style.opacity = "0";
  document.body.appendChild(area);
  try {
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}
