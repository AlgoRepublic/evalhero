import { Card, Flex, Select, Tag, Typography, Space } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { Line } from '@ant-design/charts';
import { GrowthData } from '../../../../services/tagsApi';
import { theme } from 'antd';
import { useMediaQuery } from 'react-responsive';

const { Text } = Typography;
const { useToken } = theme;

interface GrowthChartProps {
  growth: GrowthData | null;
  growthMetric: 'pointsPct' | 'pointsEarned' | 'passRate';
  onGrowthMetricChange: (metric: 'pointsPct' | 'pointsEarned' | 'passRate') => void;
  subjectCount: number;
}

export const GrowthChart = ({
  growth,
  growthMetric,
  onGrowthMetricChange,
  subjectCount,
}: GrowthChartProps) => {
  const { token } = useToken();
  const isMobile = useMediaQuery({ maxWidth: 768 });

  const getGrowthChartData = () => {
    if (!growth?.overall) return [];
    const series = growthMetric === 'pointsPct' 
      ? growth.overall.pointsPctSeries
      : growthMetric === 'pointsEarned'
      ? growth.overall.pointsEarnedSeries
      : growth.overall.passRateSeries;
    
    return series.map((point) => ({
      date: point.x,
      value: point.y,
    }));
  };

  const growthChartConfig = {
    data: getGrowthChartData(),
    xField: 'date',
    yField: 'value',
    smooth: true,
    point: {
      size: 4,
      shape: 'circle',
    },
    color: token.colorPrimary,
  };

  return (
    <Card
      title={
        <Space size={isMobile ? 'small' : 'middle'}>
          <BarChartOutlined style={{ fontSize: isMobile ? 14 : 16 }} />
          <span style={{ fontSize: isMobile ? 13 : 14 }}>Growth (Selected Subjects)</span>
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
      <div style={{ marginBottom: isMobile ? 12 : 16 }}>
        <Flex 
          vertical={isMobile}
          justify="space-between" 
          align={isMobile ? 'stretch' : 'center'} 
          wrap="wrap" 
          gap={isMobile ? 'small' : 'middle'}
        >
          <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>
            Visualize change over time across the selected subjects. (Points uses <strong>earned/max</strong>, pass uses rolling windows.)
          </Text>
          <Space size="small" wrap>
            <Tag style={{ fontSize: isMobile ? 11 : 12 }}>Metric</Tag>
            <Select
              value={growthMetric}
              onChange={onGrowthMetricChange}
              style={{ minWidth: isMobile ? '100%' : 220, width: isMobile ? '100%' : undefined }}
              size="small"
              options={[
                { label: 'Points (cumulative %)', value: 'pointsPct' },
                { label: 'Points (cumulative earned)', value: 'pointsEarned' },
                { label: 'Pass Rate (rolling 7-day %)', value: 'passRate' },
              ]}
            />
          </Space>
        </Flex>
      </div>
      <Card
        variant="outlined"
        style={{
          borderRadius: token.borderRadius,
          padding: isMobile ? 8 : 12,
        }}
      >
        {growth && getGrowthChartData().length > 0 ? (
          <Line {...growthChartConfig} height={isMobile ? 200 : 240} />
        ) : (
          <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>No growth data available</Text>
        )}
      </Card>
      <Text type="secondary" style={{ marginTop: isMobile ? 8 : 10, display: 'block', fontSize: isMobile ? 11 : 12 }}>
        <strong>POC note:</strong> Growth series are built from evaluation timestamps (grouped by day). This is the simplest honest "time axis" given the event model.
      </Text>
    </Card>
  );
};
