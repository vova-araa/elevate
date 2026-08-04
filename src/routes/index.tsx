import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  PenTool,
  CalendarClock,
  BarChart3,
  Compass,
  Layers,
  ShieldCheck,
  Check,
  Instagram,
  Music2,
  Linkedin,
  Youtube,
  Facebook,
} from "lucide-react";
import elevateLogoUrl from "@/assets/elevate-logo.png";
import { LandingShowcase } from "@/components/landing-showcase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Elevate Design — jouw merk, één portaal" },
      {
        name: "description",
        content:
          "Brand & social studio voor merken met karakter. Strategie, content en publicatie — plus een eigen portaal waarin je alles volgt, goedkeurt en meet.",
      },
    ],
  }),
  component: Landing,
});

const SOCIALS = [Instagram, Music2, Linkedin, Youtube, Facebook];

// Officiële Elevate Design-accounts — gekoppeld in de footer ("Volg ons").
const SOCIAL_LINKS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/elevatedesign.official/",
    icon: Instagram,
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@elevate.design.official",
    icon: Music2,
  },
];

const SERVICES = [
  {
    icon: Compass,
    title: "Strategie & intake",
    body: "Een gerichte intake vertaalt jouw merk naar positionering, doelgroep en content-pijlers. De basis waarop alles rust.",
  },
  {
    icon: PenTool,
    title: "Contentcreatie",
    body: "Beeld, video en tekst die klinken als jouw merk — met AI-ondersteuning voor snelheid, met de hand afgemaakt voor klasse.",
  },
  {
    icon: CalendarClock,
    title: "Planning & publicatie",
    body: "Een strakke kalender en directe koppelingen met je kanalen. Ingepland, goedgekeurd en automatisch gepubliceerd.",
  },
  {
    icon: BarChart3,
    title: "Rapportage & groei",
    body: "Heldere cijfers per merk: bereik, groei en wat werkt. Geen ruis, alleen wat telt voor de volgende stap.",
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
  return (
    <div className="relative min-h-screen overflow-hidden bg-luxe">
      {/* Achtergrond-glows */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] opacity-70"
        style={{ background: "var(--gradient-glow)" }}
      />
      <div className="pointer-events-none absolute -left-40 top-[30vh] h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-[60vh] h-96 w-96 rounded-full bg-gold/10 blur-3xl" />

      {/* ── Navigatie ── */}
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
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
          className="group inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-gold transition-colors duration-200 hover:border-gold/50 hover:bg-gold/5"
        >
          Portaal{" "}
          <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </header>

      <main className="relative z-10">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-6xl px-6 pt-16 md:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="fade-in-up inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-background/40 px-3.5 py-1 text-[10px] uppercase tracking-[0.22em] text-gold/90 backdrop-blur-sm">
                <Sparkles className="h-3 w-3" /> Brand & social studio
              </div>
              <h1
                className="fade-in-up mt-6 font-display text-5xl leading-[1.03] tracking-tight md:text-7xl"
                style={{ animationDelay: "80ms" }}
              >
                Elevate <span className="text-gradient-gold font-light italic">your</span> brand
              </h1>
              <p
                className="fade-in-up mt-6 max-w-xl text-base leading-relaxed text-muted-foreground"
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
                  to="/dashboard"
                  className="group glow-gold inline-flex items-center gap-1.5 rounded-full bg-gradient-gold px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground transition-all duration-300 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:scale-[0.98]"
                >
                  Open het portaal{" "}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#diensten"
                  className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-foreground/80 transition-colors hover:border-gold/45 hover:text-foreground"
                >
                  Bekijk wat we doen
                </a>
              </div>
              {/* Kanaal-rij */}
              <div
                className="fade-in-up mt-10 flex items-center gap-4"
                style={{ animationDelay: "320ms" }}
              >
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                  Publiceert naar
                </span>
                <div className="flex items-center gap-3">
                  {SOCIALS.map((Icon, i) => (
                    <span
                      key={i}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-gold/10 bg-card/60 text-muted-foreground"
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Hero-visual: zwevende portaal-preview */}
            <div className="fade-in-up relative" style={{ animationDelay: "200ms" }}>
              <PortalPreview />
            </div>
          </div>

          {/* Stat-strip */}
          <div
            className="fade-in-up mt-20 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-gold/10 bg-gold/10 md:grid-cols-4"
            style={{ animationDelay: "360ms" }}
          >
            {[
              ["1", "portaal voor alles"],
              ["5", "gekoppelde kanalen"],
              ["AI", "strategie & planning"],
              ["100%", "op jouw merk"],
            ].map(([n, l]) => (
              <div key={l} className="bg-background/80 px-6 py-7 text-center backdrop-blur-sm">
                <div className="font-display text-3xl text-gradient-gold md:text-4xl">{n}</div>
                <div className="mt-1 text-xs text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Showcase-carousel ── */}
        <section className="mx-auto max-w-6xl px-6 pt-28">
          <SectionHead
            eyebrow="Wat we voor je doen"
            title="Een studio die met je merk meebeweegt"
            body="Van strategie tot groei — schuif door de kern van wat samenwerken met Elevate oplevert."
          />
          <div className="mt-12">
            <LandingShowcase />
          </div>
        </section>

        {/* ── Diensten ── */}
        <section id="diensten" className="mx-auto max-w-6xl px-6 pt-28">
          <SectionHead
            eyebrow="Diensten"
            title="Alles wat je merk online sterk maakt"
            body="Van eerste strategie tot dagelijkse publicatie — vier vakgebieden, één vloeiend proces."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s, i) => (
              <div
                key={s.title}
                className="fade-in-up group rounded-2xl border border-gold/10 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold/25 hover:shadow-elegant"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/12 text-gold transition-colors group-hover:bg-gold/20">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-display text-xl">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Werkwijze ── */}
        <section id="werkwijze" className="mx-auto max-w-6xl px-6 pt-28">
          <SectionHead
            eyebrow="Werkwijze"
            title="Van intake tot meetbare groei"
            body="Een helder pad in vier stappen. Jij houdt de regie, wij doen het werk."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="fade-in-up relative rounded-2xl border border-gold/10 bg-card/60 p-6"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="font-display text-4xl text-gold/25">{s.n}</div>
                <h3 className="mt-3 font-display text-lg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-gold/30 md:block" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Portaal-showcase ── */}
        <section id="portaal" className="mx-auto max-w-6xl px-6 pt-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-background/40 px-3.5 py-1 text-[10px] uppercase tracking-[0.22em] text-gold/90">
                <Layers className="h-3 w-3" /> Het portaal
              </div>
              <h2 className="mt-5 font-display text-4xl leading-tight md:text-5xl">
                Één plek waar alles samenkomt
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Geen losse mailtjes en verspreide bestanden meer. In het Elevate-portaal zie je de
                planning, keur je content goed en volg je de resultaten.
              </p>
              <ul className="mt-7 space-y-3">
                {PORTAL_POINTS.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="text-foreground/85">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <WorkflowPreview />
          </div>
        </section>

        {/* ── Slot-CTA ── */}
        <section className="mx-auto max-w-6xl px-6 py-28">
          <div className="relative overflow-hidden rounded-3xl border border-gold/15 bg-card px-8 py-16 text-center md:px-16">
            <div
              className="pointer-events-none absolute inset-x-0 -top-24 h-64 opacity-60"
              style={{ background: "var(--gradient-glow)" }}
            />
            <h2 className="relative font-display text-4xl leading-tight md:text-6xl">
              Klaar voor de <span className="text-gradient-gold italic">volgende stap</span>?
            </h2>
            <p className="relative mx-auto mt-5 max-w-xl text-base text-muted-foreground">
              Open het portaal en ervaar hoe overzichtelijk samenwerken aan je merk kan zijn.
            </p>
            <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/dashboard"
                className="group glow-gold inline-flex items-center gap-1.5 rounded-full bg-gradient-gold px-7 py-3 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground transition-all duration-300 hover:-translate-y-0.5 hover:brightness-105"
              >
                Open het portaal{" "}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-gold/10 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-[11px] text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <img src={elevateLogoUrl} alt="" className="h-5 w-5 object-contain" />
            <span>© {new Date().getFullYear()} Elevate Design. Alle rechten voorbehouden.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="transition-colors hover:text-gold">
              Voorwaarden
            </Link>
            <Link to="/privacy" className="transition-colors hover:text-gold">
              Privacy
            </Link>
            <Link to="/dashboard" className="transition-colors hover:text-gold">
              Portaal
            </Link>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
              Volg ons
            </span>
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                title={s.label}
                className="grid h-8 w-8 place-items-center rounded-lg border border-gold/10 bg-card/60 text-muted-foreground transition-colors hover:border-gold/30 hover:text-gold"
              >
                <s.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </footer>
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
          <svg viewBox="0 0 200 48" className="h-12 w-full" preserveAspectRatio="none">
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
          {[Instagram, Music2, Linkedin].map((Icon, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-lg border border-gold/10 bg-card/70 px-3 py-2"
            >
              <Icon className="h-3.5 w-3.5 text-gold" />
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
              <Instagram className="h-3.5 w-3.5 text-primary-foreground" />
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
            <Sparkles className="absolute bottom-1.5 right-1.5 h-4 w-4 text-primary-foreground/80" />
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
      <div className="glass shadow-elegant absolute -bottom-5 -right-2 flex items-center gap-2.5 rounded-xl border border-gold/15 px-3.5 py-2.5 sm:-right-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold/12 text-gold">
          <CalendarClock className="h-4 w-4" />
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

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-2xl">
      <div className="text-[10px] uppercase tracking-[0.28em] text-gold/80">{eyebrow}</div>
      <h2 className="mt-3 font-display text-4xl leading-tight md:text-5xl">{title}</h2>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
