import type { JSONContent } from '@tiptap/core';

type ScoringAcc = { totalScore: number; totalPassFail: number };

function toNum(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (v != null && v !== '') {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

function walk(node: JSONContent, acc: ScoringAcc): void {
  if (!node) return;
  const type = node.type;
  const attrs = (node.attrs || {}) as Record<string, unknown>;
  const optionPoints = attrs.optionPoints as Record<string, { points?: unknown; isCorrect?: unknown }> | undefined;

  if (type === 'singleChoice') {
    const enablePoints =
      attrs.enablePoints === true || attrs.enablePoints === 'true';
    const enablePassFail =
      attrs.enablePassFail === true || attrs.enablePassFail === 'true';
    if (enablePassFail) acc.totalPassFail += 1;
    if (enablePoints && optionPoints && typeof optionPoints === 'object' && !Array.isArray(optionPoints)) {
      let max = 0;
      for (const key of Object.keys(optionPoints)) {
        const entry = optionPoints[key];
        const p = toNum(entry?.points);
        if (p >= 0) max = Math.max(max, p);
      }
      acc.totalScore += max;
    }
  }

  if (type === 'multipleChoice') {
    const enablePoints =
      attrs.enablePoints === true || attrs.enablePoints === 'true';
    const enablePassFail =
      attrs.enablePassFail === true || attrs.enablePassFail === 'true';
    if (enablePassFail) acc.totalPassFail += 1;
    if (enablePoints && optionPoints && typeof optionPoints === 'object' && !Array.isArray(optionPoints)) {
      let sum = 0;
      for (const key of Object.keys(optionPoints)) {
        const entry = optionPoints[key];
        const p = toNum(entry?.points);
        if (p >= 0) sum += p;
      }
      acc.totalScore += sum;
    }
  }

  // Matrix field: use pre-calculated attrs.matrixSummary (totalMaxPoints/totalScore and totalPassFail)
  if (type === 'matrixField') {
    const matrixSummary = attrs.matrixSummary as { totalMaxPoints?: unknown; totalScore?: unknown; totalPassFail?: unknown } | undefined;
    if (matrixSummary && typeof matrixSummary === 'object') {
      const maxPts = matrixSummary.totalMaxPoints ?? matrixSummary.totalScore;
      if (maxPts != null) acc.totalScore += toNum(maxPts);
      if (matrixSummary.totalPassFail != null) acc.totalPassFail += toNum(matrixSummary.totalPassFail);
      else {
        const columns = (attrs.columns || []) as Array<{ type?: string; enablePassFail?: boolean | string }>;
        const rows = (attrs.rows || []) as Array<unknown>;
        const hasPassFail = columns.some(
          (c) => (c.type === 'choice' || c.type === 'multiple') && (c.enablePassFail === true || (c.enablePassFail as string) === 'true')
        );
        if (hasPassFail && Array.isArray(rows)) acc.totalPassFail += rows.length;
      }
    }
  }

  if (node.content && Array.isArray(node.content)) {
    node.content.forEach((child) => walk(child, acc));
  }
}

/**
 * Compute totalScore (sum of max points from single/multiple choice and matrix with scoring enabled)
 * and totalPassFail (count of single/multiple choice with Pass/Fail + matrix rows with Pass/Fail columns) from form schema.
 */
export function computeScoringFromSchema(
  schema: JSONContent | null | undefined
): { totalScore: number; totalPassFail: number } {
  const acc: ScoringAcc = { totalScore: 0, totalPassFail: 0 };
  if (schema) walk(schema, acc);
  return acc;
}
