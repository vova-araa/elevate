import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { NotFound } from "./components/not-found";
import { RouteError } from "./components/route-error";

export const getRouter = () => {
  const queryClient = new QueryClient({
    // App-brede foutfeedback: geen enkele mislukte query/actie faalt nog stil.
    queryCache: new QueryCache({
      // Queries met meta.silent tonen zelf een nette inline-fallback (bv. een
      // secundaire kaart die "—" laat zien); die overvallen we niet met een
      // app-brede rode melding.
      onError: (_err, query) => {
        if (query.meta?.silent) return;
        toast.error("Kon niet laden", {
          id: "load-error",
          description: "Er ging iets mis bij het ophalen. Probeer het opnieuw.",
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: () =>
        toast.error("Actie mislukt", {
          description: "Er ging iets mis. Probeer het opnieuw.",
        }),
    }),
    defaultOptions: {
      queries: {
        // Soepeler data: kort cachen, niet herladen bij elke focus, en
        // 1x opnieuw proberen bij een hapering (minder flikkering / lege schermen).
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Geen defaultPreload: bij hover draaide dan ook de beforeLoad-auth van
    // beveiligde routes, wat tot ongewenste redirects leidde.
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: RouteError,
  });

  return router;
};
