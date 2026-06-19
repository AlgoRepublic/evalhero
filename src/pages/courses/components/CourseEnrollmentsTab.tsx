import React, { useMemo, useState } from 'react';
import {
  Button,
  Table,
  Space,
  message,
  Popconfirm,
  Typography,
  Card,
  Tag,
  Select,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  useGetCourseEnrollmentsQuery,
  useDeleteCourseEnrollmentMutation,
  useGetCourseQuery,
} from '../../../services/coursesApi';
import type { CourseEnrollment, EnrollmentStatus } from '../../../types/course';
import { useMediaQuery } from 'react-responsive';
import { useSelector } from 'react-redux';
import type { ColumnsType } from 'antd/es/table';
import { RootState } from '../../../store';
import { usePermission } from '../../../hooks/usePermission';
import CreateEnrollmentModal from './CreateEnrollmentModal';
import EditEnrollmentModal from './EditEnrollmentModal';
import { Profile } from '../../../features/auth/authSlice';
import { EnrollmentProfile } from '../../../types/course';

const { Title, Text } = Typography;

interface CourseEnrollmentsTabProps {
  courseId: string;
}

const statusColors: Record<EnrollmentStatus, string> = {
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
  overdue: 'error',
  cancelled: 'warning',
};

const CourseEnrollmentsTab: React.FC<CourseEnrollmentsTabProps> = ({
  courseId,
}) => {
  const isMobile = useMediaQuery({ maxWidth: 769 });
  const isTablet = useMediaQuery({ maxWidth: 992 });
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] =
    useState<CourseEnrollment | null>(null);

  const { data, isLoading, refetch } = useGetCourseEnrollmentsQuery({
    courseId,
    status: statusFilter,
  });
  const { data: courseData } = useGetCourseQuery(courseId);
  const [deleteEnrollment] = useDeleteCourseEnrollmentMutation();
  const { selectedProfile } = useSelector((state: RootState) => state.auth);
  const hasEditPermission = usePermission('course::edit');

  const enrollments: CourseEnrollment[] = data?.data?.enrolments?.records || [];
  const course = courseData?.data?.course;

  // Check if user can edit/delete enrollments (must be course creator and have permission)
  const canManageEnrollments = useMemo(() => {
    return course?.createdBy === selectedProfile?._id && hasEditPermission;
  }, [course?.createdBy, selectedProfile?._id, hasEditPermission]);

  interface ApiError {
    data?: {
      message?: string;
    };
  }

  const handleDelete = async (enrollmentId: string) => {
    try {
      await deleteEnrollment({ enrollmentId, courseId }).unwrap();
      message.success('Enrollment deleted successfully');
      refetch();
    } catch (err: unknown) {
      const apiError = err as ApiError;
      message.error(
        apiError?.data?.message || 'Failed to delete enrollment'
      );
    }
  };

  const handleEdit = (enrollment: CourseEnrollment) => {
    setSelectedEnrollment(enrollment);
    setEditModalOpen(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getEnrolleeName = (enrollee: Profile | string | EnrollmentProfile) => {
    if (!enrollee) return 'No enrollee';
    if (typeof enrollee === 'string') {
      return enrollee;
    }
    // Handle EnrollmentProfile (has user: User)
    if ('user' in enrollee && typeof enrollee.user === 'object' && enrollee.user !== null) {
      return enrollee.user.name || enrollee.user.email || enrollee.user.phone || enrollee._id;
    }
    // Handle Profile (has user: string | User)
    if ('user' in enrollee) {
      if (typeof enrollee.user === 'string') return enrollee.user;
      if (typeof enrollee.user === 'object' && enrollee.user !== null) {
        return enrollee.user.name || enrollee.user.email || enrollee.user.phone || enrollee._id;
      }
    }
    return enrollee._id;
  };

  const columns: ColumnsType<CourseEnrollment> = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: isMobile ? 100 : 120,
      filters: [
        { text: 'Pending', value: 'pending' },
        { text: 'In Progress', value: 'in_progress' },
        { text: 'Completed', value: 'completed' },
        { text: 'Overdue', value: 'overdue' },
        { text: 'Cancelled', value: 'cancelled' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: EnrollmentStatus) => (
        <Tag color={statusColors[status]}>
          {status.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Enrollee',
      key: 'enrollee',
      width: isMobile ? 150 : isTablet ? 200 : 250,
      ellipsis: isMobile,
      render: (_: unknown, record: CourseEnrollment) => {
        const enrolleeName = getEnrolleeName(record.enrollee);
        return (
          <Tooltip title={enrolleeName}>
            <Space>
              <UserOutlined />
              <Text>{enrolleeName}</Text>
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: 'Start Date',
      dataIndex: 'startDate',
      key: 'startDate',
      width: isTablet ? 120 : 150,
      responsive: ['md'],
      render: (date: string | null) => (
        <Text style={{ fontSize: isTablet ? 12 : 14 }}>
          {formatDate(date)}
        </Text>
      ),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: isTablet ? 120 : 150,
      responsive: ['md'],
      render: (date: string | null) => (
        <Text style={{ fontSize: isTablet ? 12 : 14 }}>
          {formatDate(date)}
        </Text>
      ),
    },
    {
      title: 'End Date',
      dataIndex: 'endDate',
      key: 'endDate',
      width: isTablet ? 120 : 150,
      responsive: ['md'],
      render: (date: string | null) => (
        <Text style={{ fontSize: isTablet ? 12 : 14 }}>
          {formatDate(date)}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: isMobile ? 100 : 200,
      fixed: 'right' as const,
      render: (_: unknown, record: CourseEnrollment) => (
        <Space
          size={isMobile ? 'small' : 'middle'}
          direction={isMobile ? 'vertical' : 'horizontal'}
          style={{ width: '100%' }}
        >
          {canManageEnrollments && (
            <>
              <Button
                type="primary"
                size={isMobile ? 'small' : 'middle'}
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
                style={{ width: isMobile ? '100%' : '80px' }}
              >
                Edit
              </Button>
              <Popconfirm
                title="Are you sure you want to delete this enrollment?"
                onConfirm={() => handleDelete(record._id)}
                okText="Yes"
                cancelText="No"
              >
                <Button
                  type="primary"
                  danger
                  size={isMobile ? 'small' : 'middle'}
                  icon={<DeleteOutlined />}
                  style={{ width: isMobile ? '100%' : '80px' }}
                >
                  Delete
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: isMobile ? 'wrap' : 'nowrap',
              gap: isMobile ? 12 : 0,
            }}
          >
            <Title level={4} style={{ margin: 0 }}>
              Course Enrollments
            </Title>
            <Space
              size="middle"
              style={{ flexWrap: isMobile ? 'wrap' : 'nowrap' }}
            >
              <Select
                placeholder="Filter by status"
                allowClear
                style={{ width: isMobile ? '100%' : 200 }}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { label: 'Pending', value: 'pending' },
                  { label: 'In Progress', value: 'in_progress' },
                  { label: 'Completed', value: 'completed' },
                  { label: 'Overdue', value: 'overdue' },
                  { label: 'Cancelled', value: 'cancelled' },
                ]}
              />
              {canManageEnrollments && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateModalOpen(true)}
                  size={isMobile ? 'small' : 'middle'}
                >
                  Create Enrollment
                </Button>
              )}
            </Space>
          </div>
          <Table
            columns={columns}
            dataSource={enrollments}
            rowKey="_id"
            loading={isLoading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} enrollments`,
            }}
            size={isMobile ? 'small' : 'middle'}
            scroll={{
              x: isMobile ? 'max-content' : isTablet ? 800 : 1000,
            }}
          />
        </Space>
      </Card>

      <CreateEnrollmentModal
        courseId={courseId}
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false);
          refetch();
        }}
      />

      <EditEnrollmentModal
        courseId={courseId}
        enrollment={selectedEnrollment}
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedEnrollment(null);
        }}
        onSuccess={() => {
          setEditModalOpen(false);
          setSelectedEnrollment(null);
          refetch();
        }}
      />
    </>
  );
};

export default CourseEnrollmentsTab;
