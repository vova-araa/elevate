import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  /** Super-admin heeft alle admin-rechten plus het super-admin-dashboard. */
  isSuperAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** S16: stuurt een herstelmail met een link naar /auth/reset-password. */
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  /** Zet het nieuwe wachtwoord — vereist de recovery-sessie die de link in requestPasswordReset opent. */
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadRole(s.user.id), 0);
      } else {
        setRole(null);
        setIsSuperAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadRole(data.session.user.id).finally(() => setLoading(false));
      } else {
        setRole(null);
        setIsSuperAdmin(false);
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadRole(userId: string) {
    // Veilige weg: SECURITY DEFINER-RPC die uitsluitend de eigen rollen
    // teruggeeft en niet afhangt van is_admin-rechten of RLS op user_roles.
    // Valt terug op een directe query als de RPC (nog) niet bestaat.
    let roles: string[] = [];
    const rpc = await supabase.rpc("current_user_roles");
    if (!rpc.error && Array.isArray(rpc.data)) {
      roles = rpc.data as string[];
    } else {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      roles = (data ?? []).map((r) => String(r.role));
    }
    const isAdmin = roles.includes("admin") || roles.includes("super_admin");
    setRole(isAdmin ? "admin" : "client");
    setIsSuperAdmin(roles.includes("super_admin"));
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { error: null };
    // Vertaal de meestvoorkomende Supabase-fouten naar duidelijke NL-meldingen,
    // zodat de gebruiker weet wat er te doen staat.
    const raw = error.message.toLowerCase();
    let message = error.message;
    if (raw.includes("invalid login credentials")) {
      message = "E-mail of wachtwoord klopt niet. Controleer beide, of reset je wachtwoord.";
    } else if (raw.includes("email not confirmed")) {
      message =
        "Je account is nog niet bevestigd. Zet in Supabase → Authentication → Users bij je gebruiker 'Auto Confirm' aan (of bevestig via de mail).";
    } else if (
      raw.includes("failed to fetch") ||
      raw.includes("networkerror") ||
      raw.includes("load failed")
    ) {
      message =
        "Kan de server niet bereiken. Controleer of de app-instellingen (Supabase-URL en -sleutel) goed staan.";
    } else if (raw.includes("rate limit") || raw.includes("too many")) {
      message = "Te veel pogingen. Wacht even en probeer opnieuw.";
    }
    return { error: message };
  }

  async function requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (!error) return { error: null };
    const raw = error.message.toLowerCase();
    let message = error.message;
    if (raw.includes("rate limit") || raw.includes("too many")) {
      message = "Te veel pogingen. Wacht even en probeer opnieuw.";
    } else if (
      raw.includes("failed to fetch") ||
      raw.includes("networkerror") ||
      raw.includes("load failed")
    ) {
      message = "Kan de server niet bereiken. Probeer het straks opnieuw.";
    }
    return { error: message };
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) return { error: null };
    const raw = error.message.toLowerCase();
    const message = raw.includes("password")
      ? "Wachtwoord voldoet niet aan de eisen — gebruik minimaal 6 tekens."
      : error.message;
    return { error: message };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setRole(null);
  }

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        role,
        isSuperAdmin,
        loading,
        signIn,
        requestPasswordReset,
        updatePassword,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
