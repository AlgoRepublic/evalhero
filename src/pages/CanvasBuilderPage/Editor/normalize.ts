/* eslint-disable @typescript-eslint/no-explicit-any */
import dayjs from 'dayjs';
import { Parser } from 'expr-eval';
import { message } from 'antd';
import { genId } from './utils';

export const normalizeTemplateMeta = (vals: any) => ({
  name: vals.name?.trim(),
  code: vals.code?.trim(),
  description: vals.description?.trim(),
  hasApproval: !!vals.hasApproval,
  hasDisputes: !!vals.hasDisputes,
  signatureRequired: !!vals.signatureRequired,
});

export const normalizeEditorNode = (node: any, values: Record<string, any>) => {
  // shared conversions
  const toNumber = (v: any) => (v === '' || v == null ? undefined : Number(v));
  const toArray = (str?: string) =>
    str?.split(',').map((s: string) => s.trim()).filter(Boolean) ?? [];

  // numeric
  ['min', 'max', 'step', 'scale', 'value'].forEach((k) => {
    if (values[k] != null) values[k] = toNumber(values[k]);
  });

  // booleans
  [
    'allowOther',
    'required',
    'showTicks',
    'rangeMode',
    'allowHalf',
    'notInFuture',
    'notInPast',
    'approvalRequired',
  ].forEach((k) => (values[k] = !!values[k]));

  // strings → arrays
  if (values.options) values.options = toArray(values.options);
  if (values.requiredKeywords) values.requiredKeywords = toArray(values.requiredKeywords);
  if (values.anchorLabels) values.anchorLabels = toArray(values.anchorLabels);

  // marks: try JSON
  if (values.marks && typeof values.marks === 'string') {
    try {
      values.marks = JSON.parse(values.marks);
    } catch {
      const marks: Record<string, string> = {};
      values.marks.split(',').forEach((m: string) => {
        const [k, label] = m.split(':');
        if (k) marks[k.trim()] = label?.trim() ?? k.trim();
      });
      values.marks = marks;
    }
  }

  // dates
  ['min', 'max', 'value'].forEach((key) => {
    const val = values[key];
    if (dayjs.isDayjs(val)) values[key] = val.toISOString();
  });

  // computedField validation
  if (node.type === 'computedField' && values.expression) {
    try {
      const parser = new Parser();
      parser.parse(values.expression);
    } catch (err: any) {
      message.error(`Invalid expression: ${err.message}`);
      throw err;
    }
  }

  // matrixField normalization
  if (node.type === 'matrixField') {
    values.columns = normalizeMatrixColumns(values.columnsJson);
    values.rows = normalizeMatrixRows(values.rowsJson);
    delete values.columnsJson;
    delete values.rowsJson;
  }

  return values;
};

const normalizeMatrixColumns = (colsJson?: string) => {
  if (!colsJson) return [];
  try {
    const arr = JSON.parse(colsJson);
    return arr.map((c: any, i: number) => ({
      id: c.id || genId(),
      label: c.label || `Column ${i + 1}`,
      type: c.type || 'text',
      options: Array.isArray(c.options)
        ? c.options
        : typeof c.options === 'string'
        ? c.options.split(',').map((x: string) => x.trim())
        : [],
    }));
  } catch {
    message.error('Invalid columns JSON');
    return [];
  }
};

const normalizeMatrixRows = (rowsJson?: string) => {
  if (!rowsJson) return [];
  try {
    const arr = JSON.parse(rowsJson);
    return arr.map((r: any, i: number) => ({
      id: r.id || genId(),
      label: r.label || `Row ${i + 1}`,
    }));
  } catch {
    return rowsJson
      .split('\n')
      .map((l: string, i: number) => ({ id: genId(), label: l || `Row ${i + 1}` }));
  }
};
