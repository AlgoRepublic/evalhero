import { CommandProps, Node, RawCommands, mergeAttributes } from '@tiptap/core';
import { Attributes, ReactNodeViewRenderer } from '@tiptap/react';
import LongTextComponent from './view';
import { genId } from '../../utils';

export const LongTextNode = Node.create({
  name: 'longText',
  group: 'block',
  atom: false,
  draggable: true,
  content: '(paragraph | heading)+',

  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
      label: { default: 'Long Text' },
      name: { default: null },
      placeholder: { default: 'Enter longer text…' },
      // content: { default: '' },
      value: { default: '' },
      minLength: { default: 0 },
      maxLength: { default: 1000 },
      regex: { default: null },
      requiredKeywords: { default: [] as string[] },
      requiredKeywordsMode: { default: 'all' as 'all' | 'any' },
      required: { default: false },
      approvalRequired: { default: false },
      enableRichText: { default: false }, // Enable/disable rich text vs plain text
      queryParam: { default: null }, // Query parameter key for pre-population
      // Node-based grouping (per-field) - used in submit mode for subject groups
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
        default: {} as Record<string, string>,
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
    return [{ tag: `div[data-type="long-text"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'long-text' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LongTextComponent);
  },

  addCommands() {
    return {
      insertLongText:
        (attrs?: Record<string, unknown>) =>
        ({ commands }: { commands: CommandProps['commands'] }) => {
          const label = (attrs as Attributes)?.label ?? 'Long Text';
          return commands.insertContent({
            type: this.name,
            attrs: {
              label: 'Long Text',
              name: attrs?.name || genId(),
              placeholder: attrs?.placeholder || 'Enter longer text…',
              minLength: attrs?.minLength !== undefined ? Number(attrs.minLength) : 0,
              maxLength: attrs?.maxLength !== undefined ? Number(attrs.maxLength) : 1000,
              regex: attrs?.regex || null,
              content: attrs?.content || '',
              value: attrs?.value || '',
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
