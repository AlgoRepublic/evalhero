import { Card, Alert, Row, Col, Typography, Spin, message } from 'antd';
import { useState, useEffect } from 'react';
import { SubjectFilterBar } from './SubjectFilterBar';
import { SubjectStatCards } from './SubjectStatCards';
import { PassFailPanel } from '../TagStatsTab/PassFailPanel';
import { ScorePanel } from '../TagStatsTab/ScorePanel';
import { SubjectGrowthChart } from './SubjectGrowthChart';
import { SubjectRankPanel } from './SubjectRankPanel';
import { SubjectTagDeepDive } from './SubjectTagDeepDive';
import { useGetComprehensiveTagStatsMutation, type ComprehensiveTagStatsData } from '../../../../services/tagsApi';
import { useGetSubjectsQuery } from '../../../../services/assignmentsApi';
import { Dayjs } from 'dayjs';

const { Text } = Typography;

interface SubjectDeepDiveTabProps {
  // Optional: can receive initial values, but manages its own state
  // Callback to pass stats data to parent for PDF export
  onStatsDataChange?: (
    data: ComprehensiveTagStatsData | null, 
    dateRange?: { startDate?: string; endDate?: string },
    filterInfo?: { selectedSubjectId?: string; subjects: any[] }
  ) => void;
}

export const SubjectDeepDiveTab = ({ onStatsDataChange }: SubjectDeepDiveTabProps) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [includeGrowth] = useState(true);
  const [includeMomentum] = useState(true);
  const [subjectGrowthMetric, setSubjectGrowthMetric] = useState<'pointsPct' | 'passRate' | 'activity'>('pointsPct');
  const [subjectTagChartMode, setSubjectTagChartMode] = useState<'barDelta' | 'scatterFocus'>('barDelta');

  // Fetch subjects for filter
  const { data: subjectsRes, isLoading: subjectsLoading } = useGetSubjectsQuery();
  const subjects = subjectsRes?.data || [];

  const [getComprehensiveTagStats, { data, isLoading, isError, error }] = useGetComprehensiveTagStatsMutation();

  const fetchStats = async () => {
    if (!selectedSubjectId) return;
    
    try {
      await getComprehensiveTagStats({
        subjectIds: [selectedSubjectId],
        startDate: dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
        endDate: dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
        includeGrowth,
        includeMomentum,
      }).unwrap();
    } catch (err) {
      const errorMessage =
        (err as { data?: { message?: string } })?.data?.message || 'Failed to load subject statistics';
      message.error(errorMessage);
    }
  };

  useEffect(() => {
    // Auto-fetch when subject or date range changes
    if (selectedSubjectId) {
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubjectId, dateRange]);

  const subjectStatsData = data?.data?.stats;

  // Notify parent when stats data changes
  useEffect(() => {
    if (onStatsDataChange) {
      onStatsDataChange(
        subjectStatsData || null,
        dateRange[0] || dateRange[1] 
          ? {
              startDate: dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
              endDate: dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
            }
          : undefined,
        {
          selectedSubjectId,
          subjects,
        }
      );
    }
  }, [subjectStatsData, dateRange, selectedSubjectId, subjects, onStatsDataChange]);

  return (
    <>
      <SubjectFilterBar
        selectedSubjectId={selectedSubjectId}
        onSubjectIdChange={setSelectedSubjectId}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        subjects={subjects}
        subjectsLoading={subjectsLoading}
      />

      {isLoading && !subjectStatsData && selectedSubjectId && (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">Loading subject statistics...</Text>
          </div>
        </div>
      )}

      {isError && (
        <Alert
          message="Error Loading Statistics"
          description={
            (error as { data?: { message?: string } })?.data?.message ||
            'Failed to load subject statistics'
          }
          type="error"
          showIcon
          style={{ marginTop: 24 }}
        />
      )}

      {!subjectStatsData && selectedSubjectId && !isLoading && (
        <Card style={{ marginTop: 24 }}>
          <Alert
            message="No Data Available"
            description={
              <Text>
                No statistics available for the selected subject and date range.
              </Text>
            }
            type="info"
            showIcon
          />
        </Card>
      )}

      {subjectStatsData && selectedSubjectId && (
        <>
          <SubjectStatCards
            summary={subjectStatsData.summary}
            tagBreakdown={subjectStatsData.tagBreakdown}
          />

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={12}>
              <PassFailPanel
                passFail={subjectStatsData.passFail}
                momentum={subjectStatsData.momentum}
                subjectCount={1}
              />
            </Col>
            <Col xs={24} lg={12}>
              <ScorePanel
                score={subjectStatsData.score}
                momentum={subjectStatsData.momentum}
                subjectCount={1}
              />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 14 }}>
            <Col xs={24} lg={14}>
              <SubjectGrowthChart
                growth={subjectStatsData.growth}
                subjectId={selectedSubjectId}
                growthMetric={subjectGrowthMetric}
                onGrowthMetricChange={setSubjectGrowthMetric}
              />
            </Col>
            <Col xs={24} lg={10}>
              <SubjectRankPanel momentum={subjectStatsData.momentum} />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 14 }}>
            <Col xs={24}>
              <SubjectTagDeepDive
                tagBreakdown={subjectStatsData.tagBreakdown}
                chartMode={subjectTagChartMode}
                onChartModeChange={setSubjectTagChartMode}
              />
            </Col>
          </Row>
        </>
      )}

      {!selectedSubjectId && (
        <Card style={{ marginTop: 24 }}>
          <Text type="secondary">Please select a subject to view detailed statistics</Text>
        </Card>
      )}
    </>
  );
};
