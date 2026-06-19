/**
 * Generate a custom analytics report PDF from the current filters and visible data.
 * Premium layout: header with optional logo, footer with page numbers, refined sections and tables.
 */
import jsPDF from 'jspdf';
import dayjs from 'dayjs';

const margin = 18;
const headerHeight = 22;
const footerHeight = 12;
const bodyTop = margin + headerHeight;
const bodyBottom = 297 - margin - footerHeight; // A4
const pageHeight = 297;
const pageWidth = 210;
const titleFontSize = 16;
const sectionFontSize = 11;
const cellFontSize = 9;
const smallFontSize = 8;

const colors = {
  primary: [37, 99, 235] as [number, number, number],
  primaryLight: [239, 246, 255] as [number, number, number],
  slate: [30, 41, 59] as [number, number, number],
  darkGray: [71, 85, 105] as [number, number, number],
  borderGray: [226, 232, 240] as [number, number, number],
  fillTint: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

function pct(value: number | null | undefined): string {
  return value != null && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—';
}

const chartImageWidth = pageWidth - margin * 2;
const chartImageHeight = 58;

/** Draw premium header with optional logo, title, and date. */
function drawHeader(pdf: jsPDF, logoDataUrl?: string): void {
  const y = 0;
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.rect(0, y, pageWidth, headerHeight, 'F');
  pdf.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.setLineWidth(0.5);
  pdf.line(0, headerHeight, pageWidth, headerHeight);

  let left = margin;
  if (logoDataUrl && typeof logoDataUrl === 'string') {
    const match = logoDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (match) {
      try {
        const format = match[1].toUpperCase() === 'JPEG' ? 'JPEG' : 'PNG';
        const logoH = 14;
        const logoW = Math.min(logoH * 2, 50);
        pdf.addImage(match[2], format, margin, 4, logoW, logoH);
        left = margin + logoW + 6;
      } catch {
        left = margin;
      }
    }
  }

  pdf.setFontSize(titleFontSize);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
  pdf.text('Analytics Report', left, 14);
  pdf.setFontSize(smallFontSize);
  pdf.setFont('helvetica', 'normal');
  pdf.text(dayjs().format('MMM DD, YYYY  ·  h:mm A'), pageWidth - margin, 14, { align: 'right' });
}

/** Draw footer with branding and page number. */
function drawFooter(pdf: jsPDF, pageNum: number, totalPages: number): void {
  const y = pageHeight - footerHeight + 2;
  pdf.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
  pdf.setLineWidth(0.3);
  pdf.line(margin, pageHeight - footerHeight, pageWidth - margin, pageHeight - footerHeight);
  pdf.setFontSize(smallFontSize);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
  pdf.text('EvalHero', margin, y + 4);
  pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, y + 4, { align: 'right' });
}

/** Parse data URL and add image to PDF; returns new y position. */
function addChartImage(
  pdf: jsPDF,
  dataUrl: string | undefined,
  y: number,
  title: string
): number {
  if (!dataUrl || typeof dataUrl !== 'string') return y;
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return y;
  const format = match[1].toUpperCase() === 'JPEG' ? 'JPEG' : 'PNG';
  const base64 = match[2];
  y = checkPageBreak(pdf, y, chartImageHeight + 16);
  y = drawSectionTitle(pdf, title, y);
  try {
    pdf.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
    pdf.setLineWidth(0.2);
    pdf.rect(margin, y, chartImageWidth, chartImageHeight, 'S');
    pdf.addImage(base64, format, margin, y, chartImageWidth, chartImageHeight);
    y += chartImageHeight + 10;
  } catch {
    // if image fails (e.g. too large), skip
  }
  return y;
}

function checkPageBreak(pdf: jsPDF, y: number, required: number): number {
  if (y + required > bodyBottom) {
    pdf.addPage();
    pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.rect(0, 0, pageWidth, headerHeight, 'F');
    pdf.setLineWidth(0.5);
    pdf.line(0, headerHeight, pageWidth, headerHeight);
    return bodyTop;
  }
  return y;
}

/** Premium section title: left accent bar + bold title. */
function drawSectionTitle(pdf: jsPDF, title: string, y: number): number {
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.rect(margin, y - 1, 3, 6, 'F');
  pdf.setFontSize(sectionFontSize);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.slate[0], colors.slate[1], colors.slate[2]);
  pdf.text(title, margin + 5, y + 3.5);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');
  return y + 10;
}

function drawTable(
  pdf: jsPDF,
  y: number,
  headers: string[],
  rows: string[][],
  colWidths: number[]
): number {
  const rowH = 7;
  const totalW = colWidths.reduce((a, b) => a + b, 0);

  y = checkPageBreak(pdf, y, rowH * (rows.length + 1) + 6);
  pdf.setFontSize(cellFontSize);
  pdf.setFont('helvetica', 'bold');
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.rect(margin, y - 2, totalW, rowH, 'F');
  pdf.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.setLineWidth(0.2);
  let x = margin;
  for (let i = 0; i < headers.length; i++) {
    pdf.rect(x, y - 2, colWidths[i], rowH, 'S');
    pdf.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    pdf.text(headers[i], x + 3, y + 4);
    x += colWidths[i];
  }
  y += rowH;

  const drawHeaderRow = (yy: number) => {
    pdf.setFontSize(cellFontSize);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.rect(margin, yy - 2, totalW, rowH, 'F');
    pdf.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    let xx = margin;
    for (let h = 0; h < headers.length; h++) {
      pdf.rect(xx, yy - 2, colWidths[h], rowH, 'S');
      pdf.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      pdf.text(headers[h], xx + 3, yy + 4);
      xx += colWidths[h];
    }
  };

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate[0], colors.slate[1], colors.slate[2]);
  for (let i = 0; i < rows.length; i++) {
    const prevY = y;
    y = checkPageBreak(pdf, y, rowH);
    if (y !== prevY) drawHeaderRow(y);
    y += y !== prevY ? rowH : 0;
    if (i % 2 === 1) {
      pdf.setFillColor(colors.fillTint[0], colors.fillTint[1], colors.fillTint[2]);
      pdf.rect(margin, y - 2, totalW, rowH, 'F');
    }
    pdf.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
    let x = margin;
    for (let j = 0; j < rows[i].length; j++) {
      pdf.rect(x, y - 2, colWidths[j], rowH, 'S');
      const text = String(rows[i][j] ?? '');
      const truncated = pdf.splitTextToSize(text, Math.max(colWidths[j] - 5, 5))[0] ?? '';
      pdf.text(truncated, x + 3, y + 4);
      x += colWidths[j];
    }
    y += rowH;
  }
  return y + 8;
}

export interface AnalyticsPdfInput {
  /** Filter summary text (e.g. "Templates: A, B • Subjects: 5 • Date: ... • Metric: Points %") */
  filterSummary: string;
  /** Current metric label for display */
  metricLabel: string;
  /** Current UI view: 'graphs' | 'tables' — PDF content matches this (Graphs = chart summaries; Tables = all tables). */
  view: 'graphs' | 'tables';
  /** Unused when view is tables (we print all tables); kept for API compatibility. */
  tableTab?: string;
  /** KPI values */
  kpis: {
    filteredSubmissions: number;
    totalSubmissions: number;
    avgMetric: string;
    subjectsCount: number;
    tagsCount: number;
    templatesCount: number;
  };
  /** Subject ranking (used in Graphs view; also for Tables view when tableTab === 'subjects') */
  leaderboardItems: Array<{ label: string; value: number | null; sub?: string }>;
  /** Tag performance (used in Graphs view; also for Tables when tableTab === 'tags') */
  tagLeaderboardItems: Array<{ label: string; value: number | null; submissions?: number }>;
  /** Template comparison (Graphs view; Tables when tableTab === 'templates') */
  templateItems: Array<{ label: string; value: number | null; submissions: number }>;
  /** Assignee scoring (Graphs view when showAssignee; Tables when tableTab === 'assignees') */
  assigneeItems?: Array<{ label: string; value: number | null; submissions: number; deviation?: number | null }>;
  /** Full subject table for Tables view — subjects tab (subject, score, submissions, baselineDelta) */
  subjectTableRows?: Array<{ subject: string; score: string; submissions: number; baselineDelta: string }>;
  /** Full tag table for Tables view — tags tab (tag, score, submissions, gapPts) */
  tagTableRows?: Array<{ tag: string; score: string; submissions: number; gapPts?: number }>;
  /** Submissions table for Tables view — submissions tab */
  submissionRows?: Array<{
    templateName: string;
    subjectDisplay: string;
    assigneeDisplay: string;
    metricValue: string;
    finalizedAt: string;
  }>;
  /** When view is 'graphs': optional chart images (data URLs from chart.toDataURL()) to embed instead of tables */
  chartImages?: {
    timeline?: string;
    subjectRanking?: string;
    tagPerformance?: string;
    templateComparison?: string;
    assigneeScoring?: string;
  };
  /** Optional logo as data URL (e.g. from /logo.png) for premium header */
  logoDataUrl?: string;
}

/**
 * Generate analytics report PDF and return as ArrayBuffer.
 */
export function generateAnalyticsPdf(input: AnalyticsPdfInput): ArrayBuffer {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  drawHeader(pdf, input.logoDataUrl);
  let y = bodyTop;

  // Subtitle and view context
  const viewLabel = input.view === 'graphs' ? 'Graphs' : 'Tables';
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.slate[0], colors.slate[1], colors.slate[2]);
  pdf.text(`EvalHero  ·  ${viewLabel} view`, margin, y);
  y += 6;
  pdf.setFontSize(cellFontSize);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
  const fullSummary = input.filterSummary;
  const summaryLines = pdf.splitTextToSize(fullSummary, pageWidth - margin * 2);
  for (const line of summaryLines) {
    y = checkPageBreak(pdf, y, 5);
    pdf.text(line, margin, y);
    y += 5;
  }
  y += 6;

  // KPIs
  y = drawSectionTitle(pdf, 'Summary', y);
  pdf.setFontSize(cellFontSize);
  pdf.setTextColor(colors.slate[0], colors.slate[1], colors.slate[2]);
  pdf.text(`Submissions in scope: ${input.kpis.filteredSubmissions} / ${input.kpis.totalSubmissions}`, margin, y);
  y += 6;
  pdf.text(`Avg ${input.metricLabel}: ${input.kpis.avgMetric}`, margin, y);
  y += 6;
  pdf.text(`Subjects: ${input.kpis.subjectsCount}  ·  Tags: ${input.kpis.tagsCount}  ·  Templates: ${input.kpis.templatesCount}`, margin, y);
  y += 12;

  if (input.view === 'graphs') {
    // Graphs view: only embed chart images — no tables (tables are for Tables view only)
    const imgs = input.chartImages;
    if (imgs?.timeline) {
      y = addChartImage(pdf, imgs.timeline, y, 'Growth timeline');
    }
    if (imgs?.subjectRanking) {
      y = addChartImage(pdf, imgs.subjectRanking, y, 'Subject ranking');
    }
    if (imgs?.tagPerformance) {
      y = addChartImage(pdf, imgs.tagPerformance, y, 'Tag performance');
    }
    if (imgs?.templateComparison) {
      y = addChartImage(pdf, imgs.templateComparison, y, 'Template comparison');
    }
    if (imgs?.assigneeScoring) {
      y = addChartImage(pdf, imgs.assigneeScoring, y, 'Assignee scoring');
    }
  } else {
    // Tables view: print all tables (Submissions, Subjects, Tags, Templates, Assignees)
    if (input.submissionRows && input.submissionRows.length > 0) {
      y = drawSectionTitle(pdf, 'Submissions', y);
      const headers = ['Template', 'Subject', input.metricLabel, 'Finalized'];
      const colWidths = [50, 50, 35, 45];
      const rows = input.submissionRows.slice(0, 50).map((r) => [
        r.templateName,
        r.subjectDisplay,
        r.metricValue,
        r.finalizedAt,
      ]);
      y = drawTable(pdf, y, headers, rows, colWidths);
      if (input.submissionRows.length > 50) {
        pdf.setFontSize(8);
        pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
        pdf.text(`(Showing first 50 of ${input.submissionRows.length} submissions)`, margin, y);
        y += 6;
      }
    }
    if (input.subjectTableRows && input.subjectTableRows.length > 0) {
      y = drawSectionTitle(pdf, 'Subjects', y);
      const headers = ['Subject', input.metricLabel, 'Submissions', 'Baseline Δ'];
      const colWidths = [90, 40, 35, 35];
      const rows = input.subjectTableRows.map((r) => [r.subject, r.score, String(r.submissions), r.baselineDelta]);
      y = drawTable(pdf, y, headers, rows, colWidths);
    }
    if (input.tagTableRows && input.tagTableRows.length > 0) {
      y = drawSectionTitle(pdf, 'Tags', y);
      const headers = ['Tag', input.metricLabel, 'Submissions', 'Gap pts'];
      const colWidths = [90, 40, 35, 35];
      const rows = input.tagTableRows.map((r) => [r.tag, r.score, String(r.submissions), String(r.gapPts ?? '')]);
      y = drawTable(pdf, y, headers, rows, colWidths);
    }
    if (input.templateItems.length > 0) {
      y = drawSectionTitle(pdf, 'Templates', y);
      const headers = ['Template', input.metricLabel, 'Submissions'];
      const colWidths = [110, 45, 35];
      const rows = input.templateItems.map((r) => [r.label, pct(r.value), String(r.submissions)]);
      y = drawTable(pdf, y, headers, rows, colWidths);
    }
    if (input.assigneeItems && input.assigneeItems.length > 0) {
      y = drawSectionTitle(pdf, 'Assignees', y);
      const headers = ['Assignee', input.metricLabel, 'Δ vs avg', 'Submissions'];
      const colWidths = [80, 40, 40, 30];
      const rows = input.assigneeItems.map((r) => [
        r.label,
        pct(r.value),
        r.deviation != null ? (r.deviation >= 0 ? `+${(r.deviation * 100).toFixed(1)}%` : `${(r.deviation * 100).toFixed(1)}%`) : '—',
        String(r.submissions),
      ]);
      y = drawTable(pdf, y, headers, rows, colWidths);
    }
  }

  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    drawFooter(pdf, p, totalPages);
  }

  return pdf.output('arraybuffer') as ArrayBuffer;
}

/**
 * Generate analytics PDF and trigger download.
 */
export function downloadAnalyticsPdf(input: AnalyticsPdfInput, filename?: string): void {
  const buffer = generateAnalyticsPdf(input);
  const name = filename ?? `analytics-report-${dayjs().format('YYYY-MM-DD-HHmm')}.pdf`;
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.endsWith('.pdf') ? name : `${name}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
