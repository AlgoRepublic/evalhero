import { Card, Typography } from 'antd';
import { ProfileDocumentsCard } from '../../users/UserProfileDetails/ProfileDocumentsCard';
import type { ProfileDocumentRecord } from '../../../services/profileDocumentsApi';

export interface ProfileDocumentsTabProps {
  profileId: string | null;
  records: ProfileDocumentRecord[];
  totalRecords: number;
  loading: boolean;
  page: number;
  perPage: number;
  isMobile: boolean;
  token: { marginSM: number; marginMD: number };
  deletingId: string | null;
  onPageChange: (page: number, perPage: number) => void;
  onSortChange: (sortBy: string, order: 'asc' | 'desc') => void;
  onUploadClick: () => void;
  onEdit: (record: ProfileDocumentRecord) => void;
  onDelete: (record: ProfileDocumentRecord) => void;
}

export function ProfileDocumentsTab({
  profileId,
  records,
  totalRecords,
  loading,
  page,
  perPage,
  isMobile,
  token,
  deletingId,
  onPageChange,
  onSortChange,
  onUploadClick,
  onEdit,
  onDelete,
}: ProfileDocumentsTabProps) {

  if (!profileId) {
    return (
      <Card size="small">
        <Typography.Text type="secondary">
          No organization profile selected. Organization documents are available when you have an
          active profile.
        </Typography.Text>
      </Card>
    );
  }

  return (
      <ProfileDocumentsCard
        profileId={profileId}
        isOwnProfile={true}
        records={records}
        total={totalRecords}
        loading={loading}
        page={page}
        perPage={perPage}
        isMobile={isMobile}
        token={token}
        deletingId={deletingId}
        onPageChange={onPageChange}
        onSortChange={onSortChange}
        onUploadClick={onUploadClick}
        onEdit={onEdit}
        onDelete={onDelete}
      />
  );
}
