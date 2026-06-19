/* eslint-disable @typescript-eslint/no-explicit-any */
// src/v2/RepeaterNode.tsx
import React from 'react';
import { Node, RawCommands, mergeAttributes } from '@tiptap/core';
import {
  NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react';
import { Button, Space, Modal, Form, InputNumber, Input, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getSetEditingNodeFromEditor } from '../utils';

/**
 * RepeaterNode & RepeaterItem
 * - Repeater contains repeater_item* children
 * - Template stored as attrs.template (array of node JSON)
 */

const RepeaterView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
  getPos,
}) => {
  const setEditingNode = getSetEditingNodeFromEditor(editor);
  const [isConfigOpen, setConfigOpen] = React.useState(false);
  const [form] = Form.useForm();

  // number of instances
  const count = node.childCount ?? 0;

  const openConfig = () => {
    form.setFieldsValue({
      label: node.attrs.label ?? 'Repeater',
      min: node.attrs.min ?? 0,
      max: node.attrs.max ?? null,
    });
    setConfigOpen(true);
    setEditingNode?.({
      attrs: node.attrs,
      type: node.type.name,
      updateAttributes,
      deleteNode,
      editor,
      getPos,
    });
  };

  const saveConfig = async () => {
    const values = await form.validateFields();
    updateAttributes({
      ...node.attrs,
      label: values.label,
      min: Number(values.min || 0),
      max: values.max === undefined ? null : Number(values.max),
    });
    setConfigOpen(false);
  };

  // capture selection as template
  const captureTemplateFromSelection = () => {
    try {
      const ed = editor;
      const { from, to } = ed.state.selection;
      if (from === to) {
        message.warning('Select nodes in the editor to set template');
        return;
      }
      const slice = ed.state.doc.slice(from, to);
      const contentJson = slice.content.toJSON(); // array of node json objects
      // Attach to repeater attrs (atomic update)
      updateAttributes({ ...node.attrs, template: contentJson });
      message.success('Template saved to repeater');
      setConfigOpen(false);
    } catch (err) {
      console.error('captureTemplateFromSelection', err);
      message.error('Failed to capture template');
    }
  };

  // Add new instance at end (or at position)
  const addInstance = async (index?: number) => {
    console.log('index', index);
    try {
      const pos = (getPos as any)();
      if (typeof pos !== 'number') {
        message.error('Unable to determine repeater position');
        return;
      }
      const insertAt = pos + node.nodeSize - 1; // end inside repeater
      let contentToInsert: any;
      if (
        node.attrs.template &&
        Array.isArray(node.attrs.template) &&
        node.attrs.template.length > 0
      ) {
        contentToInsert = {
          type: 'repeater_item',
          content: node.attrs.template,
        };
      } else {
        // fallback to an empty paragraph inside repeater_item
        contentToInsert = {
          type: 'repeater_item',
          content: [{ type: 'paragraph' }],
        };
      }
      editor.commands.focus();
      await editor.commands.insertContentAt(insertAt, contentToInsert);
    } catch (err) {
      console.error('addInstance', err);
      message.error('Failed to add instance');
    }
  };

  // duplicate instance at childIndex
  // const duplicateInstanceAt = async (childIndex: number) => {
  //   try {
  //     const child = node.child(childIndex);
  //     if (!child) {
  //       message.error('Instance not found');
  //       return;
  //     }
  //     const serialized = child.toJSON().content ?? [{ type: 'paragraph' }];
  //     const pos = (getPos as any)();
  //     const insertAt = pos + node.nodeSize - 1;
  //     await editor.commands.insertContentAt(insertAt, {
  //       type: 'repeater_item',
  //       content: serialized,
  //     });
  //   } catch (err) {
  //     console.error('duplicateInstanceAt', err);
  //     message.error('Failed to duplicate instance');
  //   }
  // };

  // remove instance at childIndex
  // const removeInstanceAt = (childIndex: number) => {
  //   try {
  //     const repPos = (getPos as any)();
  //     if (typeof repPos !== 'number') {
  //       message.error('Cannot remove instance');
  //       return;
  //     }
  //     // compute child start offset
  //     let offset = repPos + 1;
  //     for (let i = 0; i < childIndex; i++) {
  //       offset += node.child(i).nodeSize;
  //     }
  //     const childNode = node.child(childIndex);
  //     if (!childNode) {
  //       message.error('Instance not found');
  //       return;
  //     }
  //     const from = offset;
  //     const to = offset + childNode.nodeSize;
  //     const tr = editor.state.tr.delete(from, to);
  //     editor.view.dispatch(tr);
  //   } catch (err) {
  //     console.error('removeInstanceAt', err);
  //     message.error('Failed to remove instance');
  //   }
  // };

  // render list of instances (TipTap will render children under NodeViewWrapper; here we provide control buttons)
  return (
    <NodeViewWrapper
      style={{ border: '1px dashed #ddd', padding: 8, margin: '8px 0' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <strong>{node.attrs.label ?? 'Repeater'}</strong>
        <Space>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => addInstance()}
          >
            Add
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={openConfig}>
            Configure
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={deleteNode}
          >
            Delete
          </Button>
        </Space>
      </div>

      <div style={{ marginBottom: 8 }}>
        {/* TipTap will render repeater_item children inline here */}
      </div>

      <div style={{ fontSize: 12, color: '#666' }}>Instances: {count}</div>

      <Modal
        title="Configure Repeater"
        open={isConfigOpen}
        onCancel={() => setConfigOpen(false)}
        onOk={saveConfig}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="label" label="Label">
            <Input />
          </Form.Item>
          <Form.Item name="min" label="Min instances">
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="max" label="Max instances (optional)">
            <InputNumber min={1} />
          </Form.Item>

          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <div style={{ marginBottom: 6, color: '#666' }}>
              Template: you can select nodes in the editor and click "Capture
              selection" to set the template for new instances.
            </div>
            <Space>
              <Button onClick={captureTemplateFromSelection}>
                Capture selection as template
              </Button>
              <Button
                onClick={() => {
                  updateAttributes({ ...node.attrs, template: null });
                  message.success('Template cleared');
                }}
              >
                Clear template
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </NodeViewWrapper>
  );
};

export const RepeaterItemNode = Node.create({
  name: 'repeater_item',
  group: 'block',
  content: '(paragraph | heading)+',
  isolating: true,
  defining: true,
  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="repeater-item"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'repeater-item' }),
    ];
  },
});

export const RepeaterNode = Node.create({
  name: 'repeater',
  group: 'block',
  content: 'repeater_item*',
  isolating: true,
  draggable: false,
  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
      label: { default: 'Repeater' },
      min: { default: 0 },
      max: { default: null },
      template: { default: null },
      repeatable: { default: true },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="repeater"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'repeater' }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(RepeaterView);
  },

  addCommands() {
    return {
      insertRepeater:
        (attrs?: Record<string, unknown>) =>
        ({ commands }: { commands: RawCommands }) => {
          const defaults = {
            label: attrs?.label ?? 'Repeater',
            min: attrs?.min ?? 0,
            max: attrs?.max ?? null,
            template: attrs?.template ?? null,
            repeatable: attrs?.repeatable ?? true,
          };
          return commands.insertContent({
            type: this.name,
            attrs: defaults,
          });
        },

      // Add a new instance to a repeater located at repeaterPos (document position)
      addRepeaterInstanceAt: (repeaterPos: number) => () => {
        try {
          const editor = (this as any).editor;
          if (!editor || typeof repeaterPos !== 'number') return false;
          const repeaterNode = editor.state.doc.nodeAt(repeaterPos);
          if (!repeaterNode || repeaterNode.type.name !== this.name)
            return false;
          const insertAt = repeaterPos + repeaterNode.nodeSize - 1; // position inside repeater before closing
          let contentToInsert: any;
          if (
            repeaterNode.attrs.template &&
            Array.isArray(repeaterNode.attrs.template) &&
            repeaterNode.attrs.template.length > 0
          ) {
            contentToInsert = {
              type: 'repeater_item',
              content: repeaterNode.attrs.template,
            };
          } else {
            contentToInsert = {
              type: 'repeater_item',
              content: [{ type: 'paragraph' }],
            };
          }
          editor.commands.focus();
          editor.commands.insertContentAt(insertAt, contentToInsert);
          return true;
        } catch (err) {
          console.error('addRepeaterInstanceAt error', err);
          return false;
        }
      },

      // Set template for repeater at position using current selection fragment
      setRepeaterTemplateFromSelection: (repeaterPos: number) => () => {
        try {
          const editor = (this as any).editor;
          if (!editor || typeof repeaterPos !== 'number') return false;
          const { from, to } = editor.state.selection;
          if (from === to) return false;
          const slice = editor.state.doc.slice(from, to);
          const contentJson = slice.content.toJSON();
          // setNodeMarkup on repeaterPos
          const node = editor.state.doc.nodeAt(repeaterPos);
          if (!node || node.type.name !== this.name) return false;
          const tr = editor.state.tr.setNodeMarkup(repeaterPos, undefined, {
            ...node.attrs,
            template: contentJson,
          });
          editor.view.dispatch(tr);
          return true;
        } catch (err) {
          console.error('setRepeaterTemplateFromSelection error', err);
          return false;
        }
      },

      // Duplicate an instance inside repeater at repeaterPos, childIndex
      duplicateRepeaterInstance:
        (repeaterPos: number, childIndex: number) => () => {
          try {
            const editor = (this as any).editor;
            if (!editor || typeof repeaterPos !== 'number') return false;
            const repeaterNode = editor.state.doc.nodeAt(repeaterPos);
            if (!repeaterNode || repeaterNode.type.name !== this.name)
              return false;
            const child = repeaterNode.child(childIndex);
            if (!child) return false;
            const serialized = child.toJSON().content ?? [
              { type: 'paragraph' },
            ];
            const insertAt = repeaterPos + repeaterNode.nodeSize - 1;
            editor.commands.insertContentAt(insertAt, {
              type: 'repeater_item',
              content: serialized,
            });
            return true;
          } catch (err) {
            console.error('duplicateRepeaterInstance error', err);
            return false;
          }
        },

      // Remove instance at childIndex
      removeRepeaterInstance:
        (repeaterPos: number, childIndex: number) => () => {
          try {
            const editor = (this as any).editor;
            if (!editor || typeof repeaterPos !== 'number') return false;
            const repeaterNode = editor.state.doc.nodeAt(repeaterPos);
            if (!repeaterNode || repeaterNode.type.name !== this.name)
              return false;
            // compute child start position
            let offset = repeaterPos + 1; // first child pos
            for (let i = 0; i < childIndex; i++)
              offset += repeaterNode.child(i).nodeSize;
            const childNode = repeaterNode.child(childIndex);
            if (!childNode) return false;
            const from = offset;
            const to = offset + childNode.nodeSize;
            const tr = editor.state.tr.delete(from, to);
            editor.view.dispatch(tr);
            return true;
          } catch (err) {
            console.error('removeRepeaterInstance error', err);
            return false;
          }
        },

      // Move an instance from one index to another within the repeater
      moveRepeaterInstance:
        (repeaterPos: number, fromIndex: number, toIndex: number) => () => {
          try {
            const editor = (this as any).editor;
            if (!editor || typeof repeaterPos !== 'number') return false;
            const doc = editor.state.doc;
            const repeaterNode = doc.nodeAt(repeaterPos);
            if (!repeaterNode || repeaterNode.type.name !== this.name)
              return false;
            if (fromIndex === toIndex) return true;

            // Extract the child node to move
            let offset = repeaterPos + 1;
            for (let i = 0; i < fromIndex; i++)
              offset += repeaterNode.child(i).nodeSize;
            const childNode = repeaterNode.child(fromIndex);
            if (!childNode) return false;
            const from = offset;
            const to = offset + childNode.nodeSize;

            // Remove child and re-insert at target
            // We'll build a fragment containing childNode and insert it
            // const trRemove = editor.state.tr.delete(from, to);
            // compute new insert position accounting for removed node if necessary
            // If moving forward (fromIndex < toIndex) the target index decreases by 1 after removal
            let targetIndex = toIndex;
            if (fromIndex < toIndex) targetIndex = toIndex - 1;

            // compute insertion position after removal
            let insertPos = repeaterPos + 1;
            for (let i = 0; i < targetIndex; i++) {
              const n = repeaterNode.child(i);
              insertPos += n ? n.nodeSize : 0;
            }

            // Need the node json to insert
            const nodeJson = childNode.toJSON();

            // Apply remove then insert (in single transaction)
            let tr = editor.state.tr.delete(from, to);
            const nodeToInsert = editor.schema.nodeFromJSON(nodeJson);
            tr = tr.insert(insertPos, nodeToInsert);
            editor.view.dispatch(tr);
            return true;
          } catch (err) {
            console.error('moveRepeaterInstance error', err);
            return false;
          }
        },
    } as Partial<RawCommands>;
  },
});
