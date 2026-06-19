import { useState, useEffect, useMemo } from 'react';
import { Alert, Flex, Form, Grid, message, Spin, Tabs, theme, Upload, UploadFile } from 'antd';
import { UserOutlined, FileTextOutlined, BarChartOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Helmet } from 'react-helmet-async';
import { useAppSelector } from '../../hooks';
import { useUpdateUserMutation, useLazyGetUserInfoQuery } from '../../services/authApi';
import { useLazyGetAssetUrlQuery } from '../../services/assetsApi';
import type { OtpDeliveryPreference } from '../../types/auth';
import { PageHeader } from '../../components';
import { useGetRolesQuery } from '../../services/roleApi';
import { useGetDepartmentsQuery } from '../../services/departmentApi';
import { useGetLocationsQuery } from '../../services/locationsApi';
import {
  useListProfileDocumentsQuery,
  useDeleteProfileDocumentMutation,
  type ProfileDocumentRecord,
} from '../../services/profileDocumentsApi';
import { UploadDocumentModal } from '../users/UserProfileDetails/UploadDocumentModal';
import { EditDocumentModal } from '../users/UserProfileDetails/EditDocumentModal';
import {
  ProfileOverviewCard,
  ProfileDocumentsTab,
  ProfileStatsTab,
  ContactVerificationModal,
} from './components';
import type { ContactType } from './components/ContactVerificationModal';
import QueueTable from '../forms/QueuesComponents/QueueTable';

const { useBreakpoint } = Grid;

interface ProfileFormValues {
  name: string;
  otpDeliveryPreference: OtpDeliveryPreference;
}

export const ProfilePage = () => {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [form] = Form.useForm();
  const { user, selectedProfile } = useAppSelector((state) => state.auth);
  const profileId = selectedProfile?._id ?? null;

  const [activeTab, setActiveTab] = useState('documents');
  const [file, setFile] = useState<UploadFile | null>(null);
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [getUserInfo] = useLazyGetUserInfoQuery();
  const [getAssetUrl] = useLazyGetAssetUrlQuery();

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<ProfileDocumentRecord | null>(null);
  const [docPage, setDocPage] = useState(1);
  const [docPerPage, setDocPerPage] = useState(10);
  const [docSortBy, setDocSortBy] = useState('createdAt');
  const [docOrder, setDocOrder] = useState<'asc' | 'desc'>('desc');
  const [deleteDocument] = useDeleteProfileDocumentMutation();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactModalType, setContactModalType] = useState<ContactType>('email');
  const [contactModalCurrentValue, setContactModalCurrentValue] = useState<string | null>(null);

  const { data: rolesData } = useGetRolesQuery();
  const { data: departmentsData } = useGetDepartmentsQuery();
  const { data: locationsData } = useGetLocationsQuery();

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

  const records = documentsData?.data?.records ?? [];
  const totalRecords = documentsData?.data?.metadata?.count ?? 0;

  const roleMap = useMemo(() => {
    const map = new Map<string, string>();
    rolesData?.data?.roles?.records?.forEach((role) => {
      map.set(role._id, role.name);
    });
    return map;
  }, [rolesData]);

  const departmentMap = useMemo(() => {
    const map = new Map<string, string>();
    departmentsData?.data?.departments?.records?.forEach((dept) => {
      map.set(dept._id, dept.name);
    });
    return map;
  }, [departmentsData]);

  const locationMap = useMemo(() => {
    const map = new Map<string, string>();
    locationsData?.data?.locations?.records?.forEach((location) => {
      map.set(location._id, location.name);
    });
    return map;
  }, [locationsData]);

  useEffect(() => {
    if (!user) return;
    const hasEmail = user.email != null && user.email.trim() !== '';
    const hasPhone = user.phone != null && user.phone.trim() !== '';
    const defaultOtpPreference: ProfileFormValues['otpDeliveryPreference'] =
      hasEmail && hasPhone ? 'both' : hasEmail ? 'email' : 'sms';

    form.setFieldsValue({
      name: user.name,
      otpDeliveryPreference: user.otpDeliveryPreference ?? defaultOtpPreference,
    });
    const avatar = user.avatar;
    if (avatar) {
      if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
        setFile({
          uid: '-1',
          name: 'existing-avatar.png',
          status: 'done',
          thumbUrl: avatar,
        });
      } else if (!/^(image|image\/[\w+-]+)$/i.test(avatar)) {
        setFile(null);
        getAssetUrl(avatar)
          .then((result) => {
            const url = result.data;
            if (url) {
              setFile({
                uid: '-1',
                name: 'existing-avatar.png',
                status: 'done',
                thumbUrl: url,
              });
            }
          })
          .catch(() => setFile(null));
      } else {
        setFile(null);
      }
    } else {
      setFile(null);
    }
  }, [user?._id, user?.avatar, user?.name, form, getAssetUrl]);

  const handleSubmit = async (values: ProfileFormValues) => {
    try {
      await updateUser({
        name: values.name,
        otpDeliveryPreference: values.otpDeliveryPreference,
        avatar: file?.originFileObj as File,
      }).unwrap();
      message.success('Profile updated successfully');
      await getUserInfo();
      setFile(null);
    } catch (error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Failed to update profile';
      message.error(errMsg);
    }
  };

  const handleFileChange = (fileList: UploadFile[]) => {
    if (fileList.length > 0) {
      const f = fileList[0];
      if (f.originFileObj) {
        f.thumbUrl = URL.createObjectURL(f.originFileObj);
      }
      setFile(f);
    } else {
      setFile(null);
    }
  };

  const beforeUpload = (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('You can only upload image files!');
      return Upload.LIST_IGNORE;
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('Image must be smaller than 2MB!');
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  const handleDeleteDocument = async (doc: ProfileDocumentRecord) => {
    if (!profileId) return;
    setDeletingId(doc._id);
    try {
      await deleteDocument({ id: doc._id, profileId }).unwrap();
      message.success('Document deleted.');
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string };
      message.error(err?.data?.message || err?.message || 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDocSortChange = (sortBy: string, order: 'asc' | 'desc') => {
    setDocSortBy(sortBy);
    setDocOrder(order);
    setDocPage(1);
  };

  const displayName = user?.name || user?.email || user?.phone || 'Profile';

  if (!user) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  const isDeactivatedNonAdmin =
    !user.isAdmin && selectedProfile != null && selectedProfile.deletedAt != null && selectedProfile.deletedAt !== '';

  if (isDeactivatedNonAdmin) {
    return (
      <div>
        <Flex justify="center" align="center" style={{ padding: isMobile ? token.paddingSM : token.paddingMD }}>
          <Alert
            type="warning"
            showIcon
            message="You have been deactivated in this organization"
            description="Contact with admin."
            style={{ width: '100%' }}
          />
        </Flex>
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
                <UserOutlined />
                <span>Profile</span>
              </>
            ),
          },
        ]}
      />

      <div style={{ padding: isMobile ? token.paddingSM : token.paddingMD }}>
        <div style={{ marginBottom: token.marginMD }}>
          <ProfileOverviewCard
            email={user.email}
            phone={user.phone}
            isAdmin={user.isAdmin}
            showAdminField={user.isAdmin}
            isMobile={isMobile}
            file={file}
            isUpdating={isUpdating}
            selectedProfile={selectedProfile}
            roleMap={roleMap}
            departmentMap={departmentMap}
            locationMap={locationMap}
            form={form}
            onFinish={handleSubmit}
            onFileChange={handleFileChange}
            onFileRemove={() => setFile(null)}
            beforeUpload={beforeUpload}
            onViewStats={() => setActiveTab('stats')}
            onEmailAction={(currentEmail) => {
              setContactModalType('email');
              setContactModalCurrentValue(currentEmail ?? null);
              setContactModalOpen(true);
            }}
            onPhoneAction={(currentPhone) => {
              setContactModalType('phone');
              setContactModalCurrentValue(currentPhone ?? null);
              setContactModalOpen(true);
            }}
          />
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ textTransform: 'capitalize' }}
          items={[
            {
              key: 'documents',
              label: (
                <span>
                  <FileTextOutlined style={{ marginRight: 6 }} />
                  Documents
                </span>
              ),
              children: (
                <ProfileDocumentsTab
                  profileId={profileId}
                  records={records}
                  totalRecords={totalRecords}
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
                  onSortChange={handleDocSortChange}
                  onUploadClick={() => setUploadModalOpen(true)}
                  onEdit={(record) => setEditingDocument(record)}
                  onDelete={handleDeleteDocument}
                />
              ),
            },
            {
              key: 'queues',
              label: (
                <span>
                  <UnorderedListOutlined style={{ marginRight: 6 }} />
                  My Forms
                </span>
              ),
              children: <QueueTable profileId={profileId ?? undefined} />,
            },
            {
              key: 'stats',
              label: (
                <span>
                  <BarChartOutlined style={{ marginRight: 6 }} />
                  Stats
                </span>
              ),
              children: <ProfileStatsTab />,
            },
          ]}
        />
      </div>

      <ContactVerificationModal
        open={contactModalOpen}
        type={contactModalType}
        currentValue={contactModalCurrentValue}
        onCancel={() => setContactModalOpen(false)}
        onSuccess={async () => {
          await getUserInfo();
        }}
      />

      {profileId && (
        <>
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
        </>
      )}
    </div>
  );
};
