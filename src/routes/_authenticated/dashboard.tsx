import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardRedirect,
});

function DashboardRedirect() {
  const { role } = useAuth();
  if (!role) return <Loader2 className="h-6 w-6 animate-spin text-gold" />;
  if (role === "client") return <Navigate to="/client/overview" replace />;
  return <Navigate to="/admin/dashboard" replace />;
}
