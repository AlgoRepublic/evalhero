// src/v2/StaticContentNode.tsx
import React, { useState } from 'react';
import { Node, mergeAttributes, RawCommands } from '@tiptap/core';
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewProps,
} from '@tiptap/react';
import { Card, Button, Modal, Form, Input, Select, Space } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getSetEditingNodeFromEditor } from '../utils';

const contentTypes = [
  { value: 'info', label: 'Info' },
  { value: 'callout', label: 'Callout' },
  { value: 'warning', label: 'Warning' },
  { value: 'divider', label: 'Divider' },
];

const StaticView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const setEditingNode = getSetEditingNodeFromEditor(editor);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const attrs = node.attrs || {};

  const openEdit = () => {
    form.setFieldsValue({
      type: attrs.type ?? 'info',
      title: attrs.title ?? '',
      body: attrs.body ?? '',
      icon: attrs.icon ?? '',
    });
    setOpen(true);
    setEditingNode?.({
      attrs: node.attrs,
      type: node.type.name,
      updateAttributes,
      deleteNode,
      editor,
    });
  };

  const save = async () => {
    const values = await form.validateFields();
    updateAttributes({
      ...node.attrs,
      type: values.type,
      title: values.title,
      body: values.body,
      icon: values.icon,
    });
    setOpen(false);
  };

  return (
    <NodeViewWrapper style={{ margin: '8px 0' }}>
      <Card
        size="small"
        style={{
          background: node.attrs.type === 'callout' ? '#fffbe6' : undefined,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            {attrs.icon && <span style={{ marginRight: 8 }}>{attrs.icon}</span>}
            <strong>{attrs.title || attrs.type || 'Info'}</strong>
            {attrs.body && (
              <div style={{ marginTop: 6, color: '#555' }}>{attrs.body}</div>
            )}
          </div>
          <Space>
            <Button size="small" icon={<EditOutlined />} onClick={openEdit}>
              Edit
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
      </Card>

      <Modal
        title="Edit content"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={save}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="type" label="Type">
            <Select options={contentTypes} />
          </Form.Item>
          <Form.Item name="icon" label="Icon (optional)">
            <Input />
          </Form.Item>
          <Form.Item name="title" label="Title">
            <Input />
          </Form.Item>
          <Form.Item name="body" label="Body">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </NodeViewWrapper>
  );
};

export const StaticContentNode = Node.create({
  name: 'staticContent',
  group: 'block',
  atom: true,
  draggable: false,
  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
      type: { default: 'info' },
      title: { default: '' },
      body: { default: '' },
      icon: { default: null },
      collapsed: { default: false },
      visible: { default: true },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="static-content"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'static-content' }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(StaticView);
  },

  addCommands() {
    return {
      insertStaticContent:
        (attrs?: Record<string, unknown>) =>
        ({ commands }: { commands: RawCommands }) => {
          const defaults = {
            type: attrs?.type ?? 'info',
            title: attrs?.title ?? '',
            body: attrs?.body ?? '',
            icon: attrs?.icon ?? null,
          };
          return commands.insertContent({
            type: this.name,
            attrs: defaults,
          });
        },
    } as Partial<RawCommands>;
  },
});
