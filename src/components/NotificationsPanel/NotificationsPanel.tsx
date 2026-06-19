import React from 'react';
import {
  Dropdown,
  Button,
  Badge,
  List,
  Typography,
  Empty,
  Spin,
  theme,
  Tooltip,
} from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  useGetActivityQuery,
  useMarkActivityReadMutation,
  type ActivityRecord,
} from '../../services/queueApi';

dayjs.extend(relativeTime);

const { Text } = Typography;

const POLL_INTERVAL_MS = 60 * 1000; // 60s when dropdown closed (badge count)
const POLL_INTERVAL_OPEN_MS = 30 * 1000; // 30s when dropdown open

/**
 * Build app route for a notification from type and refs.
 */
function getNotificationLink(record: ActivityRecord): string | null {
  const { type, assignmentId, submissionId, channelId } = record;
  console.log("submissionId", submissionId)
  // DM / channel
  if (type === 'dm_unread' && channelId) {
    return `/chat/channel/${channelId}`;
  }
  // Queue submission (assigned, approval, dispute, question approval, etc.)
  if (assignmentId) {
    return `/forms/queues/${assignmentId}/submissions`;
  }
  // Course form types: use channel if present
  if (channelId) {
    return `/chat/channel/${channelId}`;
  }
  return null;
}

interface NotificationsPanelContentProps {
  onClose: () => void;
  markAsRead: (payload: { notificationIds?: string[] }) => void;
  isLoading: boolean;
  records: ActivityRecord[];
  unreadCount: number;
}

function NotificationsPanelContent({
  onClose,
  markAsRead,
  isLoading,
  records,
  unreadCount,
}: NotificationsPanelContentProps) {
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const handleItemClick = (record: ActivityRecord) => {
    const link = getNotificationLink(record);
    if (link) {
      markAsRead({ notificationIds: [record._id] });
      onClose();
      navigate(link);
    }
  };

  const handleMarkAllRead = () => {
    const ids = records.filter((r) => !r.read).map((r) => r._id);
    if (ids.length) {
      markAsRead({ notificationIds: ids });
    }
  };

  return (
    <div
      style={{
        width: 360,
        maxHeight: 400,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: token.colorBgElevated,
        borderRadius: token.borderRadius,
        boxShadow: token.boxShadowSecondary,
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text strong>Notifications</Text>
        {unreadCount > 0 && (
          <Button
            type="link"
            size="small"
            icon={<CheckOutlined />}
            onClick={handleMarkAllRead}
          >
            Mark all read
          </Button>
        )}
      </div>
      <div style={{ overflow: 'auto', flex: 1 }}>
        {isLoading ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : records.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No notifications"
            style={{ padding: 24 }}
          />
        ) : (
          <List
            size="small"
            dataSource={records}
            style={{ padding: '8px 0' }}
            renderItem={(record) => {
              const link = getNotificationLink(record);
              const clickable = !!link;
              return (
                <List.Item
                  key={record._id}
                  onClick={() => clickable && handleItemClick(record)}
                  style={{
                    padding: '10px 16px',
                    cursor: clickable ? 'pointer' : 'default',
                    backgroundColor: record.read ? undefined : token.colorFillQuaternary,
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      {!record.read && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: token.colorPrimary,
                            flexShrink: 0,
                            marginTop: 6,
                          }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          ellipsis
                          style={{
                            fontWeight: record.read ? 400 : 500,
                          }}
                        >
                          {record.message}
                        </Text>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(record.createdAt).fromNow()}
                          </Text>
                        </div>
                      </div>
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}

export interface NotificationsPanelProps {
  /** Optional override for trigger (e.g. for tour / a11y). */
  trigger?: React.ReactNode;
}

/**
 * Notifications bell with dropdown panel. Polls activity list for unread count and list.
 */
export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ trigger }) => {
  const [open, setOpen] = React.useState(false);
  const { data, isLoading } = useGetActivityQuery(
    { perPage: 50, order: 'desc' },
    {
      pollingInterval: open ? POLL_INTERVAL_OPEN_MS : POLL_INTERVAL_MS,
    }
  );
  const [markAsRead] = useMarkActivityReadMutation();

  const records = data?.data?.records ?? [];
  const displayUnreadCount = records.filter((r) => !r.read).length;

  const content = (
    <NotificationsPanelContent
      onClose={() => setOpen(false)}
      markAsRead={markAsRead}
      isLoading={isLoading}
      records={records}
      unreadCount={displayUnreadCount}
    />
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      dropdownRender={() => content}
      trigger={['click']}
      placement="bottomRight"
    >
      <Tooltip title="Notifications">
        {trigger ?? (
          <Badge count={displayUnreadCount} size="small" offset={[-2, 2]}>
            <Button
              icon={<BellOutlined />}
              type="text"
              size="large"
              data-tour="notifications"
            />
          </Badge>
        )}
      </Tooltip>
    </Dropdown>
  );
};
