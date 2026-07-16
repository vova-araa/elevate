import { Link } from "@tanstack/react-router";

/** Gebrande 404 in de huisstijl (licht goud/cream). */
export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-luxe px-6 text-center">
      <div className="font-display text-7xl text-gold">404</div>
      <h1 className="font-display mt-3 text-2xl">Deze pagina bestaat niet</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        De link is verlopen of verkeerd getypt. Ga terug naar het portaal om verder te werken.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-gold px-5 py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground"
      >
        Naar het portaal
      </Link>
    </div>
  );
}
