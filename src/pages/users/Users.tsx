import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button, Modal, Upload, message, Space, Typography, Alert, Table, Tag } from 'antd';
import type { UploadFile } from 'antd';
import { UploadOutlined, DownloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { PageHeader } from '../../components';
import { TeamOutlined } from '@ant-design/icons';
import { ProtectedComponent } from '../../components/ProtectedComponent';
import UsersTable from './components/UsersTable';
import { useBulkUploadUsersMutation, useExportProfilesMutation } from '../../services/usersApi';
import type {
  BulkUploadErrorResponse,
  BulkUploadValidationError,
} from '../../services/usersApi';
import { theme } from 'antd';

const { useToken } = theme;

function getValidationErrors(err: BulkUploadErrorResponse): BulkUploadValidationError[] {
  return err.data?.errors ?? err.errors ?? [];
}

/** User-friendly labels for bulk upload error codes (see bulkUpload-status-codes.md). */
const ERROR_CODE_LABELS: Record<string, string> = {
  VALIDATION_REQUIRED: 'Missing name',
  INVALID_EMAIL: 'Invalid email',
  INVALID_PHONE: 'Invalid phone',
  PROFILE_NOT_FOUND: 'Profile not found',
  USER_MUST_HAVE_EMAIL_OR_PHONE: 'Email or phone required',
  EMAIL_ALREADY_IN_USE: 'Email already in use',
  PHONE_ALREADY_IN_USE: 'Phone already in use',
  DUPLICATE_IN_FILE: 'Duplicate in file',
  DUPLICATE_KEY: 'Duplicate value',
  UPDATE_FAILED: 'Update failed',
  CREATE_FAILED: 'Create failed',
};

function getFriendlyErrorLabel(code: string): string {
  return ERROR_CODE_LABELS[code] ?? code;
}

const UsersPage = () => {
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [validationError, setValidationError] = useState<{
    message: string;
    errors: BulkUploadValidationError[];
  } | null>(null);
  const [bulkUploadUsers, { isLoading: isBulkUploading }] = useBulkUploadUsersMutation();
  const [exportProfiles, { isLoading: isExporting }] = useExportProfilesMutation();
  const { token } = useToken();

  const handleExport = async () => {
    try {
      const blob = await exportProfiles().unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'profiles.csv';
      a.click();
      URL.revokeObjectURL(url);
      message.success('Profiles exported successfully.');
    } catch {
      message.error('Export failed. Please try again.');
    }
  };

  const handleBulkUploadOk = async () => {
    const file = fileList[0]?.originFileObj;
    if (!file) {
      message.warning('Please select a CSV file.');
      return;
    }
    setValidationError(null);
    try {
      const result = await bulkUploadUsers(file).unwrap();
      if (result.success) {
        const { usersCreated, profilesCreated, updated, skipped, errors } = result.data;
        const summary = [
          usersCreated > 0 && `${usersCreated} created`,
          profilesCreated > 0 && `${profilesCreated} profiles added`,
          updated > 0 && `${updated} updated`,
          skipped > 0 && `${skipped} skipped`,
        ]
          .filter(Boolean)
          .join(', ');
        message.success(summary ? `Bulk upload completed. ${summary}.` : 'Bulk upload completed.');
        if (errors?.length > 0) {
          setFileList([]);
          setValidationError({
            message: `${errors.length} row(s) had errors. Fix the CSV and re-upload if needed.`,
            errors,
          });
          // Keep modal open so user can see errors; file cleared so they select fixed file next
        } else {
          setBulkModalOpen(false);
          setFileList([]);
        }
      } else {
        const err = result as BulkUploadErrorResponse;
        const errors = getValidationErrors(err);
        setFileList([]);
        setValidationError({
          message: err.message || 'CSV validation failed. No users were created.',
          errors,
        });
      }
    } catch (e: unknown) {
      const err = e as {
        data?: BulkUploadErrorResponse | { message?: string };
        message?: string;
      };
      const data = err?.data as BulkUploadErrorResponse | undefined;
      const errors = data ? getValidationErrors(data) : [];
      const msg =
        (data && 'message' in data ? data.message : undefined) ??
        (err?.data && typeof err.data === 'object' && 'message' in err.data
          ? (err.data as { message?: string }).message
          : undefined) ??
        err?.message ??
        'Bulk upload failed.';
      if (errors.length > 0) {
        setFileList([]);
        setValidationError({ message: msg, errors });
      } else {
        message.error(msg);
      }
    }
  };

  const handleBulkUploadCancel = () => {
    setBulkModalOpen(false);
    setFileList([]);
    setValidationError(null);
  };

  return (
    <div>
      <Helmet>
        <title>Users - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Users"
        breadcrumbs={[
          {
            title: (
              <>
                <TeamOutlined />
                <span>Users</span>
              </>
            ),
            path: '/Users',
          },
        ]}
      />
      <div>
        <ProtectedComponent permission="user::bulkupload">
          <div style={{ paddingLeft: token.paddingMD, paddingRight: token.paddingMD, marginBottom: token.marginMD }}>
            <Space>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => setBulkModalOpen(true)}
              >
                Import
              </Button>
              <Button
                variant="solid"
                color="green"
                icon={<DownloadOutlined />}
                onClick={handleExport}
                loading={isExporting}
              >
                Export
              </Button>
            </Space>
          </div>
        </ProtectedComponent>
        <UsersTable />
      </div>

      <Modal
        title="Bulk upload users"
        open={bulkModalOpen}
        onOk={handleBulkUploadOk}
        onCancel={handleBulkUploadCancel}
        confirmLoading={isBulkUploading}
        okText="Upload"
        okButtonProps={{ disabled: fileList.length === 0 }}
        destroyOnHidden
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            Upload a CSV with columns: <code>profileId</code> (optional, for updates), <code>name</code>, <code>email</code>, <code>phone</code>. Headers: <code>profileId,name,email,phone</code>. <code>name</code> is required; at least one of <code>email</code> or <code>phone</code> is required. Phone must be E.164 (e.g. +15551234567). Rows with a valid <code>profileId</code> update that profile; rows without update existing users or create new ones.
          </Typography.Text>
          <Upload
            accept=".csv"
            maxCount={1}
            fileList={fileList}
            beforeUpload={(file) => {
              setFileList([{ uid: file.name, name: file.name, status: 'done', originFileObj: file }]);
              setValidationError(null);
              return false; // prevent auto upload
            }}
            onRemove={() => {
              setFileList([]);
              setValidationError(null);
            }}
          >
            <Button icon={<UploadOutlined />}>Select CSV</Button>
          </Upload>
          {validationError && validationError.errors.length > 0 && (
            <Alert
              type="warning"
              showIcon
              icon={<ExclamationCircleOutlined />}
              message={
                validationError.errors.length === 1
                  ? '1 row needs attention'
                  : `${validationError.errors.length} rows need attention`
              }
              description={
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    Fix the rows below in your CSV. Then select your updated file and click Upload again. Row numbers match your file (row 2 = first data row).
                  </Typography.Text>
                  <Table
                    size="small"
                    dataSource={validationError.errors.map((e, i) => ({ ...e, key: i }))}
                    pagination={false}
                    scroll={{ y: 220 }}
                    columns={[
                      {
                        title: 'Row',
                        dataIndex: 'row',
                        key: 'row',
                        width: 64,
                        render: (row: number) => (
                          <Typography.Text strong>Row {row}</Typography.Text>
                        ),
                      },
                      {
                        title: 'Issue',
                        key: 'issue',
                        render: (_: unknown, record: BulkUploadValidationError) => (
                          <Space direction="vertical" size={2}>
                            <Tag color="orange">{getFriendlyErrorLabel(record.code)}</Tag>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {record.message}
                            </Typography.Text>
                          </Space>
                        ),
                      },
                      {
                        title: 'Details',
                        key: 'details',
                        width: 180,
                        render: (_: unknown, record: BulkUploadValidationError) => {
                          const parts = [
                            record.email && `Email: ${record.email}`,
                            record.phone && `Phone: ${record.phone}`,
                            record.profileId && `ID: ${record.profileId.slice(0, 12)}…`,
                          ].filter(Boolean);
                          return (
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {parts.length > 0 ? parts.join(' · ') : '—'}
                            </Typography.Text>
                          );
                        },
                      },
                    ]}
                  />
                </Space>
              }
            />
          )}
          {validationError && validationError.errors.length === 0 && (
            <Alert
              type="error"
              showIcon
              message="Upload could not be completed"
              description={validationError.message}
            />
          )}
        </Space>
      </Modal>
    </div>
  );
};

export { UsersPage };


