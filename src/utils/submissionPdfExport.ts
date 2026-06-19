import jsPDF from 'jspdf';
import dayjs from 'dayjs';
import { JSONContent } from '@tiptap/core';
import { extractFieldRows, type FieldRow } from '../pages/forms/QueuesComponents/submissionUtils';

const margin = 18;
const lineHeight = 5.5;
const sectionGap = 10;
const labelFontSize = 9;
const valueFontSize = 10;
const titleFontSize = 13;
const headerHeight = 52;
const sectionHeaderBarHeight = 6;

const colors = {
  primary: [59, 130, 246] as [number, number, number],
  primaryDark: [37, 99, 235] as [number, number, number],
  primaryLight: [147, 197, 253] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  error: [239, 68, 68] as [number, number, number],
  warning: [251, 146, 60] as [number, number, number],
  darkGray: [75, 85, 99] as [number, number, number],
  borderGray: [229, 231, 235] as [number, number, number],
  fillTint: [248, 250, 252] as [number, number, number],
  accent: [99, 102, 241] as [number, number, number], // indigo accent for marks
};

export interface ApprovalMessageForPdf {
  action: string;
  comment?: string;
  text?: string;
  sentBy?: { user?: { name?: string } };
  createdAt?: string;
}

export interface DisputeMessageForPdf {
  action: string;
  text?: string;
  comment?: string;
  signature?: { dataUrl?: string };
  sentBy?: { user?: { name?: string } };
  createdAt?: string;
}

export interface PreApprovalForPdf {
  preApproved?: boolean;
  preApprovalComment?: string;
}

export interface SubmissionPdfExportInput {
  submission: {
    _id?: string;
    status?: string;
    approvalStatus?: string;
    answers?: JSONContent;
    assignee?: { user?: { name?: string }; _id?: string };
    subject?: { user?: { name?: string }; _id?: string };
    updatedAt?: string;
    createdAt?: string;
    fieldMetadata?: { type?: { submittedAt?: string } };
    [key: string]: unknown;
  };
  assignment?: {
    hasApproval?: boolean;
    hasDisputes?: boolean;
    signatureRequired?: boolean;
    passingScore?: number;
    passingPassFailCount?: number;
    submitMeta?: {
      preApprovalByAssignee?: Record<
        string,
        {
          preApprovalByQuestion?: Record<
            string,
            {
              globalGroups?: Array<{
                subjectIds?: string[];
                preApproved?: boolean;
                preApprovalComment?: string;
              }>;
              ungroupedSubjects?: Array<{
                preApproved?: boolean;
                preApprovalComment?: string;
              }>;
            }
          >;
        }
      >;
    };
    formTemplateSchema?: {
      totalScore?: number;
      totalPassFail?: number;
    };
    [key: string]: unknown;
  };
  approvalMessages?: ApprovalMessageForPdf[];
  disputeMessages?: DisputeMessageForPdf[];
  preApproval?: PreApprovalForPdf;
  subjectId?: string;
  assigneeId?: string;
  /** Template (assignment form) name for the PDF header */
  templateName?: string;
  /** When false, dispute text messages are omitted; signature is always shown under submission details */
  includeDisputeMessaging?: boolean;
  /** Logo image URL (e.g. /logo-no-background.png). Optional. */
  logoUrl?: string;
  /** Overall submission result. When not provided, computed from graded answers (pass/fail/critical_fail or blank). */
  submissionResult?: 'pass' | 'fail' | 'critical_fail' | '';
}

/**
 * Format a FieldRow value to plain text for PDF (no signature image - those are embedded separately).
 */
function formatFieldRowValueForPdf(row: FieldRow): { text: string; isSignature?: boolean; imageDataUrl?: string } {
  const { value, type, addressComponents, rawDateValue, options, otherValue } = row;

  if (type === 'signatureField') {
    const valueStr = typeof value === 'string' ? value : '';
    const hasImage = valueStr.startsWith('data:') || valueStr.startsWith('http://') || valueStr.startsWith('https://');
    return {
      text: hasImage ? '[Signature below]' : '[No signature]',
      isSignature: hasImage,
      imageDataUrl: hasImage ? valueStr : undefined,
    };
  }

  if (value === null || value === undefined || value === '') {
    return { text: '—' };
  }

  if (type === 'singleChoice' && options) {
    const opt = options.find((o) => o.selected || o.value === value);
    if (opt) {
      if (opt.value === '__other__' && otherValue) return { text: `${opt.label}: ${otherValue}` };
      return { text: opt.label ?? String(value) };
    }
  }

  if (type === 'multipleChoice' && options) {
    const selected = options.filter((o) => o.selected || (Array.isArray(value) && value.includes(o.value)));
    if (selected.length === 0) return { text: '—' };
    const parts = selected.map((o) => (o.value === '__other__' && otherValue ? `${o.label}: ${otherValue}` : o.label));
    return { text: parts.join(', ') };
  }

  if ((type === 'addressNode' || type === 'addressField') && addressComponents) {
    const c = addressComponents;
    const parts = [
      c.street,
      c.apartment,
      [c.city, c.state, c.postalCode].filter(Boolean).join(', '),
      c.country,
    ].filter(Boolean);
    return { text: c.formatted?.trim() || parts.join(', ') || '—' };
  }

  if ((type === 'dateField' || type === 'dateTimeField') && (rawDateValue || value)) {
    const raw = rawDateValue || value;
    try {
      const d = new Date(String(raw));
      if (!isNaN(d.getTime())) {
        const formatted =
          type === 'dateTimeField'
            ? dayjs(d).format('MMM D, YYYY h:mm A')
            : dayjs(d).format('MMM D, YYYY');
        return { text: formatted };
      }
    } catch {
      // ignore
    }
  }

  if (Array.isArray(value)) {
    if (type === 'ranking') {
      return { text: value.map((v, i) => `${i + 1}. ${v}`).join('\n') };
    }
    return { text: value.map(String).join(', ') };
  }

  if (typeof value === 'object' && value !== null) {
    return { text: JSON.stringify(value) };
  }

  return { text: String(value).trim() || '—' };
}

/**
 * Split long text into lines that fit within maxWidth (mm). Returns approximate height in mm.
 */
function wrapText(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number
): number {
  const lines = pdf.splitTextToSize(text, maxWidth);
  pdf.setFontSize(fontSize);
  pdf.text(lines, x, y);
  return y + lines.length * (lineHeight + 1);
}

function checkPageBreak(pdf: jsPDF, y: number, required: number, pageHeight: number): number {
  if (y + required > pageHeight - margin - 10) {
    pdf.addPage();
    return margin;
  }
  return y;
}

/** Draw a modern section title with optional light background bar. Returns new y. */
function drawSectionTitle(
  pdf: jsPDF,
  title: string,
  y: number,
  pageWidth: number,
  marginLeft: number
): number {
  pdf.setFillColor(colors.fillTint[0], colors.fillTint[1], colors.fillTint[2]);
  pdf.rect(0, y - 2, pageWidth, sectionHeaderBarHeight + 4, 'F');
  pdf.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
  pdf.setLineWidth(0.3);
  pdf.line(marginLeft, y + sectionHeaderBarHeight + 2, pageWidth - margin, y + sectionHeaderBarHeight + 2);
  pdf.setFontSize(titleFontSize);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.primaryDark[0], colors.primaryDark[1], colors.primaryDark[2]);
  pdf.text(title, marginLeft, y + 4);
  pdf.setTextColor(0, 0, 0);
  return y + sectionHeaderBarHeight + 6;
}

// Signature display size in PDF (mm) – matches user-friendly pad aspect
const SIGNATURE_PDF_WIDTH_MM = 70;
const SIGNATURE_PDF_HEIGHT_MM = 28;

/**
 * Parse a data URL into base64 + format for jsPDF. Returns undefined if invalid.
 */
function parseDataUrl(dataUrl: string): { data: string; format: 'JPEG' | 'PNG' } | undefined {
  const m = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!m) return undefined;
  const format = (m[1].toLowerCase() === 'png' ? 'PNG' : 'JPEG') as 'JPEG' | 'PNG';
  return { data: m[2], format };
}

/**
 * Load image from data URL or URL and return as base64 for jsPDF (JPEG/PNG).
 * For data URLs returns immediately. For http(s) URLs tries fetch first (same-origin/CORS), then Image.
 * Returns undefined if load fails.
 */
function getImageBase64(dataUrlOrUrl: string): Promise<{ data: string; format: 'JPEG' | 'PNG' } | undefined> {
  if (dataUrlOrUrl.startsWith('data:')) {
    const out = parseDataUrl(dataUrlOrUrl);
    return Promise.resolve(out);
  }

  const tryFetch = (): Promise<{ data: string; format: 'JPEG' | 'PNG' } | undefined> =>
    fetch(dataUrlOrUrl, { mode: 'cors', credentials: 'omit' })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('Fetch failed'))))
      .then(
        (blob) =>
          new Promise<{ data: string; format: 'JPEG' | 'PNG' } | undefined>((res) => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = typeof reader.result === 'string' ? reader.result : '';
              res(parseDataUrl(dataUrl));
            };
            reader.onerror = () => res(undefined);
            reader.readAsDataURL(blob);
          })
      )
      .catch(() => undefined);

  const tryImage = (): Promise<{ data: string; format: 'JPEG' | 'PNG' } | undefined> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(undefined);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          resolve(parseDataUrl(dataUrl) ?? undefined);
        } catch {
          resolve(undefined);
        }
      };
      img.onerror = () => resolve(undefined);
      img.src = dataUrlOrUrl;
    });

  if (dataUrlOrUrl.startsWith('http://') || dataUrlOrUrl.startsWith('https://')) {
    return tryFetch().then((result) => (result !== undefined ? result : tryImage()));
  }
  return tryImage();
}

/**
 * Load image and return base64 + dimensions for aspect-ratio–preserving placement in PDF.
 */
function getImageBase64WithDimensions(
  dataUrlOrUrl: string
): Promise<{ data: string; format: 'JPEG' | 'PNG'; width: number; height: number } | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) {
        resolve(undefined);
        return;
      }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(undefined);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        const parsed = parseDataUrl(dataUrl);
        if (parsed) resolve({ ...parsed, width: w, height: h });
        else resolve(undefined);
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => resolve(undefined);
    img.src = dataUrlOrUrl;
  });
}

/**
 * Load signature image and convert to opaque JPEG on white background for reliable PDF display.
 * jsPDF can render PNG transparency poorly; JPEG avoids that and ensures the stroke is visible.
 */
function getSignatureForPdf(dataUrlOrUrl: string): Promise<{ data: string; format: 'JPEG' } | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(undefined);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const m = jpegDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
        if (m) resolve({ data: m[1], format: 'JPEG' });
        else resolve(undefined);
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => {
      if (dataUrlOrUrl.startsWith('http://') || dataUrlOrUrl.startsWith('https://')) {
        fetch(dataUrlOrUrl, { mode: 'cors', credentials: 'include' })
          .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('Fetch failed'))))
          .then((blob) => {
            const url = URL.createObjectURL(blob);
            const img2 = new Image();
            img2.crossOrigin = 'anonymous';
            img2.onload = () => {
              URL.revokeObjectURL(url);
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img2.naturalWidth;
                canvas.height = img2.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  resolve(undefined);
                  return;
                }
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img2, 0, 0);
                const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
                const m = jpegDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
                if (m) resolve({ data: m[1], format: 'JPEG' });
                else resolve(undefined);
              } catch {
                resolve(undefined);
              }
            };
            img2.onerror = () => {
              URL.revokeObjectURL(url);
              resolve(undefined);
            };
            img2.src = url;
          })
          .catch(() => resolve(undefined));
      } else {
        resolve(undefined);
      }
    };
    img.src = dataUrlOrUrl;
  });
}

/**
 * Generate a single submission PDF using jsPDF (no html2canvas).
 * Returns PDF as Uint8Array for saving or adding to ZIP.
 */
export async function generateSubmissionPDF(input: SubmissionPdfExportInput): Promise<ArrayBuffer> {
  const {
    submission,
    assignment,
    approvalMessages = [],
    disputeMessages = [],
    preApproval,
    templateName,
    includeDisputeMessaging = true,
    logoUrl = '/logo-no-background.png',
    submissionResult: inputSubmissionResult,
  } = input;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const drawDivider = () => {
    pdf.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 4;
  };

  // Header: row 1 = logo (left) + date (right), row 2 = title
  pdf.setFillColor(colors.primaryDark[0], colors.primaryDark[1], colors.primaryDark[2]);
  pdf.roundedRect(0, 0, pageWidth, headerHeight, 0, 0, 'F');
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.roundedRect(0, 2, pageWidth, headerHeight - 2, 0, 0, 'F');

  const row1LogoMaxH = 22;
  const logoTop = 4;
  const logoImg = await getImageBase64WithDimensions(logoUrl);
  if (logoImg) {
    const maxW = 50;
    const aspectRatio = logoImg.width / logoImg.height;
    let h = row1LogoMaxH;
    let w = row1LogoMaxH * aspectRatio;
    if (w > maxW) {
      w = maxW;
      h = maxW / aspectRatio;
    }
    try {
      pdf.addImage(logoImg.data, logoImg.format, margin, logoTop + 4, w, h);
    } catch {
      // ignore
    }
  }
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(220, 230, 255);
  pdf.text(dayjs().format('MMM DD, YYYY  h:mm A'), pageWidth - margin, logoTop + 10, { align: 'right' });

  const titleText = templateName?.trim() || 'Submission Report';
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text(titleText, margin, logoTop + row1LogoMaxH + 8);
  y = headerHeight + 12;

  // Metadata section
  y = drawSectionTitle(pdf, 'Submission details', y, pageWidth, margin);
  y += 2;

  const assigneeName =
    submission.assignee && typeof submission.assignee === 'object' && 'user' in submission.assignee
      ? (submission.assignee as { user?: { name?: string } }).user?.name
      : undefined;
  const subjectName =
    submission.subject && typeof submission.subject === 'object' && 'user' in submission.subject
      ? (submission.subject as { user?: { name?: string } }).user?.name
      : undefined;

  pdf.setFontSize(labelFontSize);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
  pdf.text('Assignee:', margin, y);
  pdf.setTextColor(0, 0, 0);
  pdf.text(assigneeName || '—', margin + 22, y);
  y += lineHeight + 2;
  pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
  pdf.text('Subject:', margin, y);
  pdf.setTextColor(0, 0, 0);
  pdf.text(subjectName || '—', margin + 22, y);
  y += lineHeight + 2;
  pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
  pdf.text('Status:', margin, y);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(submission.status ?? '—').replace(/_/g, ' '), margin + 22, y);
  y += lineHeight + 2;
  if (submission.updatedAt) {
    pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
    pdf.text('Updated:', margin, y);
    pdf.setTextColor(0, 0, 0);
    pdf.text(dayjs(submission.updatedAt).format('MMM D, YYYY h:mm A'), margin + 22, y);
    y += lineHeight + 2;
  }
  const submittedAt = (submission.fieldMetadata as { type?: { submittedAt?: string } } | undefined)?.type?.submittedAt;
  if (submittedAt) {
    pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
    pdf.text('Submitted:', margin, y);
    pdf.setTextColor(0, 0, 0);
    pdf.text(dayjs(submittedAt).format('MMM D, YYYY h:mm A'), margin + 22, y);
    y += lineHeight + 2;
  }
  y += sectionGap;
  drawDivider();
  y += sectionGap;

  // Signature (moved to top): all signature messages from dispute channel
  const signatureMessages = disputeMessages.filter(
    (m) => m.action === 'signature' || m.action === 'submission:signature'
  );
  for (const msg of signatureMessages) {
    if (!msg.signature?.dataUrl) continue;
    const who =
      msg.sentBy && typeof msg.sentBy === 'object' && 'user' in msg.sentBy
        ? (msg.sentBy as { user?: { name?: string } }).user?.name
        : '';
    const when = msg.createdAt ? dayjs(msg.createdAt).format('MMM D, YYYY h:mm A') : '';
    y = checkPageBreak(pdf, y, SIGNATURE_PDF_HEIGHT_MM + 16, pageHeight);
    y = drawSectionTitle(pdf, 'Signature', y, pageWidth, margin);
    y += 2;
    pdf.setFontSize(valueFontSize);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
    if (who || when) pdf.text(`${who || 'Signature'}${when ? ` — ${when}` : ''}`, margin, y);
    if (who || when) y += lineHeight + 2;
    pdf.setTextColor(0, 0, 0);
    const imgResult = (await getSignatureForPdf(msg.signature.dataUrl)) ?? (await getImageBase64(msg.signature.dataUrl));
    if (imgResult) {
      const imgW = SIGNATURE_PDF_WIDTH_MM;
      const imgH = SIGNATURE_PDF_HEIGHT_MM;
      y = checkPageBreak(pdf, y, imgH + 10, pageHeight);
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(margin, y, imgW, imgH, 1, 1, 'F');
      pdf.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
      pdf.setLineWidth(0.4);
      pdf.roundedRect(margin, y, imgW, imgH, 1, 1, 'S');
      try {
        pdf.addImage(imgResult.data, imgResult.format, margin + 2, y + 2, imgW - 4, imgH - 4);
      } catch {
        pdf.text('[Signature]', margin + 4, y + imgH / 2);
      }
      y += imgH + 8;
    }
    y += sectionGap;
    drawDivider();
    y += sectionGap;
  }

  // Pre-approval (if provided)
  if (preApproval?.preApproved !== undefined && preApproval.preApproved) {
    y = checkPageBreak(pdf, y, 28, pageHeight);
    y = drawSectionTitle(pdf, 'Pre-approval', y, pageWidth, margin);
    y += 2;
    pdf.setFontSize(valueFontSize);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.success[0], colors.success[1], colors.success[2]);
    pdf.text('Pre-approved', margin, y);
    y += lineHeight + 2;
    if (preApproval.preApprovalComment) {
      y = wrapText(pdf, preApproval.preApprovalComment, margin, y, contentWidth, valueFontSize);
      y += sectionGap;
    }
    y += sectionGap;
    drawDivider();
    y += sectionGap;
  }

  const rows = extractFieldRows(submission.answers as JSONContent);
  const totalQuestions = rows.length;

  // Score only from questions with Points Scoring enabled (match SubmissionSummaryStep)
  const rowsWithPointsScoring = rows.filter((r) => r.enablePoints === true);
  const totalScore = rowsWithPointsScoring.reduce(
    (sum, r) => sum + (typeof r.points === 'number' ? r.points : 0),
    0
  );
  // const maxPointsPossible = rowsWithPointsScoring.reduce(
  //   (sum, r) => sum + (typeof r.maxPoints === 'number' ? r.maxPoints : 0),
  //   0
  // );

  const maxPointsPossible = assignment?.formTemplateSchema?.totalScore || 0;

  // Pass/Fail only from questions with Pass/Fail Scoring enabled
  const rowsWithPassFailScoring = rows.filter((r) => r.enablePassFail === true);
  const totalPassFail = rowsWithPassFailScoring.length;
  const passingPassFailCount = rowsWithPassFailScoring.filter(
    (r) => r.isCorrect === true
  ).length;

  const passingScore = typeof assignment?.passingScore === 'number' ? assignment.passingScore : undefined;
  const passingPassFailCountRequired =
    typeof assignment?.passingPassFailCount === 'number' ? assignment.passingPassFailCount : undefined;

  const hasCriticalFail = rows.some(
    (r) => r.failCritical === true && r.isCorrect === false
  );
  const scoreFail = passingScore != null && totalScore < passingScore;
  const passFailCountFail =
    passingPassFailCountRequired != null &&
    passingPassFailCount < passingPassFailCountRequired;
  const overallFail = hasCriticalFail || scoreFail || passFailCountFail;
  const overallPass = !overallFail;

  // Submission result: use input or compute (pass / fail / critical_fail)
  const computedResult = ((): 'pass' | 'fail' | 'critical_fail' | '' => {
    if (rows.length === 0) return '';
    if (overallFail) return hasCriticalFail ? 'critical_fail' : 'fail';
    return 'pass';
  })();

  const submissionResultLabel =
    inputSubmissionResult !== undefined && inputSubmissionResult !== ''
      ? inputSubmissionResult === 'critical_fail'
        ? 'Critical fail'
        : inputSubmissionResult === 'fail'
          ? 'Failed'
          : 'Passed'
      : computedResult === 'critical_fail'
        ? 'Critical fail'
        : computedResult === 'fail'
          ? 'Failed'
          : computedResult === 'pass'
            ? 'Passed'
            : '';

  const hasResultSection =
    totalQuestions > 0 &&
    (submissionResultLabel ||
      rowsWithPointsScoring.length > 0 ||
      rowsWithPassFailScoring.length > 0);

  // Result section (match SubmissionSummaryStep: result slip style)
  if (hasResultSection) {
    const resultBlockHeight = 38;
    y = checkPageBreak(pdf, y, resultBlockHeight + 12, pageHeight);
    pdf.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, y, contentWidth, resultBlockHeight, 'S');
    pdf.setLineWidth(1.5);
    pdf.setDrawColor(
      overallPass ? colors.success[0] : colors.error[0],
      overallPass ? colors.success[1] : colors.error[1],
      overallPass ? colors.success[2] : colors.error[2]
    );
    pdf.line(margin, y, margin, y + resultBlockHeight);
    pdf.setLineWidth(0.5);

    const leftCol = margin + 8;
    const midCol = margin + contentWidth * 0.35;
    const rightCol = margin + contentWidth * 0.65;

    let rowY = y + 8;
    pdf.setFontSize(labelFontSize);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
    pdf.text('Result', leftCol, rowY);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(
      overallPass ? colors.success[0] : colors.error[0],
      overallPass ? colors.success[1] : colors.error[1],
      overallPass ? colors.success[2] : colors.error[2]
    );
    pdf.text(submissionResultLabel || '—', leftCol, rowY + 7);
    if (overallFail && hasCriticalFail) {
      pdf.setFontSize(labelFontSize - 1);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.error[0], colors.error[1], colors.error[2]);
      pdf.text('Critical question failed', leftCol, rowY + 14);
    }

    rowY = y + 8;
    if (rowsWithPointsScoring.length > 0) {
      pdf.setFontSize(labelFontSize);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
      pdf.text('Score', midCol, rowY);
      pdf.setFontSize(valueFontSize);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      const scoreStr =
        maxPointsPossible > 0
          ? `${totalScore} / ${maxPointsPossible}`
          : String(totalScore);
      pdf.text(scoreStr, midCol, rowY + 6);
      if (passingScore != null) {
        pdf.setFontSize(labelFontSize - 1);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
        pdf.text(`min ${passingScore}${totalScore >= passingScore ? ' ✓' : ''}`, midCol, rowY + 12);
      }
    }

    if (rowsWithPassFailScoring.length > 0) {
      pdf.setFontSize(labelFontSize);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
      pdf.text('Pass / Fail', rightCol, rowY);
      pdf.setFontSize(valueFontSize);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${passingPassFailCount} / ${totalPassFail}`, rightCol, rowY + 6);
      if (passingPassFailCountRequired != null) {
        pdf.setFontSize(labelFontSize - 1);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
        pdf.text(
          `min ${passingPassFailCountRequired}${passingPassFailCount >= passingPassFailCountRequired ? ' ✓' : ''}`,
          rightCol,
          rowY + 12
        );
      }
    }

    if (totalQuestions > 0) {
      const qCol = margin + contentWidth - 20;
      pdf.setFontSize(labelFontSize);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
      pdf.text('Questions', qCol, rowY);
      pdf.setFontSize(valueFontSize);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(String(totalQuestions), qCol, rowY + 6);
    }

    y += resultBlockHeight + sectionGap;
    drawDivider();
    y += sectionGap;
  }

  // Right-side width reserved for marks (points, pass/fail, critical fail enabled)
  const marksRightWidth = 52;

  // Form responses
  y = drawSectionTitle(pdf, 'Form responses', y, pageWidth, margin);
  y += 2;

  for (const row of rows) {
    y = checkPageBreak(pdf, y, 32, pageHeight);
    const label = row.label || row.name || row.type || 'Field';
    const formatted = formatFieldRowValueForPdf(row);
    const hasPoints = row.enablePoints && typeof row.points === 'number';
    const hasPassFail = row.enablePassFail && typeof row.isCorrect === 'boolean';
    const hasMarks = hasPoints || hasPassFail || row.failCritical === true;

    // Build marks string: points, Pass/Fail, and "Critical fail enabled" when the question has critical fail
    let marksStr = '';
    if (hasMarks) {
      const parts: string[] = [];
      if (hasPoints) {
        parts.push(
          typeof row.maxPoints === 'number' ? `${row.points}/${row.maxPoints}` : `${row.points}`
        );
      }
      if (hasPassFail) {
        const criticalFail =
          row.isCorrect === false &&
          row.failCritical === true &&
          (row.maxPoints ?? 0) > 0 &&
          (row.points ?? 0) === 0;
        parts.push(row.isCorrect ? 'Pass' : criticalFail ? 'Critical fail' : 'Fail');
      }
      if (row.failCritical) {
        const alreadyShowCriticalFail =
          hasPassFail &&
          row.isCorrect === false &&
          row.failCritical === true &&
          (row.maxPoints ?? 0) > 0 &&
          (row.points ?? 0) === 0;
        if (!alreadyShowCriticalFail) {
          parts.push('Critical fail enabled');
        }
      }
      marksStr = parts.join('  ·  ');
    }

    const maxLabelWidth = contentWidth - marksRightWidth;
    pdf.setFontSize(labelFontSize);
    pdf.setFont('helvetica', 'bold');
    const labelLines = pdf.splitTextToSize(label, maxLabelWidth);
    const firstLineY = y;

    pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.text(labelLines[0], margin, firstLineY);

    if (marksStr) {
      pdf.setFontSize(labelFontSize - 1);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
      pdf.text(marksStr, pageWidth - margin, firstLineY, { align: 'right' });
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.setFont('helvetica', 'bold');
    }
    y += lineHeight;

    for (let i = 1; i < labelLines.length; i++) {
      pdf.text(labelLines[i], margin, y);
      y += lineHeight;
    }
    pdf.setTextColor(0, 0, 0);

    if (formatted.isSignature && formatted.imageDataUrl) {
      const imgResult = (await getSignatureForPdf(formatted.imageDataUrl)) ?? (await getImageBase64(formatted.imageDataUrl));
      if (imgResult) {
        const imgW = SIGNATURE_PDF_WIDTH_MM;
        const imgH = SIGNATURE_PDF_HEIGHT_MM;
        y = checkPageBreak(pdf, y, imgH + 12, pageHeight);
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(margin, y, imgW, imgH, 1, 1, 'F');
        pdf.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(margin, y, imgW, imgH, 1, 1, 'S');
        try {
          pdf.addImage(imgResult.data, imgResult.format, margin + 2, y + 2, imgW - 4, imgH - 4);
        } catch {
          pdf.setFontSize(valueFontSize);
          pdf.setFont('helvetica', 'normal');
          pdf.text('[Signature]', margin + 4, y + imgH / 2);
        }
        y += imgH + 6;
      } else {
        pdf.setFontSize(valueFontSize);
        pdf.setFont('helvetica', 'normal');
        y = wrapText(pdf, formatted.text, margin, y, contentWidth, valueFontSize);
        y += 4;
      }
    } else {
      pdf.setFontSize(valueFontSize);
      pdf.setFont('helvetica', 'normal');
      y = wrapText(pdf, formatted.text, margin, y, contentWidth, valueFontSize);
      y += 4;
    }
    y += 4;
  }
  y += sectionGap;
  drawDivider();
  y += sectionGap;

  // Approval section
  if (assignment?.hasApproval !== false) {
    y = checkPageBreak(pdf, y, 35, pageHeight);
    y = drawSectionTitle(pdf, 'Approval', y, pageWidth, margin);
    y += 2;
    pdf.setFontSize(valueFontSize);
    pdf.setFont('helvetica', 'normal');
    const status = submission.approvalStatus ?? 'pending';
    const statusColor =
      status === 'approved' ? colors.success : status === 'rejected' ? colors.error : colors.warning;
    pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    pdf.text(`Status: ${String(status).replace(/-/g, ' ')}`, margin, y);
    y += lineHeight + 4;

    for (const msg of approvalMessages) {
      const isApprove =
        msg.action === 'approval:approved' || msg.action === 'approval:approve' || msg.action === 'approve';
      const isReject =
        msg.action === 'approval:rejected' || msg.action === 'approval:reject' || msg.action === 'reject';
      const comment = msg.comment || msg.text || '';
      const who =
        msg.sentBy && typeof msg.sentBy === 'object' && 'user' in msg.sentBy
          ? (msg.sentBy as { user?: { name?: string } }).user?.name
          : '';
      const when = msg.createdAt ? dayjs(msg.createdAt).format('MMM D, YYYY h:mm A') : '';
      const prefix = isApprove ? 'Approved' : isReject ? 'Rejected' : 'Message';
      pdf.setTextColor(isApprove ? colors.success[0] : isReject ? colors.error[0] : colors.darkGray[0], isApprove ? colors.success[1] : isReject ? colors.error[1] : colors.darkGray[1], isApprove ? colors.success[2] : isReject ? colors.error[2] : colors.darkGray[2]);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${prefix}${who ? ` by ${who}` : ''}${when ? ` — ${when}` : ''}`, margin, y);
      y += lineHeight;
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      if (comment) {
        y = wrapText(pdf, comment, margin, y, contentWidth, valueFontSize);
        y += 2;
      }
      y += 4;
    }
    y += sectionGap;
    drawDivider();
    y += sectionGap;
  }

  // Dispute messaging section (optional; signatures are already under Submission details)
  const disputeTextMessages = disputeMessages.filter(
    (m) => m.action !== 'signature' && m.action !== 'submission:signature'
  );
  if (
    includeDisputeMessaging &&
    (assignment?.hasDisputes || assignment?.signatureRequired) &&
    disputeTextMessages.length > 0
  ) {
    y = checkPageBreak(pdf, y, 35, pageHeight);
    y = drawSectionTitle(pdf, 'Dispute messaging', y, pageWidth, margin);
    y += 2;
    pdf.setFontSize(valueFontSize);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);

    for (const msg of disputeTextMessages) {
      const who =
        msg.sentBy && typeof msg.sentBy === 'object' && 'user' in msg.sentBy
          ? (msg.sentBy as { user?: { name?: string } }).user?.name
          : '';
      const when = msg.createdAt ? dayjs(msg.createdAt).format('MMM D, YYYY h:mm A') : '';

      if (msg.text || msg.comment) {
        const label =
          msg.action === 'omit-signature-request'
            ? 'Omit signature request'
            : msg.action === 'omit-signature-request-approve'
              ? 'Omit signature approved'
              : msg.action === 'omit-signature-request-reject'
                ? 'Omit signature rejected'
                : 'Message';
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${label}${who ? ` by ${who}` : ''}${when ? ` — ${when}` : ''}`, margin, y);
        y += lineHeight;
        pdf.setFont('helvetica', 'normal');
        const text = msg.comment || msg.text || '';
        if (text) {
          y = wrapText(pdf, text, margin, y, contentWidth, valueFontSize);
          y += 2;
        }
        y += 4;
      }
    }
  }

  return pdf.output('arraybuffer') as ArrayBuffer;
}

/**
 * Download a single submission PDF (generates and triggers save).
 */
export async function downloadSubmissionPDF(
  input: SubmissionPdfExportInput,
  filename?: string
): Promise<void> {
  const buffer = await generateSubmissionPDF(input);
  const name =
    filename ||
    `submission-${input.submission._id ?? 'export'}-${dayjs().format('YYYY-MM-DD')}.pdf`;
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.endsWith('.pdf') ? name : `${name}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export type FetchMessagesForSubmission = (
  submissionId: string
) => Promise<{
  approvalMessages: ApprovalMessageForPdf[];
  disputeMessages: DisputeMessageForPdf[];
}>;

export type ResolvePreApproval = (
  submission: SubmissionPdfExportInput['submission'],
  subjectId?: string,
  assigneeId?: string
) => PreApprovalForPdf | undefined;

/**
 * Generate PDFs for multiple submissions and download as a ZIP.
 * Requires JSZip. onProgress(currentIndex, total) is called for each submission generated.
 */
export async function downloadBulkSubmissionsAsZip(
  submissions: SubmissionPdfExportInput['submission'][],
  assignment: SubmissionPdfExportInput['assignment'],
  fetchMessages: FetchMessagesForSubmission,
  resolvePreApproval?: ResolvePreApproval,
  options?: {
    onProgress?: (current: number, total: number) => void;
    zipFilename?: string;
  }
): Promise<void> {
  const { onProgress, zipFilename = `submissions-${dayjs().format('YYYY-MM-DD')}.zip` } = options ?? {};
  const total = submissions.length;
  if (total === 0) return;

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    const submissionId = sub._id ?? `sub-${i}`;
    onProgress?.(i + 1, total);

    const { approvalMessages, disputeMessages } = await fetchMessages(submissionId);
    const subjectId = sub.subject && typeof sub.subject === 'object' && '_id' in sub.subject ? String((sub.subject as { _id?: string })._id) : undefined;
    const assigneeId = sub.assignee && typeof sub.assignee === 'object' && '_id' in sub.assignee ? String((sub.assignee as { _id?: string })._id) : undefined;
    const preApproval = resolvePreApproval?.(sub, subjectId, assigneeId);

    const buffer = await generateSubmissionPDF({
      submission: sub,
      assignment,
      approvalMessages,
      disputeMessages,
      preApproval,
      subjectId,
      assigneeId,
    });

    const subjectName = sub.subject && typeof sub.subject === 'object' && 'user' in sub.subject
      ? (sub.subject as { user?: { name?: string } }).user?.name
      : undefined;
    const safeName = [subjectName ?? 'subject', submissionId, dayjs().format('YYYY-MM-DD')]
      .filter(Boolean)
      .join('-')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    zip.file(`${safeName}.pdf`, buffer, { binary: true });
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
