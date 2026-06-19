import React, { useState } from 'react';
import {
  Button,
  Table,
  Space,
  message,
  Popconfirm,
  Typography,
  Card,
  Tag,
  theme,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  useGetCourseMembersQuery,
  useRemoveMemberMutation,
} from '../../../services/coursesApi';
import type { CourseMember } from '../../../types/course';
import { Profile } from '../../../features/auth/authSlice';
import EnrollMemberModal from './EnrollMemberModal';

const { Title } = Typography;

interface CourseMembersTabProps {
  courseId: string;
}

const CourseMembersTab: React.FC<CourseMembersTabProps> = ({ courseId }) => {
  const { token } = theme.useToken();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const { data, isLoading, refetch } = useGetCourseMembersQuery({
    courseId,
    page,
    perPage,
  });
  const [removeMember] = useRemoveMemberMutation();

  const members = data?.data?.members || [];
  const metadata = data?.data?.metadata;

  const handleRemove = async (memberId: string) => {
    try {
      await removeMember({ courseId, memberId }).unwrap();
      message.success('Member removed successfully');
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to remove member');
    }
  };

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_: any, record: CourseMember) => {
        const user = record.userId as Profile;
        const userName =
          typeof user?.user === 'object' && user?.user !== null
            ? user.user.name
            : user?._id || 'Unknown';
        return <span>{userName}</span>;
      },
    },
    {
      title: 'Roles',
      key: 'roles',
      render: (_: any, record: CourseMember) => (
        <Space>
          {record.roles && record.roles.length > 0 ? (
            record.roles.map((roleId: string) => (
              <Tag key={roleId} color="blue">
                {roleId}
              </Tag>
            ))
          ) : (
            <span style={{ color: token.colorTextPlaceholder }}>No roles</span>
          )}
        </Space>
      ),
    },
    {
      title: 'Cohorts',
      key: 'cohorts',
      render: (_: any, record: CourseMember) => (
        <Space>
          {record.cohorts && record.cohorts.length > 0 ? (
            record.cohorts.map((cohortId: string) => (
              <Tag key={cohortId} color="green">
                {cohortId}
              </Tag>
            ))
          ) : (
            <span style={{ color: token.colorTextPlaceholder }}>No cohorts</span>
          )}
        </Space>
      ),
    },
    {
      title: 'Enrolled At',
      dataIndex: 'enrolledAt',
      key: 'enrolledAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: CourseMember) => (
        <Popconfirm
          title="Are you sure you want to remove this member?"
          onConfirm={() => handleRemove(record._id)}
          okText="Yes"
          cancelText="No"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            Remove
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Title level={4}>Course Members</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setEnrollModalOpen(true)}
          >
            Enroll Member
          </Button>
        </div>
        <EnrollMemberModal
          courseId={courseId}
          open={enrollModalOpen}
          onClose={() => setEnrollModalOpen(false)}
          onSuccess={() => {
            refetch();
            setEnrollModalOpen(false);
          }}
        />
        <Table
          columns={columns}
          dataSource={members}
          rowKey="_id"
          loading={isLoading}
          pagination={
            metadata
              ? {
                  current: page,
                  pageSize: perPage,
                  total: metadata.count,
                  onChange: (newPage, newPerPage) => {
                    setPage(newPage);
                    setPerPage(newPerPage);
                  },
                }
              : false
          }
        />
      </Space>
    </Card>
  );
};

export default CourseMembersTab;
