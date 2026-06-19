import React from 'react';
import { Table, Typography, Tag, Space, Button, Spin, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  useGetDraftVersionsQuery,
  useLockVersionMutation,
} from '../../../services/templateVersionApi';

const { Text } = Typography;

export const TemplateVersionsTable: React.FC = () => {
  const { id: templateId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isFetching, refetch } = useGetDraftVersionsQuery(
    { templateId: templateId! },
    { skip: !templateId }
  );
  const [lockVersion, { isLoading: locking }] = useLockVersionMutation();

  const handleLock = async (versionId: string) => {
    try {
      await lockVersion(versionId).unwrap();
      message.success('Version locked successfully');
      refetch();
    } catch (e: any) {
      message.error(e?.data?.message ?? 'Failed to lock version');
    }
  };

  const columns = [
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      width: '10%',
      render: (v: number) => <Text strong>v{v}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: '15%',
      render: (status: string) => (
        <Tag color={status === 'locked' ? 'green' : 'blue'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: '25%',
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Updated At',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: '25%',
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '25%',
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="primary"
            onClick={() =>
              navigate(`/forms/templates/${templateId}/versions/${record._id}`)
            }
          >
            View
          </Button>
          {record.status !== 'locked' && (
            <Button
              danger
              loading={locking}
              onClick={() => handleLock(record._id)}
            >
              Lock
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {isFetching ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={data?.data ?? []}
          pagination={false}
        />
      )}
    </div>
  );
};
