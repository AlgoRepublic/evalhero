import { Card, Table, Typography, Space, Tag, Select, Row, Col } from 'antd';
import { TagsOutlined } from '@ant-design/icons';
import { Column } from '@ant-design/charts';
import { TagBreakdown } from '../../../../services/tagsApi';
import { theme } from 'antd';
import { useMediaQuery } from 'react-responsive';

const { Text } = Typography;
const { useToken } = theme;

interface SubjectTagDeepDiveProps {
  tagBreakdown: TagBreakdown[];
  chartMode: 'barDelta' | 'scatterFocus';
  onChartModeChange: (mode: 'barDelta' | 'scatterFocus') => void;
}

export const SubjectTagDeepDive = ({
  tagBreakdown,
  chartMode,
  onChartModeChange,
}: SubjectTagDeepDiveProps) => {
  const { token } = useToken();
  const isMobile = useMediaQuery({ maxWidth: 768 });

  return (
    <Card
      title={
        <Space size={isMobile ? 'small' : 'middle'}>
          <TagsOutlined style={{ fontSize: isMobile ? 14 : 16 }} />
          <span style={{ fontSize: isMobile ? 13 : 14 }}>Tag Deep Dive (Subject vs Org)</span>
        </Space>
      }
      extra={
        <Space size="small" wrap>
          <Tag style={{ fontSize: isMobile ? 11 : 12 }}>Chart</Tag>
          <Select
            value={chartMode}
            onChange={onChartModeChange}
            style={{ minWidth: isMobile ? '100%' : 230, width: isMobile ? '100%' : undefined }}
            size="small"
            options={[
              { label: isMobile ? 'Bar: Δ vs Org' : 'Bar: Subject Δ vs Org (Points%)', value: 'barDelta' },
              { label: isMobile ? 'Scatter: Focus vs Points%' : 'Scatter: Focus (Rel Subs) vs Points%', value: 'scatterFocus' },
            ]}
          />
        </Space>
      }
      style={{
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowTertiary,
      }}
    >
      <Row gutter={[isMobile ? 12 : 16, isMobile ? 12 : 16]}>
        <Col xs={24} lg={14}>
          <Card
            variant="outlined"
            style={{
              borderRadius: token.borderRadius,
              padding: isMobile ? 8 : 12,
            }}
          >
            {chartMode === 'barDelta' ? (
              <Column
                data={tagBreakdown?.map((tag) => ({
                  tag: tag.tagName,
                  value: tag.pointsPct,
                })) || []}
                xField="tag"
                yField="value"
                height={isMobile ? 200 : 260}
              />
            ) : (
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Scatter chart coming soon</Text>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <div style={{ overflowX: 'auto' }}>
            <Table
              dataSource={tagBreakdown?.map((tag) => ({
                key: tag.tagId,
                tagName: tag.tagName,
                relSubs: tag.relevantSubmissions,
                subjPointsPct: tag.pointsPct,
                orgAvg: '—',
                percentile: '—',
              })) || []}
              columns={[
                { title: 'Tag', dataIndex: 'tagName', key: 'tagName', width: isMobile ? 100 : undefined, ellipsis: isMobile },
                { title: isMobile ? 'Subs' : 'Rel Subs', dataIndex: 'relSubs', key: 'relSubs', align: 'right' as const, width: isMobile ? 60 : undefined, render: (v) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 12 : 14 }}>{v}</Text> },
                { title: isMobile ? 'Pts%' : 'Subj Points%', dataIndex: 'subjPointsPct', key: 'subjPointsPct', align: 'right' as const, width: isMobile ? 70 : undefined, render: (v) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 12 : 14 }}>{v.toFixed(1)}%</Text> },
                { title: isMobile ? 'Org' : 'Org Avg', dataIndex: 'orgAvg', key: 'orgAvg', align: 'right' as const, width: isMobile ? 50 : undefined },
                { title: isMobile ? 'Pct' : 'Percentile', dataIndex: 'percentile', key: 'percentile', align: 'right' as const, width: isMobile ? 50 : undefined },
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
