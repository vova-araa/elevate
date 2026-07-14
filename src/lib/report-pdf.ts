import jsPDF from "jspdf";

export type ReportRow = {
  title: string;
  report_type: string;
  period_start: string | null;
  period_end: string | null;
  summary: string | null;
  highlights: string | null;
  created_at?: string;
};

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("nl-NL") : "—");

function addWrapped(doc: jsPDF, text: string, x: number, y: number, maxW: number, lh = 5): number {
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines, x, y);
  return y + lines.length * lh;
}

function ensureSpace(doc: jsPDF, y: number, need = 20): number {
  const ph = doc.internal.pageSize.getHeight();
  if (y + need > ph - 15) {
    doc.addPage();
    return 20;
  }
  return y;
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

  doc.setDrawColor(220);
  doc.line(marginX, y + 2, marginX + contentW, y + 2);
  return y + 10;
}

function header(
  doc: jsPDF,
  clientName: string,
  subtitle: string,
  marginX: number,
  contentW: number,
): number {
  doc.setFillColor(212, 185, 122);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, "F");
  doc.setTextColor(20).setFont("helvetica", "bold").setFontSize(16);
  doc.text(clientName, marginX, 14);
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(subtitle, marginX, 19);
  doc.setTextColor(0);
  return 32;
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
  doc.save(`${clientName.replace(/\s+/g, "_")}-rapportages.pdf`);
}
