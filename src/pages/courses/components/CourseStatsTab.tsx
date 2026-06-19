import React from 'react';
import {
  Card,
  Typography,
  Spin,
  Alert,
  Statistic,
  Row,
  Col,
  Space,
  Table,
  Progress,
} from 'antd';
import { useGetCourseStatsQuery } from '../../../services/coursesApi';

const { Title, Text } = Typography;

interface CourseStatsTabProps {
  courseId: string;
}

const CourseStatsTab: React.FC<CourseStatsTabProps> = ({ courseId }) => {
  const { data, isLoading, error } = useGetCourseStatsQuery(courseId);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !data?.data?.stats) {
    return (
      <Alert
        type="error"
        message="Failed to load statistics"
        description="Please try again later"
      />
    );
  }

  const stats = data.data.stats;

  const dropoffColumns = [
    {
      title: 'Module',
      dataIndex: 'moduleTitle',
      key: 'moduleTitle',
    },
    {
      title: 'Dropoff Rate',
      dataIndex: 'dropoffRate',
      key: 'dropoffRate',
      render: (rate: number) => (
        <>
          <Progress
            percent={Math.round(rate * 100)}
            status={rate > 0.5 ? 'exception' : 'active'}
            size="small"
          />
          <Text type="secondary">{(rate * 100).toFixed(1)}%</Text>
        </>
      ),
    },
  ];

  const attemptsColumns = [
    {
      title: 'Form',
      dataIndex: 'formTitle',
      key: 'formTitle',
    },
    {
      title: 'Average Attempts',
      dataIndex: 'averageAttempts',
      key: 'averageAttempts',
      render: (attempts: number) => attempts.toFixed(1),
    },
    {
      title: 'Pass Rate',
      dataIndex: 'passRate',
      key: 'passRate',
      render: (rate: number) => (
        <>
          <Progress
            percent={Math.round(rate * 100)}
            status={rate > 0.7 ? 'success' : rate > 0.5 ? 'active' : 'exception'}
            size="small"
          />
          <Text type="secondary">{(rate * 100).toFixed(1)}%</Text>
        </>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Title level={4}>Course Statistics</Title>
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={8}>
            <Statistic
              title="Completion Rate"
              value={stats.completionRate * 100}
              precision={1}
              suffix="%"
            />
            <Progress
              percent={Math.round(stats.completionRate * 100)}
              status={stats.completionRate > 0.7 ? 'success' : 'active'}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Average Score"
              value={stats.averageScore}
              precision={1}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Median Time to Complete"
              value={stats.medianTimeToComplete}
              suffix="minutes"
            />
          </Col>
        </Row>
      </Card>

      {stats.moduleDropoffCurve && stats.moduleDropoffCurve.length > 0 && (
        <Card>
          <Title level={4}>Module Dropoff Curve</Title>
          <Table
            columns={dropoffColumns}
            dataSource={stats.moduleDropoffCurve.map((item, idx) => ({
              ...item,
              key: idx,
            }))}
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {stats.attemptsDistribution && stats.attemptsDistribution.length > 0 && (
        <Card>
          <Title level={4}>Form Attempts Distribution</Title>
          <Table
            columns={attemptsColumns}
            dataSource={stats.attemptsDistribution.map((item, idx) => ({
              ...item,
              key: idx,
            }))}
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {stats.cohortComparisons && stats.cohortComparisons.length > 0 && (
        <Card>
          <Title level={4}>Cohort Comparisons</Title>
          <Table
            columns={[
              {
                title: 'Cohort',
                dataIndex: 'cohortName',
                key: 'cohortName',
              },
              {
                title: 'Completion Rate',
                dataIndex: 'completionRate',
                key: 'completionRate',
                render: (rate: number) => (
                  <>
                    <Progress
                      percent={Math.round(rate * 100)}
                      status={rate > 0.7 ? 'success' : 'active'}
                      size="small"
                    />
                    <Text type="secondary">{(rate * 100).toFixed(1)}%</Text>
                  </>
                ),
              },
              {
                title: 'Average Score',
                dataIndex: 'averageScore',
                key: 'averageScore',
                render: (score: number) => score.toFixed(1),
              },
            ]}
            dataSource={stats.cohortComparisons.map((item, idx) => ({
              ...item,
              key: idx,
            }))}
            pagination={false}
            size="small"
          />
        </Card>
      )}
    </Space>
  );
};

export default CourseStatsTab;
