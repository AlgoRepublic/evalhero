/* eslint-disable @typescript-eslint/no-explicit-any */
import { Node, RawCommands, CommandProps, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import MatrixComponent from './MatrixComponent';

export const MatrixNode = Node.create({
  name: 'matrixField',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
      label: { default: 'Matrix' },
      name: { default: null }, // Short code reference for form submission
      required: { default: false },
      queryParam: { default: null }, // Query parameter key for pre-population
      columns: {
        default: [],
        parseHTML: (element) => {
          const data = element.getAttribute('data-columns');
          if (!data) return undefined;
          try {
            const parsed = JSON.parse(data);
            // Normalize column attributes on parse
            if (Array.isArray(parsed)) {
              return parsed.map((col: any) => {
                const normalized: any = { ...col };
                // Normalize boolean
                if (typeof normalized.required === 'string') {
                  normalized.required = normalized.required === 'true' || normalized.required === '1';
                }
                // Normalize numbers
                if (typeof normalized.scale === 'string') {
                  const num = Number(normalized.scale);
                  normalized.scale = isNaN(num) ? null : num;
                }
                if (typeof normalized.step === 'string') {
                  const num = Number(normalized.step);
                  normalized.step = isNaN(num) ? 1 : num;
                }
                if (typeof normalized.min === 'string' && normalized.min !== '') {
                  const num = Number(normalized.min);
                  normalized.min = isNaN(num) ? null : num;
                }
                if (typeof normalized.max === 'string' && normalized.max !== '') {
                  const num = Number(normalized.max);
                  normalized.max = isNaN(num) ? null : num;
                }
                if (typeof normalized.maxSelections === 'string' && normalized.maxSelections !== '') {
                  const num = Number(normalized.maxSelections);
                  normalized.maxSelections = isNaN(num) ? null : num;
                }
                // Ensure arrays
                if (!Array.isArray(normalized.anchorLabels)) normalized.anchorLabels = [];
                if (!Array.isArray(normalized.options) && (normalized.type === 'choice' || normalized.type === 'multiple')) {
                  normalized.options = [];
                }
                return normalized;
              });
            }
            return parsed;
          } catch {
            return undefined;
          }
        },
        renderHTML: (attributes) => {
          if (!attributes?.columns) return {};
          return { 'data-columns': JSON.stringify(attributes.columns) };
        },
      },
      rows: {
        default: [
          { id: 'row_1', label: 'Skill A', tooltip: '' },
          { id: 'row_2', label: 'Skill B', tooltip: '' },
        ],
        parseHTML: (element) => {
          const data = element.getAttribute('data-rows');
          if (!data) return undefined;
          try {
            return JSON.parse(data);
          } catch {
            return undefined;
          }
        },
        renderHTML: (attributes) => {
          if (!attributes?.rows) return {};
          return { 'data-rows': JSON.stringify(attributes.rows) };
        },
      },
      cells: {
        default: {},
        parseHTML: (element) => {
          const data = element.getAttribute('data-cells');
          if (!data) return {};
          try {
            return JSON.parse(data);
          } catch {
            return {};
          }
        },
        renderHTML: (attributes) => {
          if (!attributes?.cells || Object.keys(attributes.cells).length === 0) return {};
          return { 'data-cells': JSON.stringify(attributes.cells) };
        },
      },
      rules: {
        default: [],
        parseHTML: (element) => {
          const data = element.getAttribute('data-rules');
          if (!data) return [];
          try {
            return JSON.parse(data);
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => {
          if (!attributes?.rules || attributes.rules.length === 0) return {};
          return { 'data-rules': JSON.stringify(attributes.rules) };
        },
      },
      // Visibility rules for conditional logic
      visibility: {
        default: { match: 'all', rules: [] },
        parseHTML: (element) => {
          const data = element.getAttribute('data-visibility');
          if (!data) return { match: 'all', rules: [] };
          try {
            return JSON.parse(data);
          } catch {
            return { match: 'all', rules: [] };
          }
        },
        renderHTML: (attributes) => {
          if (!attributes?.visibility || !attributes.visibility.rules?.length) return {};
          return { 'data-visibility': JSON.stringify(attributes.visibility) };
        },
      },
      // Approval settings
      approvalRequired: {
        default: false,
        parseHTML: (element) => {
          const attr = element.getAttribute('data-approval-required');
          if (attr === null) return false;
          if (typeof attr === 'string') {
            return attr === 'true' || attr === '1';
          }
          return Boolean(attr);
        },
        renderHTML: (attributes) => {
          if (attributes?.approvalRequired) {
            return { 'data-approval-required': 'true' };
          }
          return {};
        },
      },
      // Grouping support
      enableGrouping: {
        default: false,
        parseHTML: (element) => {
          const attr = element.getAttribute('data-enable-grouping');
          if (attr === null) return false;
          if (typeof attr === 'string') {
            return attr === 'true' || attr === '1';
          }
          return Boolean(attr);
        },
        renderHTML: (attributes) => {
          if (attributes?.enableGrouping) {
            return { 'data-enable-grouping': 'true' };
          }
          return {};
        },
      },
      nodeGroups: {
        default: [],
        parseHTML: (element) => {
          const data = element.getAttribute('data-node-groups');
          if (!data) return [];
          try {
            return JSON.parse(data);
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => {
          if (!attributes?.nodeGroups || !Array.isArray(attributes.nodeGroups) || attributes.nodeGroups.length === 0) return {};
          return { 'data-node-groups': JSON.stringify(attributes.nodeGroups) };
        },
      },
      nodeGroupValues: {
        default: {},
        parseHTML: (element) => {
          const data = element.getAttribute('data-node-group-values');
          if (!data) return {};
          try {
            return JSON.parse(data);
          } catch {
            return {};
          }
        },
        renderHTML: (attributes) => {
          if (!attributes?.nodeGroupValues || typeof attributes.nodeGroupValues !== 'object' || Object.keys(attributes.nodeGroupValues).length === 0) return {};
          return { 'data-node-group-values': JSON.stringify(attributes.nodeGroupValues) };
        },
      },
      // Matrix type: 'single' (single choice per row), 'multiple' (multiple choice per row), 'mixed' (mixed input columns)
      matrixType: { default: 'mixed' },
      // Row label - dynamic label for the first column (row names column)
      rowLabel: {
        default: 'Item',
        parseHTML: (element) => {
          const attr = element.getAttribute('data-row-label');
          return attr !== null ? attr : 'Item';
        },
        renderHTML: (attributes) => {
          // Always save rowLabel if it exists and is not empty, even if it's the default
          // This ensures the value persists correctly
          if (attributes?.rowLabel && attributes.rowLabel.trim() !== '') {
            return { 'data-row-label': attributes.rowLabel };
          }
          return {};
        },
      },
      // Matrix summary (total points, pass/fail counts, critical fail) - computed from cells for template evaluation
      matrixSummary: {
        default: null,
        parseHTML: (element) => {
          const data = element.getAttribute('data-matrix-summary');
          if (!data) return null;
          try {
            return JSON.parse(data);
          } catch {
            return null;
          }
        },
        renderHTML: (attributes) => {
          if (!attributes?.matrixSummary || typeof attributes.matrixSummary !== 'object') return {};
          return { 'data-matrix-summary': JSON.stringify(attributes.matrixSummary) };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="matrix-field"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'matrix-field' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MatrixComponent);
  },

  addCommands() {
    return {
      insertMatrix:
        (attrs?: Record<string, unknown>) =>
        ({ commands }: { commands: CommandProps['commands'] }) => {
          const defaultCols = attrs?.columns ?? [];
          const defaultRows = attrs?.rows ?? [];
          return commands.insertContent({
            type: this.name,
            attrs: {
              label: 'Matrix',
              rowLabel: 'Item',
              columns: defaultCols,
              rows: defaultRows,
              cells: {},
              rules: [],
              ...attrs,
            },
          });
        },
    } as Partial<RawCommands>;
  },
});
