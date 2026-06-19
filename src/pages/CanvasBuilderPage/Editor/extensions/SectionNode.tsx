// src/v2/SectionNode.tsx
import React, { useEffect, useState } from 'react';
import { Node, RawCommands, mergeAttributes } from '@tiptap/core';
import {
  ReactNodeViewRenderer,
  NodeViewProps,
  NodeViewWrapper,
} from '@tiptap/react';
import { Card, Button, Space, Modal, Form, Input, Switch, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  collectFieldValues,
  evaluateCondition,
  getSetEditingNodeFromEditor,
} from '../utils';

const SectionView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const setEditingNode = getSetEditingNodeFromEditor(editor);
  const [collapsed, setCollapsed] = useState(Boolean(node.attrs.collapsed));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(
    () => setCollapsed(Boolean(node.attrs.collapsed)),
    [node.attrs.collapsed]
  );

  const onToggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    updateAttributes({ ...node.attrs, collapsed: next });
  };

  // Evaluate show-if using editor values (preview)
  const vars = collectFieldValues(editor);
  const visiblePreview = evaluateCondition(
    String(node.attrs.showIf ?? ''),
    vars
  );

  const openModal = () => {
    form.setFieldsValue({
      label: node.attrs.label ?? 'Section',
      showIf: node.attrs.showIf ?? '',
      collapsible: !!node.attrs.collapsible,
      gated: !!node.attrs.gated,
      collapsed: !!node.attrs.collapsed,
    });
    setIsModalOpen(true);
    setEditingNode?.({
      attrs: node.attrs,
      type: node.type.name,
      updateAttributes,
      deleteNode,
      editor,
    });
  };

  const onSave = async () => {
    const values = await form.validateFields();
    updateAttributes({
      ...node.attrs,
      label: values.label,
      showIf: values.showIf ?? '',
      collapsible: !!values.collapsible,
      gated: !!values.gated,
      collapsed: !!values.collapsed,
    });
    setIsModalOpen(false);
  };

  return (
    <NodeViewWrapper style={{ margin: '12px 0' }}>
      <Card size="small" styles={{ body: { padding: 8 } }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong>{node.attrs.label || 'Section'}</strong>
            {node.attrs.gated && (
              <span style={{ marginLeft: 8, color: '#1890ff' }}>(gated)</span>
            )}
            {node.attrs.showIf && (
              <Tooltip title={`Show if: ${node.attrs.showIf}`}>
                <span style={{ marginLeft: 8, color: '#fa8c16' }}>•</span>
              </Tooltip>
            )}
            {!visiblePreview && (
              <Tooltip title="This section's show-if evaluated to false in preview">
                <span style={{ marginLeft: 8, color: '#aaa' }}>(hidden)</span>
              </Tooltip>
            )}
          </div>

          <Space>
            {node.attrs.collapsible && (
              <Button size="small" onClick={onToggleCollapse}>
                {collapsed ? 'Expand' : 'Collapse'}
              </Button>
            )}
            <Button size="small" icon={<EditOutlined />} onClick={openModal}>
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

      {/* children will be rendered by TipTap inside NodeViewWrapper */}
      <div
        style={{
          display: collapsed ? 'none' : 'block',
          paddingLeft: 8,
          paddingTop: 8,
        }}
      >
        {/* TipTap injects node.content here */}
      </div>

      <Modal
        title="Edit section"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={onSave}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="label" label="Label">
            <Input />
          </Form.Item>
          <Form.Item
            name="showIf"
            label="Show-if condition"
            tooltip="Use fieldIds as variables (e.g. score >= 5)"
          >
            <Input />
          </Form.Item>
          <Form.Item name="collapsible" valuePropName="checked">
            <Switch /> Collapsible
          </Form.Item>
          <Form.Item name="collapsed" valuePropName="checked">
            <Switch /> Start collapsed
          </Form.Item>
          <Form.Item name="gated" valuePropName="checked">
            <Switch /> Gated (page-break / require completion)
          </Form.Item>
        </Form>
      </Modal>
    </NodeViewWrapper>
  );
};

export const SectionNode = Node.create({
  name: 'section',
  group: 'block',
  content: 'block*',
  defining: true,
  isolating: true,
  draggable: false,
  addAttributes() {
    return {
      id: { default: null },
      label: { default: 'Section' },
      collapsible: { default: false },
      collapsed: { default: false },
      gated: { default: false },
      showIf: { default: '' },
      inheritShowIf: { default: true },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="section"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'section' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(SectionView);
  },

  addCommands() {
    return {
      insertSection:
        (attrs?: Record<string, unknown>) =>
        ({ commands }: { commands: RawCommands }) => {
          const defaults = {
            id: attrs?.id ?? `section_${Date.now()}`,
            label: attrs?.label ?? 'Section',
            collapsible: attrs?.collapsible ?? false,
            collapsed: attrs?.collapsed ?? false,
            gated: attrs?.gated ?? false,
            showIf: attrs?.showIf ?? '',
            inheritShowIf: attrs?.inheritShowIf ?? true,
          };
          return commands.insertContent({
            type: this.name,
            attrs: defaults,
          });
        },

      toggleSectionCollapse: (pos: number) => (props: any) => {
        console.log('props', props);
        try {
          const editor = (this as any).editor;
          if (!editor) return false;
          const node = editor.state.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          const nextCollapsed = !node.attrs.collapsed;
          const newAttrs = { ...node.attrs, collapsed: nextCollapsed };
          const newTr = editor.state.tr.setNodeMarkup(pos, undefined, newAttrs);
          editor.view.dispatch(newTr);
          return true;
        } catch (e) {
          console.error('toggleSectionCollapse error', e);
          return false;
        }
      },
    } as Partial<RawCommands>;
  },
});
