import { CommandProps, Node, RawCommands, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import RankingComponent from './view';
import { genId } from '../../utils';

export const RankingNode = Node.create({
  name: 'ranking',
  group: 'block',
  atom: false,
  draggable: true,

  selectable: false,
  isolating: true,
  defining: true,

  // Allow a single paragraph as editable label content
  content: 'paragraph',

  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
      label: { default: 'Ranking' },
      name: { default: null },
      options: { default: ['Option A', 'Option B', 'Option C'] },
      order: { default: [] },
      // 'drag' uses drag & drop; 'numeric' renders numeric rank inputs
      mode: { default: 'drag' },
      // iconStyle can be 'star' or 'emoji'
      iconStyle: { default: 'star' },
      // emoji character to use when iconStyle = 'emoji'
      emoji: { default: '⭐' },
      // show suffix text by the label, e.g. "(0/5)"
      showSuffix: { default: false },
      // suffix text displayed when showSuffix = true
      suffixText: { default: '(0/5)' },
      approvalRequired: { default: false },
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
        default: {} as Record<string, any>, // entityId -> order array
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
    return [{ tag: 'div[data-type="ranking"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'ranking' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RankingComponent);
  },

  addCommands() {
    return {
      insertRanking:
        (attrs?: Record<string, unknown>) =>
        ({ commands }: { commands: CommandProps['commands'] }) => {
          const defaultOptions = ['Option A', 'Option B', 'Option C'];
          const labelText = (attrs?.['label'] as string) || 'Rank these';
          const providedOptions = Array.isArray(attrs?.options) ? attrs?.options : defaultOptions;
          return commands.insertContent({
            type: this.name,
            attrs: {
              label: labelText,
              options: providedOptions,
              order: Array.isArray(providedOptions) 
                ? providedOptions.map((l, i) => `${String(l)}-${i}`)
                : [],
              name: attrs?.name || genId(),
              ...attrs,
            },
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: labelText }],
              },
            ],
          });
        },
    } as Partial<RawCommands>;
  },
});
