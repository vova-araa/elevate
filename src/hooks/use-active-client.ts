import { getRouteApi } from "@tanstack/react-router";
import type { ActiveClientContext } from "@/lib/client-context.functions";

const routeApi = getRouteApi("/_authenticated/client");

/**
 * De klant die het gedeelde loader op /client-niveau al heeft vastgesteld
 * (A01) — inclusief ?asClient-preview voor admins. Elke /client/*-pagina
 * gebruikt dit in plaats van zelf de klantkoppeling op te zoeken; de gate in
 * route.tsx garandeert dat clientId hier nooit null is (anders wordt Outlet
 * niet gerenderd).
 */
export function useActiveClient(): ActiveClientContext & { clientId: string } {
  return routeApi.useLoaderData() as ActiveClientContext & { clientId: string };
}
