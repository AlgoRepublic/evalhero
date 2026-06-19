import { Card, Row, Col, Flex, Typography, Space } from 'antd';
import { TrophyOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import { ProfileStatsScore } from '../../../services/profilesAPI';
import { theme } from 'antd';
import { useMediaQuery } from 'react-responsive';

const { Text } = Typography;
const { useToken } = theme;

interface ScorePanelProps {
  score: ProfileStatsScore;
}

export const ScorePanel = ({ score }: ScorePanelProps) => {
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
      style={{
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowTertiary,
      }}
    >
      <Row gutter={[isMobile ? 12 : 16, isMobile ? 12 : 16]}>
        <Col xs={24} sm={12}>
          <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: isMobile ? 10 : 14 }}>
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Total Evaluations</Text>
              <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 13 : 14 }}>
                {score.total}
              </Text>
            </Flex>
            <Flex justify="space-between" align="center" style={{ marginBottom: isMobile ? 10 : 14 }}>
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Min Score</Text>
              <Flex gap="small" align="center">
                <FallOutlined style={{ color: token.colorError, fontSize: isMobile ? 12 : 14 }} />
                <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 13 : 14 }}>
                  {score.min.toFixed(2)}
                </Text>
              </Flex>
            </Flex>
            <Flex justify="space-between" align="center">
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Total Score</Text>
              <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 12 : 14 }}>
                {score.totalScore.toFixed(2)} / {score.totalScoreOutOf.toFixed(2)}
              </Text>
            </Flex>
          </div>
        </Col>
        <Col xs={24} sm={12}>
          <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: isMobile ? 10 : 14 }}>
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Average Score</Text>
              <Flex gap="small" align="center">
                <RiseOutlined style={{ color: token.colorSuccess, fontSize: isMobile ? 12 : 14 }} />
                <Text strong style={{ color: token.colorPrimary, fontSize: isMobile ? 16 : 20, fontVariantNumeric: 'tabular-nums' }}>
                  {score.average.toFixed(2)}
                </Text>
              </Flex>
            </Flex>
            <Flex justify="space-between" align="center" style={{ marginBottom: isMobile ? 10 : 14 }}>
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Max Score</Text>
              <Flex gap="small" align="center">
                <RiseOutlined style={{ color: token.colorSuccess, fontSize: isMobile ? 12 : 14 }} />
                <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 13 : 14 }}>
                  {score.max.toFixed(2)}
                </Text>
              </Flex>
            </Flex>
            <Flex justify="space-between" align="center">
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Average Percentage</Text>
              <Text strong style={{ color: token.colorPrimary, fontSize: isMobile ? 16 : 18, fontVariantNumeric: 'tabular-nums' }}>
                {(score.averagePercentage ?? (score.averageOutOf > 0 ? (score.average / score.averageOutOf) * 100 : 0)).toFixed(2)}%
              </Text>
            </Flex>
          </div>
        </Col>
      </Row>
    </Card>
  );
};
