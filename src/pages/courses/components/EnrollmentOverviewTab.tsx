import React from 'react';
import { Card, Space, Typography, Tag, Descriptions } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { CourseEnrollment, Course } from '../../../types/course';
import { Profile, User } from '../../../features/auth/authSlice';

const { Text } = Typography;

interface EnrollmentOverviewTabProps {
  enrollment: CourseEnrollment;
  courseTitle?: string;
  course?: Course;
}

const statusColors: Record<string, string> = {
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
  overdue: 'error',
  cancelled: 'warning',
};

const EnrollmentOverviewTab: React.FC<EnrollmentOverviewTabProps> = ({
  enrollment,
  courseTitle,
  course,
}) => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return dayjs(dateString).format('MMM DD, YY');
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return dayjs(dateString).format('MMM DD, YY [at] h:mm A');
  };

  const getEnrolleeName = (enrollee: Profile | string | { _id: string; user: User }) => {
    if (!enrollee) return 'No enrollee';
    if (typeof enrollee === 'string') return enrollee;
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

  const getEnrollerName = (enroller: Profile | string | { _id: string; user: User }) => {
    if (typeof enroller === 'string') return enroller;
    // Handle EnrollmentProfile (has user: User)
    if ('user' in enroller && typeof enroller.user === 'object' && enroller.user !== null) {
      return enroller.user.name || enroller.user.email || enroller.user.phone || enroller._id;
    }
    // Handle Profile (has user: string | User)
    if ('user' in enroller) {
      if (typeof enroller.user === 'string') return enroller.user;
      if (typeof enroller.user === 'object' && enroller.user !== null) {
        return enroller.user.name || enroller.user.email || enroller.user.phone || enroller._id;
      }
    }
    return enroller._id;
  };

  const enrolleeName = getEnrolleeName(enrollment.enrollee);
  const enrollerName = getEnrollerName(enrollment.enroller);

  // Format sequencing mode for display
  const getSequencingModeLabel = (mode?: string) => {
    if (!mode) return 'N/A';
    const modeMap: Record<string, string> = {
      linearStrict: 'Linear Strict',
      linearSoft: 'Linear Soft',
      clustered: 'Clustered',
    };
    return modeMap[mode] || mode;
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Descriptions
          title="Enrollment Information"
          bordered
          column={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 4 }}
        >
          <Descriptions.Item label="Status">
            <Tag color={statusColors[enrollment.status]}>
              {enrollment.status.replace('_', ' ').toUpperCase()}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Course">
            <Text strong>{courseTitle || 'Unknown Course'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Enrolled By">
            {enrollerName}
          </Descriptions.Item>
          <Descriptions.Item label="Start Date">
            {formatDate(enrollment.startDate)}
          </Descriptions.Item>
          <Descriptions.Item label="Due Date">
            {formatDate(enrollment.dueDate)}
          </Descriptions.Item>
          <Descriptions.Item label="End Date">
            {formatDate(enrollment.endDate)}
          </Descriptions.Item>
          <Descriptions.Item label="Completed At">
            {enrollment.completedAt
              ? formatDateTime(enrollment.completedAt)
              : 'N/A'}
          </Descriptions.Item>
          <Descriptions.Item label="Created At">
            {formatDateTime(enrollment.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Updated At">
            {formatDateTime(enrollment.updatedAt)}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {course && (
        <Card title="Course Sequencing" size="small">
          <Descriptions
            bordered
            column={{ xs: 1, sm: 2 }}
            size="small"
          >
            <Descriptions.Item label="Sequencing Enabled">
              <Tag color={course.sequencing?.enabled ? 'success' : 'default'}>
                {course.sequencing?.enabled ? 'Yes' : 'No'}
              </Tag>
            </Descriptions.Item>
            {course.sequencing?.enabled && (
              <>
                <Descriptions.Item label="Sequencing Mode">
                  <Tag color="blue">
                    {getSequencingModeLabel(course.sequencing?.mode)}
                  </Tag>
                </Descriptions.Item>
                {course.sequencing?.mode === 'linearSoft' && (
                  <Descriptions.Item label="Strict Mode">
                    <Tag color={course.sequencing?.strict ? 'orange' : 'green'}>
                      {course.sequencing?.strict ? 'Enabled' : 'Disabled'}
                    </Tag>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Allow Retake">
                  <Tag color={course.sequencing?.allowRetake ? 'success' : 'default'}>
                    {course.sequencing?.allowRetake ? 'Yes' : 'No'}
                  </Tag>
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
          {!course.sequencing?.enabled && (
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              All pages are unlocked with no sequencing restrictions.
            </Text>
          )}
          {course.sequencing?.enabled && course.sequencing?.mode === 'linearStrict' && (
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              Pages must be completed in strict sequential order. Each page must be completed before the next one unlocks.
            </Text>
          )}
          {course.sequencing?.enabled && course.sequencing?.mode === 'linearSoft' && (
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              {course.sequencing?.strict
                ? 'Pages can be previewed, but must be marked as completed sequentially. Users can visit any page but must complete them in order.'
                : 'Pages can be previewed and visited in any order. Users can skip pages and complete them flexibly.'}
            </Text>
          )}
        </Card>
      )}

      <Card title="Enrollee" size="small">
        {enrolleeName ? (
          <Tag icon={<UserOutlined />}>{enrolleeName}</Tag>
        ) : (
          <Text type="secondary">No enrollee</Text>
        )}
      </Card>

      {enrollment.instructions && (
        <Card title="Instructions" size="small">
          <Text>{enrollment.instructions}</Text>
        </Card>
      )}

      {enrollment.notes && (
        <Card title="Internal Notes" size="small">
          <Text>{enrollment.notes}</Text>
        </Card>
      )}
    </Space>
  );
};

export default EnrollmentOverviewTab;
