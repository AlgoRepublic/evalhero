// src/lib/tiptap/components/CommandList.tsx
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useMemo,
} from 'react';
import { Input, List, Space, Typography, Divider, Tag, theme } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { CommandItem } from './index';

const { Text } = Typography;

export interface CommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface Props {
  items: CommandItem[];
  query: string;
  command: (item: CommandItem) => void;
}

export const CommandList = forwardRef<CommandListRef, Props>(
  ({ items, query, command }, ref) => {
    const [selected, setSelected] = useState(0);
    const [hovered, setHovered] = useState<number | null>(null);
    const [search, setSearch] = useState(query);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    // const displayIndex = hovered !== null ? hovered : selected;

    const filtered = useMemo(() => {
      let result = items;

      if (search) {
        const q = search.toLowerCase().trim();
        result = result.filter((i) => {
          const titleMatch = i.title.toLowerCase().includes(q);
          const shortcutMatch = i.shortcuts?.some((s) => s.startsWith(q));
          return titleMatch || shortcutMatch;
        });
      }

      if (activeCategory) {
        result = result.filter((i) => i.category === activeCategory);
      }

      return result;
    }, [items, search, activeCategory]);

    useEffect(() => setSelected(0), [filtered]);
    useEffect(() => setSearch(query), [query]);

    const up = () =>
      setSelected((i) => (i - 1 + filtered.length) % filtered.length);
    const down = () => setSelected((i) => (i + 1) % filtered.length);
    const select = () => filtered[selected] && command(filtered[selected]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          up();
          return true;
        }
        if (event.key === 'ArrowDown') {
          down();
          return true;
        }
        if (event.key === 'Enter') {
          select();
          return true;
        }
        return false;
      },
    }));

    const categories = ['text', 'choice', 'numeric', 'date', 'file', 'layout', 'advanced'].filter((cat) =>
      items.some((i) => i.category === cat)
    );

    const { token } = theme.useToken();

    return (
      <div
        style={{
          background: token.colorBgContainer,
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          padding: '12px 0',
          maxHeight: 460,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '0 16px 8px' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search or type shortcut..."
            size="small"
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: token.colorBgElevated,
              border: 'none',
              borderRadius: 8,
            }}
            autoFocus
          />
        </div>

        <div
          style={{
            padding: '0 16px 8px',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <Tag
            color={activeCategory === null ? 'blue' : undefined}
            style={{ cursor: 'pointer', fontSize: 11 }}
            onClick={() => setActiveCategory(null)}
          >
            All
          </Tag>
          {categories.map((cat) => (
            <Tag
              key={cat}
              color={activeCategory === cat ? 'blue' : undefined}
              style={{
                cursor: 'pointer',
                fontSize: 11,
                textTransform: 'capitalize',
              }}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </Tag>
          ))}
        </div>

        <Divider style={{ margin: '8px 0' }} />

        <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
          <List
            dataSource={filtered}
            renderItem={(item, i) => {
              const shortcut = item.shortcuts?.[0];
              return (
                <List.Item
                  onClick={() => command(item)}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    background:
                      i === (hovered ?? selected)
                        ? token.colorFillAlter
                        : 'transparent',
                    borderRadius: 8,
                    margin: '0 8px',
                    transition: 'all 0.2s ease',
                    overflow: 'hidden',
                  }}
                >
                  <Space size={12} style={{ width: '100%' }}>
                    <span
                      style={{
                        fontSize: 18,
                        color: token.colorPrimary,
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        strong
                        style={{
                          color: token.colorText,
                          fontSize: 14,
                          display: 'block',
                          marginBottom: 2,
                        }}
                        ellipsis={{ tooltip: item.title }}
                      >
                        {item.title}
                      </Text>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <Text
                          type="secondary"
                          style={{
                            fontSize: 11,
                            textTransform: 'capitalize',
                            color: token.colorTextDescription,
                          }}
                        >
                          {item.category}
                        </Text>
                        {shortcut && (
                          <Tag
                            color="processing"
                            style={{
                              fontSize: 10,
                              lineHeight: '16px',
                              height: 18,
                              padding: '0 6px',
                              margin: 0,
                              borderRadius: 4,
                              fontFamily: 'monospace',
                              fontWeight: 500,
                              color: token.colorPrimary,
                              background: token.colorFillSecondary,
                              border: 'none',
                            }}
                          >
                            /{shortcut}
                          </Tag>
                        )}
                      </div>
                    </div>
                  </Space>
                </List.Item>
              );
            }}
          />

          {filtered.length === 0 && (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: token.colorTextDescription,
              }}
            >
              No commands found
            </div>
          )}
        </div>
      </div>
    );
  }
);

CommandList.displayName = 'CommandList';
