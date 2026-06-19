import React from 'react';
import {
  Card,
  Typography,
  Spin,
  Alert,
  Space,
  Progress,
  Table,
  Tag,
  Empty,
} from 'antd';
import {
  useGetCourseProgressQuery,
} from '../../../services/coursesApi';
import { ModuleStatus } from '../../../types/course';
import dayjs from 'dayjs';
import { STATUS_COLOR_MAP } from './EnrollmentProgressTab/constants';

const { Title, Text } = Typography;

interface CourseProgressTabProps {
  courseId: string;
  courseEnrolmentId: string;
}

const CourseProgressTab: React.FC<CourseProgressTabProps> = ({
  courseId,
  courseEnrolmentId,
}) => {
  const { data, isLoading, error } = useGetCourseProgressQuery({
    courseId,
    courseEnrolmentId,
  });

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="Failed to load progress"
        description={
          (error as any)?.data?.message || 'Please try again later'
        }
      />
    );
  }

  if (!data?.data?.progress) {
    return (
      <Empty description="No progress data available" />
    );
  }

  const progress = data.data.progress;

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) return `${minutes}m`;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const columns = [
    {
      title: 'Page',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: ModuleStatus) => (
        <Tag color={STATUS_COLOR_MAP[status] || 'default'}>
          {status.replace('-', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Unlocked',
      dataIndex: 'isUnlocked',
      key: 'isUnlocked',
      render: (isUnlocked: boolean) => (
        <Tag color={isUnlocked ? 'success' : 'default'}>
          {isUnlocked ? 'Yes' : 'No'}
        </Tag>
      ),
    },
    {
      title: 'Read',
      dataIndex: 'isRead',
      key: 'isRead',
      render: (isRead: boolean) => (
        <Tag color={isRead ? 'success' : 'default'}>
          {isRead ? 'Yes' : 'No'}
        </Tag>
      ),
    },
    {
      title: 'Time Spent',
      dataIndex: 'timeOnTask',
      key: 'timeOnTask',
      render: (seconds: number) => formatDuration(seconds),
    },
    {
      title: 'Forms',
      dataIndex: 'inlineForms',
      key: 'inlineForms',
      render: (forms: any[]) => {
        const filledCount = forms.filter((f) => f.isFilled).length;
        return `${filledCount}/${forms.length}`;
      },
    },
  ];

  const tableData = progress.pages.map((page) => ({
    key: page.pageId,
    title: page.title,
    order: page.orderIndex,
    status: page.status,
    isUnlocked: page.isUnlocked,
    isRead: page.isRead,
    timeOnTask: page.timeOnTask,
    inlineForms: page.inlineForms,
  })).sort((a, b) => a.order - b.order);

  const totalTimeSpent = progress.pages.reduce(
    (sum, page) => sum + page.timeOnTask,
    0
  );

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Title level={4}>Your Progress</Title>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text strong>Overall Completion: </Text>
            <Progress
              percent={progress.completionPercentage}
              status={progress.isCourseCompleted ? 'success' : 'active'}
            />
            <Text type="secondary">
              {progress.completedPages} of {progress.totalPages} pages completed
            </Text>
          </div>

          <div>
            <Text strong>Course Status: </Text>
            {progress.isCourseCompleted ? (
              <Tag color="success">Completed</Tag>
            ) : (
              <Tag color="processing">In Progress</Tag>
            )}
          </div>

          <div>
            <Text strong>Total Time Spent:</Text> {formatDuration(totalTimeSpent)}
          </div>
        </Space>
      </Card>

      <Card>
        <Title level={4}>Page Progress</Title>
        <Table
          columns={columns}
          dataSource={tableData}
          pagination={false}
          size="small"
        />
      </Card>

      {progress.pages.some((page) => page.inlineForms.length > 0) && (
        <Card>
          <Title level={4}>Form Submissions</Title>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {progress.pages.map((page) =>
              page.inlineForms.map((form) => (
                <Card key={`${page.pageId}-${form.formBlockId}`} size="small">
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div>
                      <Text strong>{page.title}</Text> - <Text>{form.formBlockId}</Text>
                    </div>
                    <div>
                      <Text>Status: </Text>
                      <Tag color={form.isFilled ? 'success' : 'default'}>
                        {form.isFilled ? 'Filled' : 'Not Filled'}
                      </Tag>
                      {form.score !== null && form.score !== undefined && (
                        <>
                          <Text> Score: </Text>
                          <Tag color={form.passed ? 'success' : 'default'}>
                            {form.score}%
                          </Tag>
                        </>
                      )}
                      {form.approvalRequired && (
                        <>
                          <Text> Approval: </Text>
                          <Tag
                            color={
                              form.approvalStatus === 'approved'
                                ? 'success'
                                : form.approvalStatus === 'rejected'
                                ? 'error'
                                : 'warning'
                            }
                          >
                            {form.approvalStatus}
                          </Tag>
                        </>
                      )}
                    </div>
                    {form.attempts > 0 && (
                      <Text type="secondary">
                        Attempts: {form.attempts}
                        {form.lastAttemptAt &&
                          ` (Last: ${dayjs(form.lastAttemptAt).format('MMM DD, YYYY')})`}
                      </Text>
                    )}
                  </Space>
                </Card>
              ))
            )}
          </Space>
        </Card>
      )}
    </Space>
  );
};

export default CourseProgressTab;
