import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ReportCard } from "@/components/client-portal/report-card";
import { FileBarChart, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/reports")({
  component: ClientReports,
});

function ClientReports() {
  const { user } = useAuth();

  const { data: membership, isLoading: loadingMembership } = useQuery({
    queryKey: ["my-client", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_members")
        .select("client_id, clients(name)")
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const clientId = (membership as any)?.client_id as string | undefined;

  const { data: reports, isLoading: loadingReports } = useQuery({
    queryKey: ["client-reports", clientId],
    enabled: !!clientId,
    queryFn: async () =>
      (
        await supabase
          .from("reports")
          .select("*")
          .eq("client_id", clientId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  // Groepeer per jaar (op basis van period_end, anders created_at), nieuwste eerst.
  const byYear = useMemo(() => {
    const groups = new Map<number, any[]>();
    (reports ?? []).forEach((r: any) => {
      const year = new Date(r.period_end ?? r.created_at).getFullYear();
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year)!.push(r);
    });
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [reports]);

  if (loadingMembership || (clientId && loadingReports)) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <FileBarChart className="h-8 w-8 text-gold mx-auto mb-3" />
        <h2 className="font-display text-2xl">Geen actieve klantkoppeling</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Zodra je gekoppeld bent aan een bedrijf verschijnen hier je maandrapporten.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Resultaten</p>
        <h1 className="font-display text-4xl sm:text-5xl mt-2">Maandrapporten</h1>
        <p className="text-sm text-muted-foreground mt-2">
          De rapportages van je Elevate-team: wat er is gepubliceerd, hoe het presteerde en wat de
          highlights waren.
        </p>
      </div>

      {(reports?.length ?? 0) === 0 && (
        <div className="glass rounded-2xl p-12 text-center">
          <FileBarChart className="h-10 w-10 text-gold mx-auto mb-4" />
          <h2 className="font-display text-2xl">Nog geen rapporten</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Je eerste maandrapport verschijnt hier zodra je team het klaargezet heeft. Meestal
            ontvang je aan het begin van elke maand een terugblik.
          </p>
        </div>
      )}

      {byYear.map(([year, items]) => (
        <section key={year} className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl text-gold">{year}</h2>
            <div className="h-px flex-1 bg-gold/10" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {items.length} rapport{items.length === 1 ? "" : "en"}
            </span>
          </div>
          <div className="space-y-4">
            {items.map((r: any) => (
              <ReportCard key={r.id} report={r} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
