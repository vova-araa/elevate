import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  PenTool,
  CalendarClock,
  BarChart3,
  Compass,
  Layers,
  Check,
  Quote,
  Instagram,
  Music2,
  Facebook,
  type LucideIcon,
} from "lucide-react";
import elevateLogoUrl from "@/assets/elevate-logo.png";
import { LandingShowcase } from "@/components/landing-showcase";
import {
  Atmosphere,
  HeroGlow,
  KeywordMarquee,
  LandingStyles,
  Reveal,
} from "@/components/landing-decor";
import { useParallax, useReveal } from "@/components/landing-motion";
import { SiteFooter } from "@/components/site-footer";
import { track } from "@/lib/analytics";
import { buildOrganizationJsonLd } from "@/config/business";

const SITE_URL = "https://www.elevatedesign.nl";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Elevate Design — jouw merk, één portaal" },
      {
        name: "description",
        content:
          "Brand & social studio voor merken met karakter. Strategie, content en publicatie — plus een eigen portaal waarin je alles volgt, goedkeurt en meet.",
      },
      // Deelvoorbeelden: zonder og:image toont WhatsApp/LinkedIn een kale link —
      // voor een social-media-studio de pijnlijkst denkbare eerste indruk.
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Elevate Design" },
      { property: "og:title", content: "Elevate Design — jouw merk, één portaal" },
      {
        property: "og:description",
        content:
          "Jij levert het materiaal — wij maken, plannen en publiceren naar Instagram, TikTok en Facebook.",
      },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:image", content: `${SITE_URL}/og.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:locale", content: "nl_NL" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Elevate Design — jouw merk, één portaal" },
      { name: "twitter:image", content: `${SITE_URL}/og.png` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          buildOrganizationJsonLd({
            url: SITE_URL,
            image: `${SITE_URL}/og.png`,
            description:
              "Social-media-studio: contentcreatie, planning en publicatie naar Instagram, TikTok en Facebook, met een eigen klantportaal.",
          }),
        ),
      },
    ],
  }),
  component: Landing,
});

// Alleen de kanalen waar klanten daadwerkelijk mee kunnen koppelen — anders
// belooft de landing iets wat de app (nog) niet levert.
const SOCIALS = [Instagram, Music2, Facebook];

type ServiceVisual = "tags" | "palette" | "calendar" | "chart";

const SERVICES: {
  icon: LucideIcon;
  title: string;
  body: string;
  visual: ServiceVisual;
  /** Grote bento-tegel over de volle breedte van de rij. */
  wide?: boolean;
}[] = [
  {
    icon: Compass,
    title: "Strategie & intake",
    body: "Een gerichte intake vertaalt jouw merk naar positionering, doelgroep en content-pijlers. De basis waarop alles rust.",
    visual: "tags",
    wide: true,
  },
  {
    icon: PenTool,
    title: "Contentcreatie",
    body: "Beeld, video en tekst die klinken als jouw merk — met AI-ondersteuning voor snelheid, met de hand afgemaakt voor klasse.",
    visual: "palette",
  },
  {
    icon: CalendarClock,
    title: "Planning & publicatie",
    body: "Een strakke kalender en directe koppelingen met je kanalen. Ingepland, goedgekeurd en automatisch gepubliceerd.",
    visual: "calendar",
  },
  {
    icon: BarChart3,
    title: "Rapportage & groei",
    body: "Heldere cijfers per merk: bereik, groei en wat werkt. Geen ruis, alleen wat telt voor de volgende stap.",
    visual: "chart",
    wide: true,
  },
];

const STEPS = [
  {
    n: "01",
    title: "Kennismaken",
    body: "We duiken in je merk, je doelen en je publiek — de basis van de samenwerking.",
  },
  {
    n: "02",
    title: "Voorstel",
    body: "Je krijgt een concreet plan en contentvoorstel om op te reageren.",
  },
  {
    n: "03",
    title: "Jij beslist",
    body: "Niets gaat live voordat jij het hebt goedgekeurd. Altijd de regie.",
  },
  {
    n: "04",
    title: "Groeien",
    body: "Wij publiceren, meten en sturen bij. Jij ziet de resultaten binnenkomen.",
  },
];

const PORTAL_POINTS = [
  "AI-strategie en contentplanning",
  "Kalender met drag & drop",
  "Goedkeuren op je telefoon — of via een deelbare link",
  "Mediabibliotheek met bulk-upload en Drive-import",
  "Overzichtelijke maandrapportage per merk en kanaal",
];

function Landing() {
  const portalParallax = useParallax<HTMLDivElement>(22);
  const cinemaGlow = useParallax<HTMLDivElement>(-30);

  return (
    <div className="relative min-h-screen overflow-hidden bg-luxe">
      <LandingStyles />
      <Atmosphere />

      {/* ── Navigatie ── */}
      <header className="sticky top-0 z-30 px-4 pt-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-gold/10 bg-background/55 px-4 py-2.5 backdrop-blur-md sm:px-6">
          <Link to="/" className="group flex items-center gap-2.5">
            <img
              src={elevateLogoUrl}
              alt="Elevate Design"
              className="h-7 w-7 object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <span className="font-display text-lg tracking-wide">Elevate Design</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#diensten" className="transition-colors hover:text-foreground">
              Diensten
            </a>
            <a href="#werkwijze" className="transition-colors hover:text-foreground">
              Werkwijze
            </a>
            <a href="#portaal" className="transition-colors hover:text-foreground">
              Portaal
            </a>
          </nav>
          <Link
            to="/dashboard"
            onClick={() => track("portal_login_click", { location: "topbar" })}
            className="group inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-gold transition-colors duration-200 hover:border-gold/50 hover:bg-gold/5"
          >
            Portaal{" "}
            <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        {/* ── Hero ── */}
        <section className="relative mx-auto max-w-6xl px-6 pb-8 pt-20 md:pt-28">
          {/* Cursor-reactieve gouden gloed (drift op touch/reduced-motion) */}
          <HeroGlow />
          {/* Oversized woordmerk op de achtergrond */}
          <span
            className="lp-wordmark pointer-events-none absolute -top-4 left-1/2 -z-0 -translate-x-1/2 select-none whitespace-nowrap font-display text-[26vw] font-medium leading-none text-gold/[0.05] md:text-[20vw]"
            aria-hidden
          >
            Elevate
          </span>

          <div className="relative grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr]">
            <div>
              <div className="fade-in-up inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-background/40 px-3.5 py-1 text-[10px] uppercase tracking-[0.22em] text-gold/90 backdrop-blur-sm">
                <Sparkles className="h-3 w-3" /> Brand &amp; social studio
              </div>

              <h1
                className="mt-6 font-display font-medium leading-[0.95] tracking-tight"
                style={{ fontSize: "clamp(3rem, 11vw, 6.5rem)" }}
              >
                <span className="lp-line" style={{ animationDelay: "80ms" }}>
                  Elevate
                </span>{" "}
                <span className="lp-line" style={{ animationDelay: "220ms" }}>
                  <span className="lp-sheen italic-accent block text-gradient-gold font-light italic">
                    your brand
                  </span>
                </span>
              </h1>

              <p
                className="fade-in-up mt-7 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg"
                style={{ animationDelay: "160ms" }}
              >
                Strategie, content en uitvoering voor merken met karakter. Alles komt samen in één
                elegant portaal — waarin je meekijkt, goedkeurt en de groei volgt.
              </p>

              <div
                className="fade-in-up mt-9 flex flex-wrap items-center gap-3"
                style={{ animationDelay: "240ms" }}
              >
                <Link
                  to="/contact"
                  onClick={() => track("cta_click", { location: "hero" })}
                  className="group glow-gold inline-flex items-center gap-1.5 rounded-full bg-gradient-gold px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground transition-all duration-300 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:scale-[0.98]"
                >
                  Plan een merkscan{" "}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#diensten"
                  className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-foreground/80 transition-colors hover:border-gold/45 hover:text-foreground"
                >
                  Bekijk wat we doen
                </a>
                <Link
                  to="/dashboard"
                  onClick={() => track("portal_login_click", { location: "hero" })}
                  className="inline-flex items-center gap-1.5 px-2 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-gold"
                >
                  Al klant? Open het portaal
                </Link>
              </div>

              {/* Kanaal-rij */}
              <div
                className="fade-in-up mt-11 flex flex-wrap items-center gap-x-4 gap-y-3"
                style={{ animationDelay: "320ms" }}
              >
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                  Publiceert naar
                </span>
                <div className="flex items-center gap-3">
                  {SOCIALS.map((Icon, i) => (
                    <span
                      key={i}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-gold/10 bg-card/60 text-muted-foreground transition-colors hover:border-gold/30 hover:text-gold"
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Hero-visual: zwevende portaal-preview (subtiele scroll-parallax) */}
            <div className="fade-in-up relative lg:pl-4" style={{ animationDelay: "200ms" }}>
              <div
                className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gold/10 blur-3xl"
                aria-hidden
              />
              <div ref={portalParallax} className="will-change-transform">
                <div className="lp-float">
                  <PortalPreview />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Woordenband ── */}
        <div className="relative border-y border-gold/10">
          <KeywordMarquee />
        </div>

        {/* ── Showcase-carousel ── */}
        <section className="mx-auto max-w-6xl px-6 pt-24 md:pt-28">
          <Reveal>
            <SectionHead
              eyebrow="Wat we voor je doen"
              title={
                <>
                  Een studio die met je{" "}
                  <span className="italic-accent italic text-gradient-gold">merk</span> meebeweegt
                </>
              }
              body="Van strategie tot groei — schuif door de kern van wat samenwerken met Elevate oplevert."
            />
          </Reveal>
          <Reveal className="mt-12" delay={80}>
            <LandingShowcase />
          </Reveal>
        </section>

        {/* ── Statement / manifest — bewust donkere, filmische contrastsectie ── */}
        <section className="mx-auto max-w-6xl px-6 pt-28">
          <Reveal>
            <figure className="lp-cinema lp-cinema-grain relative overflow-hidden rounded-3xl border px-7 py-20 text-center shadow-elegant md:px-16 md:py-28">
              {/* Oversized woordmerk op de achtergrond */}
              <span
                className="lp-float-slow pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-display text-[24vw] font-medium leading-none text-gold/[0.06] md:text-[16vw]"
                aria-hidden
              >
                Elevate
              </span>
              {/* Gouden gloed met subtiele scroll-parallax */}
              <div
                ref={cinemaGlow}
                className="pointer-events-none absolute inset-x-0 -top-24 h-64 opacity-70 will-change-transform"
                style={{ background: "var(--gradient-glow)" }}
                aria-hidden
              />
              {/* Filmische vignette voor diepte */}
              <div
                className="lp-cinema-vignette pointer-events-none absolute inset-0"
                aria-hidden
              />
              <Quote className="relative mx-auto h-9 w-9 text-gold/70" aria-hidden />
              <blockquote className="relative mx-auto mt-7 max-w-3xl font-display text-3xl leading-[1.15] tracking-tight md:text-[3.25rem]">
                Een merk is geen logo. Het is het{" "}
                <span className="italic-accent italic text-gradient-gold">gevoel</span> dat
                achterblijft — en dat bouwen we op met strategie, ambacht en{" "}
                <span className="italic-accent italic text-gradient-gold">rust</span> in de
                uitvoering.
              </blockquote>
              <figcaption className="relative mt-9 text-[11px] uppercase tracking-[0.28em] text-gold/60">
                Het handschrift van Elevate Design
              </figcaption>
            </figure>
          </Reveal>
        </section>

        {/* ── Diensten (bento) ── */}
        <section id="diensten" className="mx-auto max-w-6xl px-6 pt-28">
          <Reveal>
            <SectionHead
              eyebrow="Diensten"
              title={
                <>
                  Alles wat je merk online{" "}
                  <span className="italic-accent italic text-gradient-gold">sterk</span> maakt
                </>
              }
              body="Van eerste strategie tot dagelijkse publicatie — vier vakgebieden, één vloeiend proces."
            />
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
            {SERVICES.map((s, i) => (
              <ServiceCard key={s.title} service={s} index={i} />
            ))}
          </div>
        </section>

        {/* ── Werkwijze (tijdlijn) ── */}
        <section id="werkwijze" className="mx-auto max-w-6xl px-6 pt-28">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Reveal>
                <SectionHead
                  eyebrow="Werkwijze"
                  title={
                    <>
                      Van intake tot{" "}
                      <span className="italic-accent italic text-gradient-gold">meetbare</span>{" "}
                      groei
                    </>
                  }
                  body="Een helder pad in vier stappen. Jij houdt de regie, wij doen het werk."
                />
              </Reveal>
              <Link
                to="/contact"
                onClick={() => track("cta_click", { location: "werkwijze" })}
                className="group mt-8 hidden items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-gold lg:inline-flex"
              >
                Start vandaag{" "}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>

            <ol className="relative space-y-4 pl-4">
              {/* Verticale gouden lijn */}
              <span
                className="pointer-events-none absolute bottom-6 left-[15px] top-6 w-px bg-gradient-to-b from-gold/40 via-gold/20 to-transparent"
                aria-hidden
              />
              {STEPS.map((s, i) => (
                <TimelineStep key={s.n} step={s} index={i} />
              ))}
            </ol>
          </div>
        </section>

        {/* S15: hier stond een statistiekbalk ("3 kanalen · 1 plek · AI ·
            100% in jouw huisstijl") die zich als resultaat voordeed maar
            feature-labels waren — geen enkel cijfer kwam uit echte data. Tot
            er genoeg publicatie- en resultaatdata is om een eerlijke
            statistiekbalk te vullen (aantal begeleide merken, posts per
            maand, bereikgroei, goedkeuringsdoorlooptijd — zie A03-precedent
            op /admin/besttime), blijft dit blok weg in plaats van iets te
            tonen dat nog dun is. */}

        {/* ── Portaal-showcase ── */}
        <section id="portaal" className="mx-auto max-w-6xl px-6 pt-28">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <Reveal>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-background/40 px-3.5 py-1 text-[10px] uppercase tracking-[0.22em] text-gold/90">
                <Layers className="h-3 w-3" /> Het portaal
              </div>
              <h2 className="mt-5 font-display text-4xl leading-tight md:text-5xl">
                Één plek waar <span className="italic-accent italic text-gradient-gold">alles</span>{" "}
                samenkomt
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Geen losse mailtjes en verspreide bestanden meer. In het Elevate-portaal zie je de
                planning, keur je content goed en volg je de resultaten.
              </p>
              <ul className="mt-7 space-y-2.5">
                {PORTAL_POINTS.map((p) => (
                  <li
                    key={p}
                    className="flex items-start gap-3 rounded-xl border border-transparent px-2 py-1.5 text-sm transition-colors hover:border-gold/10 hover:bg-gold/[0.04]"
                  >
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="text-foreground/85">{p}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={100}>
              <WorkflowPreview />
            </Reveal>
          </div>
        </section>

        {/* ── Slot-CTA ── */}
        <section className="mx-auto max-w-6xl px-6 py-28">
          <Reveal className="relative overflow-hidden rounded-3xl border border-gold/15 bg-card px-7 py-16 text-center md:px-16 md:py-20">
            <div className="grain absolute inset-0" aria-hidden />
            <span
              className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-display text-[22vw] leading-none text-gold/[0.04] md:text-[14vw]"
              aria-hidden
            >
              Elevate
            </span>
            <div
              className="pointer-events-none absolute inset-x-0 -top-24 h-64 opacity-60"
              style={{ background: "var(--gradient-glow)" }}
              aria-hidden
            />
            <h2 className="relative font-display text-4xl leading-tight md:text-6xl">
              Klaar voor de{" "}
              <span className="italic-accent italic text-gradient-gold">volgende stap</span>?
            </h2>
            <p className="relative mx-auto mt-5 max-w-xl text-base text-muted-foreground">
              Plan een vrijblijvende merkscan en ervaar hoe overzichtelijk samenwerken aan je merk
              kan zijn.
            </p>
            <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/contact"
                onClick={() => track("cta_click", { location: "slot" })}
                className="group glow-gold inline-flex items-center gap-1.5 rounded-full bg-gradient-gold px-7 py-3 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground transition-all duration-300 hover:-translate-y-0.5 hover:brightness-105"
              >
                Plan een merkscan{" "}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#diensten"
                className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 px-7 py-3 text-xs font-medium uppercase tracking-[0.18em] text-foreground/80 transition-colors hover:border-gold/45 hover:text-foreground"
              >
                Ontdek de aanpak
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/* Kleine, tokengebaseerde visuals per dienst — geen afbeeldingen. */
function ServiceVisualBlock({ kind }: { kind: ServiceVisual }) {
  if (kind === "tags") {
    return (
      <div className="flex flex-wrap gap-2" aria-hidden>
        {["Positionering", "Doelgroep", "Content-pijlers", "Tone of voice", "Merkverhaal"].map(
          (t) => (
            <span
              key={t}
              className="rounded-full border border-gold/15 bg-gold/5 px-3 py-1 text-[11px] tracking-wide text-foreground/70"
            >
              {t}
            </span>
          ),
        )}
      </div>
    );
  }

  if (kind === "palette") {
    return (
      <div className="space-y-2.5" aria-hidden>
        <div className="flex gap-2">
          {["bg-gold/70", "bg-gold/40", "bg-gold/20", "bg-foreground/15", "bg-foreground/25"].map(
            (c, i) => (
              <span key={i} className={"h-6 flex-1 rounded-md " + c} />
            ),
          )}
        </div>
        <div className="space-y-1.5">
          <span className="block h-2 w-4/5 rounded-full bg-gold/15" />
          <span className="block h-2 w-3/5 rounded-full bg-gold/10" />
        </div>
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

  // chart
  return (
    <div className="rounded-xl border border-gold/10 bg-card/70 p-3" aria-hidden>
      <svg viewBox="0 0 200 44" className="h-12 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="svc-chart" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 36 L28 30 L56 32 L84 22 L112 24 L140 13 L168 15 L200 5 L200 44 L0 44 Z"
          fill="url(#svc-chart)"
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

/* Zwevende preview van het portaal — puur CSS/markup, geen afbeelding nodig. */
function PortalPreview() {
  return (
    <div className="lg:scale-105">
      <div className="glass-strong shadow-elegant relative rounded-2xl border border-gold/15 p-4 md:p-5">
        {/* Topbar */}
        <div className="flex items-center justify-between border-b border-gold/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-md bg-gradient-gold" />
            <span className="font-display text-sm">Dashboard</span>
          </div>
          <div className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gold/40" />
            <span className="h-2 w-2 rounded-full bg-gold/25" />
            <span className="h-2 w-2 rounded-full bg-gold/15" />
          </div>
        </div>
        {/* Stat-tegels */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[
            ["12", "gepland"],
            ["4", "akkoord"],
            ["+8%", "groei"],
          ].map(([n, l]) => (
            <div key={l} className="rounded-lg border border-gold/10 bg-card/70 p-2.5">
              <div className="font-display text-lg text-gold">{n}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
        {/* Mini-grafiek */}
        <div className="mt-3 rounded-lg border border-gold/10 bg-card/70 p-3">
          <div className="mb-2 text-[9px] uppercase tracking-wider text-muted-foreground">
            Bereik — 30 dagen
          </div>
          <svg viewBox="0 0 200 48" className="h-12 w-full" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="lp-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 38 L25 32 L50 34 L75 24 L100 26 L125 16 L150 18 L175 9 L200 6 L200 48 L0 48 Z"
              fill="url(#lp-fill)"
            />
            <path
              d="M0 38 L25 32 L50 34 L75 24 L100 26 L125 16 L150 18 L175 9 L200 6"
              fill="none"
              stroke="var(--gold)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </div>
        {/* Rijtjes */}
        <div className="mt-3 space-y-2">
          {[Instagram, Music2, Facebook].map((Icon, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-lg border border-gold/10 bg-card/70 px-3 py-2"
            >
              <Icon className="h-3.5 w-3.5 text-gold" aria-hidden />
              <span className="h-2 flex-1 rounded-full bg-gold/10" />
              <span className="text-[9px] uppercase tracking-wider text-gold/70">gepland</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Aanvullende portaal-visual: content-goedkeuring + publicatieflow.
   Bewust ánders dan PortalPreview, zodat er geen dubbele mock op de pagina staat. */
function WorkflowPreview() {
  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-gold/5 blur-2xl"
        aria-hidden
      />
      {/* Post-kaart met goedkeuring */}
      <div className="glass-strong shadow-elegant rounded-2xl border border-gold/15 p-4 md:p-5">
        <div className="flex items-center justify-between border-b border-gold/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-gold">
              <Instagram className="h-3.5 w-3.5 text-primary-foreground" aria-hidden />
            </span>
            <span className="font-display text-sm">Nieuwe post</span>
          </div>
          <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[9px] uppercase tracking-wider text-gold/80">
            wacht op akkoord
          </span>
        </div>

        {/* Beeld-placeholder + tekstregels */}
        <div className="mt-4 flex gap-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-gold">
            <span className="grain absolute inset-0 opacity-30" aria-hidden />
            <Sparkles
              className="absolute bottom-1.5 right-1.5 h-4 w-4 text-primary-foreground/80"
              aria-hidden
            />
          </div>
          <div className="flex-1 space-y-2 py-1">
            <span className="block h-2.5 w-4/5 rounded-full bg-gold/15" />
            <span className="block h-2.5 w-full rounded-full bg-gold/10" />
            <span className="block h-2.5 w-2/3 rounded-full bg-gold/10" />
            <div className="flex gap-1.5 pt-1">
              <span className="rounded-full border border-gold/15 bg-gold/5 px-2 py-0.5 text-[8px] tracking-wide text-foreground/60">
                #merk
              </span>
              <span className="rounded-full border border-gold/15 bg-gold/5 px-2 py-0.5 text-[8px] tracking-wide text-foreground/60">
                #social
              </span>
            </div>
          </div>
        </div>

        {/* Actieknoppen */}
        <div className="mt-4 flex items-center gap-2">
          <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-gold py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-primary-foreground">
            <Check className="h-3 w-3" /> Goedkeuren
          </span>
          <span className="inline-flex flex-1 items-center justify-center rounded-lg border border-gold/20 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-foreground/70">
            Feedback
          </span>
        </div>
      </div>

      {/* Zwevende publicatie-badge */}
      <div className="lp-float-slow glass shadow-elegant absolute -bottom-5 -right-2 flex items-center gap-2.5 rounded-xl border border-gold/15 px-3.5 py-2.5 sm:-right-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold/12 text-gold">
          <CalendarClock className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <div className="text-[11px] font-medium leading-tight">Automatisch gepubliceerd</div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            naar 5 kanalen
          </div>
        </div>
      </div>
    </div>
  );
}

/* Bento-dienstkaart met scroll-reveal (stagger via index). */
function ServiceCard({ service, index }: { service: (typeof SERVICES)[number]; index: number }) {
  const { ref, className, style } = useReveal<HTMLElement>(index * 80);
  const Icon = service.icon;
  return (
    <article
      ref={ref}
      className={
        className +
        " group relative overflow-hidden rounded-2xl border border-gold/10 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold/25 hover:shadow-elegant " +
        (service.wide ? "lg:col-span-4" : "lg:col-span-2")
      }
      style={style}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gold/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden
      />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold transition-colors group-hover:bg-gold/20">
            <Icon className="h-5 w-5" />
          </span>
          <span className="font-display text-[10px] uppercase tracking-[0.24em] text-gold/70">
            0{index + 1}
          </span>
        </div>
        <h3 className="mt-5 font-display text-xl md:text-2xl">{service.title}</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {service.body}
        </p>
        <div className="mt-auto pt-6">
          <ServiceVisualBlock kind={service.visual} />
        </div>
      </div>
    </article>
  );
}

/* Tijdlijn-stap met scroll-reveal (stagger via index). */
function TimelineStep({ step, index }: { step: (typeof STEPS)[number]; index: number }) {
  const { ref, className, style } = useReveal<HTMLLIElement>(index * 90);
  return (
    <li ref={ref} className={className + " relative pl-8"} style={style}>
      <span
        className="absolute left-0 top-2 grid h-4 w-4 -translate-x-1/2 place-items-center rounded-full border border-gold/40 bg-background"
        aria-hidden
      >
        <span className="h-1.5 w-1.5 rounded-full bg-gradient-gold" />
      </span>
      <div className="group rounded-2xl border border-gold/10 bg-card/60 p-5 transition-all duration-300 hover:border-gold/25 hover:bg-card hover:shadow-elegant">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-3xl text-gold/30 transition-colors group-hover:text-gold/60">
            {step.n}
          </span>
          <h3 className="font-display text-lg">{step.title}</h3>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
      </div>
    </li>
  );
}

function SectionHead({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: ReactNode;
  body: string;
}) {
  return (
    <div className="max-w-2xl">
      <div className="text-[10px] uppercase tracking-[0.28em] text-gold/80">{eyebrow}</div>
      <h2 className="mt-3 font-display text-4xl leading-tight md:text-5xl">{title}</h2>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
