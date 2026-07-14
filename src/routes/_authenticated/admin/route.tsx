import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import { CommandPalette } from "@/components/command-palette";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { MobileFab } from "@/components/mobile-fab";
import { useUIStore } from "@/lib/stores/ui-store";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
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

  return (
    <div className="flex min-h-screen bg-luxe">
      <AdminSidebar />
      <div
        className={cn(
          "flex-1 min-w-0 flex flex-col transition-[margin] duration-200 ease-out",
          "md:" + (collapsed ? "ml-14" : "ml-[260px]"),
          collapsed ? "md:ml-14" : "md:ml-[260px]",
        )}
      >
        <AdminTopbar />
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
      <MobileFab />
      <CommandPalette />
    </div>
  );
}
