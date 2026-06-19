import { Node, mergeAttributes, RawCommands } from '@tiptap/core';
import {
  ReactNodeViewRenderer,
  NodeViewProps,
  NodeViewWrapper,
} from '@tiptap/react';

/**
 * HiddenFieldNode
 * - Invisible marker node for storing metadata inside the document.
 * - Do NOT store file binaries or secrets here; store non-sensitive metadata or IDs that reference server-side records.
 *
 * attrs:
 *  - key: string (required)
 *  - value: any (serializable)
 *  - label: optional human label (for debugging)
 *  - exportOnly: boolean (if true it is hidden in UI; default true)
 *  - immutable: boolean (if true client UI should not allow editing; default true)
 */

const HiddenView = (props: NodeViewProps) => {
  console.log('props', props);
  // invisible in the UI by default; show nothing.
  // If you want a tiny debug marker in dev: render a small tag conditionally.
  return <NodeViewWrapper />;
};

export const HiddenFieldNode = Node.create({
  name: 'hiddenField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
      key: { default: '' },
      value: { default: null },
      label: { default: null },
      exportOnly: { default: true },
      immutable: { default: true },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="hidden-field"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    // marker element (not shown)
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'hidden-field',
        // style: 'display:none',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HiddenView);
  },

  addCommands() {
    return {
      // these are convenience commands; prefer using helper utils for robust behavior
      insertHidden:
        (attrs?: Record<string, unknown>) =>
        ({ commands }: { commands: RawCommands }) => {
          if (!attrs?.key) return false;
          return commands.insertContent({ type: this.name, attrs });
        },

      // updateHidden:
      //   (key: string, attrsPatch: Record<string, unknown>) =>
      //   ({ tr, state, dispatch }) => {
      //     // This command is intentionally minimal; use helper functions to locate & set nodes
      //     return false;
      //   },

      // removeHidden:
      //   (key: string) =>
      //   ({ tr, state, dispatch }) => {
      //     // prefer using helper removeHiddenField(editor, key)
      //     return false;
      //   },
    } as Partial<RawCommands>;
  },
});
