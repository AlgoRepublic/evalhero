import React from 'react';
import { Card, Row, Col, Space, Typography, Button, theme } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { CourseProgress } from './types';
import { GRADIENT_STYLES } from './constants';
import type { RootState } from '../../../../store';

const { Text } = Typography;

interface CompletionBannerProps {
  progress: CourseProgress;
  onView: () => void;
  onReviewPages: () => void;
  isMobile: boolean;
}

export const CompletionBanner: React.FC<CompletionBannerProps> = ({
  progress,
  onView,
  onReviewPages,
  isMobile,
}) => {
  const { token } = theme.useToken();
  const { mytheme } = useSelector((state: RootState) => state.theme);
  const isDark = mytheme === 'dark';

  const cardBackground = isDark ? GRADIENT_STYLES.completionDark : GRADIENT_STYLES.completion;
  const textColor = token.colorTextLightSolid;
  const textColorSecondary = 'rgba(255,255,255,0.9)';

  return (
    <Card
      variant="borderless"
      style={{
        background: cardBackground,
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
                color: textColor,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Course Completed
            </Text>
            <Text
              style={{
                color: textColorSecondary,
                fontSize: 14,
              }}
            >
              You've completed all {progress.totalPages} pages. Review any page anytime from the
              course contents.
            </Text>
          </Space>
        </Col>
        <Col xs={24} sm={8} lg={6}>
          <div
            style={{
              textAlign: isMobile ? 'left' : 'right',
              marginTop: isMobile ? 16 : 0,
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: isMobile ? 'flex-start' : 'flex-end',
            }}
          >
            <Button
              type="primary"
              size="large"
              icon={<TrophyOutlined />}
              onClick={onView}
              style={{
                background: token.colorBgContainer,
                color: token.colorTextBase,
                border: 'none',
                fontWeight: 600,
                height: 44,
                borderRadius: token.borderRadiusLG,
                width: isMobile ? '100%' : 'auto',
              }}
            >
              View
            </Button>
            <Button
              size="large"
              onClick={onReviewPages}
              style={{
                color: token.colorTextBase,
                // border: '1px solid rgba(255,255,255,0.65)',
                fontWeight: 600,
                height: 44,
                borderRadius: token.borderRadiusLG,
                width: isMobile ? '100%' : 'auto',
              }}
            >
              Review Pages
            </Button>
          </div>
        </Col>
      </Row>
    </Card>
  );
};
