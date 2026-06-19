import { Attributes, CommandProps, Node, RawCommands, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import LookupComponent from './view';

export const LookupNode = Node.create({
  name: 'lookupField',
  group: 'block',
  atom: false,
  draggable: true,
  content: '(paragraph | heading)+',

  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
      label: { default: 'Lookup' },
      lookupEndpoint: { default: '' },
      selectedFetchParam: { default: 'id' },
      minChars: { default: 2 },
      pageSize: { default: 20 },
      mode: { default: 'single' },
      placeholder: { default: 'Search…' },
      labelField: { default: null },
      metaField: { default: null },
      value: { default: null },
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
    return [{ tag: 'div[data-type="lookup-field"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'lookup-field' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LookupComponent);
  },

  addCommands() {
    return {
      insertLookup:
        (attrs?: Record<string, unknown>) =>
        ({ commands }: { commands: CommandProps['commands'] }) => {
          const label = (attrs as Attributes)?.label ?? 'Lookup';
          return commands.insertContent({
            type: this.name,
            attrs: {
              label: 'Lookup',
              lookupEndpoint: '',
              selectedFetchParam: 'id',
              minChars: 2,
              pageSize: 20,
              mode: 'single',
              placeholder: 'Search…',
              labelField: null,
              metaField: null,
              value: null,
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
