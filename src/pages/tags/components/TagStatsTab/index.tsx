import { Row, Col, Spin, Alert, Typography, message } from 'antd';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FilterBar } from './FilterBar';
import { StatCards } from './StatCards';
import { PassFailPanel } from './PassFailPanel';
import { ScorePanel } from './ScorePanel';
import { GrowthChart } from './GrowthChart';
import { TagBreakdownLeaderboard } from './TagBreakdownLeaderboard';
import { useGetComprehensiveTagStatsMutation, type ComprehensiveTagStatsData } from '../../../../services/tagsApi';
import { useGetSubjectsQuery } from '../../../../services/assignmentsApi';
import { Dayjs } from 'dayjs';
import { Profile } from '../../../../features/auth/authSlice';

const { Text } = Typography;

interface TagStatsTabProps {
  // Optional: tagId from URL can be passed, but tab manages its own state
  initialTagId?: string | undefined;
  // Callback to pass stats data to parent for PDF export
  onStatsDataChange?: (
    data: ComprehensiveTagStatsData | null, 
    dateRange?: { startDate?: string; endDate?: string },
    filterInfo?: { selectedSubjectIds: string[]; subjects: Profile[]; selectedTagId?: string }
  ) => void;
}

export const TagStatsTab = ({ initialTagId, onStatsDataChange }: TagStatsTabProps) => {
  const { tagId: urlTagId } = useParams<{ tagId?: string }>();
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [selectedTagId, setSelectedTagId] = useState<string | undefined>(initialTagId || urlTagId);
  const [includeGrowth] = useState(true);
  const [includeMomentum] = useState(true);
  const [growthMetric, setGrowthMetric] = useState<'pointsPct' | 'pointsEarned' | 'passRate'>('pointsPct');

  // Fetch subjects for filter
  const { data: subjectsRes, isLoading: subjectsLoading } = useGetSubjectsQuery();
  const subjects = subjectsRes?.data || [];

  const [getComprehensiveTagStats, { data, isLoading, isError, error }] = useGetComprehensiveTagStatsMutation();

  const fetchStats = async () => {
    try {
      await getComprehensiveTagStats({
        subjectIds: selectedSubjectIds.length > 0 ? selectedSubjectIds : undefined,
        startDate: dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
        endDate: dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
        tagId: selectedTagId,
        includeGrowth,
        includeMomentum,
      }).unwrap();
    } catch (err) {
      const errorMessage =
        (err as { data?: { message?: string } })?.data?.message || 'Failed to load tag statistics';
      message.error(errorMessage);
    }
  };

  useEffect(() => {
    // Update selectedTagId when URL param changes
    if (urlTagId && urlTagId !== selectedTagId) {
      setSelectedTagId(urlTagId);
    }
  }, [urlTagId, selectedTagId]);

  useEffect(() => {
    // Auto-fetch on mount and when selectedTagId changes
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTagId]);

  const handleSelectAll = () => {
    setSelectedSubjectIds(subjects.map((s) => s._id));
  };

  const handleClearAll = () => {
    setSelectedSubjectIds([]);
  };

  const handleApply = () => {
    fetchStats();
  };

  const stats = data?.data?.stats;

  // Notify parent when stats data changes
  useEffect(() => {
    if (onStatsDataChange) {
      onStatsDataChange(
        stats || null,
        dateRange[0] || dateRange[1] 
          ? {
              startDate: dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
              endDate: dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
            }
          : undefined,
        {
          selectedSubjectIds,
          subjects,
          selectedTagId,
        }
      );
    }
  }, [stats, dateRange, selectedSubjectIds, subjects, selectedTagId, onStatsDataChange]);

  return (
    <>
      <FilterBar
        selectedSubjectIds={selectedSubjectIds}
        onSubjectIdsChange={setSelectedSubjectIds}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onApply={handleApply}
        subjects={subjects}
        subjectsLoading={subjectsLoading}
        isLoading={isLoading}
        onSelectAll={handleSelectAll}
        onClearAll={handleClearAll}
      />

      {isLoading && !stats && (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">Loading statistics...</Text>
          </div>
        </div>
      )}

      {isError && (
        <Alert
          message="Error Loading Statistics"
          description={
            (error as { data?: { message?: string } })?.data?.message ||
            'Failed to load tag statistics'
          }
          type="error"
          showIcon
          style={{ marginTop: 24 }}
        />
      )}

      {stats && (
        <>
          <StatCards summary={stats.summary} />

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={12}>
              <PassFailPanel
                passFail={stats.passFail}
                momentum={stats.momentum}
                subjectCount={stats.filters?.subjectIds?.length || 0}
              />
            </Col>
            <Col xs={24} lg={12}>
              <ScorePanel
                score={stats.score}
                momentum={stats.momentum}
                subjectCount={stats.filters?.subjectIds?.length || 0}
              />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 14 }}>
            <Col xs={24} lg={24} xl={14}>
              <GrowthChart
                growth={stats.growth}
                growthMetric={growthMetric}
                onGrowthMetricChange={setGrowthMetric}
                subjectCount={stats.filters?.subjectIds?.length || 0}
              />
            </Col>
            <Col xs={24} lg={24} xl={10}>
              <TagBreakdownLeaderboard
                tagBreakdown={stats.tagBreakdown}
                tagLeaderboard={stats.tagLeaderboard}
                dateRange={dateRange}
                selectedTagId={selectedTagId}
                subjects={subjects}
              />
            </Col>
          </Row>
        </>
      )}
    </>
  );
};
