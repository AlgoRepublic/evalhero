import React from 'react';
import { Dropdown, Button, MenuProps, theme } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useColorBlindness } from '../../hooks/useColorBlindness';

/**
 * AccessibilityChecker component for color blindness simulation
 */
export const AccessibilityChecker: React.FC = () => {
  const { filterType, setFilterType } = useColorBlindness();
  const { token } = theme.useToken();

  const menuItems: MenuProps['items'] = [
    {
      key: 'none',
      label: 'Normal Vision',
      onClick: () => setFilterType('none'),
    },
    {
      type: 'divider',
    },
    {
      key: 'protanopia',
      label: 'Protanopia (Red-blind)',
      onClick: () => setFilterType('protanopia'),
    },
    {
      key: 'deuteranopia',
      label: 'Deuteranopia (Green-blind)',
      onClick: () => setFilterType('deuteranopia'),
    },
    {
      key: 'tritanopia',
      label: 'Tritanopia (Blue-blind)',
      onClick: () => setFilterType('tritanopia'),
    },
  ];

  const getActiveLabel = () => {
    switch (filterType) {
      case 'protanopia':
        return 'Protanopia';
      case 'deuteranopia':
        return 'Deuteranopia';
      case 'tritanopia':
        return 'Tritanopia';
      default:
        return 'Normal';
    }
  };

  return (
    <Dropdown
      menu={{
        items: menuItems,
        selectedKeys: [filterType],
      }}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button
        type="text"
        icon={<EyeOutlined />}
        size="large"
        title={`Color Vision: ${getActiveLabel()}`}
        style={{
          color: filterType !== 'none' ? token.colorWarning : token.colorText,
        }}
      />
    </Dropdown>
  );
};
