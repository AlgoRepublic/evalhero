import { Card, Select, Tag, Typography, Space } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { Line } from '@ant-design/charts';
import { GrowthData } from '../../../../services/tagsApi';
import { theme } from 'antd';
import { useMediaQuery } from 'react-responsive';

const { Text } = Typography;
const { useToken } = theme;

interface SubjectGrowthChartProps {
  growth: GrowthData | null;
  subjectId: string | undefined;
  growthMetric: 'pointsPct' | 'passRate' | 'activity';
  onGrowthMetricChange: (metric: 'pointsPct' | 'passRate' | 'activity') => void;
}

export const SubjectGrowthChart = ({
  growth,
  subjectId,
  growthMetric,
  onGrowthMetricChange,
}: SubjectGrowthChartProps) => {
  const { token } = useToken();
  const isMobile = useMediaQuery({ maxWidth: 768 });

  if (!growth || !subjectId) {
    return (
      <Card
        title={
          <Space size={isMobile ? 'small' : 'middle'}>
            <BarChartOutlined style={{ fontSize: isMobile ? 14 : 16 }} />
            <span style={{ fontSize: isMobile ? 13 : 14 }}>Growth (Subject vs Org Avg)</span>
          </Space>
        }
        style={{
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowTertiary,
        }}
      >
        <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>No growth data available</Text>
      </Card>
    );
  }

  const subjectSeries = growth.subjectSeries?.find(
    (s: any) => s.subjectId === subjectId
  );
  const overallSeries = growth.overall;

  if (!subjectSeries || !overallSeries) {
    return (
      <Card
        title={
          <Space size={isMobile ? 'small' : 'middle'}>
            <BarChartOutlined style={{ fontSize: isMobile ? 14 : 16 }} />
            <span style={{ fontSize: isMobile ? 13 : 14 }}>Growth (Subject vs Org Avg)</span>
          </Space>
        }
        style={{
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowTertiary,
        }}
      >
        <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>No growth data available</Text>
      </Card>
    );
  }

  const seriesData = growthMetric === 'pointsPct'
    ? subjectSeries.pointsPct
    : growthMetric === 'passRate'
    ? subjectSeries.passRate
    : subjectSeries.activity;

  const orgSeriesData = growthMetric === 'pointsPct'
    ? overallSeries.pointsPctSeries
    : growthMetric === 'passRate'
    ? overallSeries.passRateSeries
    : overallSeries.activitySeries;

  const subjectData = seriesData.map((p: any) => ({
    date: p.x,
    value: p.y,
    series: 'Subject',
  }));
  const orgData = orgSeriesData.map((p: any) => ({
    date: p.x,
    value: p.y,
    series: 'Org Avg',
  }));

  return (
    <Card
      title={
        <Space size={isMobile ? 'small' : 'middle'}>
          <BarChartOutlined style={{ fontSize: isMobile ? 14 : 16 }} />
          <span style={{ fontSize: isMobile ? 13 : 14 }}>Growth (Subject vs Org Avg)</span>
        </Space>
      }
      extra={
        <Select
          value={growthMetric}
          onChange={onGrowthMetricChange}
          style={{ minWidth: isMobile ? '100%' : 210, width: isMobile ? '100%' : undefined }}
          size="small"
          options={[
            { label: isMobile ? 'Points %' : 'Points % (cumulative)', value: 'pointsPct' },
            { label: isMobile ? 'Pass Rate' : 'Pass Rate (rolling 7d %)', value: 'passRate' },
            { label: isMobile ? 'Activity' : 'Activity (daily submissions)', value: 'activity' },
          ]}
        />
      }
      style={{
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowTertiary,
      }}
    >
      <Card
        variant="outlined"
        style={{
          borderRadius: token.borderRadius,
          padding: isMobile ? 8 : 12,
          marginBottom: isMobile ? 8 : 10,
        }}
      >
        <Line
          data={[...subjectData, ...orgData]}
          xField="date"
          yField="value"
          seriesField="series"
          smooth
          point={{ size: 4, shape: 'circle' }}
          height={isMobile ? 200 : 240}
          color={['#2f80ff', '#8a93a3']}
        />
      </Card>
      <div style={{ display: 'flex', gap: isMobile ? 6 : 8, flexWrap: 'wrap', marginTop: isMobile ? 6 : 8 }}>
        <Tag color="blue" style={{ fontSize: isMobile ? 11 : 12 }}>Subject</Tag>
        <Tag style={{ fontSize: isMobile ? 11 : 12 }}>Org Avg</Tag>
      </div>
    </Card>
  );
};
