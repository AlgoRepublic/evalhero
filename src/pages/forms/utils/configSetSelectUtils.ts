/**
 * Shared helpers for "Config Set (Optional)" select with two groups:
 * 1) From selected template (if any)
 * 2) Global config sets (searchable)
 */
export const CONFIG_SET_VALUE_PREFIX = {
  template: 't:',
  global: 'g:',
} as const;

export type ConfigSetLike = {
  _id?: string;
  name?: string;
  hasApproval?: boolean;
  hasDisputes?: boolean;
  signatureRequired?: boolean;
  omitSignatureAllowed?: boolean;
  approvalRule?: string;
  approvalMinCount?: number;
  approvers?: unknown[];
  questionApprovers?: unknown[];
  subjects?: unknown[];
  omitSignatureApprovers?: unknown[];
};

export interface ConfigSetOptionItem {
  label: string;
  value: string;
}

/** Group for Ant Design Select: { label, options } */
export interface ConfigSetOptionGroup {
  label: string;
  options: ConfigSetOptionItem[];
}

/**
 * Build grouped options: template config sets (value t:id) then global (value g:id).
 * Use empty string or undefined templateName to omit the template group label suffix.
 */
export function buildConfigSetSelectGroupedOptions(
  templateConfigSets: Array<{ _id?: string; name?: string }> | undefined,
  globalConfigSets: Array<{ _id: string; name: string; deletedAt?: string | null }>,
  templateName?: string
): ConfigSetOptionGroup[] {
  const groups: ConfigSetOptionGroup[] = [];
  const templateList = Array.isArray(templateConfigSets) ? templateConfigSets : [];
  const globalList = (globalConfigSets || []).filter((c) => !c.deletedAt);

  if (templateList.length > 0) {
    const groupLabel = templateName
      ? `From template: ${templateName}`
      : 'From template';
    groups.push({
      label: groupLabel,
      options: templateList
        .filter((cs) => cs._id)
        .map((cs) => ({
          label: cs.name ?? cs._id ?? '',
          value: `${CONFIG_SET_VALUE_PREFIX.template}${cs._id}`,
        })),
    });
  }

  if (globalList.length > 0) {
    groups.push({
      label: 'Global quick settings',
      options: globalList.map((c) => ({
        label: c.name,
        value: `${CONFIG_SET_VALUE_PREFIX.global}${c._id}`,
      })),
    });
  }

  return groups;
}

/**
 * Parse value from select (t:id or g:id). Returns { source, id } or null.
 */
export function parseConfigSetValue(
  value: string | undefined
): { source: 'template' | 'global'; id: string } | null {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith(CONFIG_SET_VALUE_PREFIX.template)) {
    return { source: 'template', id: value.slice(CONFIG_SET_VALUE_PREFIX.template.length) };
  }
  if (value.startsWith(CONFIG_SET_VALUE_PREFIX.global)) {
    return { source: 'global', id: value.slice(CONFIG_SET_VALUE_PREFIX.global.length) };
  }
  return null;
}

/**
 * Resolve config set object from select value (t:id or g:id).
 * Returns the config set from template list or global list, or undefined.
 */
export function getConfigSetFromValue(
  value: string | undefined,
  templateConfigSets: ConfigSetLike[] | undefined,
  globalConfigSets: ConfigSetLike[] | undefined
): ConfigSetLike | undefined {
  const parsed = parseConfigSetValue(value);
  if (!parsed) return undefined;
  if (parsed.source === 'template') {
    return (templateConfigSets || []).find((cs) => cs._id === parsed.id);
  }
  return (globalConfigSets || []).find((cs) => cs._id === parsed.id);
}

/**
 * For initializing form/state from a raw configSetId (e.g. from API).
 * Prefer template if id exists in template list, else use global prefix.
 */
export function normalizeConfigSetValue(
  configSetId: string | undefined,
  templateConfigSets: Array<{ _id?: string }> | undefined,
  globalConfigSets: Array<{ _id: string }> | undefined
): string | undefined {
  if (!configSetId) return undefined;
  const templateList = templateConfigSets || [];
  const globalList = globalConfigSets || [];
  if (templateList.some((cs) => cs._id === configSetId)) {
    return `${CONFIG_SET_VALUE_PREFIX.template}${configSetId}`;
  }
  if (globalList.some((c) => c._id === configSetId)) {
    return `${CONFIG_SET_VALUE_PREFIX.global}${configSetId}`;
  }
  return `${CONFIG_SET_VALUE_PREFIX.global}${configSetId}`;
}
