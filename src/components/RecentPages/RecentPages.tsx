import React from 'react';
import { Dropdown, Button, List, Typography, Empty, theme } from 'antd';
import {
  HistoryOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { usePageHistory } from '../../hooks/usePageHistory';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

/**
 * RecentPages component showing recently visited pages
 */
export const RecentPages: React.FC = () => {
  const { history, clearHistory, navigateToHistoryItem } = usePageHistory();
  const currentTheme = useSelector((state: RootState) => state.theme.mytheme);
  const { token } = theme.useToken();

  const dropdownContent = (
    <div
      style={{
        width: 320,
        maxHeight: 400,
        overflowY: 'auto',
        backgroundColor: currentTheme === 'dark' ? token.colorBgElevated : '#fff',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${token.colorBorder}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text strong>Recent Pages</Text>
        {history.length > 0 && (
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              clearHistory();
            }}
          >
            Clear
          </Button>
        )}
      </div>
      {history.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No recent pages"
          style={{ padding: '24px' }}
        />
      ) : (
        <List
          dataSource={history}
          renderItem={(item) => (
            <List.Item
              style={{
                cursor: 'pointer',
                padding: '12px 16px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  currentTheme === 'dark'
                    ? token.colorFillSecondary
                    : token.colorFillTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onClick={() => navigateToHistoryItem(item)}
            >
              <List.Item.Meta
                avatar={<ClockCircleOutlined style={{ color: token.colorTextSecondary }} />}
                title={
                  <Text
                    ellipsis
                    style={{
                      color: token.colorText,
                      fontSize: '14px',
                    }}
                  >
                    {item.title}
                  </Text>
                }
                description={
                  <Text
                    type="secondary"
                    style={{
                      fontSize: '12px',
                    }}
                  >
                    {dayjs(item.timestamp).fromNow()}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Dropdown
      popupRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button
        type="text"
        icon={<HistoryOutlined />}
        size="large"
        title="Recent Pages"
      />
    </Dropdown>
  );
};
