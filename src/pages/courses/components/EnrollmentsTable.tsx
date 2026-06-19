import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { TableColumnsType } from 'antd';
import {
  Button,
  message,
  Popconfirm,
  Space,
  Table,
  Typography,
  Tag,
  Select,
  Tooltip,
  theme,
  Row,
  Col,
  Grid,
  Card,
  Dropdown,
  Drawer,
  Empty,
  Modal,
} from 'antd';
import {
  MoreOutlined,
  EyeOutlined,
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  useGetCourseEnrollmentsQuery,
  useDeleteCourseEnrollmentMutation,
  useGetCoursesQuery,
} from '../../../services/coursesApi';
import type { CourseEnrollment, EnrollmentStatus } from '../../../types/course';
import { ResponsivePagination } from '../../../components/ResponsivePagination';
import { usePermission } from '../../../hooks/usePermission';
import { PATH_COURSES } from '../../../constants/routes';
import type { Profile, User } from '../../../features/auth/authSlice';

const STATUS_COLORS: Record<EnrollmentStatus, string> = {
  pending: 'orange',
  in_progress: 'processing',
  completed: 'success',
  overdue: 'error',
  cancelled: 'warning',
};

// Type for enrollee from API response (may have firstName/lastName directly)
type EnrolleeProfile = {
  firstName?: string;
  lastName?: string;
  email?: string;
  _id: string;
  user?: { name?: string; email?: string };
};

interface EnrollmentsTableProps {
  courseId?: string; // Optional - if provided, filters by course
  showCourseFilter?: boolean; // Show course filter dropdown
}

const { useBreakpoint } = Grid;
const { Text } = Typography;

const EnrollmentsTable: React.FC<EnrollmentsTableProps> = ({
  courseId: propCourseId,
  showCourseFilter = false,
}) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isTablet = !screens.lg;
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(
    propCourseId
  );
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const hasEditPermission = usePermission('course::edit');
  const hasDeletePermission = usePermission('course::delete');

  // Always fetch all courses to get enrollments from all of them
  const { data: coursesData, isLoading: loadingCourses } = useGetCoursesQuery({
    page: 1,
    perPage: 1000,
  });

  const courses = useMemo(
    () => coursesData?.data?.records || [],
    [coursesData?.data?.records]
  );

  // Determine the effective courseId to use
  const effectiveCourseId = propCourseId || selectedCourseId;

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [effectiveCourseId, statusFilter]);

  // Fetch enrollments - API supports listing all enrollments when courseId is not provided
  const { data, isFetching, refetch } = useGetCourseEnrollmentsQuery({
    courseId: effectiveCourseId,
    status: statusFilter,
    page,
    perPage,
  });

  const [deleteEnrollment] = useDeleteCourseEnrollmentMutation();

  const handleDelete = useCallback(
    async (enrollmentId: string, courseId: string) => {
      try {
        await deleteEnrollment({ enrollmentId, courseId }).unwrap();
        message.success('Enrolment deleted successfully');
        refetch();
      } catch (err: unknown) {
        const error = err as { data?: { message?: string } };
        message.error(error?.data?.message || 'Failed to delete enrolment');
      }
    },
    [deleteEnrollment, refetch]
  );

  const getEnrolleeName = useCallback(
    (enrollee: Profile | string | EnrolleeProfile) => {
      if (!enrollee) return 'No enrollee';
      if (typeof enrollee === 'string') {
        return enrollee;
      }
      // Handle API response format (firstName, lastName, email directly)
      if ('firstName' in enrollee || 'lastName' in enrollee) {
        return (
          `${enrollee.firstName || ''} ${enrollee.lastName || ''}`.trim() ||
          enrollee.email ||
          enrollee._id
        );
      }
      // Handle Profile type from authSlice (user.name, user.email, user.phone)
      const profile = enrollee as Profile;
      const user =
        typeof profile.user === 'object' ? (profile.user as User) : null;
      return user?.name || user?.email || user?.phone || profile._id;
    },
    []
  );

  const getCourseTitle = useCallback(
    (course: CourseEnrollment['course']) => {
      if (typeof course === 'string') {
        const courseObj = courses.find((c) => c._id === course);
        return courseObj?.title || course;
      }
      return course?.title || 'Unknown Course';
    },
    [courses]
  );

  const getCourseId = useCallback((enrollment: CourseEnrollment): string => {
    if (typeof enrollment.course === 'string') {
      return enrollment.course;
    }
    return enrollment.course?._id || '';
  }, []);

  const getEnrolleeContact = useCallback(
    (record: CourseEnrollment): string | undefined => {
      if (typeof record.enrollee !== 'object' || !record.enrollee)
        return undefined;
      if (
        'email' in record.enrollee &&
        typeof record.enrollee.email === 'string'
      ) {
        return record.enrollee.email;
      }
      if (
        'phone' in record.enrollee &&
        typeof record.enrollee.phone === 'string'
      ) {
        return record.enrollee.phone;
      }
      const profile = record.enrollee as Profile;
      if (profile.user && typeof profile.user === 'object') {
        const u = profile.user as User;
        return u.email ?? u.phone;
      }
      return undefined;
    },
    []
  );

  const formatDateRange = useCallback(
    (record: CourseEnrollment) => {
      const start = record.startDate ? dayjs(record.startDate) : null;
      const due = record.dueDate ? dayjs(record.dueDate) : null;
      if (start && due) {
        return isMobile
          ? `${start.format('MMM D')} – ${due.format('MMM D')}`
          : `${start.format('MMM DD')} – ${due.format('MMM DD, YYYY')}`;
      }
      if (start)
        return isMobile
          ? `from ${start.format('MMM D')}`
          : `from ${start.format('MMM DD, YYYY')}`;
      if (due)
        return isMobile
          ? `due ${due.format('MMM D')}`
          : `due ${due.format('MMM DD, YYYY')}`;
      return '—';
    },
    [isMobile]
  );

  // Active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (showCourseFilter && selectedCourseId) count++;
    if (statusFilter) count++;
    return count;
  }, [showCourseFilter, selectedCourseId, statusFilter]);

  const clearAllFilters = useCallback(() => {
    if (showCourseFilter) setSelectedCourseId(undefined);
    setStatusFilter(undefined);
  }, [showCourseFilter]);

  // Revamped columns: Enrollment (course + enrollee), Details (status + dates), Actions
  const columns: TableColumnsType<CourseEnrollment> = useMemo(
    () => [
      // Enrollment: course (when !propCourseId) + enrollee merged
      {
        key: 'enrollment',
        title: propCourseId ? 'Enrollee' : 'Enrollment',
        width: isMobile ? 140 : isTablet ? 200 : 260,
        ellipsis: true,
        sorter: propCourseId
          ? (a: CourseEnrollment, b: CourseEnrollment) =>
              getEnrolleeName(a.enrollee).localeCompare(
                getEnrolleeName(b.enrollee)
              )
          : (a: CourseEnrollment, b: CourseEnrollment) =>
              getCourseTitle(a.course).localeCompare(getCourseTitle(b.course)),
        render: (_: unknown, record: CourseEnrollment) => {
          const courseIdValue = getCourseId(record);
          const courseTitle = getCourseTitle(record.course);
          const enrolleeName = getEnrolleeName(record.enrollee);
          const enrolleeEmail = getEnrolleeContact(record);
          const tooltip = enrolleeEmail
            ? `${enrolleeName}\n${enrolleeEmail}`
            : enrolleeName;

          return (
            <Tooltip title={tooltip} placement="topLeft">
              <div
                style={{
                  width: '100%',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {!propCourseId && (
                  <Text
                    strong
                    ellipsis
                    style={{
                      cursor: 'pointer',
                      fontSize: isMobile ? 12 : 14,
                      color: token.colorPrimary,
                    }}
                    onClick={() => navigate(PATH_COURSES.detail(courseIdValue))}
                  >
                    {courseTitle}
                  </Text>
                )}
                <Text
                  strong={!!propCourseId}
                  ellipsis
                  style={{
                    fontSize: isMobile ? 11 : 13,
                    color: propCourseId ? undefined : token.colorTextSecondary,
                  }}
                >
                  {enrolleeName}
                </Text>
                {isMobile && (
                  <Tag
                    color={STATUS_COLORS[record.status]}
                    style={{ margin: 0, fontSize: 10, alignSelf: 'flex-start' }}
                  >
                    {record.status.replace('_', ' ').toUpperCase()}
                  </Tag>
                )}
              </div>
            </Tooltip>
          );
        },
      },
      // Details: status + dates (merged)
      {
        key: 'details',
        title: 'Details',
        width: isMobile ? 100 : isTablet ? 160 : 200,
        responsive: ['sm'],
        sorter: (a: CourseEnrollment, b: CourseEnrollment) => {
          const aDate = a.dueDate ? dayjs(a.dueDate).unix() : 0;
          const bDate = b.dueDate ? dayjs(b.dueDate).unix() : 0;
          return aDate - bDate;
        },
        render: (_: unknown, record: CourseEnrollment) => {
          const start = record.startDate ? dayjs(record.startDate) : null;
          const due = record.dueDate ? dayjs(record.dueDate) : null;
          const isOverdue =
            due && due.isBefore(dayjs()) && record.status !== 'completed';
          const range = formatDateRange(record);
          const tip = [
            start && `Start: ${start.format('MMM DD, YYYY HH:mm')}`,
            due && `Due: ${due.format('MMM DD, YYYY HH:mm')}`,
          ]
            .filter(Boolean)
            .join('\n');

          return (
            <Space direction="vertical" size={4} style={{ lineHeight: 1.2 }}>
              <Tag
                color={STATUS_COLORS[record.status]}
                style={{ margin: 0, fontSize: isMobile ? 10 : 11 }}
              >
                {record.status.replace('_', ' ').toUpperCase()}
              </Tag>
              <Tooltip title={tip || undefined}>
                <Text
                  type={isOverdue ? 'danger' : 'secondary'}
                  style={{
                    fontSize: isMobile ? 11 : 12,
                    fontWeight: isOverdue ? 600 : 400,
                  }}
                >
                  {range}
                </Text>
              </Tooltip>
            </Space>
          );
        },
      },
      // Actions
      {
        key: 'actions',
        title: 'Actions',
        width: isMobile ? 70 : 240,
        align: 'left' as const,
        fixed: 'right' as const,
        render: (_: unknown, record: CourseEnrollment) => {
          const courseIdValue = getCourseId(record);
          return (
            <Space
              size={isMobile ? 'small' : 'middle'}
              style={{ width: isMobile ? '100%' : 'auto' }}
              align={isMobile ? 'start' : 'center'}
            >
              <Button
                type="primary"
                size={isMobile ? 'small' : 'middle'}
                block={isMobile}
                onClick={() =>
                  navigate(PATH_COURSES.enrollmentView(record._id))
                }
                style={{ minWidth: isMobile ? 64 : 80 }}
              >
                View
              </Button>
              {hasEditPermission && (
                <Button
                  type="primary"
                  size={isMobile ? 'small' : 'middle'}
                  block={isMobile}
                  onClick={() =>
                    navigate(PATH_COURSES.enrollmentEdit(record._id))
                  }
                  style={{ minWidth: isMobile ? 64 : 80 }}
                >
                  Edit
                </Button>
              )}
              {hasDeletePermission && (
                <Popconfirm
                  title="Are you sure you want to delete this enrollment?"
                  onConfirm={() => handleDelete(record._id, courseIdValue)}
                >
                  <Button
                    type="primary"
                    danger
                    size={isMobile ? 'small' : 'middle'}
                    block={isMobile}
                    style={{ minWidth: isMobile ? 64 : 80 }}
                  >
                    Delete
                  </Button>
                </Popconfirm>
              )}
            </Space>
          );
        },
      },
    ],
    [
      isMobile,
      isTablet,
      propCourseId,
      navigate,
      hasEditPermission,
      hasDeletePermission,
      handleDelete,
      token,
      getCourseTitle,
      getEnrolleeName,
      getCourseId,
      getEnrolleeContact,
      formatDateRange,
    ]
  );

  const enrolments = data?.data?.enrolments?.records || [];
  const metadata = data?.data?.enrolments?.metadata;

  // Filter drawer content
  const filterDrawerContent = (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {showCourseFilter && (
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Course
          </Text>
          <Select
            placeholder="Filter by course"
            allowClear
            style={{ width: '100%' }}
            value={selectedCourseId}
            onChange={setSelectedCourseId}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={[
              { label: 'All Courses', value: undefined },
              ...courses.map((course) => ({
                value: course._id,
                label: course.title,
              })),
            ]}
          />
        </div>
      )}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Status
        </Text>
        <Select
          placeholder="Filter by status"
          allowClear
          style={{ width: '100%' }}
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
      </div>
      <Button
        block
        icon={<ClearOutlined />}
        onClick={() => {
          clearAllFilters();
          setFilterDrawerOpen(false);
        }}
      >
        Clear All Filters
      </Button>
    </Space>
  );

  // Mobile card actions dropdown items
  const getCardActions = (record: CourseEnrollment) => {
    const courseIdValue = getCourseId(record);
    const items: {
      key: string;
      icon: React.ReactNode;
      label: string;
      danger?: boolean;
      onClick: () => void;
    }[] = [
      {
        key: 'view',
        icon: <EyeOutlined />,
        label: 'View',
        onClick: () => navigate(PATH_COURSES.enrollmentView(record._id)),
      },
    ];
    if (hasEditPermission) {
      items.push({
        key: 'edit',
        icon: <EditOutlined />,
        label: 'Edit',
        onClick: () => navigate(PATH_COURSES.enrollmentEdit(record._id)),
      });
    }
    if (hasDeletePermission) {
      items.push({
        key: 'delete',
        icon: <DeleteOutlined />,
        label: 'Delete',
        danger: true,
        onClick: () => {
          Modal.confirm({
            title: 'Are you sure you want to delete this enrollment?',
            okText: 'Yes',
            okType: 'danger',
            cancelText: 'No',
            onOk: () => handleDelete(record._id, courseIdValue),
          });
        },
      });
    }
    return items;
  };

  return (
    <div style={{ padding: isMobile ? 0 : token.paddingMD }}>
      {/* Desktop filters */}
      {!isMobile && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {showCourseFilter && (
            <Col xs={24} sm={12} md={8} lg={8}>
              <Select
                placeholder="Filter by course"
                allowClear
                style={{ width: '100%' }}
                value={selectedCourseId}
                onChange={setSelectedCourseId}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                options={[
                  { label: 'All Courses', value: undefined },
                  ...courses.map((course) => ({
                    value: course._id,
                    label: course.title,
                  })),
                ]}
              />
            </Col>
          )}
          <Col xs={24} sm={12} md={8} lg={8}>
            <Select
              placeholder="Filter by status"
              allowClear
              style={{ width: '100%' }}
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
          </Col>
        </Row>
      )}

      {/* Mobile filter bar */}
      {isMobile && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <Button
            icon={<FilterOutlined />}
            onClick={() => setFilterDrawerOpen(true)}
            size="small"
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Button>
          {activeFilterCount > 0 && (
            <Button
              icon={<ClearOutlined />}
              size="small"
              onClick={clearAllFilters}
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Active filter chips (mobile) */}
      {isMobile && activeFilterCount > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          {showCourseFilter && selectedCourseId && (
            <Tag
              closable
              onClose={() => setSelectedCourseId(undefined)}
              color="blue"
            >
              {getCourseTitle(selectedCourseId)}
            </Tag>
          )}
          {statusFilter && (
            <Tag
              closable
              onClose={() => setStatusFilter(undefined)}
              color={STATUS_COLORS[statusFilter as EnrollmentStatus]}
            >
              {statusFilter.replace('_', ' ').toUpperCase()}
            </Tag>
          )}
        </div>
      )}

      {/* Filter drawer (mobile) */}
      <Drawer
        title="Filters"
        placement="bottom"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        height="auto"
        styles={{ body: { paddingBottom: 24 } }}
      >
        {filterDrawerContent}
      </Drawer>

      {/* Desktop table */}
      {!isMobile && (
        <Table<CourseEnrollment>
          scroll={{ x: isTablet ? 600 : 750 }}
          columns={columns}
          dataSource={enrolments}
          loading={isFetching || loadingCourses}
          rowKey="_id"
          pagination={false}
          size="middle"
          locale={{ emptyText: 'No enrollments found' }}
        />
      )}

      {/* Mobile card list */}
      {isMobile && (
        <div style={{ paddingBottom: 80 }}>
          {enrolments.length === 0 && !isFetching && !loadingCourses ? (
            <Empty description="No enrollments found" />
          ) : (
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {enrolments.map((record: CourseEnrollment) => {
                const courseTitle = getCourseTitle(record.course);
                const enrolleeName = getEnrolleeName(record.enrollee);
                const enrolleeContact = getEnrolleeContact(record);
                const range = formatDateRange(record);
                const due = record.dueDate ? dayjs(record.dueDate) : null;
                const isOverdue =
                  due && due.isBefore(dayjs()) && record.status !== 'completed';

                return (
                  <Card
                    key={record._id}
                    size="small"
                    styles={{ body: { padding: 12 } }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {showCourseFilter && (
                          <Text
                            strong
                            style={{
                              display: 'block',
                              fontSize: 12,
                              color: token.colorPrimary,
                              cursor: 'pointer',
                              marginBottom: 4,
                            }}
                            onClick={() =>
                              navigate(PATH_COURSES.detail(getCourseId(record)))
                            }
                            ellipsis
                          >
                            {courseTitle}
                          </Text>
                        )}
                        <Text strong style={{ display: 'block', fontSize: 14 }}>
                          {enrolleeName}
                        </Text>
                        {enrolleeContact && (
                          <Text
                            type="secondary"
                            style={{ display: 'block', fontSize: 12 }}
                            ellipsis
                          >
                            {enrolleeContact}
                          </Text>
                        )}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 8,
                            flexWrap: 'wrap',
                          }}
                        >
                          <Tag
                            color={STATUS_COLORS[record.status]}
                            style={{ margin: 0, fontSize: 11 }}
                          >
                            {record.status.replace('_', ' ').toUpperCase()}
                          </Tag>
                          <Text
                            type={isOverdue ? 'danger' : 'secondary'}
                            style={{
                              fontSize: 12,
                              fontWeight: isOverdue ? 600 : 400,
                            }}
                          >
                            {range}
                          </Text>
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Button
                          type="primary"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() =>
                            navigate(PATH_COURSES.enrollmentView(record._id))
                          }
                        />
                        <Dropdown
                          menu={{ items: getCardActions(record) }}
                          trigger={['click']}
                          placement="bottomRight"
                        >
                          <Button size="small" icon={<MoreOutlined />} />
                        </Dropdown>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </Space>
          )}
        </div>
      )}

      {/* Pagination */}
      {metadata && (
        <div style={{ marginTop: isMobile ? token.marginSM : token.marginMD }}>
          <ResponsivePagination
            page={page}
            perPage={perPage}
            total={metadata.count}
            onChange={(p, size) => {
              setPage(p);
              setPerPage(size);
            }}
            loading={isFetching || loadingCourses}
          />
        </div>
      )}
    </div>
  );
};

export default EnrollmentsTable;
