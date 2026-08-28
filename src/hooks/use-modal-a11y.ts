import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Toetsenbord-hygiëne voor handgerolde overlays (geen Radix Dialog/Sheet
 * eronder, die dit al zelf regelen). Zonder dit tabt een toetsenbordgebruiker
 * dwars door de modal heen naar de pagina erachter, doet Escape niets, en
 * verliest de trigger-knop de focus zodra de modal weer dichtgaat.
 *
 * `open` is nodig voor overlays die zelf altijd gemount blijven en de modal
 * er alleen conditioneel in renderen (PwaInstall, MobileNavSheet) — zonder
 * die dependency draait het effect maar één keer, vóórdat de modal-div er
 * überhaupt is. Een component die zelf al conditioneel mount (ComposeModal)
 * geeft gewoon `open={true}` mee.
 */
export function useModalA11y(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  open: boolean,
) {
  useEffect(() => {
    if (!open) return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    // Focus start in de modal zelf zodat een schermlezer hem aankondigt;
    // val terug op het eerste focusbare element als de container geen
    // tabindex heeft.
    if (document.activeElement === null || !container.contains(document.activeElement)) {
      (focusables()[0] ?? container).focus();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
