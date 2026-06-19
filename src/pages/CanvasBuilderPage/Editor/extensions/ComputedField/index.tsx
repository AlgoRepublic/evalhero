import { CommandProps, Node, RawCommands, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ComputedComponent from './view';

export const ComputedFieldNode = Node.create({
  name: 'computedField',
  group: 'block',
  atom: true,
  draggable: false,

  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
      fieldId: { default: null },
      label: { default: 'Computed' },
      expression: { default: '' },
      precision: { default: null },
      value: { default: null },
      visible: { default: true },
      error: { default: null },
      prefix: { default: '' }, // Prefix text
      suffix: { default: '' }, // Suffix text
      numberFormat: { default: 'none' }, // none, comma, dot, space
      rounding: { default: null }, // Number of decimal places (overrides precision if set)
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
    return [{ tag: 'div[data-type="computed-field"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'computed-field' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ComputedComponent);
  },

  addCommands() {
    return {
      insertComputed:
        (attrs?: Record<string, unknown>) =>
        ({ commands }: { commands: CommandProps['commands'] }) => {
          const defaultAttrs = {
            fieldId: attrs?.fieldId ?? null,
            label: attrs?.label ?? 'Computed',
            expression: attrs?.expression ?? '',
            precision: attrs?.precision ?? null,
            visible: attrs?.visible ?? true,
            value: null,
            error: null,
          };
          return commands.insertContent({
            type: this.name,
            attrs: defaultAttrs,
          });
        },
    } as Partial<RawCommands>;
  },
});
