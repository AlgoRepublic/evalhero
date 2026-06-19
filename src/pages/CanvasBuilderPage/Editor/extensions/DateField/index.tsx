import { Attributes, CommandProps, Node, RawCommands, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import DateComponent from './view';
import { genId } from '../../utils';

export const DateNode = Node.create({
  name: 'dateField',
  group: 'block',
  atom: false,
  draggable: true,
  content: '(paragraph | heading)+',

  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
      label: { default: 'Date' },
      name: { default: null },
      placeholder: { default: '' },
      value: { default: null }, // ISO string
      min: { default: null }, // ISO string
      max: { default: null }, // ISO string
      notInFuture: { default: false }, // boolean
      notInPast: { default: false }, // boolean
      defaultDate: { default: 'none' }, // none | today | future
      dateFormat: { default: 'MM-DD-YYYY' }, // Custom date format
      disabledDates: {
        default: [],
        parseHTML: (element) => {
          const data = element.getAttribute('data-disabled-dates');
          if (!data) return [];
          try {
            return JSON.parse(data);
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => {
          if (!attributes?.disabledDates || attributes.disabledDates.length === 0) {
            return {};
          }
          return { 'data-disabled-dates': JSON.stringify(attributes.disabledDates) };
        },
      }, // Array of ISO date strings or ranges
      queryParam: { default: null }, // Query parameter key for pre-population
      required: { default: false }, // Field is required
      approvalRequired: { default: false },
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
          if (
            !attributes?.visibility ||
            attributes?.visibility?.rules?.length === 0
          ) {
            return {};
          }
          return { 'data-visibility': JSON.stringify(attributes.visibility) };
        },
      },
      // Node-based grouping support (per-field) - used in submit mode for subjects/groups
      enableGrouping: { default: false },
      nodeGroups: {
        default: [] as Array<{ id: string; name: string; subjectIds: string[] }>,
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
          if (!attributes?.nodeGroups || attributes.nodeGroups.length === 0) {
            return {};
          }
          return { 'data-node-groups': JSON.stringify(attributes.nodeGroups) };
        },
      },
      nodeGroupValues: {
        default: {} as Record<string, any>, // entityId -> ISO string
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
          if (
            !attributes?.nodeGroupValues ||
            Object.keys(attributes.nodeGroupValues).length === 0
          ) {
            return {};
          }
          return {
            'data-node-group-values': JSON.stringify(
              attributes.nodeGroupValues,
            ),
          };
        },
      },
      // Approval status per subject/group (similar to nodeGroupValues)
      nodeGroupApprovalStatus: {
        default: {} as Record<string, 'pending' | 'approved' | 'rejected'>, // groupId/subjectId -> approvalStatus
        parseHTML: (element) => {
          const data = element.getAttribute('data-node-group-approval-status');
          if (!data) return {};
          try {
            return JSON.parse(data);
          } catch {
            return {};
          }
        },
        renderHTML: (attributes) => {
          if (
            !attributes?.nodeGroupApprovalStatus ||
            Object.keys(attributes.nodeGroupApprovalStatus).length === 0
          ) {
            return {};
          }
          return {
            'data-node-group-approval-status': JSON.stringify(attributes.nodeGroupApprovalStatus),
          };
        },
      },
      // Tags association
      tags: {
        default: [] as string[],
        parseHTML: (element) => {
          const data = element.getAttribute('data-tags');
          if (!data) return [];
          try {
            return JSON.parse(data);
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => {
          if (!attributes?.tags || attributes.tags.length === 0) {
            return {};
          }
          return { 'data-tags': JSON.stringify(attributes.tags) };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="date-field"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'date-field' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DateComponent);
  },

  addCommands() {
    return {
      insertDateField:
        (attrs?: Record<string, unknown>) =>
        ({ commands }: { commands: CommandProps['commands'] }) => {
          const label = (attrs as Attributes)?.label ?? 'Date';
          return commands.insertContent({
            type: this.name,
            attrs: {
              label: 'Date',
              name: attrs?.name || genId(),
              placeholder: attrs?.placeholder || '',
              value: attrs?.value !== undefined ? attrs.value : null,
              min: attrs?.min !== undefined ? attrs.min : null,
              max: attrs?.max !== undefined ? attrs.max : null,
              notInFuture: attrs?.notInFuture === true,
              notInPast: attrs?.notInPast === true,
              ...attrs,
            },
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: String(label) }],
              },
            ],
          });
        },
    } as Partial<RawCommands>;
  },
});
