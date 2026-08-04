/* Beweeg-primitieven voor de landingspagina (hooks + utilities, geen componenten).
   Apart bestand zodat fast-refresh netjes blijft werken voor de UI-componenten.
   Alle beweging respecteert `prefers-reduced-motion` en gebruikt transform/opacity + rAF. */

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

/** Detecteert of de gebruiker bewegingsreductie heeft aangevraagd (veilig op de server). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Kleine IntersectionObserver-hook: schakelt één keer om zodra het element in beeld komt.
   Valt terug op "direct zichtbaar" bij reduced-motion of ontbrekende observer (SSR/oud). */
export function useInView<T extends HTMLElement>(options?: {
  rootMargin?: string;
  threshold?: number;
}): { ref: RefObject<T | null>; inView: boolean } {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined" || prefersReducedMotion()) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      {
        rootMargin: options?.rootMargin ?? "0px 0px -12% 0px",
        threshold: options?.threshold ?? 0.15,
      },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [options?.rootMargin, options?.threshold]);

  return { ref, inView };
}

/** Reveal als hook — voor grid-/lijst-items waar een extra wrapper de lay-out zou breken. */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  delay = 0,
): {
  ref: RefObject<T | null>;
  className: string;
  style: CSSProperties | undefined;
} {
  const { ref, inView } = useInView<T>();
  return {
    ref,
    className: `lp-reveal ${inView ? "lp-reveal-in" : ""}`,
    style: delay ? { transitionDelay: `${delay}ms` } : undefined,
  };
}

/** Subtiele scroll-parallax: verplaatst een element licht op basis van de scrollpositie.
   Alleen actief wanneer in beeld; uitgeschakeld bij reduced-motion. */
export function useParallax<T extends HTMLElement = HTMLDivElement>(
  strength = 18,
): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;

    let raf = 0;
    let active = false;

    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh;
      const offset = -progress * strength;
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    };

    const onScroll = () => {
      if (!raf && active) raf = requestAnimationFrame(update);
    };

    const io = new IntersectionObserver(
      (entries) => {
        active = entries[0]?.isIntersecting ?? false;
        if (active) {
          update();
          window.addEventListener("scroll", onScroll, { passive: true });
        } else {
          window.removeEventListener("scroll", onScroll);
        }
      },
      { rootMargin: "120px 0px" },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [strength]);

  return ref;
}
