import { useState, useCallback, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { PageHeader, ProtectedComponent } from '../../components';
import {
  BookOutlined,
  FolderOpenOutlined,
  FolderAddOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons';
import {
  Button,
  Space,
  Card,
  Typography,
  Grid,
  theme,
  Empty,
  Popconfirm,
  message,
} from 'antd';
import type { BreadcrumbProps } from 'antd';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useGetCourseFoldersQuery,
  useGetCourseFolderQuery,
  useDeleteCourseFolderMutation,
} from '../../services/coursesApi';
import type { CourseFolder } from '../../types/course';
import { PATH_COURSES } from '../../constants/routes';
import { usePermission } from '../../hooks/usePermission';
import CoursesTable from './components/CoursesTable';
import CreateCourseFolderModal from './components/CreateCourseFolderModal';
import EditCourseFolderModal from './components/EditCourseFolderModal';

const { useBreakpoint } = Grid;
const { Text } = Typography;

type ViewMode = 'list' | 'folder';

const CoursesPage = () => {
  const navigate = useNavigate();
  const { folderId } = useParams<{ folderId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { token } = theme.useToken();

  const viewMode: ViewMode = (searchParams.get('view') as ViewMode) || 'folder';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('perPage') || '10', 10);

  const updateSearchParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        Object.entries(updates).forEach(([key, value]) => {
          if (value === null || value === undefined || value === '') {
            newParams.delete(key);
          } else {
            newParams.set(key, String(value));
          }
        });
        return newParams;
      });
    },
    [setSearchParams]
  );

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      updateSearchParams({ view: mode === 'folder' ? null : mode, page: 1 });
    },
    [updateSearchParams]
  );

  const handlePaginationChange = useCallback(
    (newPage: number, newPerPage: number) => {
      updateSearchParams({
        page: newPage === 1 ? null : newPage,
        perPage: newPerPage === 10 ? null : newPerPage,
      });
    },
    [updateSearchParams]
  );

  useEffect(() => {
    if (page !== 1) updateSearchParams({ page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);

  const canEdit = usePermission('course::edit');
  const canDelete = usePermission('course::delete');
  const [deleteFolder] = useDeleteCourseFolderMutation();

  const { data: folderData, isLoading: loadingFolder } =
    useGetCourseFolderQuery(folderId!, {
      skip: !folderId,
    });
  const currentFolder = folderData?.data?.folder;

  const { data: foldersData, isLoading: loadingFolders } =
    useGetCourseFoldersQuery({
      parent: folderId || '',
      page: 1,
      perPage: 500,
      sortBy: 'name',
      order: 'asc',
    });
  const folders = foldersData?.data?.records ?? [];

  const handleFolderClick = useCallback(
    (folder: CourseFolder) => {
      const params = new URLSearchParams();
      if (perPage !== 10) params.set('perPage', String(perPage));
      const qs = params.toString();
      navigate(PATH_COURSES.coursesFolder(folder._id) + (qs ? `?${qs}` : ''));
    },
    [navigate, perPage]
  );

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      try {
        await deleteFolder(id).unwrap();
        message.success('Folder deleted');
      } catch {
        message.error('Failed to delete folder');
      }
    },
    [deleteFolder]
  );

  const buildPathWithParams = useCallback(
    (basePath: string) => {
      const params = new URLSearchParams();
      if (perPage !== 10) params.set('perPage', String(perPage));
      return basePath + (params.toString() ? `?${params.toString()}` : '');
    },
    [perPage]
  );

  const breadcrumbItems = useMemo((): BreadcrumbProps['items'] => {
    const items: BreadcrumbProps['items'] = [
      {
        title: (
          <>
            <BookOutlined />
            <span>Courses</span>
          </>
        ),
      },
      {
        title: (
          <a
            href={buildPathWithParams(PATH_COURSES.courses)}
            onClick={(e) => {
              e.preventDefault();
              navigate(buildPathWithParams(PATH_COURSES.courses));
            }}
          >
            All Courses
          </a>
        ),
      },
    ];
    if (currentFolder?.parents) {
      currentFolder.parents.forEach((parent) => {
        items.push({
          title: (
            <a
              href={buildPathWithParams(PATH_COURSES.coursesFolder(parent._id))}
              onClick={(e) => {
                e.preventDefault();
                navigate(
                  buildPathWithParams(PATH_COURSES.coursesFolder(parent._id))
                );
              }}
            >
              {parent.name}
            </a>
          ),
        });
      });
    }
    if (currentFolder) {
      items.push({ title: currentFolder.name });
    }
    return items;
  }, [currentFolder, buildPathWithParams, navigate]);

  const scopeLabel = folderId ? currentFolder?.name || 'Folder' : 'Root';
  const isLoading = loadingFolders || (folderId && loadingFolder);
  const hasFolders = folders.length > 0;
  const isRootListView = !folderId && viewMode === 'list';

  return (
    <>
      <Helmet>
        <title>Courses - Eval Hero</title>
      </Helmet>
      <PageHeader title="Courses" breadcrumbs={breadcrumbItems} />

      <div style={{ padding: isMobile ? 0 : undefined }}>
        <Space
          wrap
          size="middle"
          style={{ marginBottom: 16, width: isMobile ? '100%' : undefined }}
          align="center"
          direction={isMobile ? 'vertical' : 'horizontal'}
        >
          {!folderId && (
            <Space.Compact>
              <Button
                type={viewMode === 'folder' ? 'primary' : 'default'}
                onClick={() => handleViewModeChange('folder')}
              >
                Folders
              </Button>
              <Button
                type={viewMode === 'list' ? 'primary' : 'default'}
                onClick={() => handleViewModeChange('list')}
              >
                List
              </Button>
            </Space.Compact>
          )}
          <Text type="secondary">
            Scope: <Text strong>{scopeLabel}</Text>
          </Text>
          <ProtectedComponent permission="course::create">
            <Button
              onClick={() =>
                navigate(PATH_COURSES.add, {
                  state: { folderId: folderId || null },
                })
              }
              type="primary"
              style={{ marginBottom: 0, width: isMobile ? '100%' : undefined }}
            >
              Create Course
            </Button>
          </ProtectedComponent>
          <ProtectedComponent permission="course::create">
            <Button
              icon={<FolderAddOutlined />}
              onClick={() => setCreateFolderOpen(true)}
              style={{ width: isMobile ? '100%' : undefined }}
            >
              Create Folder
            </Button>
          </ProtectedComponent>
        </Space>

        {isLoading && !hasFolders && (
          <Card loading style={{ marginBottom: 16 }} />
        )}

        {!isLoading && !folderId && !hasFolders && viewMode === 'folder' && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No folders yet. Create a folder or add a course (uncategorized)."
            style={{ marginBottom: 16 }}
          />
        )}

        {viewMode === 'list' && (
          <CoursesTable
            folderId={folderId}
            all={isRootListView}
            page={page}
            perPage={perPage}
            onPaginationChange={handlePaginationChange}
            showLocationColumn
          />
        )}

        {viewMode === 'folder' && (
          <>
            {hasFolders && (
              <Card
                title={
                  <Space>
                    <FolderOpenOutlined style={{ color: token.colorPrimary }} />
                    <span>Folders</span>
                  </Space>
                }
                style={{ marginBottom: 16 }}
                loading={loadingFolders}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile
                      ? 'repeat(auto-fill, minmax(140px, 1fr))'
                      : 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 12,
                  }}
                >
                  {folders.map((folder) => (
                    <Card
                      key={folder._id}
                      hoverable
                      onClick={() => handleFolderClick(folder)}
                      style={{
                        cursor: 'pointer',
                        textAlign: 'center',
                        border: `1px solid ${token.colorBorderSecondary}`,
                        position: 'relative',
                      }}
                      styles={{ body: { padding: isMobile ? 12 : 16 } }}
                    >
                      <FolderOpenOutlined
                        style={{
                          fontSize: 32,
                          color: token.colorPrimary,
                          marginBottom: 8,
                        }}
                      />
                      <div>
                        <Text
                          ellipsis
                          style={{ display: 'block', fontWeight: 500 }}
                        >
                          {folder.name}
                        </Text>
                      </div>
                      <Space
                        style={{ position: 'absolute', top: 4, right: 4 }}
                        size={0}
                      >
                        {canEdit && (
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            style={{ color: token.colorTextSecondary }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditFolderId(folder._id);
                            }}
                          />
                        )}
                        {canDelete && (
                          <Popconfirm
                            title="Delete this folder?"
                            description="Courses in this folder will become uncategorized."
                            onConfirm={(e) => {
                              e?.stopPropagation();
                              handleDeleteFolder(folder._id);
                            }}
                            onCancel={(e) => e?.stopPropagation()}
                          >
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Popconfirm>
                        )}
                      </Space>
                    </Card>
                  ))}
                </div>
              </Card>
            )}

            <CoursesTable
              folderId={folderId}
              all={false}
              page={page}
              perPage={perPage}
              onPaginationChange={handlePaginationChange}
              showLocationColumn={false}
            />
          </>
        )}
      </div>

      <CreateCourseFolderModal
        open={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        parentId={folderId || null}
      />
      <EditCourseFolderModal
        open={!!editFolderId}
        folderId={editFolderId}
        onClose={() => setEditFolderId(null)}
      />
    </>
  );
};

export { CoursesPage };
