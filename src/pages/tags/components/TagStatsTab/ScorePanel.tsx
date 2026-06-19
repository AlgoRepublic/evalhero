import { Card, Row, Col, Flex, Typography, Space } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { ComprehensiveTagStatsScore, MomentumData } from '../../../../services/tagsApi';
import { theme } from 'antd';
import { useMediaQuery } from 'react-responsive';

const { Text } = Typography;
const { useToken } = theme;

interface ScorePanelProps {
  score: ComprehensiveTagStatsScore;
  momentum?: MomentumData | null;
  subjectCount: number;
}

export const ScorePanel = ({ score, momentum, subjectCount }: ScorePanelProps) => {
  const { token } = useToken();
  const isMobile = useMediaQuery({ maxWidth: 768 });

  return (
    <Card
      title={
        <Space size={isMobile ? 'small' : 'middle'}>
          <TrophyOutlined style={{ color: token.colorWarning, fontSize: isMobile ? 14 : 16 }} />
          <span style={{ fontSize: isMobile ? 13 : 14 }}>Score Statistics</span>
        </Space>
      }
      extra={
        <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>
          {subjectCount} subject(s)
        </Text>
      }
      style={{
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowTertiary,
      }}
    >
      <Row gutter={[isMobile ? 12 : 16, isMobile ? 12 : 16]}>
        <Col xs={24} sm={12}>
          <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: isMobile ? 16 : 24 }}>
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Total Evaluations</Text>
              <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 13 : 14 }}>
                {score.total}
              </Text>
            </Flex>
            <Flex justify="space-between" align="center" style={{ marginBottom: isMobile ? 10 : 14 }}>
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Min Score</Text>
              <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 13 : 14 }}>
                {score.minScore.toFixed(2)}
              </Text>
            </Flex>
            <Flex justify="space-between" align="center">
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Total Score</Text>
              <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 12 : 14 }}>
                {score.earned.toFixed(2)} / {score.max.toFixed(2)}
              </Text>
            </Flex>
          </div>
        </Col>
        <Col xs={24} sm={12}>
          <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: isMobile ? 10 : 14 }}>
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Average Score</Text>
              <Text strong style={{ color: token.colorPrimary, fontSize: isMobile ? 16 : 20, fontVariantNumeric: 'tabular-nums' }}>
                {score.avgScore.toFixed(2)}
              </Text>
            </Flex>
            <Flex justify="space-between" align="center" style={{ marginBottom: isMobile ? 10 : 14 }}>
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Max Score</Text>
              <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 13 : 14 }}>
                {score.maxScore.toFixed(2)}
              </Text>
            </Flex>
            <Flex justify="space-between" align="center">
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Average Percentage</Text>
              <Text strong style={{ color: token.colorPrimary, fontSize: isMobile ? 16 : 18, fontVariantNumeric: 'tabular-nums' }}>
                {score.avgPct.toFixed(2)}%
              </Text>
            </Flex>
          </div>
        </Col>
      </Row>
      {momentum && (
        <Text type="secondary" style={{ marginTop: isMobile ? 12 : 16, display: 'block', fontSize: isMobile ? 11 : 12 }}>
          Momentum: {momentum.dPoints > 0 ? '+' : ''}
          {momentum.dPoints.toFixed(1)}% (last 7d vs prev 7d)
        </Text>
      )}
    </Card>
  );
};
