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
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  useGetCourseCohortsQuery,
  useDeleteCohortMutation,
} from '../../../services/coursesApi';
import type { Cohort } from '../../../types/course';
import CreateCohortModal from './CreateCohortModal';

const { Title } = Typography;

interface CourseCohortsTabProps {
  courseId: string;
}

const CourseCohortsTab: React.FC<CourseCohortsTabProps> = ({ courseId }) => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { data, isLoading, refetch } = useGetCourseCohortsQuery(courseId);
  const [deleteCohort] = useDeleteCohortMutation();

  const cohorts = data?.data?.cohorts || [];

  const handleDelete = async (cohortId: string) => {
    try {
      await deleteCohort({ courseId, cohortId }).unwrap();
      message.success('Cohort deleted successfully');
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to delete cohort');
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Visibility',
      dataIndex: 'visibility',
      key: 'visibility',
      render: (visibility: string) => (
        <Tag color={visibility === 'public' ? 'blue' : 'default'}>
          {visibility}
        </Tag>
      ),
    },
    {
      title: 'Default Threads',
      key: 'defaultThreadAssignments',
      render: (_: any, record: Cohort) => (
        <span>{record.defaultThreadAssignments?.length || 0}</span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: any, record: Cohort) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              // TODO: Open edit cohort modal
              message.info('Edit cohort feature coming soon');
            }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this cohort?"
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
          <Title level={4}>Cohorts</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Cohort
          </Button>
        </div>
        <CreateCohortModal
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
          dataSource={cohorts}
          rowKey="_id"
          loading={isLoading}
          pagination={false}
        />
      </Space>
    </Card>
  );
};

export default CourseCohortsTab;
