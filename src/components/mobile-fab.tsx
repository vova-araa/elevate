import { Link, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";

const FAB_ROUTES = ["/admin/dashboard", "/admin/planner", "/admin/postiz", "/admin/queue"];

export function MobileFab() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  if (!FAB_ROUTES.some((r) => path === r || path.startsWith(r + "/"))) return null;
  return (
    <Link
      to="/admin/compose"
      className="md:hidden fixed right-4 bottom-[76px] z-40 h-14 w-14 rounded-full bg-gold text-primary-foreground grid place-items-center shadow-elegant hover:opacity-90 transition"
      aria-label="Nieuwe post"
    >
      <Plus className="h-6 w-6" />
    </Link>
  );
}
