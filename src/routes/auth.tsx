import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import elevateLogoUrl from "@/assets/elevate-logo.png";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Inloggen — Elevate Design" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { signIn, loading, user, role } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect zodra rol bekend is (zowel bij bestaande sessie als na sign-in)
  useEffect(() => {
    if (loading || !user || !role) return;
    navigate({ to: role === "admin" ? "/admin/dashboard" : "/dashboard", replace: true });
  }, [user, role, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Vul je e-mail en wachtwoord in.");
      return;
    }
    setBusy(true);
    try {
      const { error: signInError } = await signIn(email.trim(), password);
      if (signInError) {
        setError(signInError);
        return;
      }
      // Redirect wordt door bovenstaande effect afgehandeld zodra rol geladen is
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-luxe px-4 py-10 flex items-center justify-center">
      {/* Zachte gouden glow bovenaan */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[55vh]"
        style={{ background: "var(--gradient-glow)" }}
      />
      {/* Subtiele gloed onder de kaart */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-3xl" />

      <form
        onSubmit={submit}
        className="fade-in-up glass-strong shadow-elegant relative w-full max-w-sm space-y-5 rounded-2xl p-8"
      >
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-gold/20 bg-background/60 shadow-sm">
            <img
              src={elevateLogoUrl}
              alt="Elevate Design"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
          </div>
          <h1 className="font-display text-4xl text-gold">Inloggen</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Log in om het portaal te openen.</p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <label className="block text-sm">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="naam@bedrijf.nl"
            className="mt-1.5 w-full rounded-lg border border-gold/20 bg-background/60 px-3 py-2 outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-gold/40 focus:ring-2 focus:ring-gold/35"
          />
        </label>

        <label className="block text-sm">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Wachtwoord</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            className="mt-1.5 w-full rounded-lg border border-gold/20 bg-background/60 px-3 py-2 outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-gold/40 focus:ring-2 focus:ring-gold/35"
          />
        </label>

        <button
          type="submit"
          disabled={busy || loading}
          className="glow-gold inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-gold px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200 hover:brightness-105 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Bezig met inloggen…
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              Inloggen
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-muted-foreground/70">
          Elevate Design — jouw merk, één portaal.
        </p>
      </form>
    </main>
  );
}
