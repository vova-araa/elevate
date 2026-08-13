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
import { useUIStore } from "@/lib/stores/ui-store";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    // Alleen de goedkope sessiecheck hier; de rol is al bekend in AuthProvider
    // en AdminGate hieronder stuurt niet-admins door. Zo vervallen een extra
    // netwerkronde (getUser) én een user_roles-query vóór elke admin-pagina.
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw redirect({ to: "/auth" });
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
        <main className="scroll-surface flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
          {/* Zachte page-transition bij navigeren tussen admin-schermen. */}
          <div key={pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileBottomNav />
      <MobileNavSheet />
      <MobileFab />
      <CommandPalette />
    </div>
  );
}
