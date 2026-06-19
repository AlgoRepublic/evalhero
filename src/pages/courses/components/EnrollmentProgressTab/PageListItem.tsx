import React from 'react';
import { Card, Space, Typography, Tag, Badge, theme } from 'antd';
import {
  LockOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { ModuleStatus } from '../../../../types/course';
import { PageTableData } from './types';
import { STATUS_COLOR_MAP } from './constants';
import { formatDuration } from './utils';

const { Text } = Typography;

interface PageListItemProps {
  page: PageTableData;
  isSelected: boolean;
  onClick: () => void;
  isClickable?: boolean;
}

export const PageListItem: React.FC<PageListItemProps> = ({
  page,
  isSelected,
  onClick,
  isClickable = true,
}) => {
  const { token } = theme.useToken();
  const isLocked = !isClickable;
  const isCompleted = page.status === 'passed';
  const isInProgress = page.status === 'in-progress';

  const cardBorder = isSelected ? `2px solid ${token.colorPrimary}` : `1px solid ${token.colorBorder}`;
  const cardBg = isSelected
    ? token.colorPrimaryBg
    : token.colorBgContainer;
  const cardShadow = isSelected
    ? `0 4px 12px ${token.colorPrimary}26`
    : token.boxShadowSecondary;

  return (
    <Card
      key={page.pageId}
      hoverable={!isLocked}
      onClick={() => !isLocked && onClick()}
      style={{
        cursor: isLocked ? 'not-allowed' : 'pointer',
        opacity: isLocked ? 0.65 : 1,
        marginBottom: 12,
        borderRadius: 12,
        border: cardBorder,
        background: cardBg,
        boxShadow: cardShadow,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      styles={{ body: { padding: '16px' } }}
      onMouseEnter={(e) => {
        if (!isLocked && !isSelected) {
          e.currentTarget.style.boxShadow = `0 6px 16px ${token.colorPrimary}26`;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.boxShadow = cardShadow;
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: isLocked
                  ? token.colorFillQuaternary
                  : isCompleted
                  ? token.colorSuccessBg
                  : isInProgress
                  ? token.colorPrimaryBg
                  : token.colorFillTertiary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {isLocked ? (
                <LockOutlined style={{ color: token.colorTextPlaceholder, fontSize: 18 }} />
              ) : isCompleted ? (
                <CheckCircleOutlined style={{ color: token.colorSuccess, fontSize: 18 }} />
              ) : isInProgress ? (
                <ClockCircleOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
              ) : (
                <FileTextOutlined style={{ color: token.colorTextPlaceholder, fontSize: 18 }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Text
                  strong
                  style={{
                    fontSize: 15,
                    color: isLocked ? token.colorTextPlaceholder : token.colorText,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {page.title}
                </Text>
                {isSelected && (
                  <Badge
                    status="processing"
                    text="Current"
                    style={{ fontSize: 10, flexShrink: 0 }}
                  />
                )}
              </div>
              <Tag
                color={(STATUS_COLOR_MAP[page.status as ModuleStatus] ?? 'default') as string}
                style={{ fontSize: 11, margin: 0 }}
              >
                {page.status.replace('-', ' ').toUpperCase()}
              </Tag>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
            paddingTop: 12,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              Read Status
            </Text>
            <Space size={4}>
              {page.isRead ? (
                <>
                  <CheckOutlined style={{ color: token.colorSuccess, fontSize: 12 }} />
                  <Text style={{ fontSize: 12, color: token.colorSuccess }}>Read</Text>
                </>
              ) : (
                <>
                  <CloseOutlined style={{ color: token.colorTextPlaceholder, fontSize: 12 }} />
                  <Text style={{ fontSize: 12, color: token.colorTextPlaceholder }}>Unread</Text>
                </>
              )}
            </Space>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              Time Spent
            </Text>
            <Text style={{ fontSize: 12, fontWeight: 500 }}>
              {formatDuration(page.timeOnTask)}
            </Text>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              Forms
            </Text>
            <Text style={{ fontSize: 12, fontWeight: 500 }}>
              {page.inlineForms.filter((f) => f.isFilled).length} / {page.inlineForms.length}
            </Text>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              Page Number
            </Text>
            <Text style={{ fontSize: 12, fontWeight: 500 }}>#{page.order + 1}</Text>
          </div>
        </div>

        {!page.isUnlocked && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
            <Tag icon={<LockOutlined />} color="default" style={{ fontSize: 11 }}>
              This page is locked
            </Tag>
          </div>
        )}
      </div>
    </Card>
  );
};
