import { FileBarChart, Download, Sparkles, CalendarRange } from "lucide-react";

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
  return METRIC_LABELS[key.toLowerCase()] ?? key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function formatMetricValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString("nl-NL");
  if (typeof v === "boolean") return v ? "Ja" : "Nee";
  return String(v);
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });

export function ReportCard({ report }: { report: any }) {
  const metrics =
    report.metrics && typeof report.metrics === "object" && !Array.isArray(report.metrics)
      ? Object.entries(report.metrics as Record<string, unknown>).filter(([, v]) => v != null && typeof v !== "object")
      : [];

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
          <h3 className="font-display text-xl sm:text-2xl leading-tight break-words">{report.title}</h3>
          {period && (
            <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5 text-gold/70" />
              {period}
            </div>
          )}
        </div>
        {report.file_path && (
          <a
            href={report.file_path}
            target="_blank"
            rel="noreferrer"
            className="min-h-11 rounded-lg bg-gold/15 text-gold hover:bg-gold/25 px-4 text-xs font-medium inline-flex items-center justify-center gap-1.5 shrink-0 w-full sm:w-auto"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        )}
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
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate" title={metricLabel(key)}>
                {metricLabel(key)}
              </div>
              <div className="font-display text-lg sm:text-xl mt-0.5 break-words">{formatMetricValue(value)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
