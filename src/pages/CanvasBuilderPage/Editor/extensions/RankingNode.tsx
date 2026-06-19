import { CommandProps, Node, RawCommands, mergeAttributes } from '@tiptap/core';
import {
  ReactNodeViewRenderer,
  NodeViewProps,
  NodeViewWrapper,
} from '@tiptap/react';
import React from 'react';
import { List, Button, Space } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { getSetEditingNodeFromEditor } from '../utils';

const RankingComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const {
    label,
    options = [],
    order = [],
  } = node.attrs as {
    label?: string;
    options?: React.ReactNode[];
    order?: number[];
  };
  const setEditingNode = getSetEditingNodeFromEditor(editor);

  // If order absent, default to options order
  const currentOrder: number[] =
    Array.isArray(order) && order.length === options.length
      ? (order as number[])
      : options.map((_: React.ReactNode, i: number) => i);

  const move = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= options.length) return;
    const nextOrder = [...currentOrder];
    const [item] = nextOrder.splice(fromIdx, 1);
    nextOrder.splice(toIdx, 0, item);
    updateAttributes({ ...node.attrs, order: nextOrder });
  };

  // convenience to display items in current order
  const orderedItems = currentOrder.map((idx: number) => options[idx]);

  return (
    <NodeViewWrapper
      data-drag-handle
      style={{ padding: 8, border: '1px dashed #ccc', margin: '8px 0' }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{label}</div>

      <List
        size="small"
        bordered
        dataSource={orderedItems}
        renderItem={(item, idx) => (
          <List.Item
            actions={[
              <Button
                size="small"
                icon={<ArrowUpOutlined />}
                onClick={() => move(idx, idx - 1)}
              />,
              <Button
                size="small"
                icon={<ArrowDownOutlined />}
                onClick={() => move(idx, idx + 1)}
              />,
            ]}
          >
            <span style={{ marginRight: 8 }}>{idx + 1}.</span>
            <span>{item}</span>
          </List.Item>
        )}
      />

      <Space align="start" style={{ width: '100%', marginTop: 8 }} size="large">
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() =>
            // (editor.commands.focus() || updateAttributes({ ...node.attrs })) &&
            editor.commands.focus() &&
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
          danger
          icon={<DeleteOutlined />}
          onClick={deleteNode}
        />
      </Space>
    </NodeViewWrapper>
  );
};

export const RankingNode = Node.create({
  name: 'ranking',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      label: { default: 'Ranking' },
      options: { default: ['First', 'Second', 'Third'] },
      order: { default: [] }, // array of indices representing the ranked order
    };
  },

  parseHTML() {
    return [{ tag: `div[data-type="ranking"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'ranking' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RankingComponent);
  },

  addCommands() {
    return {
      insertRanking:
        (attrs?: Record<string, unknown>) =>
        ({ commands }: { commands: CommandProps['commands'] }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              label: 'Rank these',
              options: ['A', 'B', 'C'],
              order: [],
              ...attrs,
            },
          });
        },
    } as Partial<RawCommands>;
  },
});
