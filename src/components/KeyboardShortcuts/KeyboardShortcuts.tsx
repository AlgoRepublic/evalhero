import React, { useEffect } from 'react';
import { Modal, Typography, Space, Tag, Divider, theme } from 'antd';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { getKeyboardShortcuts } from '../../config/keyboardShortcuts';
import { hasPermission } from '../../utils/rbac';

const { Title, Text } = Typography;

export interface KeyboardShortcut {
  keys: string[];
  description: string;
  action?: string;
}

interface KeyboardShortcutsProps {
  open: boolean;
  onClose: () => void;
}

/**
 * KeyboardShortcuts component displaying available keyboard shortcuts
 */
export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  open,
  onClose,
}) => {
  const currentTheme = useSelector((state: RootState) => state.theme.mytheme);
  const state = useSelector((state: RootState) => state);
  const { token } = theme.useToken();

  const checkPermission = (permission: string) => {
    return hasPermission(permission, state);
  };

  const shortcuts = getKeyboardShortcuts(checkPermission);

  const renderKey = (key: string) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const keyMap: Record<string, string> = {
      Ctrl: isMac ? '⌘' : 'Ctrl',
      Shift: 'Shift',
      Alt: isMac ? '⌥' : 'Alt',
      Enter: 'Enter',
      Esc: 'Esc',
      Space: 'Space',
    };

    return keyMap[key] || key;
  };

  const renderKeys = (keys: string[]) => {
    return (
      <Space size={4}>
        {keys.map((key, index) => (
          <React.Fragment key={index}>
            <Tag
              style={{
                margin: 0,
                padding: '2px 8px',
                backgroundColor:
                  currentTheme === 'dark'
                    ? token.colorFillSecondary
                    : token.colorBgContainer,
                border: `1px solid ${token.colorBorder}`,
                color: token.colorText,
                fontSize: '11px',
                fontFamily: 'monospace',
              }}
            >
              {renderKey(key)}
            </Tag>
            {index < keys.length - 1 && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                +
              </Text>
            )}
          </React.Fragment>
        ))}
      </Space>
    );
  };

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    if (open) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [open, onClose]);

  return (
    <Modal
      title="Keyboard Shortcuts"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      styles={{
        body: {
          maxHeight: '70vh',
          overflowY: 'auto',
        },
      }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {shortcuts.map((category, categoryIndex) => (
          <div key={categoryIndex}>
            <Title level={5} style={{ marginBottom: 12 }}>
              {category.name}
            </Title>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {category.shortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                  }}
                >
                  <Text style={{ flex: 1 }}>{shortcut.description}</Text>
                  <div>{renderKeys(shortcut.keys)}</div>
                </div>
              ))}
            </Space>
            {categoryIndex < shortcuts.length - 1 && (
              <Divider style={{ margin: '16px 0' }} />
            )}
          </div>
        ))}
      </Space>
    </Modal>
  );
};
