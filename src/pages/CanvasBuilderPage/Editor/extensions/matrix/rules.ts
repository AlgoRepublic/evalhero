/* eslint-disable @typescript-eslint/no-explicit-any */
import { normalizeValue } from './utils';

// Enhanced rule evaluation with multiple operators - works with specific cells
export const evalRowViolationsForCells = (
  rowId: string,
  cellsToCheck: Record<string, Record<string, any>>,
  rules: any[],
  columns: any[]
): Record<string, string> => {
  const violations: Record<string, string> = {};
  rules.forEach((rule: any) => {
    const when = rule.when || {};
    const then = rule.then || {};
    const actual = (cellsToCheck[rowId] && cellsToCheck[rowId][when.colId]) ?? null;
    // Normalize value for comparison
    const col = columns.find((c: any) => c.id === when.colId);
    const normalizedActual = col && actual !== null ? normalizeValue(actual, col.type) : actual;
    let triggered = false;
    
    switch (when.op) {
      case '==':
      case 'equals':
        triggered = String(normalizedActual) === String(when.value);
        break;
      case '!=':
      case 'not_equals':
        triggered = String(normalizedActual) !== String(when.value);
        break;
      case 'in':
      case 'contains':
        triggered = Array.isArray(normalizedActual)
          ? normalizedActual.includes(when.value)
          : String(normalizedActual).includes(String(when.value));
        break;
      case 'not_in':
      case 'not_contains':
        triggered = Array.isArray(normalizedActual)
          ? !normalizedActual.includes(when.value)
          : !String(normalizedActual).includes(String(when.value));
        break;
      case '>':
        triggered = Number(normalizedActual) > Number(when.value);
        break;
      case '>=':
        triggered = Number(normalizedActual) >= Number(when.value);
        break;
      case '<':
        triggered = Number(normalizedActual) < Number(when.value);
        break;
      case '<=':
        triggered = Number(normalizedActual) <= Number(when.value);
        break;
      case 'empty':
        triggered = normalizedActual === null || normalizedActual === undefined || String(normalizedActual || '').trim() === '';
        break;
      case 'not_empty':
        triggered = normalizedActual !== null && normalizedActual !== undefined && String(normalizedActual || '').trim() !== '';
        break;
      default:
        triggered = String(normalizedActual) === String(when.value);
    }
    
    if (triggered) {
      if (then.required) {
        const target = (cellsToCheck[rowId] && cellsToCheck[rowId][then.colId]) ?? null;
        const targetCol = columns.find((c: any) => c.id === then.colId);
        const normalizedTarget = targetCol && target !== null ? normalizeValue(target, targetCol.type) : target;
        const empty =
          normalizedTarget === null ||
          normalizedTarget === undefined ||
          (Array.isArray(normalizedTarget) ? normalizedTarget.length === 0 : String(normalizedTarget || '').trim() === '');
        if (empty) {
          violations[then.colId] = then.message || `Required because ${when.colId} ${when.op} ${when.value}`;
        }
      }
      if (then.hide) {
        // Handle hide logic if needed
      }
    }
  });
  return violations;
};
