import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Typography, theme, Grid, message, Tabs, Button, Flex } from 'antd';
import { TeamOutlined, UserSwitchOutlined, FileTextOutlined, BarChartOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '../../../hooks';
import { PageHeader } from '../../../components';
import { PATH_USERS } from '../../../constants/routes';
import {
  useListProfileDocumentsQuery,
  useDeleteProfileDocumentMutation,
  type ProfileDocumentRecord,
} from '../../../services/profileDocumentsApi';
import { useGetProfileQuery, useStartImpersonationMutation } from '../../../services/usersApi';
import type { User } from '../../../features/auth/authSlice';
import { usePermission } from '../../../hooks/usePermission';
import { setImpersonationState } from '../../../utils/impersonation';
import { addActivity } from '../../../utils/activityUtils';
import { ProfileCard } from './ProfileCard';
import { ProfileDocumentsCard } from './ProfileDocumentsCard';
import { UploadDocumentModal } from './UploadDocumentModal';
import { EditDocumentModal } from './EditDocumentModal';
import { ProfileStatsTab } from '../../profile/components';
import QueueTable from '../../forms/QueuesComponents/QueueTable';

const { useBreakpoint } = Grid;

export default function UserProfileDetailsPage() {
  const { profileId } = useParams<{ profileId: string }>();
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const selectedProfile = useAppSelector((state) => state.auth.selectedProfile);
  const loggedInUser = useAppSelector((state) => state.auth.user);
  const accessToken = useAppSelector((state) => state.auth.accessToken) ?? localStorage.getItem('accessToken');
  const refreshToken = useAppSelector((state) => state.auth.refreshToken) ?? localStorage.getItem('refreshToken');
  const hasProfiledocumentView = usePermission('profiledocument::view');
  const [startImpersonation, { isLoading: isStartingImpersonation }] = useStartImpersonationMutation();
  const isOwnProfile = Boolean(profileId && selectedProfile?._id === profileId);
  const showDocumentsSection = hasProfiledocumentView || isOwnProfile;

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<ProfileDocumentRecord | null>(null);
  const [docPage, setDocPage] = useState(1);
  const [docPerPage, setDocPerPage] = useState(10);
  const [docSortBy, setDocSortBy] = useState('createdAt');
  const [docOrder, setDocOrder] = useState<'asc' | 'desc'>('desc');

  const { data: profile, isLoading: isProfileLoading, isError: isProfileError } = useGetProfileQuery(
    profileId!,
    { skip: !profileId }
  );
  const { data: documentsData, isFetching: isDocumentsLoading } = useListProfileDocumentsQuery(
    {
      profileId: profileId!,
      page: docPage,
      perPage: docPerPage,
      sortBy: docSortBy,
      order: docOrder,
    },
    { skip: !profileId }
  );

  const [deleteDocument] = useDeleteProfileDocumentMutation();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const records = documentsData?.data?.records ?? [];
  const totalRecords = documentsData?.data?.metadata?.count ?? 0;
  const user = typeof profile?.user === 'object' && profile?.user ? (profile.user as User) : null;
  const displayName = user?.name || user?.email || user?.phone || 'Profile';

  const handleDelete = async (doc: ProfileDocumentRecord) => {
    setDeletingId(doc._id);
    try {
      await deleteDocument({ id: doc._id, profileId: profileId! }).unwrap();
      message.success('Document deleted.');
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string };
      message.error(err?.data?.message || err?.message || 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSortChange = (sortBy: string, order: 'asc' | 'desc') => {
    setDocSortBy(sortBy);
    setDocOrder(order);
    setDocPage(1);
  };

  const canImpersonate = Boolean(
    loggedInUser?.isAdmin && !isOwnProfile && user?._id && profileId && accessToken && selectedProfile?._id
  );
  const handleImpersonate = async () => {
    if (!user?._id || !profileId || !accessToken || !selectedProfile?._id) return;
    try {
      const data = await startImpersonation({ userId: user._id, profileId }).unwrap();
      setImpersonationState({
        impersonationToken: data.impersonationToken,
        targetUser: data.targetUser,
        targetProfile: data.targetProfile,
        originalAccessToken: accessToken,
        originalProfileId: selectedProfile._id,
        originalRefreshToken: refreshToken,
      });
      const targetLabel = data.targetUser.name ?? data.targetUser.email ?? 'user';
      addActivity({
        type: 'impersonation',
        description: `Started impersonating ${targetLabel}`,
        meta: { user: targetLabel, userId: data.targetUser._id },
      });
      message.success(`Viewing as ${targetLabel}. Reloading.`);
      window.location.href = '/profile';
    } catch (err: unknown) {
      const e = err as { data?: { message?: string }; message?: string };
      message.error(e?.data?.message ?? e?.message ?? 'Failed to start impersonation');
    }
  };

  if (!profileId) {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Text type="danger">Missing profile ID.</Typography.Text>
      </div>
    );
  }

  return (
    <div>
      <Helmet>
        <title>{displayName} - Profile - Eval Hero</title>
      </Helmet>
      <PageHeader
        title={displayName}
        breadcrumbs={[
          {
            title: (
              <>
                <TeamOutlined />
                <span>Users</span>
              </>
            ),
            path: PATH_USERS.root,
          },
          {
            title: displayName,
          },
        ]}
      />

      <div style={{ padding: isMobile ? token.paddingSM : token.paddingMD }}>
        {canImpersonate && (
          <Flex justify="flex-end" style={{ marginBottom: token.marginMD }}>
            <Button
              type="primary"
              icon={<UserSwitchOutlined />}
              onClick={handleImpersonate}
              loading={isStartingImpersonation}
            >
              Impersonate
            </Button>
          </Flex>
        )}
        <div style={{ marginBottom: token.marginMD }}>
          <ProfileCard
            displayName={displayName}
            email={user?.email}
            phone={user?.phone}
            avatar={user?.avatar}
            isAdmin={user?.isAdmin ?? false}
            showAdminField={loggedInUser?.isAdmin ?? false}
            isOwnProfile={isOwnProfile}
            isLoading={isProfileLoading}
            isError={isProfileError}
            profileId={profileId}
            profile={profile ?? undefined}
          />
        </div>

        <Tabs
          defaultActiveKey={showDocumentsSection ? 'documents' : 'stats'}
          style={{ textTransform: 'capitalize' }}
          items={[
            ...(showDocumentsSection
              ? [
                  {
                    key: 'documents',
                    label: (
                      <span>
                        <FileTextOutlined style={{ marginRight: 6 }} />
                        Documents
                      </span>
                    ),
                    children: (
                      <ProfileDocumentsCard
                        profileId={profileId}
                        isOwnProfile={isOwnProfile}
                        records={records}
                        total={totalRecords}
                        loading={isDocumentsLoading}
                        page={docPage}
                        perPage={docPerPage}
                        isMobile={isMobile}
                        token={token}
                        deletingId={deletingId}
                        onPageChange={(p, size) => {
                          setDocPage(p);
                          setDocPerPage(size);
                        }}
                        onSortChange={handleSortChange}
                        onUploadClick={() => setUploadModalOpen(true)}
                        onEdit={(record) => setEditingDocument(record)}
                        onDelete={handleDelete}
                      />
                    ),
                  },
                ]
              : []),
            {
              key: 'queues',
              label: (
                <span>
                  <UnorderedListOutlined style={{ marginRight: 6 }} />
                  My Forms
                </span>
              ),
              children: <QueueTable profileId={profileId} />,
            },
            {
              key: 'stats',
              label: (
                <span>
                  <BarChartOutlined style={{ marginRight: 6 }} />
                  Stats
                </span>
              ),
              children: <ProfileStatsTab profileId={profileId} />,
            },
          ]}
        />
      </div>

      <UploadDocumentModal
        open={uploadModalOpen}
        profileId={profileId}
        onCancel={() => setUploadModalOpen(false)}
        onSuccess={() => setUploadModalOpen(false)}
      />
      <EditDocumentModal
        open={editingDocument != null}
        profileId={profileId}
        document={editingDocument}
        onCancel={() => setEditingDocument(null)}
        onSuccess={() => setEditingDocument(null)}
      />
    </div>
  );
}
