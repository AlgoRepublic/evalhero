import { useState, useEffect } from 'react';
import { Dayjs } from 'dayjs';
import { Row, Col, Spin, Alert, Typography, message } from 'antd';
import { useGetProfileStatsMutation } from '../../../services/profilesAPI';
import { useGetTagsQuery } from '../../../services/tagsApi';
import { useAppSelector } from '../../../hooks';
// import type { Profile } from '../../../features/auth/authSlice';
import { FilterBar } from './FilterBar';
import { StatCards } from './StatCards';
import { PassFailPanel } from './PassFailPanel';
import { ScorePanel } from './ScorePanel';

const { Text } = Typography;

export interface ProfileStatsTabProps {
  /** When provided (e.g. on user profile details page), stats are for this profile. Otherwise uses selectedProfile. */
  profileId?: string;
}

export function ProfileStatsTab({ profileId: profileIdProp }: ProfileStatsTabProps = {}) {
  const { selectedProfile } = useAppSelector((state) => state.auth);
  const profileId = profileIdProp ?? selectedProfile?._id ?? '';
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);

  const { data: tagsResponse, isLoading: tagsLoading } = useGetTagsQuery({
    page: 1,
    perPage: 1000,
    sortBy: 'name',
    order: 'asc',
  });

  const tags = tagsResponse?.data?.tags?.records || [];

  const [getProfileStats, {
    data: statsResponse,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErrorData,
  }] = useGetProfileStatsMutation();

  const statsData = statsResponse?.data?.stats || null;
  const isLoading = statsLoading;
  const error = statsError
    ? (statsErrorData as { data?: { message?: string } })?.data?.message ||
      'Failed to load profile statistics'
    : null;

  const fetchStats = async () => {
    const subjectIds = profileId ? [profileId] : [];

    try {
      await getProfileStats({
        tagId: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        subjectIds,
        startDate: dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
        endDate: dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
        includeGrowth: true,
        includeMomentum: true,
      }).unwrap();
    } catch (err: unknown) {
      const errorMessage =
        (err as { data?: { message?: string } })?.data?.message ||
        'Failed to load profile statistics';
      message.error(errorMessage);
    }
  };

  useEffect(() => {
    if (profileId) {
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchStats depends on filters
  }, [profileId, selectedTagIds, dateRange]);

  const handleSelectAll = () => {
    setSelectedTagIds(tags.map((tag) => tag._id));
  };

  const handleClearAll = () => {
    setSelectedTagIds([]);
  };

  const handleApply = () => {
    fetchStats();
  };

  if (!profileId) {
    return (
      <Alert
        message="No profile selected"
        description="Please select a profile to view statistics."
        type="warning"
        showIcon
      />
    );
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <FilterBar
        selectedTagIds={selectedTagIds}
        onTagIdsChange={setSelectedTagIds}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onApply={handleApply}
        tags={tags}
        tagsLoading={tagsLoading}
        isLoading={isLoading}
        onSelectAll={handleSelectAll}
        onClearAll={handleClearAll}
      />

      {isLoading && !statsData && (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">Loading statistics...</Text>
          </div>
        </div>
      )}

      {error && !statsData && (
        <Alert
          message="Error loading statistics"
          description={error}
          type="error"
          showIcon
          style={{ marginTop: 24 }}
        />
      )}

      {statsData && (
        <>
          <StatCards summary={statsData.summary} />

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={12}>
              <PassFailPanel passFail={statsData.passFail} />
            </Col>
            <Col xs={24} lg={12}>
              <ScorePanel score={statsData.score} />
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
