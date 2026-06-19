import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Input,
  List,
  Typography,
  Space,
  Empty,
  Tag,
  theme,
} from 'antd';
import { SearchOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { getCommands } from '../../config/commands';
import { searchItems } from '../../utils/fuzzySearch';
import { hasPermission } from '../../utils/rbac';
import { usePageHistory } from '../../hooks/usePageHistory';
import { addActivity } from '../../utils/activityUtils';

const { Text } = Typography;

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_HISTORY = 10;

interface SmartSearchProps {
  open: boolean;
  onClose: () => void;
  onSyncData?: () => void;
  onToggleTheme?: () => void;
  onSwitchWorkspace?: () => void;
  triggerKey?: string; // Allow different trigger key
}

/**
 * SmartSearch component for global search across the application
 */
export const SmartSearch: React.FC<SmartSearchProps> = ({
  open,
  onClose,
  onSyncData,
  onToggleTheme,
  onSwitchWorkspace,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const currentTheme = useSelector((state: RootState) => state.theme.mytheme);
  const rootState = useSelector((state: RootState) => state);
  const { token } = theme.useToken();
  const { history: pageHistory } = usePageHistory();
  const inputRef = useRef<any>(null);

  const checkPermission = (permission: string) => {
    return hasPermission(permission, rootState);
  };

  // Get search history
  const getSearchHistory = (): string[] => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const [searchHistory, setSearchHistory] = useState<string[]>(getSearchHistory());

  // Save search to history
  const saveToHistory = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    const updated = [
      searchQuery,
      ...searchHistory.filter((h) => h !== searchQuery),
    ].slice(0, MAX_HISTORY);
    setSearchHistory(updated);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  };

  // Get all commands
  const allCommands = getCommands(
    navigate,
    checkPermission,
    {
      toggleTheme: onToggleTheme || (() => {}),
      syncData: onSyncData || (() => {}),
      startTour: () => {},
      switchWorkspace: onSwitchWorkspace,
    }
  );

  // Flatten commands
  const flatCommands = allCommands.flatMap((group) =>
    group.commands.map((cmd) => ({ ...cmd, groupName: group.name, type: 'command' as const }))
  );

  // Add page history as searchable items
  const pageHistoryItems = pageHistory.map((item) => ({
    id: `page-${item.path}`,
    title: item.title,
    description: item.path,
    type: 'page' as const,
    action: () => navigate(item.path),
    keywords: [item.title, item.path],
  }));

  // Combine all searchable items
  const allItems = [
    ...flatCommands.map((cmd) => ({ ...cmd, type: 'command' as const })),
    ...pageHistoryItems,
  ];

  // Search items
  const filteredItems = query.trim()
    ? searchItems(allItems, query, (item) =>
        [item.title, item.description, ...(item.keywords || [])].join(' ')
      )
    : [];

  // Show history when no query
  const showHistory = !query.trim() && searchHistory.length > 0;

  // Reset selection
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const itemsToNavigate = showHistory ? searchHistory : filteredItems;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < itemsToNavigate.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : itemsToNavigate.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (showHistory && searchHistory[selectedIndex]) {
          setQuery(searchHistory[selectedIndex]);
        } else if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          saveToHistory(query);
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredItems, selectedIndex, onClose, query, showHistory, searchHistory]);

  const executeItem = (item: typeof allItems[0]) => {
    item.action();
    addActivity({
      type: item.type === 'page' ? 'navigation' : 'action',
      description: `Searched and navigated to: ${item.title}`,
      path: item.type === 'page' ? item.description : undefined,
    });
    if (query.trim()) {
      saveToHistory(query);
    }
    onClose();
  };

  const selectHistoryItem = (historyItem: string) => {
    setQuery(historyItem);
    inputRef.current?.focus();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={600}
      styles={{
        body: {
          padding: 0,
        },
      }}
    >
      <div
        style={{
          backgroundColor: currentTheme === 'dark' ? token.colorBgElevated : '#fff',
        }}
      >
        <Input
          ref={inputRef}
          size="large"
          prefix={<SearchOutlined />}
          placeholder="Search pages, commands, and more..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            border: 'none',
            borderBottom: `1px solid ${token.colorBorder}`,
            borderRadius: 0,
          }}
        />
        <div
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            padding: '8px 0',
          }}
        >
          {showHistory ? (
            <div>
              <div
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: token.colorTextSecondary,
                  textTransform: 'uppercase',
                }}
              >
                Recent Searches
              </div>
              <List
                dataSource={searchHistory}
                renderItem={(item, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <List.Item
                      style={{
                        cursor: 'pointer',
                        padding: '12px 16px',
                        backgroundColor: isSelected
                          ? token.colorPrimaryBg
                          : 'transparent',
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => selectHistoryItem(item)}
                    >
                      <List.Item.Meta
                        avatar={<ClockCircleOutlined style={{ color: token.colorTextSecondary }} />}
                        title={
                          <Text
                            style={{
                              color: isSelected
                                ? token.colorPrimary
                                : token.colorText,
                            }}
                          >
                            {item}
                          </Text>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            </div>
          ) : filteredItems.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No results found"
              style={{ padding: '24px' }}
            />
          ) : (
            <List
              dataSource={filteredItems}
              renderItem={(item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <List.Item
                    style={{
                      cursor: 'pointer',
                      padding: '12px 16px',
                      backgroundColor: isSelected
                        ? token.colorPrimaryBg
                        : 'transparent',
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => executeItem(item)}
                  >
                    <List.Item.Meta
                      avatar={
                        'icon' in item && item.icon ? (
                          <div
                            style={{
                              color: isSelected
                                ? token.colorPrimary
                                : token.colorTextSecondary,
                            }}
                          >
                            {item.icon}
                          </div>
                        ) : null
                      }
                      title={
                        <Space>
                          <Text
                            strong={isSelected}
                            style={{
                              color: isSelected
                                ? token.colorPrimary
                                : token.colorText,
                            }}
                          >
                            {item.title}
                          </Text>
                          {item.type && (
                            <Tag
                              style={{
                                fontSize: '10px',
                                margin: 0,
                              }}
                            >
                              {item.type}
                            </Tag>
                          )}
                        </Space>
                      }
                      description={
                        item.description && (
                          <Text
                            type="secondary"
                            style={{ fontSize: '12px' }}
                          >
                            {item.description}
                          </Text>
                        )
                      }
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </div>
        <div
          style={{
            padding: '8px 16px',
            borderTop: `1px solid ${token.colorBorder}`,
            fontSize: '11px',
            color: token.colorTextSecondary,
          }}
        >
          <Space>
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </Space>
        </div>
      </div>
    </Modal>
  );
};
