import type { ReactNode } from "react";
import { useInView } from "@/hooks/use-scroll-reveal";

/** Herbruikbaar scroll-reveal-blok voor portal-pagina's (admin/client): faadt +
    schuift zacht in beeld zodra het element de viewport in scrolt. `delay` in ms
    voor een lichte stagger tussen kaarten in dezelfde rij. Gebruikt de globale
    .reveal/.reveal-in klassen uit styles.css (respecteert prefers-reduced-motion). */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal ${inView ? "reveal-in" : ""} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
