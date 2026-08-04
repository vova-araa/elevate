/* Sfeer- en decoratiecomponenten voor de landingspagina.
   Puur CSS/SVG/markup — geen externe libs of afbeeldingen.
   De keyframes leven in een lokaal <style>-blok zodat styles.css onaangeroerd blijft. */

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

      .lp-marquee-track { animation: lp-marquee 38s linear infinite; }
      .lp-float { animation: lp-float 6.5s ease-in-out infinite; }
      .lp-float-slow { animation: lp-float-slow 8s ease-in-out infinite; }
      .lp-drift { animation: lp-drift 16s ease-in-out infinite; }
      .lp-drift-b { animation: lp-drift-b 22s ease-in-out infinite; }
      .lp-pulse-ring { animation: lp-pulse-ring 3s ease-out infinite; }
      .lp-sheen {
        background-image: linear-gradient(
          100deg,
          transparent 30%,
          oklch(from var(--gold) l c h / 45%) 50%,
          transparent 70%
        );
        background-size: 200% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        animation: lp-sheen 6s ease-in-out infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .lp-marquee-track, .lp-float, .lp-float-slow, .lp-drift, .lp-drift-b,
        .lp-pulse-ring, .lp-sheen { animation: none !important; }
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
