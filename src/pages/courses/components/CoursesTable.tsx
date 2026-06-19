import React, { useState, useMemo, useCallback } from 'react';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import {
  Button,
  Card,
  Dropdown,
  Empty,
  message,
  Popconfirm,
  Space,
  Table,
  Typography,
  Tag,
  theme,
  Tooltip,
  Breadcrumb,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  EyeOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  UndoOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
// import dayjs from 'dayjs';
import { useSelector } from 'react-redux';
import { FilterValue, SorterResult } from 'antd/es/table/interface';
import {
  useGetCoursesQuery,
  useGetCourseFoldersQuery,
  useDeleteCourseMutation,
  useUpdateCourseMutation,
  useEnrollMemberMutation,
  useMoveCourseToFolderMutation,
} from '../../../services/coursesApi';
import type { Course, CourseMember } from '../../../types/course';
import { ResponsivePagination } from '../../../components/ResponsivePagination';
import { usePermission } from '../../../hooks/usePermission';
import { RootState } from '../../../store';
import { PATH_COURSES } from '../../../constants/routes';
import {
  AssetImage,
  MoveToFolderModal,
  UNCATEGORIZED_VALUE,
} from '../../../components';

export interface CoursesTableProps {
  folderId?: string;
  all?: boolean;
  page?: number;
  perPage?: number;
  onPaginationChange?: (page: number, perPage: number) => void;
  showLocationColumn?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  published: 'success',
  archived: 'warning',
};
const VISIBILITY_COLORS: Record<string, string> = {
  open: 'blue',
  'invite-only': 'purple',
};
const ENROLLMENT_COLORS: Record<string, string> = {
  'auto-join': 'green',
  'request-join': 'orange',
  'invite-only': 'red',
};

const CoursesTable: React.FC<CoursesTableProps> = ({
  folderId,
  all = false,
  page: pageProp = 1,
  perPage: perPageProp = 10,
  onPaginationChange,
  showLocationColumn = false,
}) => {
  const { token } = theme.useToken();
  const isMobile = useMediaQuery({ maxWidth: 769 });
  const isTablet = useMediaQuery({ maxWidth: 992 });

  const [page, setPage] = useState(pageProp);
  const [perPage, setPerPage] = useState(perPageProp);
  const [sortBy, setSortBy] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [_enrollingCourseId, setEnrollingCourseId] = useState<string | null>(
    null
  );

  const effectivePage = onPaginationChange ? pageProp : page;
  const effectivePerPage = onPaginationChange ? perPageProp : perPage;

  const { data, isFetching } = useGetCoursesQuery({
    page: effectivePage,
    perPage: effectivePerPage,
    sortBy,
    order,
    folder: folderId || undefined,
    // When no folderId: default to "all" for backward compat; when folderId set: only this folder
    all: folderId ? undefined : all !== false ? true : undefined,
  });

  const handlePaginationChange = useCallback(
    (p: number, size: number) => {
      if (onPaginationChange) {
        onPaginationChange(p, size);
      } else {
        setPage(p);
        setPerPage(size);
      }
    },
    [onPaginationChange]
  );

  const buildPathWithParams = useCallback(
    (basePath: string) => {
      const params = new URLSearchParams();
      if (effectivePerPage !== 10)
        params.set('perPage', String(effectivePerPage));
      return basePath + (params.toString() ? `?${params.toString()}` : '');
    },
    [effectivePerPage]
  );

  const [deleteCourse] = useDeleteCourseMutation();
  const [updateCourse] = useUpdateCourseMutation();
  const [enrollMember] = useEnrollMemberMutation();
  const [moveCourseToFolder, { isLoading: moveLoading }] =
    useMoveCourseToFolderMutation();
  const [moveModalRecord, setMoveModalRecord] = useState<Course | null>(null);
  const navigate = useNavigate();
  const { selectedProfile } = useSelector((state: RootState) => state.auth);

  const { data: courseFoldersData } = useGetCourseFoldersQuery(
    { page: 1, perPage: 500, sortBy: 'name', order: 'asc' },
    { skip: !moveModalRecord }
  );
  const courseFolderOptions = useMemo(() => {
    const options: Array<{ label: string; value: string }> = [
      { label: 'Uncategorized', value: UNCATEGORIZED_VALUE },
    ];
    const folders = courseFoldersData?.data?.records ?? [];
    folders.forEach((f) => {
      const pathParts = f.parents?.map((p) => p.name) ?? [];
      pathParts.push(f.name);
      options.push({ label: pathParts.join(' / '), value: f._id });
    });
    return options;
  }, [courseFoldersData]);

  // Permission checks
  const hasEditPermission = usePermission('course::edit');
  const hasDeletePermission = usePermission('course::delete');
  const hasRestorePermission = usePermission('course::restore');
  const canView = usePermission('course::view');

  // Helper function to check if user can edit/delete/restore a course
  // User can edit/delete/restore if: course.createdBy === selectedProfile._id AND user has the permission
  const canEditCourse = useCallback(
    (course: Course) => {
      return course.createdBy === selectedProfile?._id && hasEditPermission;
    },
    [hasEditPermission, selectedProfile?._id]
  );

  const canDeleteCourse = useCallback(
    (course: Course) => {
      return course.createdBy === selectedProfile?._id && hasDeletePermission;
    },
    [hasDeletePermission, selectedProfile?._id]
  );

  const canRestoreCourse = useCallback(
    (course: Course) => {
      return course.createdBy === selectedProfile?._id && hasRestorePermission;
    },
    [hasRestorePermission, selectedProfile?._id]
  );

  const isCurrentUserMember = useCallback(
    (course: Course) => {
      if (!selectedProfile?._id || !course.members?.length) return false;
      return course.members.some((m: CourseMember) => {
        const uid =
          typeof m.userId === 'string'
            ? m.userId
            : (m.userId as { _id?: string })?._id;
        return uid === selectedProfile._id;
      });
    },
    [selectedProfile?._id]
  );

  // 🔹 Handlers
  const handleDelete = React.useCallback(
    async (id: string) => {
      try {
        await deleteCourse(id).unwrap();
        message.success('Course deleted successfully');
      } catch (err: unknown) {
        const error = err as { data?: { message?: string } };
        message.error(error?.data?.message || 'Failed to delete course');
      }
    },
    [deleteCourse]
  );

  const handleRestore = React.useCallback(
    async (id: string) => {
      try {
        await updateCourse({
          id,
          data: { restore: true },
        }).unwrap();
        message.success('Course restored successfully');
      } catch (err: unknown) {
        const error = err as { data?: { message?: string } };
        message.error(error?.data?.message || 'Failed to restore course');
      }
    },
    [updateCourse]
  );

  const handleEnroll = React.useCallback(
    async (courseId: string) => {
      if (!selectedProfile?._id) {
        message.error('You must be signed in to enroll');
        return;
      }
      setEnrollingCourseId(courseId);
      try {
        await enrollMember({
          courseId,
          userId: selectedProfile._id,
        }).unwrap();
        message.success('Enrolled in course successfully');
      } catch (err: unknown) {
        const error = err as { data?: { message?: string } };
        message.error(error?.data?.message || 'Failed to enroll in course');
      } finally {
        setEnrollingCourseId(null);
      }
    },
    [enrollMember, selectedProfile?._id]
  );

  const handleMoveToFolder = useCallback(
    async (folderId: string | null) => {
      if (!moveModalRecord) return;
      await moveCourseToFolder({
        id: moveModalRecord._id,
        folder: folderId,
      }).unwrap();
      setMoveModalRecord(null);
    },
    [moveModalRecord, moveCourseToFolder]
  );

  const handleTableChange = useCallback(
    (
      _pagination: TablePaginationConfig,
      _filters: Record<string, FilterValue | null>,
      sorter: SorterResult<Course> | SorterResult<Course>[]
    ) => {
      if (!Array.isArray(sorter) && sorter.field && sorter.order) {
        setSortBy(sorter.field as string);
        setOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
      } else {
        setSortBy('createdAt');
        setOrder('desc');
      }
    },
    []
  );

  // 🔹 Table Columns (revamped: merged similar columns)
  const columns: TableColumnsType<Course> = useMemo(() => {
    const imageSize = isMobile
      ? { width: 40, height: 30 }
      : { width: 56, height: 36 };

    return [
      // Course: cover + title (merged)
      {
        title: 'Course',
        key: 'course',
        sorter: (a: Course, b: Course) => a.title.localeCompare(b.title),
        width: isMobile ? 160 : isTablet ? '30%' : '28%',
        ellipsis: true,
        render: (_: unknown, record: Course) => {
          const cover = record.coverImage;
          return (
            <Space
              size={isMobile ? 8 : 12}
              align="center"
              style={{ width: '100%', minWidth: 0 }}
              wrap={isMobile}
            >
              {cover ? (
                <AssetImage
                  src={cover}
                  alt=""
                  {...imageSize}
                  style={{ objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                  preview={false}
                />
              ) : (
                <div
                  style={{
                    ...imageSize,
                    flexShrink: 0,
                    backgroundColor: token.colorFillTertiary,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{ fontSize: 9, color: token.colorTextPlaceholder }}
                  >
                    —
                  </span>
                </div>
              )}
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <Typography.Text
                  strong
                  ellipsis
                  style={{
                    cursor: 'pointer',
                    fontSize: isMobile ? 12 : 14,
                  }}
                  onClick={() => navigate(PATH_COURSES.detail(record._id))}
                >
                  {record.title}
                </Typography.Text>
                {isMobile && (
                  <Tag
                    color={STATUS_COLORS[record.status] || 'default'}
                    style={{ margin: 0, fontSize: 10, alignSelf: 'flex-start' }}
                  >
                    {record.status}
                  </Tag>
                )}
              </span>
            </Space>
          );
        },
      },
      // Details: status + visibility + enrollment (merged)
      {
        title: 'Details',
        key: 'details',
        width: isMobile ? 100 : isTablet ? 180 : 220,
        responsive: ['md'],
        render: (_: unknown, record: Course) => (
          <Space size={4} wrap style={{ lineHeight: 1.2 }}>
            <Tag
              color={STATUS_COLORS[record.status] || 'default'}
              style={{ margin: 0, fontSize: isMobile ? 10 : 11 }}
            >
              {record.status}
            </Tag>
            <Tag
              color={VISIBILITY_COLORS[record.visibility] || 'default'}
              style={{ margin: 0, fontSize: isMobile ? 10 : 11 }}
            >
              {record.visibility}
            </Tag>
            <Tag
              color={ENROLLMENT_COLORS[record.enrollmentPolicy] || 'default'}
              style={{ margin: 0, fontSize: isMobile ? 10 : 11 }}
            >
              {record.enrollmentPolicy}
            </Tag>
          </Space>
        ),
      },
      // Stats: members + pages (merged)
      {
        title: isMobile ? 'M·P' : 'Stats',
        key: 'stats',
        width: isMobile ? 56 : 72,
        align: 'center' as const,
        responsive: ['md'],
        render: (_: unknown, record: Course) => {
          const members = record.members?.length ?? 0;
          const pages = record.pages?.length ?? 0;
          return (
            <Tooltip title={`${members} members · ${pages} pages`}>
              <span
                style={{
                  fontSize: isMobile ? 11 : 12,
                  color: token.colorTextSecondary,
                }}
              >
                {members} · {pages}
              </span>
            </Tooltip>
          );
        },
      },
      ...(showLocationColumn
        ? [
            {
              title: 'Location',
              key: 'location',
              responsive: ['lg'] as (
                | 'xs'
                | 'sm'
                | 'md'
                | 'lg'
                | 'xl'
                | 'xxl'
              )[],
              render: (_: unknown, record: Course) => {
                const folder = record.folder;
                if (!folder) {
                  return (
                    <Typography.Text
                      type="secondary"
                      ellipsis
                      style={{ maxWidth: 200, cursor: 'pointer' }}
                      onClick={() =>
                        navigate(buildPathWithParams(PATH_COURSES.courses))
                      }
                    >
                      Uncategorized
                    </Typography.Text>
                  );
                }
                const pathParts = folder.parents?.map((p) => p.name) || [];
                pathParts.push(folder.name);
                const fullPath = pathParts.join(' / ');
                return (
                  <Tooltip
                    title={
                      <Breadcrumb
                        items={[
                          ...(folder.parents?.map((p) => ({
                            title: (
                              <a
                                key={p._id}
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigate(
                                    buildPathWithParams(
                                      PATH_COURSES.coursesFolder(p._id)
                                    )
                                  );
                                }}
                                style={{
                                  color: 'rgba(255,255,255,0.85)',
                                  cursor: 'pointer',
                                }}
                              >
                                {p.name}
                              </a>
                            ),
                          })) || []),
                          { title: folder.name },
                        ]}
                        separator="/"
                      />
                    }
                  >
                    <Typography.Text
                      type="secondary"
                      ellipsis
                      style={{ maxWidth: 200, cursor: 'pointer' }}
                      onClick={() =>
                        navigate(
                          buildPathWithParams(
                            PATH_COURSES.coursesFolder(folder._id)
                          )
                        )
                      }
                    >
                      {fullPath}
                    </Typography.Text>
                  </Tooltip>
                );
              },
            },
          ]
        : []),
      // Created
      // {
      //   title: 'Created',
      //   dataIndex: 'createdAt',
      //   key: 'createdAt',
      //   responsive: ['xl'],
      //   sorter: (a: Course, b: Course) =>
      //     dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      //   width: isTablet ? 100 : 120,
      //   render: (date: string) => (
      //     <span style={{ fontSize: isTablet ? 12 : 13, color: token.colorTextSecondary }}>
      //       {dayjs(date).format(isTablet ? 'MMM DD' : 'MMM DD, YYYY')}
      //     </span>
      //   ),
      // },
      // Actions
      {
        title: 'Actions',
        key: 'actions',
        width: isMobile ? 65 : 280,
        fixed: 'right' as const,
        render: (_: unknown, record: Course) => {
          const isDeleted = !!record.deletedAt;
          const canEdit = canEditCourse(record);
          const canDelete = canDeleteCourse(record);
          const canRestore = canRestoreCourse(record);
          // const isMember = isCurrentUserMember(record);
          // const canEnroll = canView && !isDeleted && record.status === 'published' && !isMember && selectedProfile?._id;

          return (
            <Space
              size={isMobile ? 'small' : 'middle'}
              direction={isMobile ? 'vertical' : 'horizontal'}
              style={{ width: '100%' }}
            >
              {canView && !isDeleted && (
                <Button
                  type="primary"
                  variant="solid"
                  color="purple"
                  size={isMobile ? 'small' : 'middle'}
                  onClick={() => navigate(PATH_COURSES.detail(record._id))}
                  style={{ width: isMobile ? '100%' : '70px' }}
                >
                  View
                </Button>
              )}
              {/* {canEnroll && (
                <Button
                  type="default"
                  size={isMobile ? 'small' : 'middle'}
                  loading={enrollingCourseId === record._id}
                  onClick={() => handleEnroll(record._id)}
                  style={{ width: isMobile ? '100%' : '70px' }}
                >
                  Enroll
                </Button>
              )} */}
              {canEdit && !isDeleted && (
                <Button
                  type="primary"
                  size={isMobile ? 'small' : 'middle'}
                  onClick={() => navigate(PATH_COURSES.edit(record._id))}
                  style={{ width: isMobile ? '100%' : '70px' }}
                >
                  Edit
                </Button>
              )}
              {canEdit && !isDeleted && (
                <Button
                  size={isMobile ? 'small' : 'middle'}
                  onClick={() => setMoveModalRecord(record)}
                  style={{ width: isMobile ? '100%' : '70px' }}
                  variant="solid"
                  color="magenta"
                >
                  Move
                </Button>
              )}
              {canDelete && !isDeleted && (
                <Popconfirm
                  title="Are you sure you want to delete this course?"
                  onConfirm={() => handleDelete(record._id)}
                >
                  <Button
                    type="primary"
                    danger
                    size={isMobile ? 'small' : 'middle'}
                    style={{ width: isMobile ? '100%' : '70px' }}
                  >
                    Delete
                  </Button>
                </Popconfirm>
              )}
              {canRestore && isDeleted && (
                <Popconfirm
                  title="Are you sure you want to restore this course?"
                  onConfirm={() => handleRestore(record._id)}
                >
                  <Button
                    type="primary"
                    variant="solid"
                    color="green"
                    size={isMobile ? 'small' : 'middle'}
                    style={{ width: isMobile ? '100%' : '70px' }}
                  >
                    Restore
                  </Button>
                </Popconfirm>
              )}
            </Space>
          );
        },
      },
    ];
  }, [
    navigate,
    canView,
    canEditCourse,
    canDeleteCourse,
    canRestoreCourse,
    handleDelete,
    handleRestore,
    handleEnroll,
    isCurrentUserMember,
    isMobile,
    isTablet,
    token,
    selectedProfile?._id,
    showLocationColumn,
    buildPathWithParams,
  ]);

  const courses = data?.data?.records || [];
  const metadata = data?.data?.metadata;

  const mobileCards = useMemo(() => {
    if (!isMobile || !courses.length) return null;
    return courses.map((course) => {
      const isDeleted = !!course.deletedAt;
      const canEdit = canEditCourse(course);
      const canDelete = canDeleteCourse(course);
      const canRestore = canRestoreCourse(course);
      const members = course.members?.length ?? 0;
      const pages = course.pages?.length ?? 0;
      const cover = course.coverImage;

      const dropdownItems: MenuProps['items'] = [];
      if (canEdit && !isDeleted) {
        dropdownItems.push({
          key: 'edit',
          icon: <EditOutlined />,
          label: 'Edit',
          onClick: () => navigate(PATH_COURSES.edit(course._id)),
        });
        dropdownItems.push({
          key: 'move',
          icon: <FolderOutlined />,
          label: 'Move',
          onClick: () => setMoveModalRecord(course),
        });
      }
      if (canDelete && !isDeleted) {
        dropdownItems.push({
          key: 'delete',
          icon: <DeleteOutlined />,
          label: (
            <Popconfirm
              title="Delete this course?"
              onConfirm={() => handleDelete(course._id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
              placement="topRight"
            >
              <span>Delete</span>
            </Popconfirm>
          ),
          danger: true,
          onClick: (e) => e?.domEvent?.stopPropagation?.(),
        });
      }
      if (canRestore && isDeleted) {
        dropdownItems.push({
          key: 'restore',
          icon: <UndoOutlined />,
          label: (
            <Popconfirm
              title="Restore this course?"
              onConfirm={() => handleRestore(course._id)}
              okText="Restore"
              placement="topRight"
            >
              <span>Restore</span>
            </Popconfirm>
          ),
          onClick: (e) => e?.domEvent?.stopPropagation?.(),
        });
      }

      return (
        <Card
          key={course._id}
          size="small"
          style={{ marginBottom: 8 }}
          styles={{ body: { padding: 12 } }}
        >
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            {cover ? (
              <AssetImage
                src={cover}
                alt=""
                width={56}
                height={40}
                style={{ objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                preview={false}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 40,
                  flexShrink: 0,
                  backgroundColor: token.colorFillTertiary,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{ fontSize: 9, color: token.colorTextPlaceholder }}
                >
                  —
                </span>
              </div>
            )}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <Typography.Text
                strong
                ellipsis
                style={{ cursor: 'pointer', fontSize: 13 }}
                onClick={() => navigate(PATH_COURSES.detail(course._id))}
              >
                {course.title}
              </Typography.Text>
              <Space size={4} wrap style={{ lineHeight: 1.2 }}>
                <Tag
                  color={STATUS_COLORS[course.status] || 'default'}
                  style={{ margin: 0, fontSize: 10 }}
                >
                  {course.status}
                </Tag>
                <Tag
                  color={VISIBILITY_COLORS[course.visibility] || 'default'}
                  style={{ margin: 0, fontSize: 10 }}
                >
                  {course.visibility}
                </Tag>
                <Tag
                  color={
                    ENROLLMENT_COLORS[course.enrollmentPolicy] || 'default'
                  }
                  style={{ margin: 0, fontSize: 10 }}
                >
                  {course.enrollmentPolicy}
                </Tag>
                {isDeleted && (
                  <Tag color="red" style={{ margin: 0, fontSize: 10 }}>
                    Deleted
                  </Tag>
                )}
              </Space>
              <span style={{ fontSize: 11, color: token.colorTextSecondary }}>
                {members} members · {pages} pages
              </span>
            </div>
            {dropdownItems.length > 0 && (
              <Dropdown menu={{ items: dropdownItems }} trigger={['click']}>
                <Button
                  type="text"
                  size="small"
                  icon={<MoreOutlined />}
                  style={{ flexShrink: 0 }}
                />
              </Dropdown>
            )}
          </div>
          {canView && !isDeleted && (
            <Button
              type="primary"
              variant="solid"
              color="purple"
              size="small"
              block
              icon={<EyeOutlined />}
              onClick={() => navigate(PATH_COURSES.detail(course._id))}
            >
              View
            </Button>
          )}
        </Card>
      );
    });
  }, [
    isMobile,
    courses,
    canEditCourse,
    canDeleteCourse,
    canRestoreCourse,
    canView,
    navigate,
    token,
    handleDelete,
    handleRestore,
    setMoveModalRecord,
  ]);

  return (
    <>
      {!isMobile && (
        <Table
          columns={columns}
          dataSource={courses}
          rowKey="_id"
          loading={isFetching}
          onChange={handleTableChange}
          pagination={false}
          size={isMobile ? 'small' : 'middle'}
          scroll={{
            x: isMobile ? 'max-content' : isTablet ? 700 : 900,
          }}
        />
      )}
      {isMobile && (
        <div style={{ paddingBottom: 80 }}>
          {courses.length === 0 && !isFetching ? (
            <Empty description="No courses" />
          ) : (
            mobileCards
          )}
        </div>
      )}
      {metadata && (
        <ResponsivePagination
          page={effectivePage}
          perPage={effectivePerPage}
          total={metadata.count}
          onChange={handlePaginationChange}
        />
      )}
      <MoveToFolderModal
        open={!!moveModalRecord}
        onClose={() => setMoveModalRecord(null)}
        title="Move course"
        itemName={moveModalRecord?.title ?? ''}
        folderOptions={courseFolderOptions}
        currentFolderId={moveModalRecord?.folder?._id ?? null}
        onMove={handleMoveToFolder}
        loading={moveLoading}
      />
    </>
  );
};

export default CoursesTable;
