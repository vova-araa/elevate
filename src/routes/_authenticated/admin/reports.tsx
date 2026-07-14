import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientStore } from "@/lib/stores/client-store";
import { useState } from "react";
import { Download, FileBarChart, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/reports")({ component: ReportsPage });

function ReportsPage() {
  const { activeClient } = useClientStore();
  const [period, setPeriod] = useState("30");
  const [busy, setBusy] = useState(false);

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

  async function generate() {
    if (!activeClient) return toast.error("Selecteer een klant");
    setBusy(true);
    try {
      const from = new Date(Date.now() - Number(period) * 86400000).toISOString().slice(0, 10);
      const to = new Date().toISOString().slice(0, 10);
      const days = Number(period);
      const report_type: "monthly" | "analytics" = days <= 31 ? "monthly" : "analytics";
      const { error } = await supabase.from("reports").insert({
        client_id: activeClient.id,
        title: `Rapport ${activeClient.name} — ${from} t/m ${to}`,
        period_start: from,
        period_end: to,
        report_type,
      });
      if (error) throw error;
      toast.success("Rapport aangemaakt");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Mislukt");
    } finally {
      setBusy(false);
    }
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
          onClick={generate}
          disabled={busy}
          className="w-full h-10 rounded-lg bg-gold text-primary-foreground font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileBarChart className="h-4 w-4" />
          )}
          Rapport genereren
        </button>
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
              <div key={r.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.period_start ? new Date(r.period_start).toLocaleDateString("nl-NL") : "—"} –{" "}
                    {r.period_end ? new Date(r.period_end).toLocaleDateString("nl-NL") : "—"}
                    <span className="uppercase ml-2">{r.report_type}</span>
                  </div>
                </div>
                {r.file_path ? (
                  <a
                    href={r.file_path}
                    className="text-xs h-8 px-3 rounded-lg bg-gold/15 text-gold inline-flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">Geen bestand</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
