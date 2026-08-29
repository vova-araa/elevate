import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClient } from "@/hooks/use-active-client";
import { ReportCard } from "@/components/client-portal/report-card";
import { Reveal } from "@/components/reveal";
import { EmptyState } from "@/components/empty-state";
import { FileBarChart, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/client/reports")({
  component: ClientReports,
});

function ClientReports() {
  const { clientId } = useActiveClient();

  const { data: reports, isLoading: loadingReports } = useQuery({
    queryKey: ["client-reports", clientId],
    queryFn: async () =>
      (
        await supabase
          .from("reports")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  // Groepeer per jaar (op basis van period_end, anders created_at), nieuwste eerst.
  const byYear = useMemo(() => {
    const groups = new Map<number, Tables<"reports">[]>();
    (reports ?? []).forEach((r) => {
      const year = new Date(r.period_end ?? r.created_at).getFullYear();
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year)!.push(r);
    });
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [reports]);

  if (loadingReports) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
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
        <EmptyState
          icon={<FileBarChart className="h-5 w-5" />}
          title="Nog geen rapporten"
          description="Je eerste maandrapport verschijnt hier zodra je team het klaargezet heeft. Meestal ontvang je aan het begin van elke maand een terugblik."
          className="py-12"
        />
      )}

      {byYear.map(([year, items], i) => (
        <Reveal key={year} className="space-y-4" delay={Math.min(i * 60, 240)}>
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-2xl text-gold">{year}</h2>
              <div className="h-px flex-1 bg-gold/10" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {items.length} rapport{items.length === 1 ? "" : "en"}
              </span>
            </div>
            <div className="space-y-4">
              {items.map((r) => (
                <ReportCard key={r.id} report={r} />
              ))}
            </div>
          </section>
        </Reveal>
      ))}
    </div>
  );
}
