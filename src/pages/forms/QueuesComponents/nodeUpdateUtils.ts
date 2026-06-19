/* eslint-disable @typescript-eslint/no-explicit-any */
import { Editor } from '@tiptap/core';
import { JSONContent } from '@tiptap/core';
import { Node as ProseMirrorNode } from 'prosemirror-model';

/**
 * Find a node in the tiptap editor by ID, type, and optionally variant
 * Returns the node and its position if found
 */
export const findNodeInEditor = (
  editor: Editor,
  targetNode: { type: string; attrs: any }
): { node: ProseMirrorNode; pos: number } | null => {
  if (!editor || !editor.state) return null;

  const { state } = editor;
  const targetAttrs = targetNode.attrs || {};
  const targetId = targetAttrs.id;
  const targetName = targetAttrs.name;
  const targetLabel = targetAttrs.label;
  const targetType = targetNode.type;
  const targetVariant = targetAttrs.variant;

  let found: { node: ProseMirrorNode; pos: number } | null = null;

  // Helper to check if a node type supports variants
  const nodeTypeHasVariant = (nodeType: string): boolean => {
    const variantNodeTypes = [
      'shortText',
      'ratingField',
      'singleChoice',
      'multipleChoice',
    ];
    return variantNodeTypes.includes(nodeType);
  };

  // Helper to get default variant for a node type
  const getDefaultVariant = (nodeType: string): string => {
    const defaults: Record<string, string> = {
      shortText: 'text',
      ratingField: 'stars',
      singleChoice: 'radio',
      multipleChoice: 'checkbox',
    };
    return defaults[nodeType] || '';
  };

  // Walk through the document to find the node
  state.doc.descendants((node, pos) => {
    if (found) return false; // Stop if already found

    const nodeAttrs = node.attrs as any;
    const nodeId = nodeAttrs?.id;
    const nodeName = nodeAttrs?.name;
    const nodeLabel = nodeAttrs?.label;
    const nodeType = node.type.name;
    const nodeVariant = nodeAttrs?.variant;

    let matches = false;

    // Priority 1: Match by ID if both nodes have IDs (most reliable)
    if (targetId && nodeId && targetId === nodeId) {
      if (nodeType === targetType) {
        // For variant-supporting node types, also verify variant matches
        if (nodeTypeHasVariant(nodeType)) {
          const defaultVariant = getDefaultVariant(nodeType);
          const nodeVariantValue = nodeVariant || defaultVariant;
          const targetVariantValue = targetVariant || defaultVariant;
          if (nodeVariantValue === targetVariantValue) {
            matches = true;
          }
        } else {
          matches = true;
        }
      }
    }
    // Priority 2: Fallback to type + name/label matching for backward compatibility
    else if (nodeType === targetType) {
      const nameMatch = targetName && nodeName && targetName === nodeName;
      const labelMatch = targetLabel && nodeLabel && targetLabel === nodeLabel;
      
      if (nameMatch || labelMatch) {
        // For variant-supporting node types, also verify variant matches
        if (nodeTypeHasVariant(nodeType)) {
          const defaultVariant = getDefaultVariant(nodeType);
          const nodeVariantValue = nodeVariant || defaultVariant;
          const targetVariantValue = targetVariant || defaultVariant;
          if (nodeVariantValue === targetVariantValue) {
            matches = true;
          }
        } else {
          matches = true;
        }
      }
    }

    if (matches) {
      found = { node, pos };
      return false; // Stop traversal
    }

    return true; // Continue traversal
  });

  return found;
};

/**
 * Update node attributes in the tiptap editor
 * Properly merges nodeGroupApprovalStatus and other attributes
 * 
 * NOTE: Currently, nodeGroupApprovalStatus stores status as strings:
 *   Record<string, 'pending' | 'approved' | 'rejected'>
 * 
 * For future enhancement, consider storing rejection messages per subject/group:
 *   Record<string, { status: 'pending' | 'approved' | 'rejected', rejectionMessage?: string }>
 * This would allow different rejection messages for different subjects/groups.
 */
export const updateNodeAttributesInEditor = (
  editor: Editor,
  targetNode: { type: string; attrs: any },
  newAttrs: Partial<any>
): boolean => {
  if (!editor || !editor.state) return false;

  const found = findNodeInEditor(editor, targetNode);
  if (!found) {
    console.warn('[updateNodeAttributesInEditor] Node not found:', {
      type: targetNode.type,
      id: targetNode.attrs?.id,
      name: targetNode.attrs?.name,
    });
    return false;
  }

  const { node, pos } = found;
  const { state, view } = editor;
  const { tr } = state;
  const nodeAttrs = node.attrs as any;

  // CRITICAL: Properly merge nodeGroupApprovalStatus to preserve ALL existing keys
  const mergedAttrs = { ...newAttrs };

  // Merge nodeGroupApprovalStatus if it's being updated
  if (newAttrs.nodeGroupApprovalStatus !== undefined) {
    const existingNodeGroupApprovalStatus =
      (nodeAttrs?.nodeGroupApprovalStatus &&
        typeof nodeAttrs.nodeGroupApprovalStatus === 'object')
        ? nodeAttrs.nodeGroupApprovalStatus
        : {};
    const incomingNodeGroupApprovalStatus =
      (newAttrs.nodeGroupApprovalStatus &&
        typeof newAttrs.nodeGroupApprovalStatus === 'object')
        ? newAttrs.nodeGroupApprovalStatus
        : {};

    // Merge: preserve all existing statuses, then apply incoming updates
    // This ensures we don't lose statuses for other subjects/groups
    mergedAttrs.nodeGroupApprovalStatus = {
      ...existingNodeGroupApprovalStatus,
      ...incomingNodeGroupApprovalStatus,
    };
  }

  // CRITICAL: Also properly merge nodeGroupValues if it's being updated
  if (newAttrs.nodeGroupValues !== undefined) {
    const existingNodeGroupValues =
      (nodeAttrs?.nodeGroupValues &&
        typeof nodeAttrs.nodeGroupValues === 'object')
        ? nodeAttrs.nodeGroupValues
        : {};
    const incomingNodeGroupValues =
      (newAttrs.nodeGroupValues &&
        typeof newAttrs.nodeGroupValues === 'object')
        ? newAttrs.nodeGroupValues
        : {};

    // Merge: preserve all existing values, then apply incoming updates
    mergedAttrs.nodeGroupValues = {
      ...existingNodeGroupValues,
      ...incomingNodeGroupValues,
    };
  }

  // Merge all other attributes
  const finalAttrs = {
    ...nodeAttrs,
    ...mergedAttrs,
  };

  // Update the node using setNodeMarkup
  // This properly updates the node in the ProseMirror document
  tr.setNodeMarkup(pos, undefined, finalAttrs);

  // Dispatch the transaction to apply the changes
  view.dispatch(tr);

  return true;
};

/**
 * Find a node in JSONContent schema by ID, type, and optionally variant
 * Returns the node and its path if found
 */
export const findNodeInJSONContent = (
  doc: JSONContent,
  targetNode: { type: string; attrs: any },
  path: number[] = []
): { node: JSONContent; path: number[] } | null => {
  if (!doc) return null;

  const targetAttrs = targetNode.attrs || {};
  const targetId = targetAttrs.id;
  const targetName = targetAttrs.name;
  const targetLabel = targetAttrs.label;
  const targetType = targetNode.type;
  const targetVariant = targetAttrs.variant;

  // Helper to check if a node type supports variants
  const nodeTypeHasVariant = (nodeType: string): boolean => {
    const variantNodeTypes = [
      'shortText',
      'ratingField',
      'singleChoice',
      'multipleChoice',
    ];
    return variantNodeTypes.includes(nodeType);
  };

  // Helper to get default variant for a node type
  const getDefaultVariant = (nodeType: string): string => {
    const defaults: Record<string, string> = {
      shortText: 'text',
      ratingField: 'stars',
      singleChoice: 'radio',
      multipleChoice: 'checkbox',
    };
    return defaults[nodeType] || '';
  };

  const walk = (node: JSONContent, currentPath: number[]): { node: JSONContent; path: number[] } | null => {
    if (!node) return null;

    const nodeAttrs = node.attrs || {};
    const nodeId = nodeAttrs.id;
    const nodeName = nodeAttrs.name;
    const nodeLabel = nodeAttrs.label;
    const nodeType = node.type;
    const nodeVariant = nodeAttrs.variant;

    let matches = false;

    // Priority 1: Match by ID if both nodes have IDs (most reliable)
    if (targetId && nodeId && targetId === nodeId) {
      if (nodeType === targetType) {
        // For variant-supporting node types, also verify variant matches
        if (nodeTypeHasVariant(nodeType)) {
          const defaultVariant = getDefaultVariant(nodeType);
          const nodeVariantValue = nodeVariant || defaultVariant;
          const targetVariantValue = targetVariant || defaultVariant;
          if (nodeVariantValue === targetVariantValue) {
            matches = true;
          }
        } else {
          matches = true;
        }
      }
    }
    // Priority 2: Fallback to type + name/label matching for backward compatibility
    else if (nodeType === targetType) {
      const nameMatch = targetName && nodeName && targetName === nodeName;
      const labelMatch = targetLabel && nodeLabel && targetLabel === nodeLabel;
      
      if (nameMatch || labelMatch) {
        // For variant-supporting node types, also verify variant matches
        if (nodeTypeHasVariant(nodeType)) {
          const defaultVariant = getDefaultVariant(nodeType);
          const nodeVariantValue = nodeVariant || defaultVariant;
          const targetVariantValue = targetVariant || defaultVariant;
          if (nodeVariantValue === targetVariantValue) {
            matches = true;
          }
        } else {
          matches = true;
        }
      }
    }

    if (matches) {
      return { node, path: currentPath };
    }

    // Recurse through children
    if (Array.isArray(node.content)) {
      for (let i = 0; i < node.content.length; i++) {
        const child = node.content[i];
        const result = walk(child, [...currentPath, i]);
        if (result) {
          return result;
        }
      }
    }

    return null;
  };

  return walk(doc, path);
};

/**
 * Update node attributes in JSONContent schema
 * Properly merges nodeGroupApprovalStatus and other attributes
 * Returns a new JSONContent with updated attributes
 */
export const updateNodeAttributesInJSONContent = (
  doc: JSONContent,
  targetNode: { type: string; attrs: any },
  newAttrs: Partial<any>
): JSONContent | null => {
  if (!doc) return null;

  const found = findNodeInJSONContent(doc, targetNode);
  if (!found) {
    console.warn('[updateNodeAttributesInJSONContent] Node not found:', {
      type: targetNode.type,
      id: targetNode.attrs?.id,
      name: targetNode.attrs?.name,
    });
    return null;
  }

  const { node, path } = found;
  const nodeAttrs = node.attrs || {};

  // CRITICAL: Properly merge nodeGroupApprovalStatus to preserve ALL existing keys
  const mergedAttrs = { ...newAttrs };

  // Merge nodeGroupApprovalStatus if it's being updated
  if (newAttrs.nodeGroupApprovalStatus !== undefined) {
    const existingNodeGroupApprovalStatus =
      (nodeAttrs?.nodeGroupApprovalStatus &&
        typeof nodeAttrs.nodeGroupApprovalStatus === 'object')
        ? nodeAttrs.nodeGroupApprovalStatus
        : {};
    const incomingNodeGroupApprovalStatus =
      (newAttrs.nodeGroupApprovalStatus &&
        typeof newAttrs.nodeGroupApprovalStatus === 'object')
        ? newAttrs.nodeGroupApprovalStatus
        : {};

    // Merge: preserve all existing statuses, then apply incoming updates
    mergedAttrs.nodeGroupApprovalStatus = {
      ...existingNodeGroupApprovalStatus,
      ...incomingNodeGroupApprovalStatus,
    };
  }

  // CRITICAL: Also properly merge nodeGroupValues if it's being updated
  if (newAttrs.nodeGroupValues !== undefined) {
    const existingNodeGroupValues =
      (nodeAttrs?.nodeGroupValues &&
        typeof nodeAttrs.nodeGroupValues === 'object')
        ? nodeAttrs.nodeGroupValues
        : {};
    const incomingNodeGroupValues =
      (newAttrs.nodeGroupValues &&
        typeof newAttrs.nodeGroupValues === 'object')
        ? newAttrs.nodeGroupValues
        : {};

    // Merge: preserve all existing values, then apply incoming updates
    mergedAttrs.nodeGroupValues = {
      ...existingNodeGroupValues,
      ...incomingNodeGroupValues,
    };
  }

  // Merge all other attributes
  const finalAttrs = {
    ...nodeAttrs,
    ...mergedAttrs,
  };

  // Create a deep copy of the document
  const updatedDoc = JSON.parse(JSON.stringify(doc)) as JSONContent;

  // Navigate to the node using the path and update it
  const updateNodeAtPath = (current: JSONContent, currentPath: number[], targetPath: number[]): void => {
    if (currentPath.length === targetPath.length) {
      // We've reached the target node
      if (current.attrs) {
        current.attrs = finalAttrs;
      }
      return;
    }

    const nextIndex = targetPath[currentPath.length];
    if (Array.isArray(current.content) && current.content[nextIndex]) {
      updateNodeAtPath(current.content[nextIndex], [...currentPath, nextIndex], targetPath);
    }
  };

  updateNodeAtPath(updatedDoc, [], path);

  return updatedDoc;
};

