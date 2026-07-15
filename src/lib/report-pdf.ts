import jsPDF from "jspdf";

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
  /** Standaard true: roept doc.save(...) aan. Zet op false om alleen het jsPDF-document terug te krijgen. */
  download?: boolean;
}

const DEFAULT_BRAND_RGB: [number, number, number] = [212, 185, 122];

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("nl-NL") : "—");

/** Vertaal veelvoorkomende metric-keys naar Nederlandse labels — spiegelt report-card.tsx. */
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
  posts_failed: "Mislukte posts",
  success_rate: "Succesratio",
  profile_visits: "Profielbezoeken",
  website_clicks: "Websitekliks",
  stories: "Stories",
  reels: "Reels",
};

function metricLabel(key: string): string {
  return (
    METRIC_LABELS[key.toLowerCase()] ?? key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
  );
}

function metricValueText(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString("nl-NL");
  if (typeof v === "boolean") return v ? "Ja" : "Nee";
  return String(v);
}

function extractMetricEntries(metrics: unknown): [string, unknown][] {
  if (metrics && typeof metrics === "object" && !Array.isArray(metrics)) {
    return Object.entries(metrics as Record<string, unknown>).filter(
      ([, v]) => v != null && typeof v !== "object",
    );
  }
  return [];
}

function hexToRgb(hex?: string): [number, number, number] {
  if (!hex) return DEFAULT_BRAND_RGB;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return DEFAULT_BRAND_RGB;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function addWrapped(doc: jsPDF, text: string, x: number, y: number, maxW: number, lh = 5): number {
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines, x, y);
  return y + lines.length * lh;
}

function ensureSpace(doc: jsPDF, y: number, need = 20): number {
  const ph = doc.internal.pageSize.getHeight();
  if (y + need > ph - 18) {
    doc.addPage();
    return 20;
  }
  return y;
}

function addLogoIfPresent(doc: jsPDF, dataUrl: string | undefined, pageW: number) {
  if (!dataUrl) return;
  const m = /^data:image\/(png|jpe?g);base64,/i.exec(dataUrl);
  if (!m) return;
  const format = m[1].toLowerCase().startsWith("jp") ? "JPEG" : "PNG";
  try {
    doc.addImage(dataUrl, format, pageW - 15 - 18, 3, 18, 18);
  } catch {
    // Ongeldige/onbruikbare afbeeldingsdata — logo overslaan i.p.v. de PDF te breken.
  }
}

/** Huisstijl-header: "Elevate Social", klantnaam/titel, periode en een dunne gouden scheidingslijn. */
function header(
  doc: jsPDF,
  clientName: string,
  subtitle: string,
  marginX: number,
  contentW: number,
  brand: ReportPdfBrand = {},
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const [r, g, b] = hexToRgb(brand.brandColor);

  doc.setFillColor(r, g, b);
  doc.rect(0, 0, pageW, 24, "F");

  doc.setTextColor(30).setFont("helvetica", "bold").setFontSize(8);
  doc.text("ELEVATE SOCIAL", marginX, 7);

  doc.setFont("helvetica", "bold").setFontSize(15);
  doc.text(clientName, marginX, 15);

  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(subtitle, marginX, 20.5);

  addLogoIfPresent(doc, brand.logoDataUrl, pageW);

  doc.setTextColor(0);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.6);
  doc.line(marginX, 27.5, marginX + contentW, 27.5);
  doc.setLineWidth(0.2);
  doc.setDrawColor(0);

  return 34;
}

/** Voetregel met paginanummers op elke pagina van het document. */
function drawFooters(doc: jsPDF, marginX: number, contentW: number) {
  const pageCount = doc.getNumberOfPages();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(225).setLineWidth(0.2);
    doc.line(marginX, pageH - 12, marginX + contentW, pageH - 12);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(140);
    doc.text("Elevate Social", marginX, pageH - 7);
    doc.text(`Pagina ${i} / ${pageCount}`, marginX + contentW, pageH - 7, { align: "right" });
    doc.setTextColor(0);
  }
}

/** Nette key/waarde-tabel voor de metrics van een rapport (2 kolommen, alternerende achtergrond). */
function drawMetricsTable(
  doc: jsPDF,
  entries: [string, unknown][],
  y: number,
  marginX: number,
  contentW: number,
): number {
  if (entries.length === 0) return y;
  y = ensureSpace(doc, y, 20);

  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("Kerncijfers", marginX, y);
  y += 5;

  const cols = 2;
  const colW = contentW / cols;
  const rowH = 9;
  const rows = Math.ceil(entries.length / cols);

  for (let row = 0; row < rows; row++) {
    y = ensureSpace(doc, y, rowH + 2);
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (idx >= entries.length) continue;
      const [key, value] = entries[idx];
      const x = marginX + col * colW;

      doc.setFillColor(248, 244, 234);
      doc.rect(x, y - 5.5, colW - 3, rowH - 1.5, "F");

      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120);
      doc.text(metricLabel(key), x + 2.5, y - 1.5);

      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(25);
      doc.text(metricValueText(value), x + 2.5, y + 3);
      doc.setTextColor(0);
    }
    y += rowH;
  }
  return y + 5;
}

const BAR_METRIC_KEYS = [
  "reach",
  "impressions",
  "views",
  "engagement",
  "likes",
  "comments",
  "shares",
  "clicks",
];

/** Eenvoudige horizontale bar-visualisatie voor een handvol kern-metrics, puur met rect/setFillColor. */
function drawMetricsBars(
  doc: jsPDF,
  entries: [string, unknown][],
  y: number,
  marginX: number,
  contentW: number,
  brandRgb: [number, number, number],
): number {
  const seen = new Set<string>();
  const picked: [string, number][] = [];
  for (const [key, value] of entries) {
    if (typeof value !== "number" || value <= 0) continue;
    const lower = key.toLowerCase();
    if (!BAR_METRIC_KEYS.includes(lower)) continue;
    const norm = lower === "impressions" ? "views" : lower;
    if (seen.has(norm)) continue;
    seen.add(norm);
    picked.push([key, value]);
    if (picked.length >= 5) break;
  }
  if (picked.length === 0) return y;

  y = ensureSpace(doc, y, 12 + picked.length * 8);
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("Overzicht", marginX, y);
  y += 6;

  const max = Math.max(...picked.map(([, v]) => v));
  const labelW = 38;
  const valueW = 24;
  const barMaxW = contentW - labelW - valueW;

  for (const [key, value] of picked) {
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(70);
    doc.text(metricLabel(key), marginX, y + 3.2);

    doc.setFillColor(238, 231, 214);
    doc.rect(marginX + labelW, y - 1, barMaxW, 5, "F");

    const w = Math.max((value / max) * barMaxW, 2);
    doc.setFillColor(brandRgb[0], brandRgb[1], brandRgb[2]);
    doc.rect(marginX + labelW, y - 1, w, 5, "F");

    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(25);
    doc.text(value.toLocaleString("nl-NL"), marginX + labelW + barMaxW + 2, y + 3.2);
    doc.setTextColor(0);
    y += 8;
  }
  return y + 4;
}

function drawReport(
  doc: jsPDF,
  r: ReportRow,
  startY: number,
  marginX: number,
  contentW: number,
): number {
  let y = startY;
  y = ensureSpace(doc, y, 30);

  doc.setFont("helvetica", "bold").setFontSize(14);
  y = addWrapped(doc, r.title, marginX, y, contentW, 6);
  y += 1;

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(120);
  doc.text(
    `${r.report_type.toUpperCase()}  •  ${fmt(r.period_start)} → ${fmt(r.period_end)}`,
    marginX,
    y,
  );
  y += 6;
  doc.setTextColor(0);

  if (r.summary) {
    y = ensureSpace(doc, y, 20);
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.text("Samenvatting", marginX, y);
    y += 5;
    doc.setFont("helvetica", "normal").setFontSize(10);
    y = addWrapped(doc, r.summary, marginX, y, contentW, 5);
    y += 3;
  }
  if (r.highlights) {
    y = ensureSpace(doc, y, 20);
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.text("Highlights", marginX, y);
    y += 5;
    doc.setFont("helvetica", "normal").setFontSize(10);
    y = addWrapped(doc, r.highlights, marginX, y, contentW, 5);
    y += 3;
  }

  const metricsEntries = extractMetricEntries(r.metrics);
  if (metricsEntries.length > 0) {
    y = drawMetricsTable(doc, metricsEntries, y, marginX, contentW);
  }

  doc.setDrawColor(220);
  doc.line(marginX, y + 2, marginX + contentW, y + 2);
  return y + 10;
}

export function exportReportPdf(clientName: string, r: ReportRow) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 15;
  const contentW = doc.internal.pageSize.getWidth() - marginX * 2;
  const y = header(
    doc,
    clientName,
    `Rapportage • ${fmt(r.period_start)} → ${fmt(r.period_end)}`,
    marginX,
    contentW,
  );
  drawReport(doc, r, y, marginX, contentW);
  drawFooters(doc, marginX, contentW);
  doc.save(`${clientName.replace(/\s+/g, "_")}-${r.title.replace(/\s+/g, "_")}.pdf`);
}

export function exportAllReportsPdf(clientName: string, reports: ReportRow[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 15;
  const contentW = doc.internal.pageSize.getWidth() - marginX * 2;
  let y = header(
    doc,
    clientName,
    `Alle rapportages (${reports.length}) • ${new Date().toLocaleDateString("nl-NL")}`,
    marginX,
    contentW,
  );
  for (const r of reports) {
    y = drawReport(doc, r, y, marginX, contentW);
  }
  drawFooters(doc, marginX, contentW);
  doc.save(`${clientName.replace(/\s+/g, "_")}-rapportages.pdf`);
}

/**
 * Genereert een volledig gestileerde PDF voor één rapport: huisstijl-header met
 * (optionele) klantbranding, een bar-visualisatie en tabel van de kern-metrics,
 * de bestaande samenvatting/highlights-sectie en paginavoetregels.
 *
 * Downloadt de PDF standaard (`doc.save`, opts.download = false om dit te onderdrukken)
 * en geeft altijd het jsPDF-document terug (bv. voor `doc.output("blob")`).
 */
export function generateReportPdf(report: ReportRow, opts: ReportPdfOptions = {}): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 15;
  const contentW = doc.internal.pageSize.getWidth() - marginX * 2;
  const brandRgb = hexToRgb(opts.brandColor);

  const headerName = opts.clientName ?? "Rapportage";
  const headerSubtitle = opts.clientName
    ? `${report.title} • ${fmt(report.period_start)} → ${fmt(report.period_end)}`
    : `${report.report_type.toUpperCase()} • ${fmt(report.period_start)} → ${fmt(report.period_end)}`;

  let y = header(doc, headerName, headerSubtitle, marginX, contentW, opts);

  const metricsEntries = extractMetricEntries(report.metrics);
  y = drawMetricsBars(doc, metricsEntries, y, marginX, contentW, brandRgb);

  drawReport(doc, report, y, marginX, contentW);

  drawFooters(doc, marginX, contentW);

  if (opts.download !== false) {
    const fileName = opts.fileName ?? `${report.title.replace(/\s+/g, "_")}.pdf`;
    doc.save(fileName);
  }

  return doc;
}
