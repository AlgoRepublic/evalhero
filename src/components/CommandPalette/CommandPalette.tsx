import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Input,
  List,
  Typography,
  Space,
  Empty,
  Divider,
  theme,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { getCommands } from '../../config/commands';
import { searchItems } from '../../utils/fuzzySearch';
import { hasPermission } from '../../utils/rbac';
import { useTour } from '../../context/TourContext';
import { addActivity } from '../../utils/activityUtils';

const { Text } = Typography;

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSyncData?: () => void;
  onToggleTheme?: () => void;
  onSwitchWorkspace?: () => void;
}

/**
 * CommandPalette component for quick navigation and actions
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onSyncData,
  onToggleTheme,
  onSwitchWorkspace,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const state = useSelector((state: RootState) => state.theme.mytheme);
  const rootState = useSelector((state: RootState) => state);
  const { token } = theme.useToken();
  const { startTour } = useTour();
  const inputRef = useRef<any | null>(null);

  const checkPermission = (permission: string) => {
    return hasPermission(permission, rootState);
  };

  const allCommands = getCommands(
    navigate,
    checkPermission,
    {
      toggleTheme: onToggleTheme || (() => {}),
      syncData: onSyncData || (() => {}),
      startTour,
      switchWorkspace: onSwitchWorkspace,
    }
  );

  // Flatten commands for search
  const flatCommands = allCommands.flatMap((group) =>
    group.commands.map((cmd) => ({ ...cmd, groupName: group.name }))
  );

  // Search commands
  const filteredCommands = searchItems(flatCommands, query, (cmd) =>
    [cmd.title, cmd.description, ...cmd.keywords].join(' ')
  );

  // Group filtered results
  const groupedResults = filteredCommands.reduce((acc, cmd) => {
    const group = acc.find((g) => g.name === cmd.groupName);
    if (group) {
      group.commands.push(cmd);
    } else {
      acc.push({ name: cmd.groupName!, commands: [cmd] });
    }
    return acc;
  }, [] as Array<{ name: string; commands: typeof flatCommands }>);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef?.current?.focus();
      }, 100);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredCommands, selectedIndex, onClose]);

  const executeCommand = (command: typeof flatCommands[0]) => {
    command.action();
    addActivity({
      type: 'action',
      description: `Executed command: ${command.title}`,
    });
    onClose();
  };

  // Calculate which item is selected across groups
  // let currentIndex = 0;
  const getItemIndex = (groupIndex: number, commandIndex: number) => {
    let index = 0;
    for (let i = 0; i < groupIndex; i++) {
      index += groupedResults[i].commands.length;
    }
    return index + commandIndex;
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
          backgroundColor: state === 'dark' ? token.colorBgElevated : '#fff',
        }}
      >
        <Input
          ref={inputRef}
          size="large"
          prefix={<SearchOutlined />}
          placeholder="Type a command or search..."
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
          {groupedResults.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No commands found"
              style={{ padding: '24px' }}
            />
          ) : (
            groupedResults.map((group, groupIndex) => (
              <div key={group.name}>
                <div
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: token.colorTextSecondary,
                    textTransform: 'uppercase',
                  }}
                >
                  {group.name}
                </div>
                <List
                  dataSource={group.commands}
                  renderItem={(command, commandIndex) => {
                    const itemIndex = getItemIndex(groupIndex, commandIndex);
                    const isSelected = itemIndex === selectedIndex;

                    return (
                      <List.Item
                        style={{
                          cursor: 'pointer',
                          padding: '12px 16px',
                          backgroundColor: isSelected
                            ? token.colorPrimaryBg
                            : 'transparent',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        onClick={() => executeCommand(command)}
                      >
                        <List.Item.Meta
                          avatar={
                            <div
                              style={{
                                color: isSelected
                                  ? token.colorPrimary
                                  : token.colorTextSecondary,
                              }}
                            >
                              {command.icon}
                            </div>
                          }
                          title={
                            <Text
                              strong={isSelected}
                              style={{
                                color: isSelected
                                  ? token.colorPrimary
                                  : token.colorText,
                              }}
                            >
                              {command.title}
                            </Text>
                          }
                          description={
                            command.description && (
                              <Text
                                type="secondary"
                                style={{ fontSize: '12px' }}
                              >
                                {command.description}
                              </Text>
                            )
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
                {groupIndex < groupedResults.length - 1 && (
                  <Divider style={{ margin: '8px 0' }} />
                )}
              </div>
            ))
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
