/* eslint-disable @typescript-eslint/no-explicit-any */
import { JSONContent } from '@tiptap/core';
import { getMatrixSummary } from '../../CanvasBuilderPage/Editor/extensions/matrix/utils';

export type OptionDetail = {
  label: string;
  value: string;
  points?: number;
  isCorrect?: boolean;
  selected?: boolean;
};

export type FieldRow = {
  label?: string;
  name?: string;
  type?: string;
  variant?: string;
  value: any;
  points?: number;
  maxPoints?: number;
  isCorrect?: boolean;
  /** When true, wrong answer with 0 points counts as "Critical fail". From node attrs (singleChoice/multipleChoice). */
  failCritical?: boolean;
  /** When true, this question uses Points Scoring (only for singleChoice/multipleChoice). */
  enablePoints?: boolean;
  /** When true, this question uses Pass/Fail Scoring (only for singleChoice/multipleChoice). */
  enablePassFail?: boolean;
  options?: OptionDetail[]; // For choice fields - all available options with details
  otherValue?: string; // For "Other" option value
  tags?: string[]; // Tag IDs associated with this field
  // Address field details
  addressComponents?: {
    street?: string;
    apartment?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    formatted?: string;
    lat?: number | null;
    lng?: number | null;
  };
  // Raw date value for proper formatting
  rawDateValue?: string;
  /** Matrix field: snapshot of summary and structure for display. */
  matrixSummarySnapshot?: {
    totalPoints: number;
    totalMaxPoints: number;
    /** Row-level: number of rows with at least one pass. */
    passCount: number;
    /** Row-level: number of rows with at least one fail. */
    failCount: number;
    /** Total pass/fail cells (rows × pass/fail columns). */
    totalPassFail: number;
    /** Number of pass/fail cells that are correct (for X/Y display). Present when recomputed. */
    passedCellCount?: number;
    /** Number of pass/fail cells that are wrong. Present when recomputed. */
    failedCellCount?: number;
    hasCriticalFail: boolean;
    perRow?: Array<{ rowId: string; label?: string; points: number; maxPoints: number; pass: boolean; fail: boolean; criticalFail: boolean }>;
  };
  /** Matrix field: column definitions (id, label, type, options, optionPoints, enablePoints, enablePassFail) for detailed table. */
  matrixColumns?: Array<{ id: string; label: string; type: string; options?: string[]; optionPoints?: Record<string, { points?: number; isCorrect?: boolean }>; enablePoints?: boolean; enablePassFail?: boolean }>;
  /** Matrix field: row definitions (id, label) for detailed table. */
  matrixRows?: Array<{ id: string; label: string }>;
  fileItems?: Array<{
    name?: string;
    url?: string;
    size?: number;
    mime?: string;
    scanStatus?: string;
    uploadedAt?: string;
  }>;
  signatureInfo?: {
    mode?: 'draw' | 'type';
    signerName?: string | null;
    timestamp?: string | null;
    uploadedUrl?: string | null;
    dataUrl?: string | null;
  };
};

export const extractFieldRows = (doc: JSONContent | undefined): FieldRow[] => {
  const byKey: Record<string, FieldRow> = {};
  const walk = (node?: JSONContent) => {
    if (!node) return;
    const type = (node as any)?.type as string | undefined;
    const attrs = ((node as any)?.attrs || {}) as Record<string, any>;
    const variant = (attrs as any).variant as string | undefined;
    const answerNodeTypes = new Set([
      'shortText',
      'longText',
      'richText',
      'numberField',
      'dateField',
      'dateTimeField',
      'singleChoice',
      'multipleChoice',
      'ratingField',
      'sliderField',
      'addressNode',
      'addressField', // Also check for addressField (actual node type name)
      'ranking',
      'lookupField',
      'fileField',
      'signatureField',
      'matrixField',
    ]);
    if (type && answerNodeTypes.has(type)) {
      // For ranking field, use order instead of value
      let value: any = type === 'ranking' ? ((attrs as any).order || []) : (attrs as any).value;
      
      // Check for nodeGroupValues if value is empty (for grouped/ungrouped subjects)
      if ((!value || value === '' || (Array.isArray(value) && value.length === 0)) && (attrs as any).nodeGroupValues) {
        const nodeGroupValues = (attrs as any).nodeGroupValues;
        // Extract the first value from nodeGroupValues (could be ungrouped or grouped)
        const groupKeys = Object.keys(nodeGroupValues);
        if (groupKeys.length > 0) {
          // For ungrouped subjects, there's typically one key like "ungrouped-{id}"
          // For grouped subjects, there might be multiple keys like "group-{id}"
          // Take the first non-empty value
          for (const key of groupKeys) {
            const groupValue = nodeGroupValues[key];
            if (groupValue !== null && groupValue !== undefined && groupValue !== '') {
              value = groupValue;
              break;
            }
          }
        }
      }
      // Compute points/correctness for choice fields
      let points: number | undefined = undefined;
      let maxPoints: number | undefined = undefined;
      let isCorrect: boolean | undefined = undefined;

      // Extract tags from attrs
      const tags = Array.isArray((attrs as any).tags) ? (attrs as any).tags : undefined;

      // Extract actual label from node content (paragraph text) - do this once for all field types
      let actualLabel = (attrs as any).label;
      if (node.content && Array.isArray(node.content)) {
        // Find the first paragraph or heading in content
        const findLabelInContent = (content: any[]): string | undefined => {
          for (const item of content) {
            if (item.type === 'paragraph' || item.type === 'heading') {
              if (item.content && Array.isArray(item.content)) {
                // Extract text from content
                const textParts = item.content
                  .filter((c: any) => c.type === 'text')
                  .map((c: any) => c.text || '')
                  .join('');
                if (textParts.trim()) {
                  return textParts.trim();
                }
              }
            }
            // Recursively search in nested content
            if (item.content && Array.isArray(item.content)) {
              const nestedLabel = findLabelInContent(item.content);
              if (nestedLabel) return nestedLabel;
            }
          }
          return undefined;
        };
        const contentLabel = findLabelInContent(node.content);
        if (contentLabel) {
          actualLabel = contentLabel;
        }
      }

      if (type === 'singleChoice') {
        const selected: string | undefined = value;
        const optionPoints = (attrs as any).optionPoints || {};
        // const optionLimits = (attrs as any).optionLimits || {};
        // const allowOther = (attrs as any).allowOther || false;
        const otherPlaceholder = (attrs as any).otherPlaceholder || 'Other…';
        
        // Extract all options from node content
        const allOptions: OptionDetail[] = [];
        
        // For yesno variant
        if ((attrs as any).variant === 'yesno') {
          ['Yes', 'No'].forEach((optValue) => {
            const entry = optionPoints[optValue] || {};
            allOptions.push({
              label: optValue,
              value: optValue,
              points: typeof entry.points === 'number' ? entry.points : entry.points != null ? Number(entry.points) : undefined,
              isCorrect: String(entry?.isCorrect).toLowerCase() === 'true',
              selected: selected === optValue,
            });
          });
        } else {
          // Helper function to extract text from content (recursive to handle nested structures)
          const extractTextFromContent = (contentNode: any): string => {
            if (!contentNode) return '';
            if (contentNode.textContent) return contentNode.textContent;
            if (contentNode.content && Array.isArray(contentNode.content)) {
              // Recursively extract text from all text nodes
              const extractRecursive = (nodes: any[]): string => {
                let text = '';
                for (const node of nodes) {
                  if (node.type === 'text' && node.text) {
                    text += node.text;
                  } else if (node.content && Array.isArray(node.content)) {
                    text += extractRecursive(node.content);
                  }
                }
                return text.trim();
              };
              return extractRecursive(contentNode.content);
            }
            return '';
          };
          
          // Extract options from node content
          if (node.content && Array.isArray(node.content)) {
            node.content.forEach((child: any) => {
              if (child.type === 'singleChoiceOption') {
                const optValue = child.attrs?.value || '';
                // Extract label from content - prefer actual text content over option value
                let optLabel = extractTextFromContent(child);
                // Only fallback to attrs.value if we couldn't extract any text
                if (!optLabel || optLabel.trim() === '') {
                  optLabel = child.attrs?.value || optValue;
                }
                const entry = optionPoints[optValue] || {};
                allOptions.push({
                  label: optLabel,
                  value: optValue,
                  points: typeof entry.points === 'number' ? entry.points : entry.points != null ? Number(entry.points) : undefined,
                  isCorrect: String(entry?.isCorrect).toLowerCase() === 'true',
                  selected: selected === optValue,
                });
              } else if (child.type === 'singleChoiceOther') {
                let otherText = extractTextFromContent(child);
                if (!otherText || otherText.trim() === '') {
                  otherText = otherPlaceholder;
                }
                const entry = optionPoints['__other__'] || {};
                allOptions.push({
                  label: otherText,
                  value: '__other__',
                  points: typeof entry.points === 'number' ? entry.points : entry.points != null ? Number(entry.points) : undefined,
                  isCorrect: String(entry?.isCorrect).toLowerCase() === 'true',
                  selected: selected === '__other__',
                });
              }
            });
          }
        }
        
        if (selected) {
          const entry = optionPoints[selected];
          const p = entry?.points;
          const numP = typeof p === 'number' ? p : p != null ? Number(p) : 0;
          isCorrect = String(entry?.isCorrect).toLowerCase() === 'true';
          // Only include points when option is correct and points are non-negative
          points =
            isCorrect && numP >= 0
              ? numP
              : isCorrect && numP < 0
                ? 0
                : undefined;
          if (points === undefined && selected) points = 0;
        }
        // Max points: only from correct options, excluding negative points
        const singleVals = Object.values(optionPoints || {})
          .filter(
            (e: any) => String(e?.isCorrect).toLowerCase() === 'true'
          )
          .map((e: any) => {
            const p = typeof e?.points === 'number' ? e.points : Number(e?.points);
            return typeof p === 'number' && !Number.isNaN(p) && p >= 0 ? p : 0;
          });
        maxPoints = singleVals.length ? Math.max(...singleVals) : undefined;
        
        // Extract "Other" value if selected
        let otherValue: string | undefined = undefined;
        if (selected === '__other__' && node.content && Array.isArray(node.content)) {
          const otherNode = node.content.find((child: any) => child.type === 'singleChoiceOther');
          if (otherNode) {
            // Extract text from node content
            if (otherNode.content && Array.isArray(otherNode.content)) {
              const textParts = otherNode.content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text || '')
                .join('');
              otherValue = textParts.trim() || undefined;
            } else if (otherNode.textContent) {
              otherValue = otherNode.textContent.trim() || undefined;
            }
          }
        }
        
        const failCritical =
          typeof (attrs as any).failCritical === 'string'
            ? (attrs as any).failCritical === 'true'
            : !!((attrs as any).failCritical);
        const enablePoints =
          (attrs as any).enablePoints === true || (attrs as any).enablePoints === 'true';
        const enablePassFail =
          (attrs as any).enablePassFail === true || (attrs as any).enablePassFail === 'true';
        const row: FieldRow = {
          label: actualLabel,
          name: (attrs as any).name,
          type,
          variant,
          value: selected,
          points,
          maxPoints,
          isCorrect,
          failCritical,
          enablePoints,
          enablePassFail,
          options: allOptions.length > 0 ? allOptions : undefined,
          otherValue,
          tags,
        };
        const key = `${row.name || ''}|${row.type || ''}|${row.variant || ''}`;
        byKey[key] = row;
        return; // Skip the default row creation below
      }

      if (type === 'matrixField') {
        const columns = Array.isArray((attrs as any).columns) ? (attrs as any).columns : [];
        const rows = Array.isArray((attrs as any).rows) ? (attrs as any).rows : [];
        const rules = Array.isArray((attrs as any).rules) ? (attrs as any).rules : [];
        let cells: Record<string, Record<string, any>> = (attrs as any).cells && typeof (attrs as any).cells === 'object' ? (attrs as any).cells : {};
        const nodeGroupValues = (attrs as any).nodeGroupValues && typeof (attrs as any).nodeGroupValues === 'object' ? (attrs as any).nodeGroupValues : {};
        if (Object.keys(cells).length === 0 && Object.keys(nodeGroupValues).length > 0) {
          const firstKey = Object.keys(nodeGroupValues)[0];
          const firstCells = nodeGroupValues[firstKey];
          if (firstCells && typeof firstCells === 'object') {
            cells = firstCells;
          }
        }
        const matrixSummary = getMatrixSummary(cells, columns, rows, rules);
        const totalPoints = matrixSummary.totalPoints;
        const totalMaxPoints = matrixSummary.totalMaxPoints;
        const passCount = matrixSummary.passCount;
        const failCount = matrixSummary.failCount;
        const totalPassFail = matrixSummary.totalPassFail;
        const passedCellCount = matrixSummary.passedCellCount ?? passCount;
        const failedCellCount = matrixSummary.failedCellCount ?? failCount;
        const hasCriticalFail = matrixSummary.hasCriticalFail;
        const hasPassFail = totalPassFail > 0 || passCount > 0 || failCount > 0;
        const row: FieldRow = {
          label: (attrs as any).label || 'Matrix',
          name: (attrs as any).name,
          type: 'matrixField',
          variant: (attrs as any).matrixType || 'mixed',
          value: cells,
          points: totalMaxPoints > 0 ? totalPoints : undefined,
          maxPoints: totalMaxPoints > 0 ? totalMaxPoints : undefined,
          isCorrect: hasCriticalFail ? false : (hasPassFail ? failCount === 0 : undefined),
          failCritical: hasCriticalFail,
          enablePoints: totalMaxPoints > 0,
          enablePassFail: hasPassFail,
          tags,
          matrixSummarySnapshot: {
            totalPoints,
            totalMaxPoints,
            passCount,
            failCount,
            totalPassFail,
            passedCellCount,
            failedCellCount,
            hasCriticalFail,
            perRow: Array.isArray(matrixSummary.perRow) ? matrixSummary.perRow.map((p: any) => ({
              rowId: p.rowId,
              label: rows.find((r: any) => r.id === p.rowId)?.label,
              points: p.points,
              maxPoints: p.maxPoints,
              pass: p.pass,
              fail: p.fail,
              criticalFail: p.criticalFail,
            })) : undefined,
          },
          matrixColumns: columns.map((c: any) => ({
            id: c.id,
            label: c.label || c.id,
            type: c.type || 'text',
            options: Array.isArray(c.options) ? c.options : [],
            optionPoints: c.optionPoints && typeof c.optionPoints === 'object' ? c.optionPoints : {},
            enablePoints: c.enablePoints === true || c.enablePoints === 'true',
            enablePassFail: c.enablePassFail === true || c.enablePassFail === 'true',
          })),
          matrixRows: rows.map((r: any) => ({ id: r.id, label: r.label || r.id })),
        };
        const key = `${row.name || ''}|${row.type || ''}|${(attrs as any).id ?? ''}`;
        byKey[key] = row;
        return;
      }

      if (type === 'fileField') {
        const fromAttrFiles = Array.isArray((attrs as any).files) ? (attrs as any).files : [];
        const nodeGroupValues = (attrs as any).nodeGroupValues && typeof (attrs as any).nodeGroupValues === 'object'
          ? (attrs as any).nodeGroupValues
          : {};
        let files: any[] = fromAttrFiles;
        if (files.length === 0 && Object.keys(nodeGroupValues).length > 0) {
          for (const key of Object.keys(nodeGroupValues)) {
            const candidate = nodeGroupValues[key];
            if (Array.isArray(candidate) && candidate.length > 0) {
              files = candidate;
              break;
            }
          }
        }

        if (files.length > 0) {
          const fileItems = files.map((f: any) => ({
            name: f?.name || '',
            url: f?.url || '',
            size: typeof f?.size === 'number' ? f.size : Number(f?.size) || undefined,
            mime: f?.mime || '',
            scanStatus: f?.scanStatus || '',
            uploadedAt: f?.uploadedAt || '',
          }));
          const row: FieldRow = {
            label: actualLabel || 'File Upload',
            name: (attrs as any).name,
            type,
            variant,
            value: fileItems,
            fileItems,
            tags,
          };
          const key = `${row.name || ''}|${row.type || ''}|${(attrs as any).id ?? ''}`;
          byKey[key] = row;
        }
        return;
      }

      if (type === 'signatureField') {
        const nodeGroupValues = (attrs as any).nodeGroupValues && typeof (attrs as any).nodeGroupValues === 'object'
          ? (attrs as any).nodeGroupValues
          : {};
        let signature = {
          mode: (attrs as any).mode as 'draw' | 'type' | undefined,
          signerName: (attrs as any).signerName ?? null,
          timestamp: (attrs as any).timestamp ?? null,
          uploadedUrl: (attrs as any).uploadedUrl ?? null,
          dataUrl: (attrs as any).dataUrl ?? null,
        };
        const hasSignature =
          !!signature.uploadedUrl || !!signature.dataUrl || !!signature.signerName || !!signature.timestamp;
        if (!hasSignature && Object.keys(nodeGroupValues).length > 0) {
          for (const key of Object.keys(nodeGroupValues)) {
            const candidate = nodeGroupValues[key];
            if (candidate && typeof candidate === 'object') {
              const next = {
                mode: candidate.mode as 'draw' | 'type' | undefined,
                signerName: candidate.signerName ?? null,
                timestamp: candidate.timestamp ?? null,
                uploadedUrl: candidate.uploadedUrl ?? null,
                dataUrl: candidate.dataUrl ?? null,
              };
              if (next.uploadedUrl || next.dataUrl || next.signerName || next.timestamp) {
                signature = next;
                break;
              }
            }
          }
        }

        if (signature.uploadedUrl || signature.dataUrl || signature.signerName || signature.timestamp) {
          const row: FieldRow = {
            label: actualLabel || 'Signature',
            name: (attrs as any).name,
            type,
            variant,
            value: signature,
            signatureInfo: signature,
            tags,
          };
          const key = `${row.name || ''}|${row.type || ''}|${(attrs as any).id ?? ''}`;
          byKey[key] = row;
        }
        return;
      }

      if (type === 'multipleChoice') {
        const selected: string[] = Array.isArray(value) ? value : [];
        const optionPoints = (attrs as any).optionPoints || {};
        // const optionLimits = (attrs as any).optionLimits || {};
        // const allowOther = (attrs as any).allowOther || false;
        const otherPlaceholder = (attrs as any).otherPlaceholder || 'Other…';
        
        // Extract all options from node content
        const allOptions: OptionDetail[] = [];
        
        // For yesno variant
        if ((attrs as any).variant === 'yesno') {
          ['Yes', 'No'].forEach((optValue) => {
            const entry = optionPoints[optValue] || {};
            allOptions.push({
              label: optValue,
              value: optValue,
              points: typeof entry.points === 'number' ? entry.points : entry.points != null ? Number(entry.points) : undefined,
              isCorrect: String(entry?.isCorrect).toLowerCase() === 'true',
              selected: selected.includes(optValue),
            });
          });
        } else {
          // Helper function to extract text from content (recursive to handle nested structures)
          const extractTextFromContent = (contentNode: any): string => {
            if (!contentNode) return '';
            if (contentNode.textContent) return contentNode.textContent;
            if (contentNode.content && Array.isArray(contentNode.content)) {
              // Recursively extract text from all text nodes
              const extractRecursive = (nodes: any[]): string => {
                let text = '';
                for (const node of nodes) {
                  if (node.type === 'text' && node.text) {
                    text += node.text;
                  } else if (node.content && Array.isArray(node.content)) {
                    text += extractRecursive(node.content);
                  }
                }
                return text.trim();
              };
              return extractRecursive(contentNode.content);
            }
            return '';
          };
          
          // Extract options from node content
          if (node.content && Array.isArray(node.content)) {
            node.content.forEach((child: any) => {
              if (child.type === 'multipleChoiceOption') {
                const optValue = child.attrs?.value || '';
                // Extract label from content - prefer actual text content over option value
                let optLabel = extractTextFromContent(child);
                // Only fallback to attrs.value if we couldn't extract any text
                if (!optLabel || optLabel.trim() === '') {
                  optLabel = child.attrs?.value || optValue;
                }
                const entry = optionPoints[optValue] || {};
                allOptions.push({
                  label: optLabel,
                  value: optValue,
                  points: typeof entry.points === 'number' ? entry.points : entry.points != null ? Number(entry.points) : undefined,
                  isCorrect: String(entry?.isCorrect).toLowerCase() === 'true',
                  selected: selected.includes(optValue),
                });
              } else if (child.type === 'multipleChoiceOther') {
                let otherText = extractTextFromContent(child);
                if (!otherText || otherText.trim() === '') {
                  otherText = otherPlaceholder;
                }
                const entry = optionPoints['__other__'] || {};
                allOptions.push({
                  label: otherText,
                  value: '__other__',
                  points: typeof entry.points === 'number' ? entry.points : entry.points != null ? Number(entry.points) : undefined,
                  isCorrect: String(entry?.isCorrect).toLowerCase() === 'true',
                  selected: selected.includes('__other__'),
                });
              }
            });
          }
        }
        
        let total = 0;
        let allCorrect = selected.length > 0;
        selected.forEach((opt: string) => {
          const entry = optionPoints[opt];
          const p = entry?.points;
          const numP = typeof p === 'number' ? p : p != null ? Number(p) : 0;
          const optCorrect = String(entry?.isCorrect).toLowerCase() === 'true';
          // Only include points when option is correct and points are non-negative
          if (optCorrect && numP >= 0) total += numP;
          if (!optCorrect) allCorrect = false;
        });
        points = selected.length ? total : undefined;
        isCorrect = selected.length ? allCorrect : undefined;
        // Max points: only from correct options, excluding negative points
        const vals = Object.values(optionPoints || {})
          .filter((e: any) => String(e?.isCorrect).toLowerCase() === 'true')
          .map((e: any) => {
            const p = typeof e?.points === 'number' ? e.points : Number(e?.points);
            return typeof p === 'number' && !Number.isNaN(p) && p >= 0 ? p : 0;
          });
        maxPoints = vals.length ? vals.reduce((a: number, b: number) => a + b, 0) : undefined;
        
        // Extract "Other" value if selected
        let otherValue: string | undefined = undefined;
        if (selected.includes('__other__') && node.content && Array.isArray(node.content)) {
          const otherNode = node.content.find((child: any) => child.type === 'multipleChoiceOther');
          if (otherNode) {
            // Extract text from node content
            if (otherNode.content && Array.isArray(otherNode.content)) {
              const textParts = otherNode.content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text || '')
                .join('');
              otherValue = textParts.trim() || undefined;
            } else if (otherNode.textContent) {
              otherValue = otherNode.textContent.trim() || undefined;
            }
          }
        }
        const failCritical =
          typeof (attrs as any).failCritical === 'string'
            ? (attrs as any).failCritical === 'true'
            : !!((attrs as any).failCritical);
        const enablePoints =
          (attrs as any).enablePoints === true || (attrs as any).enablePoints === 'true';
        const enablePassFail =
          (attrs as any).enablePassFail === true || (attrs as any).enablePassFail === 'true';
        const row: FieldRow = {
          label: actualLabel,
          name: (attrs as any).name,
          type,
          variant,
          value: selected,
          points,
          maxPoints,
          isCorrect,
          failCritical,
          enablePoints,
          enablePassFail,
          options: allOptions.length > 0 ? allOptions : undefined,
          otherValue,
          tags,
        };
        const key = `${row.name || ''}|${row.type || ''}|${row.variant || ''}`;
        byKey[key] = row;
        return; // Skip the default row creation below
      }

      // Normalize values for display (only for non-choice fields)
      if (type !== 'singleChoice' && type !== 'multipleChoice') {
        if (type === 'richText' && typeof value === 'string')
          value = value.replace(/<[^>]+>/g, '').trim();
        
        // Handle special field types
        if (type === 'sliderField') {
          // For range mode, value is an array [min, max]
          // For single mode, value is a number
          if (Array.isArray(value) && value.length === 2) {
            // Range mode - format as "min - max"
            value = `${value[0]} - ${value[1]}`;
          }
          // Single mode - keep as number (no transformation needed)
        } else if (type === 'ranking') {
          // Ranking value is an array of ordered item IDs or labels
          // Try to get the actual order from attrs.order or use value as-is
          const order = (attrs as any).order || [];
          const options = (attrs as any).options || [];
          if (Array.isArray(order) && order.length > 0 && Array.isArray(options)) {
            // Map order IDs to option labels
            const orderMap = new Map(options.map((opt: any, idx: number) => {
              const optId = typeof opt === 'string' ? `${opt}-${idx}` : opt.id || `${opt}-${idx}`;
              const optLabel = typeof opt === 'string' ? opt : opt.label || opt;
              return [optId, optLabel];
            }));
            const rankedLabels = order
              .map((id: string) => orderMap.get(id) || id)
              .filter((label: string) => label);
            value = rankedLabels.length > 0 ? rankedLabels : value;
          }
        } else if (type === 'addressNode' || type === 'addressField') {
          // Preserve all address components for detailed display
          const addressComponents = {
            street: (attrs as any).street || '',
            apartment: (attrs as any).apartment || '',
            city: (attrs as any).city || '',
            state: (attrs as any).state || '',
            postalCode: (attrs as any).postalCode || '',
            country: (attrs as any).country || '',
            formatted: (attrs as any).formatted || '',
            lat: (attrs as any).lat ?? null,
            lng: (attrs as any).lng ?? null,
          };
          
          // Check if any address component has a value
          const hasAnyValue = Object.values(addressComponents).some(
            (v) => v !== null && v !== undefined && v !== '' && (typeof v !== 'string' || v.trim().length > 0)
          );
          
          if (hasAnyValue) {
            // Use formatted if available, otherwise build from components
            const formatted = addressComponents.formatted?.trim();
            if (formatted) {
              value = formatted;
            } else {
              // Build from individual fields
              const parts = [
                addressComponents.street,
                addressComponents.apartment,
                addressComponents.city,
                addressComponents.state,
                addressComponents.postalCode,
                addressComponents.country,
              ].filter((p) => p && String(p).trim());
              value = parts.length > 0 ? parts.join(', ') : '';
            }
          } else {
            value = '';
          }
          
          // Store address components for detailed display
          const row: FieldRow = {
            label: actualLabel,
            name: (attrs as any).name,
            type,
            variant,
            value,
            points,
            maxPoints,
            isCorrect,
            addressComponents: hasAnyValue ? addressComponents : undefined,
            tags,
          };
          const key = `${row.name || ''}|${row.type || ''}|${row.variant || ''}`;
          byKey[key] = row;
          return; // Skip the default row creation below
        } else if (type === 'dateField' || type === 'dateTimeField') {
          // Preserve raw date value for proper formatting
          const rawDateValue = typeof value === 'string' ? value : null;
          
          // Format date for display but keep raw value
          if (typeof value === 'string' && value) {
            try {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                if (type === 'dateTimeField') {
                  value = date.toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: (attrs as any).showSeconds ? '2-digit' : undefined,
                    hour12: (attrs as any).timeFormat === '12',
                  });
                } else {
                  value = date.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  });
                }
              }
            } catch {
              // Keep original value if parsing fails
            }
          }
          
          // Store row with raw date value
          const row: FieldRow = {
            label: actualLabel,
            name: (attrs as any).name,
            type,
            variant,
            value,
            points,
            maxPoints,
            isCorrect,
            rawDateValue: rawDateValue || undefined,
            tags,
          };
          const key = `${row.name || ''}|${row.type || ''}|${row.variant || ''}`;
          byKey[key] = row;
          return; // Skip the default row creation below
        }
        
        // Skip empty values
        const hasValue =
          (typeof value === 'string' && value.trim().length > 0) ||
          (Array.isArray(value) && value.length > 0) ||
          typeof value === 'number' ||
          typeof value === 'boolean';
        if (hasValue) {
          const row: FieldRow = {
            label: actualLabel,
            name: (attrs as any).name,
            type,
            variant,
            value,
            points,
            maxPoints,
            isCorrect,
            tags,
          };
          // include variant in key to distinguish same-name different shortText variants
          const key = `${row.name || ''}|${row.type || ''}|${row.variant || ''}`;
          // Keep the latest occurrence to reflect submitted values overriding defaults
          byKey[key] = row;
        }
      }
    }
    if (Array.isArray((node as any)?.content)) {
      (node as any).content.forEach((c: JSONContent) => walk(c));
    }
  };
  walk(doc);
  // Materialize in insertion order preference is last-write-wins; keep map values
  return Object.values(byKey);
};

