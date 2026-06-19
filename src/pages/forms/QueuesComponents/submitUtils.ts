import { JSONContent } from '@tiptap/core';

/**
 * Extract node values from nodeGroupValues for a specific subject
 * This replaces node values with group-specific or ungrouped-subject-specific values
 */
export const buildSubjectAnswers = (
  schema: JSONContent,
  subjectId: string,
  globalGroups: Array<{ id: string; name: string; subjectIds: string[] }>,
  availableSubjects: Array<{ label: string; value: string }>
): JSONContent => {
  if (!schema || !schema.content) return schema;

  // Create a deep copy to avoid mutating the original
  const result: JSONContent = JSON.parse(JSON.stringify(schema));

  // Find which group this subject belongs to (in global groups - default)
  const globalGroup = globalGroups.find((g) => g.subjectIds.includes(subjectId));
  const isUngrouped = !globalGroup && availableSubjects.some((s) => s.value === subjectId);

  const walk = (node: JSONContent): void => {
    if (!node) return;

    const attrs = node.attrs || {};
    const nodeType = node.type;
    // Matrix nodes use 'cells' instead of 'value'
    const targetAttrKey = nodeType === 'ranking' ? 'order' : (nodeType === 'matrixField' ? 'cells' : 'value');

    // Convert enableGrouping to boolean (handles string "true"/"false")
    const enableGrouping = attrs.enableGrouping === true || attrs.enableGrouping === 'true';
    const nodeGroupValues = attrs.nodeGroupValues || {};

    // Always check nodeGroupValues first, even if enableGrouping is false
    // This handles cases where nodeGroupValues exist but enableGrouping flag is false
    const hasNodeGroupValues = nodeGroupValues && typeof nodeGroupValues === 'object' && Object.keys(nodeGroupValues).length > 0;

    // Check if this node has node-based grouping
    if (enableGrouping && attrs.nodeGroups && Array.isArray(attrs.nodeGroups)) {
      const nodeGroups = attrs.nodeGroups as Array<{ id: string; name: string; subjectIds: string[] }>;

      // Find which node group this subject belongs to
      const nodeGroup = nodeGroups.find((g) => g.subjectIds.includes(subjectId));
      
      if (nodeGroup) {
        // Subject is in a node group - use group value
        const groupKey = `group-${nodeGroup.id}`;
        const groupValue = nodeGroupValues[groupKey];
        if (groupValue !== undefined && groupValue !== null && groupValue !== '') {
          (attrs as any)[targetAttrKey] = groupValue;
        }
      } else {
        // Subject is not in any node group - check if it's ungrouped for this node
        const ungroupedKey = `ungrouped-${subjectId}`;
        const ungroupedValue = nodeGroupValues[ungroupedKey];
        if (ungroupedValue !== undefined && ungroupedValue !== null && ungroupedValue !== '') {
          (attrs as any)[targetAttrKey] = ungroupedValue;
        }
        // If no value found, leave the default value from schema
      }
    } else if (hasNodeGroupValues || globalGroup || isUngrouped) {
      // Node has nodeGroupValues (even if enableGrouping is false) OR has global groups
      // Check if node has nodeGroupValues that might be set from global groups or synced values
      
      if (globalGroup) {
        // Try global group key first
        const globalGroupKey = `group-${globalGroup.id}`;
        const globalValue = nodeGroupValues[globalGroupKey];
        if (globalValue !== undefined && globalValue !== null && globalValue !== '') {
          (attrs as any)[targetAttrKey] = globalValue;
          return; // Found value, stop processing
        }
      }
      
      // Check for ungrouped value (always check this, even if in a group, as values might be synced)
      const ungroupedKey = `ungrouped-${subjectId}`;
      const ungroupedValue = nodeGroupValues[ungroupedKey];
      if (ungroupedValue !== undefined && ungroupedValue !== null && ungroupedValue !== '') {
        (attrs as any)[targetAttrKey] = ungroupedValue;
        return; // Found value, stop processing
      }
      
      // If in a global group and no ungrouped value found, try group value again
      if (globalGroup && !ungroupedValue) {
        const globalGroupKey = `group-${globalGroup.id}`;
        const globalValue = nodeGroupValues[globalGroupKey];
        if (globalValue !== undefined && globalValue !== null && globalValue !== '') {
          (attrs as any)[targetAttrKey] = globalValue;
        }
      }
    }

    // Recursively process child nodes
    if (Array.isArray(node.content)) {
      node.content.forEach((child) => walk(child));
    }
  };

  // Process all nodes in the schema
  if (Array.isArray(result.content)) {
    result.content.forEach((node) => walk(node));
  }

  return result;
};

/**
 * Get complete form data for a specific subject
 * Returns the form schema with all values populated for that subject
 */
export const getSubjectFormData = (
  schema: JSONContent,
  subjectId: string,
  globalGroups: Array<{ id: string; name: string; subjectIds: string[] }>,
  availableSubjects: Array<{ label: string; value: string }>,
  allSubjects: Array<{ label: string; value: string }>
) => {
  // Find subject info
  const globalGroup = globalGroups.find((g) => g.subjectIds.includes(subjectId));
  const subject = allSubjects.find((s) => s.value === subjectId);
  
  const subjectInfo = {
    subjectId,
    subjectName: subject?.label || 'Unknown',
    groupId: globalGroup?.id || null,
    groupName: globalGroup?.name || null,
    type: (globalGroup ? 'grouped' : 'ungrouped') as 'grouped' | 'ungrouped',
  };

  // Get the form with subject-specific answers
  const formWithAnswers = buildSubjectAnswers(
    schema,
    subjectId,
    globalGroups,
    availableSubjects
  );

  return {
    metadata: subjectInfo,
    form: formWithAnswers,
    timestamp: new Date().toISOString(),
  };
};

