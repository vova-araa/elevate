import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, RotateCw } from "lucide-react";

/**
 * Globale, gebrande foutpagina voor als een scherm niet laadt of crasht.
 *
 * De foutmelding staat er bewust bíj. Dit is een besloten werkomgeving, geen
 * publieke site: zonder de melding kun je alleen "er ging iets mis" doorgeven,
 * en dan is er niets te repareren. De tekst staat ingeklapt zodat het scherm
 * rustig blijft.
 */
export function RouteError({ error, reset }: { error: Error; reset?: () => void }) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const details = [error?.message, error?.stack].filter(Boolean).join("\n\n");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-luxe px-6 text-center">
      <div className="font-display text-6xl text-gold">Oeps</div>
      <h1 className="font-display mt-3 text-2xl">Er ging iets mis</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Dit scherm kon niet geladen worden. Probeer het opnieuw of ga terug naar het portaal.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            // reset() haalt de foutgrens weg, invalidate() haalt de data opnieuw
            // op. Zonder de eerste blijft dit scherm staan en lijkt de knop stuk.
            reset?.();
            void router.invalidate();
          }}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-gold px-5 py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Opnieuw proberen
        </button>
        {/* Bewust een harde navigatie: als de router zelf in de knoop ligt,
            komt een client-side Link niet aan. */}
        <a
          href="/admin/dashboard"
          className="rounded-full border border-gold/30 px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-gold transition hover:bg-gold/10"
        >
          Naar het portaal
        </a>
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
        >
          Home
        </Link>
      </div>

      {details && (
        <div className="mt-8 w-full max-w-xl text-left">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            {showDetails ? "Verberg details" : "Toon details"}
          </button>
          {showDetails && (
            <div className="mt-2 rounded-lg border border-border bg-surface p-3">
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-left text-xs text-muted-foreground">
                {details}
              </pre>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(details).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-gold hover:underline"
              >
                <Copy className="h-3 w-3" /> {copied ? "Gekopieerd" : "Kopieer melding"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
