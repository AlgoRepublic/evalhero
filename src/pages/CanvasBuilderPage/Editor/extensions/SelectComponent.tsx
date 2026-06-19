import { NodeViewProps } from '@tiptap/core';
import { getSetEditingNodeFromEditor, wrapperStyle } from '../utils';
import { NodeViewWrapper } from '@tiptap/react';
import { Button, Select, Space } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';

export const SelectComponent = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}: NodeViewProps) => {
  const { label, options } = node.attrs;
  const setEditingNode = getSetEditingNodeFromEditor(editor);
  const mode = (editor as any)?.storage?.formBuilder?.mode || 'readonly';
  const isEditMode = mode === 'edit';
  return (
    <NodeViewWrapper {...(isEditMode ? { 'data-drag-handle': true } : {})} style={wrapperStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontWeight: 600 }}>{label}</label>
          <Select
            style={{ width: '100%' }}
            options={(options || []).map((o: string) => ({
              value: o,
              label: o,
            }))}
            disabled
          />
        </div>
        {isEditMode && (
          <Space>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() =>
                setEditingNode?.({
                  attrs: node.attrs,
                  type: node.type.name,
                  updateAttributes,
                  deleteNode,
                })
              }
            />
            <Button
              size="small"
              icon={<DeleteOutlined />}
              danger
              onClick={deleteNode}
            />
          </Space>
        )}
      </div>
    </NodeViewWrapper>
  );
};
