import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import elevateLogoUrl from "@/assets/elevate-logo.png";

// Gedeelde opmaak voor publieke juridische pagina's (/terms en /privacy).
// Deze URL's worden ook gebruikt in de developer-portalen van TikTok/Meta.
export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-luxe">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[40vh] opacity-60"
        style={{ background: "var(--gradient-glow)" }}
      />
      <header className="relative z-10 mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={elevateLogoUrl} alt="Elevate Design" className="h-7 w-7 object-contain" />
          <span className="font-display text-lg tracking-wide">Elevate Design</span>
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-gold hover:border-gold/50 hover:bg-gold/5"
        >
          <ArrowLeft className="h-3 w-3" /> Home
        </Link>
      </header>
      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-10">
        <p className="text-[10px] uppercase tracking-[0.24em] text-gold/80">{eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl">{title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">Laatst bijgewerkt: {updated}</p>
        <div className="legal-body mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
          {children}
        </div>
      </main>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gold/10 bg-card/60 p-5 backdrop-blur-sm">
      <h2 className="font-display text-xl text-gold">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
