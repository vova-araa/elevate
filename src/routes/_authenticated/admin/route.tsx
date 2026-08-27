import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import { CommandPalette } from "@/components/command-palette";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { MobileNavSheet } from "@/components/mobile-nav-sheet";
import { MobileFab } from "@/components/mobile-fab";
import { PwaInstall } from "@/components/pwa-install";
import { useUIStore } from "@/lib/stores/ui-store";

/**
 * Uitkomst van de rolcheck, per gebruiker onthouden.
 *
 * Zonder dit deed élke klik in het menu opnieuw een netwerkronde naar Supabase
 * (bovenop die van de ouder-route). Dat is niet alleen traag; het maakte het
 * openen van een scherm ook afhankelijk van een geslaagd verzoek, en één
 * hapering zette het hele scherm op de foutpagina.
 */
let cachedAdmin: { userId: string; isAdmin: boolean } | null = null;

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    // De ouder-route (/_authenticated) heeft de gebruiker al vastgesteld en
    // geeft hem door in de context — die halen we hier niet nóg een keer op.
    const userId = (context as { user?: { id?: string } }).user?.id;
    if (!userId) throw redirect({ to: "/auth" });

    if (cachedAdmin?.userId === userId) {
      if (!cachedAdmin.isAdmin) throw redirect({ to: "/dashboard" });
      return;
    }

    let isAdmin: boolean;
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      isAdmin = !!data;
    } catch {
      // Netwerkhapering: niet doorsturen en zeker niet crashen. AdminGate
      // hieronder kijkt alsnog naar de rol uit de auth-context, en RLS bewaakt
      // de data server-side. Liever een scherm dat laadt dan een foutpagina.
      return;
    }

    cachedAdmin = { userId, isAdmin };
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: AdminGate,
});

function AdminGate() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !role) return;
    if (role !== "admin") navigate({ to: "/dashboard", replace: true });
  }, [role, loading, navigate]);

  if (loading || !role || role !== "admin") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }
  return <AdminLayout />;
}

function AdminLayout() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen bg-luxe">
      <AdminSidebar />
      <div
        className={cn(
          "flex-1 min-w-0 flex flex-col transition-[margin] duration-200 ease-out",
          collapsed ? "md:ml-16" : "md:ml-[264px]",
        )}
      >
        <AdminTopbar />
        <main className="scroll-surface flex-1 p-4 md:p-6 lg:p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
          {/* Zachte page-transition bij navigeren tussen admin-schermen. */}
          <div key={pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileBottomNav />
      <MobileNavSheet />
      <MobileFab />
      <PwaInstall bottomClassName="bottom-[calc(76px+env(safe-area-inset-bottom))]" />
      <CommandPalette />
    </div>
  );
}
