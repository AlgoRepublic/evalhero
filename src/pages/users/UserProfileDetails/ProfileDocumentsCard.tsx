import { Card, Table, Button, Space, Typography, Tag, Empty, Popconfirm, Spin } from 'antd';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import { PlusOutlined } from '@ant-design/icons';
import { ResponsivePagination } from '../../../components/ResponsivePagination';
import { ProtectedComponent } from '../../../components/ProtectedComponent';
import { PROFILE_DOCUMENT_TYPE_LABELS } from '../../../constants/profileDocument';
import type { ProfileDocumentRecord } from '../../../services/profileDocumentsApi';
import { DownloadDocumentButton } from './DownloadDocumentButton';
import dayjs from 'dayjs';

export interface ProfileDocumentsCardProps {
  profileId: string;
  /** When true, the user is managing their own profile; view/create/edit/delete are allowed without permission checks. */
  isOwnProfile?: boolean;
  records: ProfileDocumentRecord[];
  total: number;
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

export function ProfileDocumentsCard({
  records,
  isOwnProfile = false,
  total,
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
}: ProfileDocumentsCardProps) {
  const canEdit = isOwnProfile;
  const canDelete = isOwnProfile;
  const canCreate = isOwnProfile;
  const handleTableChange = (
    _pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<ProfileDocumentRecord> | SorterResult<ProfileDocumentRecord>[]
  ) => {
    if (!Array.isArray(sorter) && sorter.field && sorter.order) {
      onSortChange(String(sorter.field), sorter.order === 'ascend' ? 'asc' : 'desc');
    }
  };

  const columns: TableColumnsType<ProfileDocumentRecord> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: isMobile ? undefined : '22%',
      ellipsis: true,
      render: (title: string, record: ProfileDocumentRecord) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Typography.Text strong ellipsis>
            {title}
          </Typography.Text>
          {isMobile && (
            <Space size="small" wrap style={{ flexWrap: 'wrap' }}>
              <Tag color="blue" style={{ margin: 0 }}>
                {PROFILE_DOCUMENT_TYPE_LABELS[record.documentType] ?? record.documentType}
              </Tag>
              {record.expirationDate ? (
                <Tag color={record.isExpired ? 'red' : 'green'} style={{ margin: 0 }}>
                  {record.isExpired ? 'Expired' : 'Valid'} · {dayjs(record.expirationDate).format('MMM D, YYYY')}
                </Tag>
              ) : (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>—</Typography.Text>
              )}
            </Space>
          )}
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'documentType',
      key: 'documentType',
      width: '14%',
      responsive: ['md'],
      render: (type: string) => (
        <Tag color="blue">{PROFILE_DOCUMENT_TYPE_LABELS[type] ?? type}</Tag>
      ),
    },
    {
      title: 'File',
      key: 'file',
      width: '20%',
      responsive: ['md'],
      render: (_: unknown, record: ProfileDocumentRecord) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
          {record.file?.fileName ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: 'Expiration',
      dataIndex: 'expirationDate',
      key: 'expirationDate',
      width: '18%',
      responsive: ['md'],
      render: (_: unknown, record: ProfileDocumentRecord) => {
        if (!record.expirationDate) return <Typography.Text type="secondary">—</Typography.Text>;
        const isExpired = record.isExpired;
        return (
          <Tag color={isExpired ? 'red' : 'green'}>
            {isExpired ? 'Expired' : 'Valid'} · {dayjs(record.expirationDate).format('MMM D, YYYY')}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: isMobile ? 100 : 180,
      align: 'left' as const,
      fixed: 'right' as const,
      render: (_: unknown, record: ProfileDocumentRecord) => (
        <Space
          size={isMobile ? 'small' : 'middle'}
          direction={isMobile ? 'vertical' : 'horizontal'}
          style={{ width: isMobile ? '100%' : 'auto' }}
          align={isMobile ? 'start' : 'center'}
        >
          <DownloadDocumentButton documentKey={record.file.key} isMobile={isMobile} />
          {canEdit ? (
            <Button
              type="primary"
              size={isMobile ? 'small' : 'middle'}
              block={isMobile}
              style={{ minWidth: isMobile ? 80 : 80 }}
              onClick={() => onEdit(record)}
            >
              Edit
            </Button>
          ) : (
            <ProtectedComponent permission="profiledocument::edit">
              <Button
                type="primary"
                size={isMobile ? 'small' : 'middle'}
                block={isMobile}
                style={{ minWidth: isMobile ? 80 : 80 }}
                onClick={() => onEdit(record)}
              >
                Edit
              </Button>
            </ProtectedComponent>
          )}
          {canDelete ? (
            <Popconfirm
              title="Delete this document?"
              onConfirm={() => onDelete(record)}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="primary"
                danger
                size={isMobile ? 'small' : 'middle'}
                block={isMobile}
                loading={deletingId === record._id}
                style={{ minWidth: isMobile ? 80 : 80 }}
              >
                Delete
              </Button>
            </Popconfirm>
          ) : (
            <ProtectedComponent permission="profiledocument::delete">
              <Popconfirm
                title="Delete this document?"
                onConfirm={() => onDelete(record)}
                okText="Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
              >
                <Button
                  type="primary"
                  danger
                  size={isMobile ? 'small' : 'middle'}
                  block={isMobile}
                  loading={deletingId === record._id}
                  style={{ minWidth: isMobile ? 80 : 80 }}
                >
                  Delete
                </Button>
              </Popconfirm>
            </ProtectedComponent>
          )}
        </Space>
      ),
    },
  ];

  const uploadButton = (
    <Button type="primary" icon={<PlusOutlined />} onClick={onUploadClick}>
      Upload document
    </Button>
  );
  const uploadButtonSmall = (
    <Button type="primary" onClick={onUploadClick}>
      Upload document
    </Button>
  );

  return (
    <Card
      title="Profile documents"
      extra={
        canCreate ? (
          uploadButton
        ) : (
          <ProtectedComponent permission="profiledocument::create">
            {uploadButton}
          </ProtectedComponent>
        )
      }
    >
      {loading && records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin tip="Loading documents..." />
        </div>
      ) : records.length === 0 ? (
        <Empty
          description="No documents yet"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          {canCreate ? (
            uploadButtonSmall
          ) : (
            <ProtectedComponent permission="profiledocument::create">
              {uploadButtonSmall}
            </ProtectedComponent>
          )}
        </Empty>
      ) : (
        <>
          <Table<ProfileDocumentRecord>
            rowKey="_id"
            columns={columns}
            dataSource={records}
            loading={loading}
            pagination={false}
            onChange={handleTableChange}
            size={isMobile ? 'small' : 'middle'}
            scroll={{ x: 'max-content' }}
          />
          <div style={{ marginTop: isMobile ? token.marginSM : token.marginMD }}>
            <ResponsivePagination
              page={page}
              perPage={perPage}
              total={total}
              onChange={(p, size) => onPageChange(p, size)}
              loading={loading}
            />
          </div>
        </>
      )}
    </Card>
  );
}
