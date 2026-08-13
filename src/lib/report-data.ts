/**
 * Pure rapport-helpers zónder jsPDF-afhankelijkheid.
 *
 * Deze functies worden tijdens het renderen gebruikt (tabellen, labels), terwijl
 * het genereren van de PDF alleen bij een klik nodig is. Door ze te scheiden
 * blijft de zware jspdf-bundel (~126 kB gzip) uit de eerste paginalading en
 * wordt hij pas dynamisch geladen wanneer iemand daadwerkelijk exporteert.
 */

export type ReportRow = {
  title: string;
  report_type: string;
  period_start: string | null;
  period_end: string | null;
  summary: string | null;
  highlights: string | null;
  created_at?: string;
  /** JSON-object met key/waarde-cijfers (bv. reach, engagement, instagram_posts, ...). */
  metrics?: unknown;
};

/** Optionele huisstijl/klant-branding voor een gegenereerde PDF. */
export interface ReportPdfBrand {
  clientName?: string;
  /** Hex-kleur, bv. "#D4B97A". Valt terug op het Elevate-goud. */
  brandColor?: string;
  /** data:image/png;base64,... of data:image/jpeg;base64,... */
  logoDataUrl?: string;
}

export interface ReportPdfOptions extends ReportPdfBrand {
  /** Bestandsnaam zonder pad. Standaard afgeleid van de titel. */
  fileName?: string;
  /** Standaard true: roept doc.save(...) aan. Zet op false om alleen het document terug te krijgen. */
  download?: boolean;
}

export interface ReportPlatformRow {
  platform: string;
  label?: string;
  total: number;
  published: number;
  failed: number;
  scheduled?: number;
  draft?: number;
}

export interface ReportPostRow {
  platform: string;
  label?: string;
  scheduled_at: string;
  published_at?: string | null;
  status: string;
  caption_summary?: string | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/** Haalt `metrics.per_platform` op en valideert elk item; onbruikbare/oude data → []. */
export function extractPlatformBreakdown(metrics: unknown): ReportPlatformRow[] {
  if (!isRecord(metrics) || !Array.isArray(metrics.per_platform)) return [];
  return metrics.per_platform.filter(isRecord).map((r) => ({
    platform: typeof r.platform === "string" ? r.platform : "onbekend",
    label: typeof r.label === "string" ? r.label : undefined,
    total: typeof r.total === "number" ? r.total : 0,
    published: typeof r.published === "number" ? r.published : 0,
    failed: typeof r.failed === "number" ? r.failed : 0,
    scheduled: typeof r.scheduled === "number" ? r.scheduled : undefined,
    draft: typeof r.draft === "number" ? r.draft : undefined,
  }));
}

/** Haalt `metrics.posts_detail` op en valideert elk item; onbruikbare/oude data → []. */
export function extractPostDetails(metrics: unknown): ReportPostRow[] {
  if (!isRecord(metrics) || !Array.isArray(metrics.posts_detail)) return [];
  return metrics.posts_detail
    .filter(isRecord)
    .map((r) => ({
      platform: typeof r.platform === "string" ? r.platform : "onbekend",
      label: typeof r.label === "string" ? r.label : undefined,
      scheduled_at: typeof r.scheduled_at === "string" ? r.scheduled_at : "",
      published_at: typeof r.published_at === "string" ? r.published_at : null,
      status: typeof r.status === "string" ? r.status : "onbekend",
      caption_summary: typeof r.caption_summary === "string" ? r.caption_summary : null,
    }))
    .filter((r) => r.scheduled_at !== "");
}

const STATUS_LABELS: Record<string, string> = {
  published: "Gepubliceerd",
  failed: "Mislukt",
  scheduled: "Gepland",
  draft: "Concept",
  publishing: "Wordt gepubliceerd",
};

/** Nederlands label voor een scheduled_posts-status (bv. "published" → "Gepubliceerd"). */
export function reportStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

// ── Lazy PDF-toegang ────────────────────────────────────────────────────────
// Wrappers die jspdf pas ophalen op het moment van exporteren.

export async function exportReportPdfLazy(clientName: string, r: ReportRow): Promise<void> {
  const { exportReportPdf } = await import("./report-pdf");
  exportReportPdf(clientName, r);
}

export async function exportAllReportsPdfLazy(
  clientName: string,
  reports: ReportRow[],
): Promise<void> {
  const { exportAllReportsPdf } = await import("./report-pdf");
  exportAllReportsPdf(clientName, reports);
}

export async function generateReportPdfLazy(
  report: ReportRow,
  opts: ReportPdfOptions = {},
): Promise<void> {
  const { generateReportPdf } = await import("./report-pdf");
  generateReportPdf(report, opts);
}
