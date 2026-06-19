import React from 'react';
import { Card, Col, Typography, Progress, Statistic } from 'antd';

const { Text } = Typography;

interface StatCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  prefix?: React.ReactNode;
  gradient: string;
  progress?: number;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  suffix,
  prefix,
  gradient,
  progress,
}) => (
  <Col xs={24} sm={12} lg={6}>
    <Card
      variant="outlined"
      style={{
        background: gradient,
        borderRadius: 12,
        height: '100%',
      }}
      styles={{ body: { padding: 20 } }}
    >
      <Statistic
        title={
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>
            {title}
          </Text>
        }
        value={value}
        suffix={suffix}
        valueStyle={{ color: '#fff', fontSize: 32, fontWeight: 600 }}
        prefix={prefix}
      />
      {progress !== undefined && (
        <Progress
          percent={progress}
          strokeColor="#fff"
          trailColor="rgba(255,255,255,0.3)"
          showInfo={false}
          style={{ marginTop: 12 }}
        />
      )}
    </Card>
  </Col>
);
