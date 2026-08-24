import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  PenTool,
  CalendarClock,
  BarChart3,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { prefersReducedMotion } from "@/components/landing-motion";

type Slide = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  /** Kleine grafische begeleiding rechts in de slide. */
  visual: "chart" | "calendar" | "approve" | "spark" | "reach";
};

const SLIDES: Slide[] = [
  {
    icon: Sparkles,
    eyebrow: "Strategie",
    title: "Een merk met richting",
    body: "Positionering, doelgroep en content-pijlers scherp op papier — zodat elke post ergens over gaat.",
    visual: "spark",
  },
  {
    icon: PenTool,
    eyebrow: "Creatie",
    title: "Content die klinkt als jij",
    body: "Beeld, video en tekst in jouw toon. AI voor snelheid, met de hand afgemaakt voor klasse.",
    visual: "chart",
  },
  {
    icon: CalendarClock,
    eyebrow: "Planning",
    title: "Altijd een volle kalender",
    body: "Ingepland, goedgekeurd en automatisch gepubliceerd naar al je kanalen. Nooit meer improviseren.",
    visual: "calendar",
  },
  {
    icon: ShieldCheck,
    eyebrow: "Regie",
    title: "Jij keurt alles goed",
    body: "Niets gaat live zonder jouw akkoord. Goedkeuren doe je op je telefoon of via een deelbare link.",
    visual: "approve",
  },
  {
    icon: BarChart3,
    eyebrow: "Groei",
    title: "Resultaat dat je ziet",
    body: "Heldere cijfers per merk en kanaal. Bereik, groei en wat werkt — zonder ruis.",
    visual: "reach",
  },
];

export function LandingShowcase() {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);
  const paused = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const onSelect = useCallback((embla: CarouselApi) => {
    if (!embla) return;
    setSelected(embla.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!api) return;
    setSnaps(api.scrollSnapList());
    onSelect(api);
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api, onSelect]);

  // S12: pauzeer ook buiten beeld — voorheen draaide de setInterval altijd
  // door, ook wanneer de sectie allang gescrold was, wat op een pagina met
  // meerdere auto-advancing onderdelen onnodig CPU/batterij kost.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        paused.current = !entry.isIntersecting;
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Auto-advance, met pauze bij hover/focus/buiten-beeld. Geheel uit bij
  // prefers-reduced-motion — anders draait de carousel door tegen de
  // uitdrukkelijke voorkeur van de bezoeker in.
  useEffect(() => {
    if (!api || prefersReducedMotion()) return;
    const id = window.setInterval(() => {
      if (paused.current) return;
      api.scrollNext();
    }, 4500);
    return () => window.clearInterval(id);
  }, [api]);

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocusCapture={() => (paused.current = true)}
      onBlurCapture={() => (paused.current = false)}
    >
      <Carousel
        setApi={setApi}
        opts={{ loop: true, align: "start" }}
        className="w-full"
        aria-label="Wat Elevate voor je doet"
      >
        <CarouselContent className="-ml-4">
          {SLIDES.map((s, i) => (
            <CarouselItem key={s.title} className="pl-4 md:basis-1/2 lg:basis-1/3">
              <ShowcaseCard slide={s} index={i} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {/* Dots / indicators — role="tablist" zodat schermlezers dit als een
          groep bij elkaar horende, selecteerbare pagina's aankondigen. */}
      <div
        className="mt-8 flex items-center justify-center gap-2"
        role="tablist"
        aria-label="Slides"
      >
        {snaps.map((_, i) => {
          const active = i === selected;
          return (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`Ga naar slide ${i + 1}`}
              onClick={() => api?.scrollTo(i)}
              className={
                "h-1.5 rounded-full transition-all duration-300 " +
                (active ? "w-7 bg-gradient-gold" : "w-2 bg-gold/20 hover:bg-gold/40")
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function ShowcaseCard({ slide, index }: { slide: Slide; index: number }) {
  const Icon = slide.icon;
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-gold/10 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold/25 hover:shadow-elegant">
      {/* Gouden accentlijn bovenaan, groeit bij hover */}
      <span
        className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gradient-gold transition-transform duration-500 group-hover:scale-x-100"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gold/10 opacity-70 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden
      />
      {/* Decoratief slide-nummer */}
      <span
        className="pointer-events-none absolute right-4 top-3 select-none font-display text-5xl text-gold/[0.08]"
        aria-hidden
      >
        0{index + 1}
      </span>
      <div className="relative flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/12 text-gold transition-colors group-hover:bg-gold/20">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="text-xs uppercase tracking-[0.24em] text-gold/80">{slide.eyebrow}</span>
      </div>
      <h3 className="relative mt-5 font-display text-2xl leading-tight">{slide.title}</h3>
      <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{slide.body}</p>
      <div className="relative mt-auto pt-6">
        <SlideVisual kind={slide.visual} />
      </div>
    </div>
  );
}

/* Lichte, tokengebaseerde grafische begeleiding per slide — geen afbeeldingen. */
function SlideVisual({ kind }: { kind: Slide["visual"] }) {
  if (kind === "chart" || kind === "reach") {
    return (
      <div className="rounded-xl border border-gold/10 bg-card/70 p-3">
        <svg viewBox="0 0 200 44" className="h-11 w-full" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={`sv-${kind}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 36 L28 30 L56 32 L84 22 L112 24 L140 13 L168 15 L200 5 L200 44 L0 44 Z"
            fill={`url(#sv-${kind})`}
          />
          <path
            d="M0 36 L28 30 L56 32 L84 22 L112 24 L140 13 L168 15 L200 5"
            fill="none"
            stroke="var(--gold)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  if (kind === "calendar") {
    return (
      <div className="grid grid-cols-7 gap-1.5" aria-hidden>
        {Array.from({ length: 21 }).map((_, i) => {
          const filled = [2, 4, 7, 10, 13, 16, 18].includes(i);
          return (
            <span
              key={i}
              className={
                "aspect-square rounded-[5px] " +
                (filled ? "bg-gradient-gold" : "border border-gold/10 bg-card/70")
              }
            />
          );
        })}
      </div>
    );
  }

  if (kind === "approve") {
    return (
      <div className="space-y-2" aria-hidden>
        {[70, 90].map((w) => (
          <div
            key={w}
            className="flex items-center gap-2.5 rounded-lg border border-gold/10 bg-card/70 px-3 py-2"
          >
            <span className="h-2 rounded-full bg-gold/15" style={{ width: `${w}%` }} />
            <span className="ml-auto rounded-full bg-gold/15 px-2 py-0.5 text-xs uppercase tracking-wider text-gold/80">
              akkoord
            </span>
          </div>
        ))}
      </div>
    );
  }

  // spark
  return (
    <div className="flex flex-wrap gap-2" aria-hidden>
      {["Positionering", "Doelgroep", "Pijlers", "Toon", "Kalender"].map((t) => (
        <span
          key={t}
          className="rounded-full border border-gold/15 bg-gold/5 px-2.5 py-1 text-xs tracking-wide text-foreground/70"
        >
          {t}
        </span>
      ))}
    </div>
  );
}
