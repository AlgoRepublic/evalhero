import { Attributes, CommandProps, Node, RawCommands, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import * as ViewModule from './view';
const FileNodeComponent = ViewModule.default ?? ViewModule.FileNodeComponent;

// Default file types for common use cases: certs, evidence photos, PDFs
const DEFAULT_ALLOWED_TYPES = [
  'application/pdf', // PDFs
  'image/jpeg', // JPEG images
  'image/jpg', // JPG images
  'image/png', // PNG images
];

export const FileNode = Node.create({
  name: 'fileField',
  group: 'block',
  atom: false,
  draggable: true,
  content: '(paragraph | heading)+',

  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
      label: { default: 'Attach Files' },
      allowedTypes: { default: DEFAULT_ALLOWED_TYPES },
      maxSizeBytes: { default: 10 * 1024 * 1024 }, // 10MB default
      maxCount: { default: 5 },
      files: { default: [] },
      required: { default: false },
      uploadEndpoint: { default: '/api/uploads' },
      deleteEndpoint: { default: '/api/files' },
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
      // Virus scan hooks (functions passed from parent)
      onVirusScanComplete: { default: null },
      onVirusScanError: { default: null },
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
    return [{ tag: 'div[data-type="file-field"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'file-field' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileNodeComponent);
  },

  addCommands() {
    return {
      insertFileField:
        (attrs?: Record<string, unknown>) =>
        ({ commands }: { commands: CommandProps['commands'] }) => {
          const label = (attrs as Attributes)?.label ?? 'Attach Files';
          return commands.insertContent({
            type: this.name,
            attrs: {
              label: 'Attach Files',
              allowedTypes: DEFAULT_ALLOWED_TYPES,
              maxSizeBytes: 10 * 1024 * 1024,
              maxCount: 5,
              files: [],
              required: false,
              uploadEndpoint: '/api/uploads',
              deleteEndpoint: '/api/files',
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
