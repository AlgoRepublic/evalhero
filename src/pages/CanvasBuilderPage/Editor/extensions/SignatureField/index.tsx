import { Attributes, CommandProps, Node, RawCommands, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import SignatureComponent from './view';

export const SignatureNode = Node.create({
  name: 'signatureField',
  group: 'block',
  atom: false,
  draggable: true,
  content: '(paragraph | heading)+',

  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
      label: { default: 'Signature' },
      mode: { default: 'draw' },
      signerName: { default: null },
      timestamp: { default: null },
      dataUrl: { default: null },
      uploadedUrl: { default: null },
      requireSignerName: { default: false },
      uploadEndpoint: { default: '/api/uploads' },
      signatureId: { default: null },
      signatureName: { default: null },
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
        default: {} as Record<string, unknown>,
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
            'data-node-group-values': JSON.stringify(attributes.nodeGroupValues),
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
    return [{ tag: 'div[data-type="signature-field"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'signature-field' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SignatureComponent);
  },

  addCommands() {
    return {
      insertSignature:
        (attrs?: Record<string, unknown>) =>
        ({ commands }: { commands: CommandProps['commands'] }) => {
          const label = (attrs as Attributes)?.label ?? 'Signature';
          return commands.insertContent({
            type: this.name,
            attrs: {
              label: 'Signature',
              mode: 'draw',
              signerName: null,
              timestamp: null,
              dataUrl: null,
              uploadedUrl: null,
              requireSignerName: false,
              uploadEndpoint: '/api/uploads',
              signatureId: null,
              signatureName: null,
              enableGrouping: false,
              nodeGroups: [],
              nodeGroupValues: {},
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
