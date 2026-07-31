import { Link, useRouter } from "@tanstack/react-router";
import { RotateCw } from "lucide-react";

/** Globale, gebrande foutpagina (huisstijl) voor als een scherm niet laadt/crasht. */
export function RouteError({ error }: { error: Error }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-luxe px-6 text-center">
      <div className="font-display text-6xl text-gold">Oeps</div>
      <h1 className="font-display mt-3 text-2xl">Er ging iets mis</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Dit scherm kon niet geladen worden. Probeer het opnieuw of ga terug naar het portaal.
      </p>
      {import.meta.env.DEV && error?.message && (
        <pre className="mt-4 max-w-md overflow-auto rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs text-muted-foreground">
          {error.message}
        </pre>
      )}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.invalidate()}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-gold px-5 py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Opnieuw proberen
        </button>
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
        >
          Naar het portaal
        </Link>
      </div>
    </div>
  );
}
