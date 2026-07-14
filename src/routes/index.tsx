import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import elevateLogoUrl from "@/assets/elevate-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Elevate Design — Elevate your brand" },
      {
        name: "description",
        content:
          "Brand studio voor muziekstudio's, chocolatiers, parfumeurs en andere ambitieuze merken. Stappenplan, content en oplevering in één portaal.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-luxe">
      {/* subtle glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] opacity-70"
        style={{ background: "var(--gradient-glow)" }}
      />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={elevateLogoUrl} alt="Elevate Design" className="h-7 w-7 object-contain" />
          <span className="font-display text-lg tracking-wide">Elevate Design</span>
        </Link>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-gold hover:bg-gold/5 transition"
        >
          Portal <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6">
        <section className="pt-24 pb-24 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-background/40 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-gold/90 backdrop-blur-sm">
            <Sparkles className="h-3 w-3" /> Brand studio
          </div>
          <h1 className="mt-7 font-display text-5xl md:text-7xl leading-[1] tracking-tight">
            Elevate <span className="text-gradient-gold italic font-light">your</span> brand
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm md:text-base text-muted-foreground leading-relaxed">
            Strategie, content en uitvoering voor merken met karakter — binnen één elegant portaal.
          </p>
          <div className="mt-8 flex items-center justify-center">
            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-1.5 rounded-full bg-gradient-gold px-5 py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground glow-gold"
            >
              Open portal{" "}
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>

        <section className="pb-24">
          <div className="glass-strong rounded-2xl p-10 text-center shadow-elegant">
            <p className="font-display text-2xl md:text-4xl italic text-gradient-gold">
              "Craft over noise."
            </p>
            <p className="mt-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              — Elevate Design
            </p>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-gold/10 py-6 text-center text-[11px] text-muted-foreground">
        © {new Date().getFullYear()} Elevate Design. All rights reserved.
      </footer>
    </div>
  );
}
