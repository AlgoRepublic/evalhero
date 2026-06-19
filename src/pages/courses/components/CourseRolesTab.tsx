import React, { useState } from 'react';
import {
  Button,
  Table,
  Space,
  message,
  Popconfirm,
  Typography,
  Card,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  useGetCourseRolesQuery,
  useDeleteCourseRoleMutation,
} from '../../../services/coursesApi';
import type { CourseRole } from '../../../types/course';
import CreateCourseRoleModal from './CreateCourseRoleModal';

const { Title } = Typography;

interface CourseRolesTabProps {
  courseId: string;
}

const CourseRolesTab: React.FC<CourseRolesTabProps> = ({ courseId }) => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { data, isLoading, refetch } = useGetCourseRolesQuery(courseId);
  const [deleteRole] = useDeleteCourseRoleMutation();

  const roles = data?.data?.roles || [];

  const handleDelete = async (roleId: string) => {
    try {
      await deleteRole({ courseId, roleId }).unwrap();
      message.success('Role deleted successfully');
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to delete role');
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Parent Role',
      dataIndex: 'parentRoleId',
      key: 'parentRoleId',
      render: (parentId: string) => parentId || '-',
    },
    {
      title: 'Permissions',
      key: 'permissions',
      render: (_: any, record: CourseRole) => {
        const permCount = Object.values(record.permissions).filter(
          (v) => v === true
        ).length;
        return <span>{permCount} permissions</span>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: any, record: CourseRole) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              // TODO: Open edit role modal
              message.info('Edit role feature coming soon');
            }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this role?"
            onConfirm={() => handleDelete(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Title level={4}>Course Roles</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Role
          </Button>
        </div>
        <CreateCourseRoleModal
          courseId={courseId}
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            refetch();
            setCreateModalOpen(false);
          }}
        />
        <Table
          columns={columns}
          dataSource={roles}
          rowKey="_id"
          loading={isLoading}
          pagination={false}
        />
      </Space>
    </Card>
  );
};

export default CourseRolesTab;
