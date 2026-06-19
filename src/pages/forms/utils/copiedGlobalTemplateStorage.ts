import type { JSONContent } from '@tiptap/core';
import type { GlobalFormTemplateConfigSet } from '../../../services/globalFormTemplatesApi';

const STORAGE_KEY = 'evalhero_copied_global_template';

export interface CopiedGlobalTemplate {
  name: string;
  description?: string | null;
  formSchema?: JSONContent;
  totalScore?: number;
  totalPassFail?: number;
  configSets?: GlobalFormTemplateConfigSet[];
}

export function setCopiedGlobalTemplate(data: CopiedGlobalTemplate): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota / private mode
  }
}

export function getCopiedGlobalTemplate(): CopiedGlobalTemplate | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CopiedGlobalTemplate;
    if (!parsed || typeof parsed.name !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasCopiedGlobalTemplate(): boolean {
  return getCopiedGlobalTemplate() != null;
}
