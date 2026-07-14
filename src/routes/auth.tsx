import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Inloggen — Elevate Design" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { signIn, loading, user, role } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Redirect zodra rol bekend is (zowel bij bestaande sessie als na sign-in)
  useEffect(() => {
    if (loading || !user || !role) return;
    navigate({ to: role === "admin" ? "/admin/dashboard" : "/dashboard", replace: true });
  }, [user, role, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return toast.error("Vul je e-mail en wachtwoord in");
    setBusy(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) return toast.error(error);
      // Redirect wordt door bovenstaande effect afgehandeld zodra rol geladen is
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-luxe px-4 py-10 flex items-center justify-center">
      <form onSubmit={submit} className="glass-strong w-full max-w-sm rounded-2xl p-6 space-y-5">
        <div>
          <div className="h-9 w-9 rounded-full bg-gradient-gold mb-4" />
          <h1 className="font-display text-4xl text-gold">Inloggen</h1>
          <p className="mt-1 text-sm text-muted-foreground">Log in om het portaal te openen.</p>
        </div>

        <label className="block text-sm">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-gold/20 bg-background/60 px-3 py-2 outline-none focus:ring-2 focus:ring-gold/35"
          />
        </label>

        <label className="block text-sm">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Wachtwoord</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-gold/20 bg-background/60 px-3 py-2 outline-none focus:ring-2 focus:ring-gold/35"
          />
        </label>

        <button
          type="submit"
          disabled={busy || loading}
          className="w-full rounded-full bg-gradient-gold px-4 py-2.5 text-sm font-medium text-primary-foreground inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Inloggen
        </button>
      </form>
    </main>
  );
}
