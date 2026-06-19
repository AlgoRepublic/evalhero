import { Node, RawCommands, mergeAttributes } from '@tiptap/core';
import type { Attributes, CommandProps } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import MultipleChoiceComponent from './view';

export const MultipleChoiceNode = Node.create({
  name: 'multipleChoice',
  group: 'block',
  content: '(paragraph | heading | multipleChoiceOption | multipleChoiceOther)+',
  atom: false,
  draggable: true,

  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
      name: { default: '' },
      label: { default: 'Multiple Choice' },
      variant: { default: 'checkbox' }, // checkbox | dropdown | buttons
      layout: { default: 'horizontal' }, // horizontal | vertical
      randomize: { default: false },
      defaultValue: { default: [] }, // Changed to array for multiple selections
      value: { default: [] }, // Added to track current value
      allowOther: { default: false },
      otherPlaceholder: { default: 'Other…' },
      required: { default: false },
      approvalRequired: { default: false },
      approvalStatus: { default: null }, // 'pending' | 'approved' | 'rejected' | 'requested' (course form single-user)
      rejectionMessage: { default: null },
      enablePassFail: { default: false },
      enablePoints: { default: false },
      failCritical: { default: false },
      enableCalculation: { default: false }, // Enable for calculation
      optionPoints: {
        default: {},
        parseHTML: (element) => {
          const data = element.getAttribute('data-option-points');
          if (!data) return {};
          try {
            return JSON.parse(data);
          } catch {
            return {};
          }
        },
        renderHTML: (attributes) => {
          if (Object.keys(attributes.optionPoints).length === 0) {
            return {};
          }
          return {
            'data-option-points': JSON.stringify(attributes.optionPoints),
          };
        },
      },
      optionLimits: {
        default: {},
        parseHTML: (element) => {
          const data = element.getAttribute('data-option-limits');
          if (!data) return {};
          try {
            return JSON.parse(data);
          } catch {
            return {};
          }
        },
        renderHTML: (attributes) => {
          if (Object.keys(attributes.optionLimits).length === 0) {
            return {};
          }
          return {
            'data-option-limits': JSON.stringify(attributes.optionLimits),
          };
        },
      },
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
        default: {} as Record<string, string[]>, // Changed to string[] for multiple selections
        parseHTML: (element) => {
          const data = element.getAttribute('data-node-group-values');
          if (!data) return {};
          try {
            const parsed = JSON.parse(data);
            // Ensure all values are arrays (for backward compatibility, convert strings to arrays)
            const normalized: Record<string, string[]> = {};
            for (const [key, value] of Object.entries(parsed)) {
              if (Array.isArray(value)) {
                normalized[key] = value;
              } else if (value != null) {
                // Convert single value to array for backward compatibility
                normalized[key] = [String(value)];
              } else {
                normalized[key] = [];
              }
            }
            return normalized;
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
    return [{ tag: `div[data-type="multiple-choice"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'multiple-choice' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MultipleChoiceComponent);
  },

  addCommands() {
    return {
      insertMultipleChoice:
        (attrs?: Record<string, unknown>) =>
        ({
          chain,
          state,
        }: {
          chain: CommandProps['chain'];
          state: CommandProps['state'];
        }) => {
          let count = 0;
          state.doc.descendants((node) => {
            if (node.type.name === 'multipleChoice') {
              count++;
            }
            return true;
          });
          const name = `multiple_choice_${count + 1}`;
          const label = (attrs as Attributes)?.label ?? 'Multiple Choice';
          return chain()
            .insertContent({
              type: 'multipleChoice',
              attrs: {
                name,
                label: 'Multiple Choice',
                variant: 'checkbox',
                layout: 'horizontal',
                randomize: false,
                defaultValue: [],
                value: [],
                allowOther: false,
                otherPlaceholder: 'Other…',
                // Node-based grouping: enabled by default for new multiple choice fields
                // enableGrouping: true,
                // nodeGroups: [],
                // nodeGroupValues: {},
                enablePassFail: false,
                enablePoints: false,
                failCritical: false,
                optionPoints: {},
                visibility: { match: 'all', rules: [] },
                ...attrs,
              },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: String(label) }],
                },
                {
                  type: 'multipleChoiceOption',
                  attrs: {
                    value: 'Option 1',
                    imageUrl: null,
                    isCorrect: false,
                  },
                  content: [{ type: 'text', text: 'Option 1' }],
                },
                {
                  type: 'multipleChoiceOption',
                  attrs: {
                    value: 'Option 2',
                    imageUrl: null,
                    isCorrect: false,
                  },
                  content: [{ type: 'text', text: 'Option 2' }],
                },
                ...(attrs?.allowOther
                  ? [
                      {
                        type: 'multipleChoiceOther',
                        attrs: { isCorrect: false },
                      },
                    ]
                  : []),
              ],
            })
            .run();
        },
    } as Partial<RawCommands>;
  },
});
