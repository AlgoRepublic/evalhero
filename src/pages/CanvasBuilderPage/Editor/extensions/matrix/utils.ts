/* eslint-disable @typescript-eslint/no-explicit-any */
import dayjs from 'dayjs';

// Helper to combine base URL with relative path for file/signature URLs
const API_URL = import.meta.env.VITE_API_URL || '';
export const combineUrl = (url: string): string => {
  if (!url) return '';
  // If URL is already absolute (starts with http:// or https://), return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // If URL is relative, combine with base URL
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  // Ensure url starts with /
  const relativePath = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${relativePath}`;
};

/** Resolve stored file/signature URLs for display or opening (http(s), data, blob, or API-relative). */
export function resolveMatrixAssetHref(url: string): string {
  if (!url) return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  ) {
    return url;
  }
  return combineUrl(url);
}

/**
 * Open asset in a new browser tab/window. Use inside the form editor so ProseMirror/TipTap
 * does not handle the click as in-document navigation (same tab).
 */
export function openMatrixAssetInNewTab(
  url: string,
  e?: { preventDefault(): void; stopPropagation(): void }
): void {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const href = resolveMatrixAssetHref(url);
  if (!href) return;
  window.open(href, '_blank', 'noopener,noreferrer');
}

// Helper function to get minimum column width based on type, label, and content
export const getColumnMinWidth = (col: any): number => {
  const colType = col.type || 'text';
  const labelLength = (col.label || '').length;
  
  // Base minimum width from label (8px per character + padding)
  const labelBasedWidth = Math.max(80, labelLength * 8 + 40);
  
  switch (colType) {
    case 'choice': {
      // HOT PATCH: Column width based on longest option text (for button variants)
      const maxOptionLength = col.options?.reduce((max: number, opt: string) => 
        Math.max(max, String(opt).length), 0) || 0;
      // Use 7px per char for button text fit + padding
      const optionBasedWidth = maxOptionLength * 7 + 20;
      return Math.max(labelBasedWidth, Math.max(70, optionBasedWidth));
    }
    case 'multiple': {
      // HOT PATCH: Column width based on longest option text (for button variants)
      const maxOptLength = col.options?.reduce((max: number, opt: string) => 
        Math.max(max, String(opt).length), 0) || 0;
      // Use 7px per char for button text fit + padding
      const optionBasedWidth = maxOptLength * 7 + 20;
      return Math.max(labelBasedWidth, Math.max(70, optionBasedWidth));
    }
    case 'number':
      // Compact but consider label
      return Math.max(labelBasedWidth, 100);
    case 'text':
      // Medium width, consider label
      return Math.max(labelBasedWidth, 120);
    case 'longText':
      // Wider for expander, but flexible
      return Math.max(labelBasedWidth, 150);
    case 'date':
      // Date picker needs reasonable space
      return Math.max(labelBasedWidth, 140);
    case 'boolean':
      // Compact switch
      return Math.max(labelBasedWidth, 90);
    case 'rating': {
      // Consider scale (more stars = wider)
      const scale = col.scale || 5;
      const scaleBasedWidth = scale * 30 + 40;
      return Math.max(labelBasedWidth, scaleBasedWidth);
    }
    case 'anchors': {
      // Consider anchor labels if available
      if (col.anchorLabels && Array.isArray(col.anchorLabels) && col.anchorLabels.length > 0) {
        const maxLabelLength = col.anchorLabels.reduce((max: number, lab: string) => 
          Math.max(max, String(lab).length), 0);
        const labelBasedMin = maxLabelLength * 10 + 60;
        return Math.max(labelBasedWidth, Math.max(150, labelBasedMin));
      }
      // Consider scale for numbered anchors
      const scale = col.scale || 5;
      const scaleBasedWidth = scale * 30 + 40;
      return Math.max(labelBasedWidth, Math.max(150, scaleBasedWidth));
    }
    case 'file':
      // File upload needs space for button
      return Math.max(labelBasedWidth, 140);
    case 'signature':
      // Signature needs space for button
      return Math.max(labelBasedWidth, 140);
    case 'computed':
      // Computed - flexible based on label
      return Math.max(labelBasedWidth, 120);
    default:
      return Math.max(labelBasedWidth, 120);
  }
};

// Helper to normalize value based on column type
export const normalizeValue = (value: any, colType: string): any => {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }

  switch (colType) {
    case 'number':
      // Ensure number type
      if (typeof value === 'string') {
        const num = Number(value);
        return isNaN(num) ? null : num;
      }
      return typeof value === 'number' ? value : null;

    case 'boolean':
      // Ensure boolean type
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        if (value === 'true' || value === '1') return true;
        if (value === 'false' || value === '0' || value === '') return false;
      }
      if (typeof value === 'number') return value !== 0;
      return Boolean(value);

    case 'rating':
      // Ensure number type (0 to scale)
      if (typeof value === 'string') {
        const num = Number(value);
        return isNaN(num) ? 0 : Math.max(0, num);
      }
      return typeof value === 'number' ? Math.max(0, value) : 0;

    case 'anchors':
      // Ensure number type (1 to scale) or null
      if (typeof value === 'string') {
        const num = Number(value);
        return isNaN(num) ? null : Math.max(1, num);
      }
      if (typeof value === 'number') {
        return value >= 1 ? value : null;
      }
      return null;

    case 'choice':
      // Ensure string type
      return typeof value === 'string' ? value : String(value);

    case 'multiple':
      // Ensure array of strings
      if (Array.isArray(value)) {
        return value.map(v => typeof v === 'string' ? v : String(v));
      }
      return [];

    case 'date':
      // Ensure ISO string or null
      if (typeof value === 'string') {
        // If it's already an ISO string, return as is
        if (value.includes('T') || value.includes('Z')) return value;
        // Try to parse and convert to ISO
        const date = dayjs(value);
        return date.isValid() ? date.toISOString() : null;
      }
      return null;

    case 'text':
    case 'longText':
      // Ensure string type
      return typeof value === 'string' ? value : String(value || '');

    case 'file':
    case 'signature':
      // Keep as object or string (for signatures)
      return value;

    case 'computed':
      // Computed values are numbers typically
      if (typeof value === 'string') {
        const num = Number(value);
        return isNaN(num) ? null : num;
      }
      return typeof value === 'number' ? value : null;

    default:
      return value;
  }
};

// Helper to normalize column attributes (convert strings to proper types)
export const normalizeColumnAttributes = (col: any): any => {
  const normalized = { ...col };
  
  // Normalize boolean attributes
  if (normalized.required !== undefined && normalized.required !== null) {
    if (typeof normalized.required === 'string') {
      normalized.required = normalized.required === 'true' || normalized.required === '1';
    } else {
      normalized.required = Boolean(normalized.required);
    }
  } else {
    normalized.required = false;
  }
  
  // Normalize numeric attributes
  if (normalized.scale !== undefined && normalized.scale !== null) {
    if (typeof normalized.scale === 'string') {
      const num = Number(normalized.scale);
      normalized.scale = isNaN(num) ? (normalized.type === 'rating' || normalized.type === 'anchors' ? 5 : null) : num;
    } else if (typeof normalized.scale !== 'number') {
      normalized.scale = normalized.type === 'rating' || normalized.type === 'anchors' ? 5 : null;
    }
  } else if (normalized.type === 'rating' || normalized.type === 'anchors') {
    normalized.scale = 5;
  }
  
  if (normalized.step !== undefined && normalized.step !== null) {
    if (typeof normalized.step === 'string') {
      const num = Number(normalized.step);
      normalized.step = isNaN(num) ? 1 : num;
    } else if (typeof normalized.step !== 'number') {
      normalized.step = 1;
    }
  } else if (normalized.type === 'number') {
    normalized.step = 1;
  }
  
  if (normalized.min !== undefined && normalized.min !== null && normalized.min !== '') {
    if (typeof normalized.min === 'string') {
      const num = Number(normalized.min);
      normalized.min = isNaN(num) ? null : num;
    } else if (typeof normalized.min !== 'number') {
      normalized.min = null;
    }
  } else {
    normalized.min = null;
  }
  
  if (normalized.max !== undefined && normalized.max !== null && normalized.max !== '') {
    if (typeof normalized.max === 'string') {
      const num = Number(normalized.max);
      normalized.max = isNaN(num) ? null : num;
    } else if (typeof normalized.max !== 'number') {
      normalized.max = null;
    }
  } else {
    normalized.max = null;
  }
  
  if (normalized.maxSelections !== undefined && normalized.maxSelections !== null && normalized.maxSelections !== '') {
    if (typeof normalized.maxSelections === 'string') {
      const num = Number(normalized.maxSelections);
      normalized.maxSelections = isNaN(num) ? null : num;
    } else if (typeof normalized.maxSelections !== 'number') {
      normalized.maxSelections = null;
    }
  } else {
    normalized.maxSelections = null;
  }
  
  // Ensure anchorLabels is an array
  if (normalized.type === 'anchors') {
    if (!Array.isArray(normalized.anchorLabels)) {
      normalized.anchorLabels = [];
    }
  } else {
    normalized.anchorLabels = normalized.anchorLabels || [];
  }
  
  // Ensure options is an array for choice/multiple
  if ((normalized.type === 'choice' || normalized.type === 'multiple') && !Array.isArray(normalized.options)) {
    normalized.options = [];
  }

  // Choice/multiple: ensure optionPoints, variant, layout, scoring flags
  if (normalized.type === 'choice' || normalized.type === 'multiple') {
    if (normalized.optionPoints !== undefined && typeof normalized.optionPoints === 'object' && !Array.isArray(normalized.optionPoints)) {
      // keep as is
    } else {
      normalized.optionPoints = {};
    }
    if (!['radio', 'dropdown', 'buttons', 'yesno'].includes(normalized.variant)) {
      normalized.variant = normalized.type === 'choice' ? 'radio' : 'checkbox';
    }
    // Yes/No variant: fixed options like SingleChoiceField (no custom option list)
    if (normalized.type === 'choice' && normalized.variant === 'yesno') {
      normalized.options = ['Yes', 'No'];
    }
    if (!['horizontal', 'vertical'].includes(normalized.layout)) {
      normalized.layout = 'horizontal';
    }
    if (typeof normalized.enablePassFail !== 'boolean') {
      normalized.enablePassFail = normalized.enablePassFail === true || normalized.enablePassFail === 'true';
    }
    if (typeof normalized.enablePoints !== 'boolean') {
      normalized.enablePoints = normalized.enablePoints === true || normalized.enablePoints === 'true';
    }
    if (typeof normalized.failCritical !== 'boolean') {
      normalized.failCritical = normalized.failCritical === true || normalized.failCritical === 'true';
    }
  }
  
  // Ensure computedExpr is a string
  if (normalized.computedExpr !== undefined && normalized.computedExpr !== null) {
    normalized.computedExpr = String(normalized.computedExpr);
  } else {
    normalized.computedExpr = '';
  }
  
  // Ensure tooltip is a string
  if (normalized.tooltip !== undefined && normalized.tooltip !== null) {
    normalized.tooltip = String(normalized.tooltip);
  } else {
    normalized.tooltip = '';
  }
  
  return normalized;
};

/** Option points/correct per option value (same shape as SingleChoice/MultipleChoice optionPoints) */
export type OptionPointEntry = { points?: number; isCorrect?: boolean };

/** Parse boolean from tiptap/storage (can be string "true"/"false"). */
function parseBool(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val === 'true' || val === '1';
  return !!val;
}

/** Parse points from optionPoints entry (tiptap may store as string). */
function parsePoints(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') {
    const n = Number(val);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

/** Parse optionPoints entry; tiptap schema often stores points/isCorrect as strings. */
function parseOptionEntry(entry: any): { points: number; isCorrect: boolean } {
  if (!entry || typeof entry !== 'object') {
    return { points: 0, isCorrect: false };
  }
  return {
    points: parsePoints(entry.points),
    isCorrect: parseBool(entry.isCorrect),
  };
}

/** Whether column has scoring enabled (handle string booleans from tiptap). */
function isScoringColumn(c: any): boolean {
  if (!c || (c.type !== 'choice' && c.type !== 'multiple')) return false;
  return parseBool(c.enablePoints) || parseBool(c.enablePassFail);
}

/** Whether column has pass/fail enabled (handle string booleans). */
function hasPassFailColumn(c: any): boolean {
  return !!c && (c.type === 'choice' || c.type === 'multiple') && parseBool(c.enablePassFail);
}

/**
 * Compute matrix summary: total points, pass/fail counts, and whether any critical fail is triggered.
 * Used for template evaluation (e.g. "Critical Fail fails the template") and storing totals.
 * Normalizes string booleans/numbers from tiptap schema (optionPoints, enablePoints, enablePassFail, cell values).
 */
export function getMatrixSummary(
  cells: Record<string, Record<string, any>>,
  columns: any[],
  rows: any[],
  rules: any[]
): {
  totalPoints: number;
  totalMaxPoints: number;
  totalScore: number;
  passCount: number;
  failCount: number;
  /** Total number of pass/fail cells (rows × pass/fail columns). */
  totalPassFail: number;
  /** Number of pass/fail cells that are correct. Used for submission summary X/Y. */
  passedCellCount: number;
  /** Number of pass/fail cells that are answered and wrong. */
  failedCellCount: number;
  hasCriticalFail: boolean;
  perRow?: Array<{ rowId: string; points: number; maxPoints: number; pass: boolean; fail: boolean; criticalFail: boolean }>;
} {
  let totalPoints = 0;
  let totalMaxPoints = 0;
  let passCount = 0;
  let failCount = 0;
  let passedCellCount = 0;
  let failedCellCount = 0;
  let hasCriticalFail = false;
  const perRow: Array<{ rowId: string; points: number; maxPoints: number; pass: boolean; fail: boolean; criticalFail: boolean }> = [];

  const scoringColumns = columns.filter((c: any) => isScoringColumn(c));
  const criticalFailRules = Array.isArray(rules) ? rules.filter((r: any) => r.then?.action === 'critical_fail') : [];
  const criticalFailRulesApplicable = criticalFailRules.filter((r: any) => {
    const colId = r.when?.colId;
    if (!colId) return false;
    const col = columns.find((c: any) => c.id === colId);
    return col && hasPassFailColumn(col);
  });

  for (const row of rows) {
    const rowId = row.id;
    let rowPoints = 0;
    let rowMaxPoints = 0;
    let rowPass = false;
    let rowFail = false;
    let rowCriticalFail = false;

    for (const col of scoringColumns) {
      const optionPointsRaw: Record<string, any> = col.optionPoints || {};
      const opts = Array.isArray(col.options) ? (col.options as string[]) : [];
      const val = (cells[rowId] && cells[rowId][col.id]) ?? null;
      const normalizedVal = normalizeValue(val, col.type);

      const enablePoints = parseBool(col.enablePoints);
      const enablePassFail = parseBool(col.enablePassFail);

      if (enablePoints) {
        const correctOpts = opts.filter((o) => parseOptionEntry(optionPointsRaw[o]).isCorrect);
        const maxForCol = col.type === 'choice'
          ? (correctOpts.length ? Math.max(...correctOpts.map((o) => parseOptionEntry(optionPointsRaw[o]).points)) : 0)
          : correctOpts.reduce((sum, o) => sum + parseOptionEntry(optionPointsRaw[o]).points, 0);
        rowMaxPoints += maxForCol;
        if (col.type === 'choice' && typeof normalizedVal === 'string') {
          const entry = parseOptionEntry(optionPointsRaw[normalizedVal]);
          if (entry.isCorrect && entry.points >= 0) rowPoints += entry.points;
        } else if (col.type === 'multiple' && Array.isArray(normalizedVal)) {
          (normalizedVal as string[]).forEach((v) => {
            const entry = parseOptionEntry(optionPointsRaw[v]);
            if (entry.isCorrect && entry.points >= 0) rowPoints += entry.points;
          });
        }
      }
      if (enablePassFail) {
        if (col.type === 'choice' && typeof normalizedVal === 'string') {
          const entry = parseOptionEntry(optionPointsRaw[normalizedVal]);
          if (entry.isCorrect) {
            rowPass = true;
            passedCellCount += 1;
          } else if (normalizedVal) {
            rowFail = true;
            failedCellCount += 1;
          }
        } else if (col.type === 'multiple' && Array.isArray(normalizedVal)) {
          const selected = normalizedVal as string[];
          const allCorrect = selected.length > 0 && selected.every((v) => parseOptionEntry(optionPointsRaw[v]).isCorrect);
          const anyCorrect = selected.some((v) => parseOptionEntry(optionPointsRaw[v]).isCorrect);
          if (anyCorrect) rowPass = true;
          if (selected.length > 0 && !allCorrect) rowFail = true;
          if (allCorrect) passedCellCount += 1;
          else if (selected.length > 0) failedCellCount += 1;
        }
      }
    }

    for (const rule of criticalFailRulesApplicable) {
      const when = rule.when || {};
      const colId = when.colId;
      if (!colId) continue;
      if (when.rowId && when.rowId !== rowId) continue;
      const col = columns.find((c: any) => c.id === colId);
      const optionPointsRaw: Record<string, any> = col?.optionPoints || {};
      const actual = (cells[rowId] && cells[rowId][colId]) ?? null;
      const normalizedActual = col && actual !== null ? normalizeValue(actual, col.type) : actual;
      let isFail = false;
      if (col?.type === 'choice' && typeof normalizedActual === 'string') {
        const entry = parseOptionEntry(optionPointsRaw[normalizedActual]);
        isFail = !!normalizedActual && !entry.isCorrect;
      } else if (col?.type === 'multiple' && Array.isArray(normalizedActual)) {
        const selected = normalizedActual as string[];
        isFail = selected.length > 0 && !selected.every((v) => parseOptionEntry(optionPointsRaw[v]).isCorrect);
      }
      if (isFail) {
        rowCriticalFail = true;
        break;
      }
    }

    totalPoints += rowPoints;
    totalMaxPoints += rowMaxPoints;
    if (rowPass) passCount += 1;
    if (rowFail) failCount += 1;
    if (rowCriticalFail) hasCriticalFail = true;
    perRow.push({
      rowId,
      points: rowPoints,
      maxPoints: rowMaxPoints,
      pass: rowPass,
      fail: rowFail,
      criticalFail: rowCriticalFail,
    });
  }

  const passFailColumnCount = scoringColumns.filter((c: any) => parseBool(c.enablePassFail)).length;
  const totalPassFail = rows.length * passFailColumnCount;

  return {
    totalPoints,
    totalMaxPoints,
    totalScore: totalMaxPoints,
    passCount,
    failCount,
    totalPassFail,
    passedCellCount,
    failedCellCount,
    hasCriticalFail,
    perRow,
  };
}
