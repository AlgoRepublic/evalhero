import React, { useState, useMemo } from 'react';
import {
  Drawer,
  Timeline,
  Typography,
  Button,
  Select,
  Space,
  Empty,
  theme,
  Tag,
  Tooltip,
} from 'antd';
import {
  HistoryOutlined,
  DeleteOutlined,
  LinkOutlined,
  ThunderboltOutlined,
  FormOutlined,
  SettingOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import {
  getActivities,
  clearActivities,
  filterActivitiesByType,
  ActivityType,
} from '../../utils/activityUtils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

interface ActivityTimelineProps {
  open: boolean;
  onClose: () => void;
}

const ACTIVITY_TYPE_LABELS: Record<ActivityType | 'all', string> = {
  all: 'All Activities',
  navigation: 'Navigation',
  action: 'Actions',
  form: 'Forms',
  settings: 'Settings',
  organization: 'Organization',
  impersonation: 'Impersonation',
};

/**
 * ActivityTimeline component showing recent user activities (navigation, actions,
 * impersonation start/end, forms, settings, organization changes).
 */
export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  open,
  onClose,
}) => {
  const [filterType, setFilterType] = useState<ActivityType | 'all'>('all');
  const { token } = theme.useToken();

  const activities = useMemo(() => {
    const all = getActivities();
    if (filterType === 'all') return all;
    return filterActivitiesByType(all, filterType);
  }, [filterType]);

  const handleClear = () => {
    clearActivities();
    setFilterType(filterType === 'all' ? 'navigation' : 'all');
    setTimeout(() => setFilterType('all'), 0);
  };

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'navigation':
        return <LinkOutlined />;
      case 'action':
        return <ThunderboltOutlined />;
      case 'form':
        return <FormOutlined />;
      case 'settings':
        return <SettingOutlined />;
      case 'organization':
        return <TeamOutlined />;
      case 'impersonation':
        return <UserSwitchOutlined />;
      default:
        return <HistoryOutlined />;
    }
  };

  const getActivityColor = (type: ActivityType) => {
    switch (type) {
      case 'navigation':
        return token.colorPrimary;
      case 'action':
        return token.colorSuccess;
      case 'form':
        return token.colorInfo;
      case 'settings':
        return token.colorWarning;
      case 'organization':
        return token.colorError;
      case 'impersonation':
        return '#d4380d'; // distinct orange/red for impersonation
      default:
        return token.colorTextSecondary;
    }
  };

  return (
    <Drawer
      title={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <HistoryOutlined />
            <Title level={5} style={{ margin: 0 }}>
              Activity Timeline
            </Title>
          </Space>
          {activities.length > 0 && (
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={handleClear}
              danger
            >
              Clear
            </Button>
          )}
        </Space>
      }
      open={open}
      onClose={onClose}
      width={400}
      styles={{
        body: {
          padding: '16px',
        },
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Select
          value={filterType}
          onChange={(value) => setFilterType(value)}
          style={{ width: '100%' }}
          options={(
            ['all', 'navigation', 'action', 'form', 'settings', 'organization', 'impersonation'] as const
          ).map((value) => ({
            label: ACTIVITY_TYPE_LABELS[value],
            value,
          }))}
        />

        {activities.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              filterType === 'all'
                ? 'No activities yet'
                : `No ${ACTIVITY_TYPE_LABELS[filterType].toLowerCase()}`
            }
            style={{ padding: '24px 0' }}
          />
        ) : (
          <Timeline
            items={activities.map((activity) => {
              const color = getActivityColor(activity.type);
              return {
                color,
                dot: (
                  <Tooltip title={ACTIVITY_TYPE_LABELS[activity.type]}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        backgroundColor: `${color}18`,
                        color,
                        fontSize: 14,
                      }}
                    >
                      {getActivityIcon(activity.type)}
                    </span>
                  </Tooltip>
                ),
                children: (
                  <div style={{ marginBottom: 4 }}>
                    <Space wrap size={[4, 4]}>
                      <Text strong>{activity.description}</Text>
                      <Tag color={color} style={{ margin: 0 }}>
                        {ACTIVITY_TYPE_LABELS[activity.type]}
                      </Tag>
                    </Space>
                    {activity.meta && Object.keys(activity.meta).length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        {Object.entries(activity.meta).map(([key, value]) => (
                          <Text
                            key={key}
                            type="secondary"
                            style={{ fontSize: '12px', display: 'block' }}
                            ellipsis
                          >
                            {key === 'user' || key === 'impersonatedUser'
                              ? `User: ${value}`
                              : `${key}: ${value}`}
                          </Text>
                        ))}
                      </div>
                    )}
                    {activity.path && (
                      <div>
                        <Text
                          type="secondary"
                          style={{ fontSize: '12px' }}
                          ellipsis
                        >
                          {activity.path}
                        </Text>
                      </div>
                    )}
                    <div>
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        {dayjs(activity.timestamp).fromNow()}
                      </Text>
                    </div>
                  </div>
                ),
              };
            })}
          />
        )}
      </Space>
    </Drawer>
  );
};
