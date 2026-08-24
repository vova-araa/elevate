import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import elevateLogoUrl from "@/assets/elevate-logo.png";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({
    meta: [
      { title: "Nieuw wachtwoord — Elevate Design" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

/**
 * S16: waar de herstellink uit requestPasswordReset (auth-context.tsx)
 * naartoe wijst. Supabase herkent de recovery-token in de URL zelf
 * (detectSessionInUrl) en zet daarmee een tijdelijke sessie — hier hoeven we
 * alleen het nieuwe wachtwoord op te vragen en op te slaan.
 */
function ResetPasswordPage() {
  const navigate = useNavigate();
  const { updatePassword, loading, user, role } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done || loading || !user || !role) return;
    navigate({ to: role === "admin" ? "/admin/dashboard" : "/dashboard", replace: true });
  }, [done, user, role, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Gebruik minimaal 6 tekens.");
      return;
    }
    if (password !== confirm) {
      setError("Wachtwoorden komen niet overeen.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) {
        setError(updateError);
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-luxe px-4 py-10 flex items-center justify-center">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[55vh]"
        style={{ background: "var(--gradient-glow)" }}
      />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-3xl" />

      <div className="fade-in-up glass-strong shadow-elegant relative w-full max-w-sm space-y-5 rounded-2xl p-8">
        <div className="text-center">
          <Link
            to="/"
            className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-gold/20 bg-background/60 shadow-sm transition hover:border-gold/40"
            aria-label="Naar de homepage"
          >
            <img
              src={elevateLogoUrl}
              alt="Elevate Design"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
          </Link>
          <h1 className="font-display text-4xl text-gold">Nieuw wachtwoord</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {done
              ? "Wachtwoord gewijzigd — je wordt doorgestuurd."
              : "Kies een nieuw wachtwoord voor je account."}
          </p>
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

        {done ? (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-foreground/80">
            <CheckCircle2 className="h-4 w-4 text-gold" />
            <Loader2 className="h-4 w-4 animate-spin text-gold" />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Nieuw wachtwoord
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-lg border border-gold/20 bg-background/60 px-3 py-2 outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-gold/40 focus:ring-2 focus:ring-gold/35"
              />
            </label>

            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Herhaal wachtwoord
              </span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
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
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Wachtwoord opslaan
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
