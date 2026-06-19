import { Node, mergeAttributes, RawCommands, CommandProps } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ShortTextView from './view';

export const ShortTextNode = Node.create({
  name: 'shortText',
  group: 'block',
  content: '(paragraph | heading)+',
  draggable: true,

  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
      variant: { default: 'text' },
      // label: { default: 'Short Text' },
      name: { default: null },
      placeholder: { default: 'Enter text...' },
      minLength: { default: null },
      maxLength: { default: null },
      value: { default: '' },
      regex: { default: null },
      mask: { default: null },
      required: { default: false },
      approvalRequired: { default: false },
      approvalStatus: { default: null }, // 'pending' | 'approved' | 'rejected'
      approvers: { 
        default: null,
        parseHTML: (element) => {
          const data = element.getAttribute('data-approvers');
          if (!data) return null;
          try {
            return JSON.parse(data);
          } catch {
            return null;
          }
        },
        renderHTML: (attributes) => {
          if (!attributes?.approvers || attributes.approvers.length === 0) {
            return {};
          }
          return { 'data-approvers': JSON.stringify(attributes.approvers) };
        },
      }, // string[] - config set approvers
      rejectionMessage: { default: null },
      namePrefix: { default: false },
      nameSuffix: { default: false },
      namePrefixRequired: { default: false },
      nameSuffixRequired: { default: false },
      middleName: { default: false },
      middleNameRequired: { default: false },
      phoneCountryIsoCode: { default: undefined },
      queryParam: { default: null }, // Query parameter key for pre-population
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
      // Node-based grouping
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
        default: {} as Record<string, string>, // groupId -> value
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
          if (!attributes?.nodeGroupValues || Object.keys(attributes.nodeGroupValues).length === 0) {
            return {};
          }
          return { 'data-node-group-values': JSON.stringify(attributes.nodeGroupValues) };
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
    return [{ tag: 'div[data-type="short-text"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'short-text' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ShortTextView);
  },

  addCommands() {
    return {
      insertShortText:
        (attrs?: Record<string, unknown>) =>
        ({ chain }: { chain: CommandProps['chain'] }) => {
          const label = attrs?.label ?? 'Short Text';
          const generatedName = label
            .toString()
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .replace(/_+/g, '_');

          const defaults = {
            variant: 'text',
            // label,
            placeholder: 'Enter text...',
            required: false,
            name: generatedName || null,
            value: '',
            ...attrs,
          };

          return chain()
            .insertContent({
              type: 'shortText',
              attrs: defaults,
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: String(label) }],
                },
              ],
            })
            .run();
        },
    } as Partial<RawCommands>;
  },
});
