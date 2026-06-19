import React, { useState } from 'react';
import {
  Drawer,
  Button,
  Space,
  Typography,
  message,
  theme,
} from 'antd';
import {
  SettingOutlined,
  ReloadOutlined,
  PushpinOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import { useSidebar } from '../../context/SidebarContext';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

const { Title, Text } = Typography;

interface SidebarCustomizerProps {
  menuItems?: Array<{ key: string; label: string }>;
}

/**
 * SidebarCustomizer component for customizing sidebar appearance
 */
export const SidebarCustomizer: React.FC<SidebarCustomizerProps> = ({
  menuItems = [],
}) => {
  const [open, setOpen] = useState(false);
  const {
    preferences,
    allMenuItems,
    resetPreferences,
    pinItem,
    unpinItem,
    hideItem,
    showItem,
  } = useSidebar();
  const currentTheme = useSelector((state: RootState) => state.theme.mytheme);
  const { token } = theme.useToken();

  const handleReset = () => {
    resetPreferences();
    message.success('Sidebar preferences reset to default');
  };

  // Flatten all menu items including children for display
  const flattenMenuItems = (items: typeof allMenuItems): Array<{ key: string; label: string; isChild?: boolean }> => {
    const result: Array<{ key: string; label: string; isChild?: boolean }> = [];
    
    items.forEach((item) => {
      // Add parent item
      result.push({ key: item.key, label: item.label, isChild: false });
      
      // Add children if present
      if (item.children && item.children.length > 0) {
        item.children.forEach((child) => {
          result.push({ key: child.key, label: child.label, isChild: true });
        });
      }
    });
    
    return result;
  };

  // Get all available items (from context - shows ALL items including hidden ones)
  const getAllItems = (): Array<{ key: string; label: string; isChild?: boolean }> => {
    // Priority 1: Use allMenuItems from context (includes all items, even hidden)
    if (allMenuItems.length > 0) {
      return flattenMenuItems(allMenuItems);
    }
    
    // Priority 2: Use provided menuItems prop
    if (menuItems.length > 0) {
      return menuItems.map(item => ({ ...item, isChild: false }));
    }
    
    // Fallback: extract from actual menu items in sidebar (only visible ones)
    const menuElements = document.querySelectorAll('[data-tour^="menu-item-"]');
    const items: Array<{ key: string; label: string; isChild?: boolean }> = [];
    
    menuElements.forEach((el) => {
      const key = el.getAttribute('data-tour')?.replace('menu-item-', '') || '';
      const label = el.textContent?.trim() || key;
      if (key && !items.find((item) => item.key === key)) {
        items.push({ key, label, isChild: false });
      }
    });
    
    return items;
  };

  const displayItems = getAllItems();

  return (
    <>
      <Button
        type="text"
        icon={<SettingOutlined />}
        size="large"
        onClick={() => setOpen(true)}
        title="Customize Sidebar"
      />
      <Drawer
        title={
          <Space>
            <SettingOutlined />
            <Title level={5} style={{ margin: 0 }}>
              Customize Sidebar
            </Title>
          </Space>
        }
        open={open}
        onClose={() => setOpen(false)}
        width={400}
        extra={
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={handleReset}
            danger
          >
            Reset
          </Button>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Title level={5}>Menu Items</Title>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {displayItems.length === 0 ? (
                <Text type="secondary">No menu items found</Text>
              ) : (
                displayItems.map((item) => {
                const isPinned = preferences.pinnedItems.includes(item.key);
                const isHidden = preferences.hiddenItems.includes(item.key);

                return (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      backgroundColor:
                        currentTheme === 'dark'
                          ? token.colorFillSecondary
                          : token.colorFillTertiary,
                      borderRadius: token.borderRadius,
                    }}
                  >
                    <Text
                      delete={isHidden}
                      type={isHidden ? 'secondary' : undefined}
                      style={{
                        opacity: isHidden ? 0.6 : 1,
                        marginLeft: item.isChild ? '20px' : 0,
                        fontStyle: isHidden ? 'italic' : 'normal',
                      }}
                    >
                      {item.isChild && '└ '}
                      {item.label}
                      {isHidden && ' (hidden)'}
                    </Text>
                    <Space>
                      <Button
                        type="text"
                        size="small"
                        icon={
                          isPinned ? (
                            <PushpinOutlined style={{ color: token.colorPrimary }} />
                          ) : (
                            <PushpinOutlined />
                          )
                        }
                        onClick={() => {
                          if (isPinned) {
                            unpinItem(item.key);
                            message.info(`${item.label} unpinned`);
                          } else {
                            pinItem(item.key);
                            message.success(`${item.label} pinned`);
                          }
                        }}
                        title={isPinned ? 'Unpin' : 'Pin'}
                      />
                      <Button
                        type="text"
                        size="small"
                        icon={
                          isHidden ? (
                            <EyeInvisibleOutlined style={{ color: token.colorError }} />
                          ) : (
                            <EyeOutlined />
                          )
                        }
                        onClick={() => {
                          if (isHidden) {
                            showItem(item.key);
                            message.success(`${item.label} shown`);
                          } else {
                            hideItem(item.key);
                            message.info(`${item.label} hidden`);
                          }
                        }}
                        title={isHidden ? 'Show' : 'Hide'}
                      />
                    </Space>
                  </div>
                );
              }))}
            </Space>
          </div>
        </Space>
      </Drawer>
    </>
  );
};
