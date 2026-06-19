import React from 'react';
import { Layout, DatePicker, Menu, Typography, Grid } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import dayjs from 'dayjs';
import { CalendarFilters, type CalendarFiltersState } from './CalendarFilters';
const { Sider } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

export type CalendarSourceKey = 'profile-documents';

const SIDEBAR_SOURCE_KEYS: Record<string, CalendarSourceKey> = {
  'profile-documents': 'profile-documents',
} as const;

export interface CalendarSidebarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  selectedSourceKey: CalendarSourceKey | null;
  onSourceSelect: (key: CalendarSourceKey) => void;
  /** Admin-only calendar filters; when provided, filter UI is shown */
  isAdmin?: boolean;
  calendarFilters?: CalendarFiltersState;
  onCalendarFiltersChange?: (filters: CalendarFiltersState) => void;
}

const menuItems: MenuProps['items'] = [
  {
    key: 'profile-documents',
    icon: <FileTextOutlined />,
    label: 'Profile Documents',
  },
];

export const CalendarSidebar: React.FC<CalendarSidebarProps> = ({
  currentDate,
  onDateChange,
  selectedSourceKey,
  onSourceSelect,
  isAdmin,
  calendarFilters,
  onCalendarFiltersChange,
}) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const showFilters = isAdmin && selectedSourceKey === 'profile-documents' && calendarFilters != null && onCalendarFiltersChange != null;

  return (
    <Sider
      width={240}
      collapsedWidth={0}
      breakpoint="md"
      collapsed={isMobile}
      style={{
        background: 'transparent',
        marginRight: 16,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Calendar
        </Text>
        <DatePicker
          value={dayjs(currentDate)}
          onChange={(d) => d && onDateChange(d.toDate())}
          allowClear={false}
          style={{ width: '100%' }}
          size="middle"
        />
      </div>
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Sources
        </Text>
        <Menu
          selectedKeys={selectedSourceKey ? [selectedSourceKey] : []}
          onSelect={({ key }) => {
            const sourceKey = SIDEBAR_SOURCE_KEYS[key];
            if (sourceKey) onSourceSelect(sourceKey);
          }}
          items={menuItems}
          style={{ border: 'none', background: 'transparent' }}
        />
      </div>
      {showFilters && (
        <CalendarFilters value={calendarFilters} onChange={onCalendarFiltersChange} />
      )}
    </Sider>
  );
};
