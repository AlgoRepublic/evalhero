import React from 'react';
import { Card, Row, Col, Space, Typography, Button } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { PageProgress, CourseProgress } from './types';
import { GRADIENT_STYLES } from './constants';

const { Text } = Typography;

interface StartResumeBannerProps {
  hasStarted: boolean;
  firstUnreadPage: PageProgress | null;
  progress: CourseProgress;
  onView: () => void;
  isMobile: boolean;
}

export const StartResumeBanner: React.FC<StartResumeBannerProps> = ({
  hasStarted,
  firstUnreadPage,
  progress,
  onView,
  isMobile,
}) => {
  const getFirstPageTitle = () => {
    const firstPage = progress.pages.find((p) => p.orderIndex === 0);
    return firstPage?.title || 'Ready to start the course';
  };

  const getSubtitle = () => {
    if (hasStarted) {
      return firstUnreadPage
        ? `Next page to read: ${firstUnreadPage.title}`
        : 'Continue your learning journey';
    }
    return firstUnreadPage
      ? `Ready to begin: ${firstUnreadPage.title}`
      : getFirstPageTitle();
  };

  return (
    <Card
      variant="borderless"
      style={{
        background: GRADIENT_STYLES.primary,
        borderRadius: 16,
        marginBottom: 24,
        border: 'none',
      }}
      styles={{ body: { padding: '20px 24px' } }}
    >
      <Row align="middle" justify="space-between" wrap>
        <Col xs={24} sm={16} lg={18}>
          <Space direction="vertical" size={4}>
            <Text
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {hasStarted ? 'Continue Your Learning' : 'Start Your Course'}
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 14,
              }}
            >
              {getSubtitle()}
            </Text>
          </Space>
        </Col>
        <Col xs={24} sm={8} lg={6}>
          <div
            style={{
              textAlign: isMobile ? 'left' : 'right',
              marginTop: isMobile ? 16 : 0,
            }}
          >
            <Button
              type="primary"
              size="large"
              icon={<BookOutlined />}
              onClick={onView}
              style={{
                background: '#fff',
                color: '#667eea',
                border: 'none',
                fontWeight: 600,
                height: 44,
                borderRadius: 8,
                width: isMobile ? '100%' : 'auto',
              }}
            >
              {hasStarted ? 'Resume Course' : 'Start Course'}
            </Button>
          </div>
        </Col>
      </Row>
    </Card>
  );
};
