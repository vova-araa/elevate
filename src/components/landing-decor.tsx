/* Sfeer- en decoratiecomponenten voor de landingspagina.
   Puur CSS/SVG/markup — geen externe libs of afbeeldingen.
   De keyframes leven in een lokaal <style>-blok zodat styles.css onaangeroerd blijft. */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { prefersReducedMotion, useInView } from "@/components/landing-motion";

/** Herbruikbaar scroll-reveal-blok: faadt + schuift zacht in beeld. `delay` in ms voor stagger. */
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
  const style: CSSProperties | undefined = delay ? { transitionDelay: `${delay}ms` } : undefined;
  return (
    <div
      ref={ref}
      className={`lp-reveal ${inView ? "lp-reveal-in" : ""} ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}

/** Meetellend cijfer: telt op van 0 naar de eindwaarde zodra het in beeld komt.
   Behoudt prefix/suffix (bv. "%") en niet-numerieke waarden (bv. "AI") ongewijzigd. */
export function CountUp({
  value,
  duration = 1600,
  className,
}: {
  value: string;
  duration?: number;
  className?: string;
}) {
  const match = value.match(/^(\D*)(\d[\d.]*)(\D*)$/);
  const prefix = match ? match[1] : "";
  const numStr = match ? match[2] : "";
  const suffix = match ? match[3] : "";
  const target = numStr ? Number(numStr) : 0;
  const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;

  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.4 });
  const [current, setCurrent] = useState(0);
  const done = useRef(false);

  // `match` is elke render een nieuw object. Stond het in de dependencies, dan
  // draaide dit effect bij iedere render opnieuw — en omdat `done` dan al true
  // was, deed de opruiming wél zijn werk (cancelAnimationFrame) en de start
  // niet. Het cijfer bleef zo op 0 of 1 hangen. Vandaar een stabiele boolean.
  const hasMatch = !!match;

  /*
   * Kleine getallen tellen niet op.
   *
   * De band toont claims als "3 kanalen" en "100% in jouw huisstijl". Tijdens
   * het optellen las dat als "0 kanalen" en "1% in jouw huisstijl" — precies het
   * tegenovergestelde van wat er staat, en voor een socialbureau de slechtst
   * denkbare eerste indruk. Onder de tien is er ook niets te beleven aan een
   * teller, dus die zetten we meteen op de eindwaarde.
   */
  const worthAnimating = target >= 10;

  useEffect(() => {
    if (!hasMatch || !inView || done.current) return;
    done.current = true;
    if (prefersReducedMotion() || !worthAnimating) {
      setCurrent(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setCurrent(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setCurrent(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, hasMatch, target, duration, worthAnimating]);

  if (!match) {
    return (
      <span ref={ref} className={className}>
        {value}
      </span>
    );
  }

  const formatted = current.toLocaleString("nl-NL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/** Zachte gouden gloed die op desktop (pointer:fine) de muis volgt met soepele lerp.
   Op touch/mobiel of bij reduced-motion: een rustige, driftende (of statische) gloed. */
export function HeroGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    const fine =
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches;
    if (!fine || prefersReducedMotion()) return; // CSS-drift / statische fallback blijft actief

    el.style.animation = "none"; // JS neemt de positie over

    let raf = 0;
    let targetX = 50;
    let targetY = 34;
    let curX = 50;
    let curY = 34;

    const loop = () => {
      curX += (targetX - curX) * 0.09;
      curY += (targetY - curY) * 0.09;
      el.style.setProperty("--gx", `${curX.toFixed(2)}%`);
      el.style.setProperty("--gy", `${curY.toFixed(2)}%`);
      if (Math.abs(targetX - curX) > 0.1 || Math.abs(targetY - curY) > 0.1) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
      }
    };

    const onMove = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width) * 100;
      targetY = ((e.clientY - rect.top) / rect.height) * 100;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    parent.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      parent.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="lp-hero-glow pointer-events-none absolute inset-0 -z-0"
      aria-hidden
      style={{ "--gx": "50%", "--gy": "34%" } as CSSProperties}
    />
  );
}

/** Lokale keyframes voor de landing. Eén keer renderen (in de root van de pagina). */
export function LandingStyles() {
  return (
    <style>{`
      @keyframes lp-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      @keyframes lp-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
      @keyframes lp-float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      @keyframes lp-drift { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(24px, -18px) scale(1.1); } }
      @keyframes lp-drift-b { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-28px, 16px) scale(1.12); } }
      @keyframes lp-sheen { from { background-position: 200% 0; } to { background-position: -200% 0; } }
      @keyframes lp-pulse-ring { 0% { opacity: 0.5; transform: scale(0.9); } 70% { opacity: 0; transform: scale(1.6); } 100% { opacity: 0; transform: scale(1.6); } }
      @keyframes lp-wordmark { 0%, 100% { transform: translate(-50%, 0) scale(1); opacity: 1; } 50% { transform: translate(-50%, -16px) scale(1.02); opacity: 0.82; } }
      @keyframes lp-glow-drift { 0%, 100% { transform: translate3d(-3%, -2%, 0); } 50% { transform: translate3d(3%, 3%, 0); } }
      @keyframes lp-line-in { from { opacity: 0; transform: translateY(0.5em); filter: blur(9px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }

      .lp-marquee-track { animation: lp-marquee 44s linear infinite; }
      .lp-float { animation: lp-float 6.5s ease-in-out infinite; }
      .lp-float-slow { animation: lp-float-slow 8s ease-in-out infinite; }
      .lp-drift { animation: lp-drift 16s ease-in-out infinite; }
      .lp-drift-b { animation: lp-drift-b 22s ease-in-out infinite; }
      .lp-pulse-ring { animation: lp-pulse-ring 3s ease-out infinite; }
      .lp-wordmark { animation: lp-wordmark 13s ease-in-out infinite; }
      /*
       * Glans over goudkleurige tekst.
       *
       * Deze klasse zet background-image en wint daarmee van de klasse
       * .text-gradient-gold eronder, die color: transparent +
       * background-clip: text gebruikt. Stond hier een verloop dat buiten de
       * glansband dóórzichtig was, dan viel de tekst daar volledig weg — de
       * tweede regel van de H1 was op desktop half en op mobiel helemaal
       * onzichtbaar.
       *
       * Daarom loopt het verloop nu van goud naar lichter goud en terug: altijd
       * dekkend, de beweging zit alleen in de helderheid.
       */
      .lp-sheen {
        background-image: linear-gradient(
          100deg,
          var(--gold-deep) 30%,
          oklch(from var(--gold) calc(l + 0.12) c h) 50%,
          var(--gold-deep) 70%
        );
        background-size: 200% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        animation: lp-sheen 6s ease-in-out infinite;
      }

      /* Scroll-reveal */
      .lp-reveal {
        opacity: 0;
        transform: translateY(26px);
        transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1),
          transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
        will-change: opacity, transform;
      }
      .lp-reveal-in { opacity: 1; transform: none; }

      /* Kinetische hero-regels */
      .lp-line { display: block; opacity: 0; animation: lp-line-in 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards; }

      /* Cursor-reactieve hero-gloed */
      .lp-hero-glow {
        background: radial-gradient(
          40% 40% at var(--gx, 50%) var(--gy, 34%),
          oklch(from var(--gold) l c h / 22%),
          transparent 72%
        );
        animation: lp-glow-drift 16s ease-in-out infinite;
        will-change: transform;
      }

      /* Bewust donkere, filmische contrastsectie (in beide thema's donker) */
      .lp-cinema {
        background:
          radial-gradient(70% 90% at 50% 0%, oklch(0.34 0.05 72 / 55%), transparent 65%),
          linear-gradient(165deg, oklch(0.23 0.022 62), oklch(0.15 0.015 55) 55%, oklch(0.11 0.01 50));
        border-color: oklch(from var(--gold) l c h / 28%);
        color: oklch(0.95 0.012 85);
      }
      .lp-cinema-vignette {
        background: radial-gradient(120% 120% at 50% 50%, transparent 55%, oklch(0 0 0 / 45%));
      }
      .lp-cinema-grain::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0.07;
        background-image: radial-gradient(oklch(0.95 0.05 85) 1px, transparent 1px);
        background-size: 3px 3px;
      }

      @media (prefers-reduced-motion: reduce) {
        .lp-marquee-track, .lp-float, .lp-float-slow, .lp-drift, .lp-drift-b,
        .lp-pulse-ring, .lp-sheen, .lp-wordmark, .lp-hero-glow, .lp-line {
          animation: none !important;
        }
        .lp-line { opacity: 1; }
        .lp-reveal { opacity: 1; transform: none; transition: none; }
      }
    `}</style>
  );
}

/** Gelaagde achtergrond: driftende gouden gloed + fijne korrel over de hele pagina. */
export function Atmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-x-0 top-0 h-[80vh] opacity-80"
        style={{ background: "var(--gradient-glow)" }}
      />
      <div className="lp-drift absolute -left-40 top-[24vh] h-[26rem] w-[26rem] rounded-full bg-gold/10 blur-3xl" />
      <div className="lp-drift-b absolute -right-40 top-[52vh] h-[28rem] w-[28rem] rounded-full bg-gold/10 blur-3xl" />
      <div className="lp-drift absolute left-1/2 top-[90vh] h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-gold/[0.07] blur-3xl" />
      <div className="grain absolute inset-0" />
    </div>
  );
}

const MARQUEE_WORDS = [
  "Strategie",
  "Branding",
  "Identiteit",
  "Contentcreatie",
  "Verhaal",
  "Social",
  "Publicatie",
  "Regie",
  "Groei",
];

/** Rustige, oneindig schuivende woordenband — voegt beweging en ritme toe. */
export function KeywordMarquee() {
  const items = [...MARQUEE_WORDS, ...MARQUEE_WORDS];
  return (
    <div
      className="relative flex overflow-hidden py-6"
      aria-hidden
      style={{
        maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
      }}
    >
      <div className="lp-marquee-track flex shrink-0 items-center gap-8 pr-8 sm:gap-12 sm:pr-12">
        {items.map((w, i) => (
          <div key={i} className="flex shrink-0 items-center gap-8 sm:gap-12">
            <span className="font-display text-2xl italic tracking-tight text-foreground/45 sm:text-3xl">
              {w}
            </span>
            <span className="h-1.5 w-1.5 rotate-45 bg-gold/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
