import { Card, Row, Col, Typography, Space, Table, Divider } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { MomentumData } from '../../../../services/tagsApi';
import { theme } from 'antd';
import { useMediaQuery } from 'react-responsive';

const { Text } = Typography;
const { useToken } = theme;

interface SubjectRankPanelProps {
  momentum: MomentumData | null;
}

export const SubjectRankPanel = ({ momentum }: SubjectRankPanelProps) => {
  const { token } = useToken();
  const isMobile = useMediaQuery({ maxWidth: 768 });

  return (
    <Card
      title={
        <Space size={isMobile ? 'small' : 'middle'}>
          <TrophyOutlined style={{ fontSize: isMobile ? 14 : 16 }} />
          <span style={{ fontSize: isMobile ? 13 : 14 }}>Rank + Strengths/Weaknesses</span>
        </Space>
      }
      style={{
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowTertiary,
      }}
    >
      <Row gutter={[isMobile ? 8 : 12, isMobile ? 8 : 12]}>
        <Col xs={24} sm={12}>
          <Card
            variant="outlined"
            style={{
              borderRadius: token.borderRadius,
              padding: 10,
            }}
          >
            <Text type="secondary" style={{ fontSize: 11 }}>Org Rank (Points %)</Text>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              —
            </div>
            <Text type="secondary" style={{ fontSize: 11, marginTop: 2, display: 'block' }}>
              —
            </Text>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            variant="outlined"
            style={{
              borderRadius: token.borderRadius,
              padding: 10,
            }}
          >
            <Text type="secondary" style={{ fontSize: 11 }}>Org Rank (Pass Rate)</Text>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              —
            </div>
            <Text type="secondary" style={{ fontSize: 11, marginTop: 2, display: 'block' }}>
              —
            </Text>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            variant="outlined"
            style={{
              borderRadius: token.borderRadius,
              padding: 10,
            }}
          >
            <Text type="secondary" style={{ fontSize: 11 }}>Momentum (Points %)</Text>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              {momentum
                ? `${momentum.dPoints > 0 ? '+' : ''}${momentum.dPoints.toFixed(1)}`
                : '—'}
            </div>
            <Text type="secondary" style={{ fontSize: 11, marginTop: 2, display: 'block' }}>
              Last 7d vs prev 7d
            </Text>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            variant="outlined"
            style={{
              borderRadius: token.borderRadius,
              padding: 10,
            }}
          >
            <Text type="secondary" style={{ fontSize: 11 }}>Consistency (Volatility)</Text>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              —
            </div>
            <Text type="secondary" style={{ fontSize: 11, marginTop: 2, display: 'block' }}>
              Std dev of daily points%
            </Text>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: isMobile ? '8px 0' : '12px 0' }} />

      <Row gutter={[isMobile ? 8 : 12, isMobile ? 8 : 12]}>
        <Col xs={24} sm={12}>
          <div style={{ marginBottom: isMobile ? 6 : 8 }}>
            <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>Top Strengths</Text>
            <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12, marginLeft: 8 }}>
              (vs org avg)
            </Text>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <Table
              dataSource={[]}
              columns={[
                { title: 'Tag', dataIndex: 'tag', key: 'tag', width: isMobile ? 80 : undefined },
                { title: isMobile ? 'Δ%' : 'Δ Points%', dataIndex: 'delta', key: 'delta', align: 'right' as const, width: isMobile ? 60 : undefined },
                { title: isMobile ? 'Subs' : 'Rel Subs', dataIndex: 'relSubs', key: 'relSubs', align: 'right' as const, width: isMobile ? 50 : undefined },
              ]}
              pagination={false}
              size="small"
              scroll={isMobile ? { x: 'max-content' } : undefined}
            />
          </div>
        </Col>
        <Col xs={24} sm={12}>
          <div style={{ marginBottom: isMobile ? 6 : 8 }}>
            <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>Areas to Improve</Text>
            <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12, marginLeft: 8 }}>
              (vs org avg)
            </Text>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <Table
              dataSource={[]}
              columns={[
                { title: 'Tag', dataIndex: 'tag', key: 'tag', width: isMobile ? 80 : undefined },
                { title: isMobile ? 'Δ%' : 'Δ Points%', dataIndex: 'delta', key: 'delta', align: 'right' as const, width: isMobile ? 60 : undefined },
                { title: isMobile ? 'Subs' : 'Rel Subs', dataIndex: 'relSubs', key: 'relSubs', align: 'right' as const, width: isMobile ? 50 : undefined },
              ]}
              pagination={false}
              size="small"
              scroll={isMobile ? { x: 'max-content' } : undefined}
            />
          </div>
        </Col>
      </Row>
    </Card>
  );
};
