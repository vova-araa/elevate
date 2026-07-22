import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadRole(s.user.id), 0);
      } else {
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadRole(data.session.user.id).finally(() => setLoading(false));
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadRole(userId: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (data && data.length > 0) {
      const isAdmin = data.some((r) => r.role === "admin");
      setRole(isAdmin ? "admin" : "client");
    } else {
      setRole("client");
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { error: null };
    // Vertaal de meestvoorkomende Supabase-fouten naar duidelijke NL-meldingen,
    // zodat de gebruiker weet wat er te doen staat.
    const raw = error.message.toLowerCase();
    let message = error.message;
    if (raw.includes("invalid login credentials")) {
      message = "E-mail of wachtwoord klopt niet. Controleer beide, of reset je wachtwoord in Supabase.";
    } else if (raw.includes("email not confirmed")) {
      message =
        "Je account is nog niet bevestigd. Zet in Supabase → Authentication → Users bij je gebruiker 'Auto Confirm' aan (of bevestig via de mail).";
    } else if (raw.includes("failed to fetch") || raw.includes("networkerror") || raw.includes("load failed")) {
      message =
        "Kan de server niet bereiken. Controleer of de app-instellingen (Supabase-URL en -sleutel) goed staan.";
    } else if (raw.includes("rate limit") || raw.includes("too many")) {
      message = "Te veel pogingen. Wacht even en probeer opnieuw.";
    }
    return { error: message };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setRole(null);
  }

  return (
    <Ctx.Provider value={{ user, session, role, loading, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
