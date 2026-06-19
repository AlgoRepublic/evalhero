import { Card, Row, Col, Flex, Progress, Typography, Space } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { ProfileStatsPassFail } from '../../../services/profilesAPI';
import { theme } from 'antd';
import { useMediaQuery } from 'react-responsive';

const { Text } = Typography;
const { useToken } = theme;

interface PassFailPanelProps {
  passFail: ProfileStatsPassFail;
}

export const PassFailPanel = ({ passFail }: PassFailPanelProps) => {
  const { token } = useToken();
  const isMobile = useMediaQuery({ maxWidth: 768 });

  const passPercent = passFail.total 
    ? (passFail.pass / passFail.total) * 100 
    : 0;
  const failPercent = passFail.total 
    ? (passFail.fail / passFail.total) * 100 
    : 0;

  return (
    <Card
      title={
        <Space size={isMobile ? 'small' : 'middle'}>
          <CheckCircleOutlined style={{ color: token.colorSuccess, fontSize: isMobile ? 14 : 16 }} />
          <span style={{ fontSize: isMobile ? 13 : 14 }}>Pass/Fail Statistics</span>
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
            <Flex justify="space-between" align="center" style={{ marginBottom: isMobile ? 6 : 8 }}>
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Total Evaluations</Text>
              <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 13 : 14 }}>
                {passFail.total}
              </Text>
            </Flex>
            <Flex justify="space-between" align="center" style={{ marginBottom: isMobile ? 6 : 8 }}>
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Failed</Text>
              <Text strong style={{ color: token.colorError, fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 13 : 14 }}>
                {passFail.fail}
              </Text>
            </Flex>
            <Progress
              percent={failPercent}
              strokeColor={token.colorError}
              showInfo={false}
              size="small"
            />
          </div>
        </Col>
        <Col xs={24} sm={12}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 18 }}>
            <div>
              <Flex justify="space-between" align="center" style={{ marginBottom: isMobile ? 6 : 8 }}>
                <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Passed</Text>
                <Text strong style={{ color: token.colorSuccess, fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 13 : 14 }}>
                  {passFail.pass}
                </Text>
              </Flex>
              <Progress
                percent={passPercent}
                strokeColor={token.colorSuccess}
                showInfo={false}
                size="small"
              />
            </div>
            <div>
              <Flex justify="space-between" align="center" style={{ marginBottom: isMobile ? 6 : 8 }}>
                <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Pass Rate</Text>
                <Text strong style={{ color: token.colorSuccess, fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 13 : 14 }}>
                  {passFail.passRate.toFixed(1)}%
                </Text>
              </Flex>
              <Progress
                percent={passFail.passRate}
                strokeColor={token.colorSuccess}
                showInfo={false}
                size="small"
              />
            </div>
          </div>
        </Col>
      </Row>
    </Card>
  );
};
