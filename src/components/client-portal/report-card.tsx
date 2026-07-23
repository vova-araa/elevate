import { useState } from "react";
import {
  FileBarChart,
  Download,
  FileDown,
  Sparkles,
  CalendarRange,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import {
  generateReportPdf,
  extractPlatformBreakdown,
  extractPostDetails,
  reportStatusLabel,
  type ReportRow,
} from "@/lib/report-pdf";
import { cn } from "@/lib/utils";

/** Vertaal veelvoorkomende metric-keys naar Nederlandse labels. */
const METRIC_LABELS: Record<string, string> = {
  followers: "Volgers",
  followers_growth: "Groei volgers",
  new_followers: "Nieuwe volgers",
  reach: "Bereik",
  impressions: "Weergaven",
  views: "Weergaven",
  engagement: "Interacties",
  engagement_rate: "Engagementratio",
  likes: "Likes",
  comments: "Reacties",
  shares: "Gedeeld",
  saves: "Opgeslagen",
  clicks: "Kliks",
  posts: "Posts",
  posts_published: "Gepubliceerde posts",
  profile_visits: "Profielbezoeken",
  website_clicks: "Websitekliks",
  stories: "Stories",
  reels: "Reels",
};

function metricLabel(key: string) {
  return (
    METRIC_LABELS[key.toLowerCase()] ?? key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
  );
}

function formatMetricValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString("nl-NL");
  if (typeof v === "boolean") return v ? "Ja" : "Nee";
  return String(v);
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });

function downloadReportPdf(report: Tables<"reports">) {
  const row: ReportRow = {
    title: report.title,
    report_type: report.report_type,
    period_start: report.period_start,
    period_end: report.period_end,
    summary: report.summary,
    highlights: report.highlights,
    created_at: report.created_at,
    metrics: report.metrics,
  };
  generateReportPdf(row, { fileName: `${report.title.replace(/\s+/g, "_")}.pdf` });
}

export function ReportCard({ report }: { report: Tables<"reports"> }) {
  const [postsOpen, setPostsOpen] = useState(false);
  const metrics =
    report.metrics && typeof report.metrics === "object" && !Array.isArray(report.metrics)
      ? Object.entries(report.metrics as Record<string, unknown>).filter(
          ([, v]) => v != null && typeof v !== "object",
        )
      : [];
  const platformRows = extractPlatformBreakdown(report.metrics);
  const postRows = extractPostDetails(report.metrics);

  const period =
    report.period_start && report.period_end
      ? `${fmtDate(report.period_start)} – ${fmtDate(report.period_end)}`
      : report.period_end
        ? fmtDate(report.period_end)
        : null;

  return (
    <div className="rounded-xl border border-gold/10 bg-card p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="rounded-lg bg-gold/10 border border-gold/30 p-2.5 w-fit shrink-0">
          <FileBarChart className="h-5 w-5 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-xl sm:text-2xl leading-tight break-words">
            {report.title}
          </h3>
          {period && (
            <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5 text-gold/70" />
              {period}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => downloadReportPdf(report)}
            className="min-h-11 rounded-lg bg-gold/15 text-gold hover:bg-gold/25 px-4 text-xs font-medium inline-flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
          >
            <FileDown className="h-3.5 w-3.5" /> Download PDF
          </button>
          {report.file_path && (
            <a
              href={report.file_path}
              target="_blank"
              rel="noreferrer"
              className="min-h-11 rounded-lg border border-gold/20 hover:bg-gold/10 px-4 text-xs font-medium inline-flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
            >
              <Download className="h-3.5 w-3.5" /> Bestand
            </a>
          )}
        </div>
      </div>

      {report.summary && (
        <p className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">{report.summary}</p>
      )}

      {report.highlights && (
        <div className="mt-4 rounded-xl border border-gold/20 bg-gold/5 p-3">
          <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gold">
            <Sparkles className="h-3.5 w-3.5" /> Highlights
          </div>
          <p className="mt-1.5 text-sm whitespace-pre-wrap">{report.highlights}</p>
        </div>
      )}

      {metrics.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {metrics.map(([key, value]) => (
            <div key={key} className="rounded-lg border border-border/40 bg-surface/40 p-3 min-w-0">
              <div
                className="text-[10px] uppercase tracking-wider text-muted-foreground truncate"
                title={metricLabel(key)}
              >
                {metricLabel(key)}
              </div>
              <div className="font-display text-lg sm:text-xl mt-0.5 break-words">
                {formatMetricValue(value)}
              </div>
            </div>
          ))}
        </div>
      )}

      {platformRows.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Per platform
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/40">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Platform</th>
                  <th className="px-3 py-2 text-right font-medium">Totaal</th>
                  <th className="px-3 py-2 text-right font-medium">Gepubliceerd</th>
                  <th className="px-3 py-2 text-right font-medium">Mislukt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {platformRows.map((p) => (
                  <tr key={p.platform}>
                    <td className="px-3 py-2">{p.label ?? p.platform}</td>
                    <td className="px-3 py-2 text-right">{p.total}</td>
                    <td className="px-3 py-2 text-right text-emerald-500">{p.published}</td>
                    <td className="px-3 py-2 text-right text-destructive">{p.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {postRows.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setPostsOpen((v) => !v)}
            className="flex w-full items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground mb-2"
          >
            <span>Per post ({postRows.length})</span>
            {postsOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {postsOpen && (
            <div className="max-h-80 overflow-y-auto rounded-lg border border-border/40 divide-y divide-border/40">
              {postRows.map((p, i) => (
                <div
                  key={`${p.platform}-${p.scheduled_at}-${i}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs"
                >
                  <span className="shrink-0 text-muted-foreground">
                    {p.scheduled_at ? fmtDate(p.scheduled_at) : "—"}
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
}
