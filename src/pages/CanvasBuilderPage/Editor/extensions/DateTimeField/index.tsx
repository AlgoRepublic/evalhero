import { Attributes, CommandProps, Node, RawCommands, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import DateTimeComponent from './view';
import { genId } from '../../utils';

export const DateTimeNode = Node.create({
  name: 'dateTimeField',
  group: 'block',
  atom: false,
  draggable: true,
  content: '(paragraph | heading)+',

  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
      label: { default: 'Date & Time' },
      name: { default: null },
      value: { default: null }, // ISO datetime string
      min: { default: null }, // ISO
      max: { default: null }, // ISO
      notInFuture: { default: false },
      notInPast: { default: false },
      timeFormat: { default: '24' }, // '24' or '12'
      showSeconds: { default: false },
      timezone: { default: null }, // optional IANA tz string; requires dayjs.tz to apply
      timeIncrement: { default: null }, // Minutes increment (e.g., 15 for 15-minute intervals)
      timeLimits: {
        default: null,
        parseHTML: (element) => {
          const data = element.getAttribute('data-time-limits');
          if (!data) return null;
          try {
            return JSON.parse(data);
          } catch {
            return null;
          }
        },
        renderHTML: (attributes) => {
          if (!attributes?.timeLimits) {
            return {};
          }
          return { 'data-time-limits': JSON.stringify(attributes.timeLimits) };
        },
      }, // { start: '09:00', end: '17:00' } - restrict time selection
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
        default: {} as Record<string, any>, // entityId -> ISO datetime string
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
    return [{ tag: 'div[data-type="date-time-field"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'date-time-field' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DateTimeComponent);
  },

  addCommands() {
    return {
      insertDateTimeField:
        (attrs?: Record<string, unknown>) =>
        ({ commands }: { commands: CommandProps['commands'] }) => {
          const label = (attrs as Attributes)?.label ?? 'Date & Time';
          return commands.insertContent({
            type: this.name,
            attrs: {
              label: 'Date & Time',
              name: attrs?.name || genId(),
              value: attrs?.value !== undefined ? attrs.value : null,
              min: attrs?.min !== undefined ? attrs.min : null,
              max: attrs?.max !== undefined ? attrs.max : null,
              notInFuture: attrs?.notInFuture === true,
              notInPast: attrs?.notInPast === true,
              timeFormat: attrs?.timeFormat === '12' ? '12' : '24',
              showSeconds: attrs?.showSeconds === true,
              timezone: attrs?.timezone || null,
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
