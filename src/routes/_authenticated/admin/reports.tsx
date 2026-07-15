import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useClientStore } from "@/lib/stores/client-store";
import { useState } from "react";
import { Download, FileBarChart, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createReportFromAnalytics } from "@/lib/report-generate.functions";
import { generateReportPdf, type ReportRow } from "@/lib/report-pdf";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/reports")({ component: ReportsPage });

function ReportsPage() {
  const { activeClient } = useClientStore();
  const [period, setPeriod] = useState("30");
  const qc = useQueryClient();
  const generateFn = useServerFn(createReportFromAnalytics);

  const { data: history, refetch } = useQuery({
    queryKey: ["reports", activeClient?.id],
    queryFn: async () => {
      let q = supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (activeClient?.id) q = q.eq("client_id", activeClient.id);
      const { data } = await q;
      return data ?? [];
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (!activeClient) throw new Error("Selecteer een klant");
      const periodStart = new Date(Date.now() - Number(period) * 86400000)
        .toISOString()
        .slice(0, 10);
      const periodEnd = new Date().toISOString().slice(0, 10);
      return generateFn({ data: { clientId: activeClient.id, periodStart, periodEnd } });
    },
    onSuccess: () => {
      toast.success("Maandrapport gegenereerd op basis van analytics");
      qc.invalidateQueries({ queryKey: ["reports", activeClient?.id] });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message || "Genereren mislukt"),
  });

  function downloadPdf(r: Tables<"reports">) {
    const row: ReportRow = {
      title: r.title,
      report_type: r.report_type,
      period_start: r.period_start,
      period_end: r.period_end,
      summary: r.summary,
      highlights: r.highlights,
      created_at: r.created_at,
      metrics: r.metrics,
    };
    generateReportPdf(row, {
      clientName: activeClient?.name,
      brandColor: activeClient?.color ?? undefined,
      fileName: `${r.title.replace(/\s+/g, "_")}.pdf`,
    });
  }

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-5 max-w-6xl">
      <div className="rounded-xl border border-gold/15 bg-card p-5 space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
            Klant
          </div>
          <div className="text-sm font-medium">{activeClient?.name ?? "—"}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
            Periode
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full rounded-lg border border-border bg-transparent px-3 h-9 text-sm"
          >
            <option value="7">Laatste 7 dagen</option>
            <option value="30">Laatste 30 dagen</option>
            <option value="90">Laatste 90 dagen</option>
          </select>
        </div>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="w-full h-10 rounded-lg bg-gold text-primary-foreground font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {generate.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileBarChart className="h-4 w-4" />
          )}
          Genereer maandrapport
        </button>
        <p className="text-xs text-muted-foreground">
          Telt gepubliceerde posts per platform uit de gekozen periode en stelt automatisch een
          samenvatting en kerncijfers samen.
        </p>
      </div>

      <div className="rounded-xl border border-gold/15 bg-card p-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
          Geschiedenis
        </div>
        {(history ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen rapporten gegenereerd.</p>
        ) : (
          <div className="divide-y divide-border">
            {history!.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.period_start ? new Date(r.period_start).toLocaleDateString("nl-NL") : "—"} –{" "}
                    {r.period_end ? new Date(r.period_end).toLocaleDateString("nl-NL") : "—"}
                    <span className="uppercase ml-2">{r.report_type}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => downloadPdf(r)}
                    className="text-xs h-8 px-3 rounded-lg bg-gold/15 text-gold inline-flex items-center gap-1.5 hover:bg-gold/25"
                  >
                    <FileDown className="h-3.5 w-3.5" /> Download PDF
                  </button>
                  {r.file_path && (
                    <a
                      href={r.file_path}
                      className="text-xs h-8 px-3 rounded-lg border border-border inline-flex items-center gap-1.5 hover:bg-accent/40"
                    >
                      <Download className="h-3.5 w-3.5" /> Bestand
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
