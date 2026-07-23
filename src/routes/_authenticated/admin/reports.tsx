import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useClientStore } from "@/lib/stores/client-store";
import { useState } from "react";
import { ChevronDown, ChevronUp, Download, FileBarChart, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createReportFromAnalytics } from "@/lib/report-generate.functions";
import {
  generateReportPdf,
  extractPlatformBreakdown,
  extractPostDetails,
  reportStatusLabel,
  type ReportRow,
} from "@/lib/report-pdf";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/reports")({ component: ReportsPage });

function ReportsPage() {
  const { activeClient } = useClientStore();
  const [period, setPeriod] = useState("30");
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
            {history!.map((r) => {
              const platformRows = extractPlatformBreakdown(r.metrics);
              const postRows = extractPostDetails(r.metrics);
              const hasDetail = platformRows.length > 0 || postRows.length > 0;
              const expanded = expandedId === r.id;
              return (
                <div key={r.id} className="py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.period_start
                          ? new Date(r.period_start).toLocaleDateString("nl-NL")
                          : "—"}{" "}
                        – {r.period_end ? new Date(r.period_end).toLocaleDateString("nl-NL") : "—"}
                        <span className="uppercase ml-2">{r.report_type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {hasDetail && (
                        <button
                          onClick={() => setExpandedId(expanded ? null : r.id)}
                          className="text-xs h-8 px-3 rounded-lg border border-border inline-flex items-center gap-1.5 hover:bg-accent/40"
                        >
                          {expanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                          Detail
                        </button>
                      )}
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

                  {expanded && hasDetail && (
                    <div className="mt-3 space-y-3">
                      {platformRows.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-border/60">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-accent/20 text-[10px] uppercase tracking-wider text-muted-foreground">
                                <th className="px-3 py-1.5 text-left font-medium">Platform</th>
                                <th className="px-3 py-1.5 text-right font-medium">Totaal</th>
                                <th className="px-3 py-1.5 text-right font-medium">Gepubliceerd</th>
                                <th className="px-3 py-1.5 text-right font-medium">Mislukt</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {platformRows.map((p) => (
                                <tr key={p.platform}>
                                  <td className="px-3 py-1.5">{p.label ?? p.platform}</td>
                                  <td className="px-3 py-1.5 text-right">{p.total}</td>
                                  <td className="px-3 py-1.5 text-right text-emerald-500">
                                    {p.published}
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-destructive">
                                    {p.failed}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {postRows.length > 0 && (
                        <div className="max-h-64 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/60">
                          {postRows.map((p, i) => (
                            <div
                              key={`${p.platform}-${p.scheduled_at}-${i}`}
                              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-xs"
                            >
                              <span className="shrink-0 text-muted-foreground">
                                {p.scheduled_at
                                  ? new Date(p.scheduled_at).toLocaleDateString("nl-NL")
                                  : "—"}
                              </span>
                              <span className="shrink-0 rounded-full bg-gold/10 px-2 py-0.5 text-gold">
                                {p.label ?? p.platform}
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-2 py-0.5",
                                  p.status === "published" && "bg-emerald-500/10 text-emerald-500",
                                  p.status === "failed" && "bg-destructive/10 text-destructive",
                                  p.status === "scheduled" && "bg-gold/10 text-gold",
                                  p.status === "draft" && "bg-muted/30 text-muted-foreground",
                                )}
                              >
                                {reportStatusLabel(p.status)}
                              </span>
                              {p.caption_summary && (
                                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                  {p.caption_summary}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
