import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Loader2, Users, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveClientContext } from "@/lib/client-context.functions";
import { EmptyState } from "@/components/empty-state";
import { OverviewSkeleton } from "@/components/client-portal/overview-skeleton";

const searchSchema = z.object({
  // "Bekijk als klant" — alleen admins mogen dit; server-side gevalideerd in
  // getActiveClientContext, dit is puur het doorgeven van de parameter.
  asClient: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/client")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ asClient: search.asClient }),
  loader: ({ deps }) => getActiveClientContext({ data: { asClient: deps.asClient } }),
  pendingComponent: OverviewSkeleton,
  component: ClientPortalGate,
});

function ClientPortalGate() {
  const active = Route.useLoaderData();

  if (!active.clientId) {
    return (
      <div className="max-w-2xl">{active.isAdmin ? <AdminClientPicker /> : <NoOwnClient />}</div>
    );
  }

  return <Outlet />;
}

function NoOwnClient() {
  return (
    <EmptyState
      icon={<Users className="h-5 w-5" />}
      title="Geen actieve klantkoppeling"
      description="Zodra je Elevate-team je aan een bedrijf koppelt, verschijnt hier je persoonlijke portaal met kanalen, planning en resultaten."
    />
  );
}

/** A17: een admin zonder ?asClient krijgt een klantkiezer i.p.v. stil terug te gaan naar /admin. */
function AdminClientPicker() {
  const navigate = useNavigate();
  const { data: clients, isLoading } = useQuery({
    queryKey: ["client-portal-picker-clients"],
    queryFn: async () =>
      (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });

  return (
    <EmptyState
      icon={<UserCog className="h-5 w-5" />}
      title="Je bent ingelogd als admin"
      description="Het klantportaal is voor klanten — kies hieronder een klant om het te bekijken zoals zij het zien."
      action={
        isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gold" />
        ) : (clients?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Er zijn nog geen klanten aangemaakt.</p>
        ) : (
          <select
            defaultValue=""
            onChange={(e) => {
              if (!e.target.value) return;
              navigate({ to: "/client/overview", search: { asClient: e.target.value } });
            }}
            className="min-h-11 rounded-lg bg-input/60 hairline px-4 py-2 text-sm"
          >
            <option value="" disabled>
              Kies een klant…
            </option>
            {clients!.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )
      }
    />
  );
}
