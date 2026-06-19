import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { PageHeader, ProtectedComponent } from '../../components';
import {
  FormOutlined,
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
  useGetFormTemplateFoldersQuery,
  useGetFormTemplateFolderQuery,
  useDeleteFormTemplateFolderMutation,
  type FormTemplateFolder,
} from '../../services/templatesAPI';
import { PATH_FORMS } from '../../constants/routes';
import { usePermission } from '../../hooks/usePermission';
import TemplatesTable from './components/TemplatesTable';
import CreateFormTemplateFolderModal from './components/CreateFormTemplateFolderModal';
import EditFormTemplateFolderModal from './components/EditFormTemplateFolderModal';

const { useBreakpoint } = Grid;
const { Text } = Typography;

type ViewMode = 'list' | 'folder';

const TemplatesPage = () => {
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

  // Reset page to 1 when folder changes (e.g. open a folder or go back). Don't run on initial mount so ?page=2 at root stays.
  const prevFolderIdRef = useRef<string | undefined>(undefined);
  const isInitialMount = useRef(true);
  useEffect(() => {
    const currentFolderId = folderId ?? undefined;
    const prev = prevFolderIdRef.current;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevFolderIdRef.current = currentFolderId;
      return;
    }
    prevFolderIdRef.current = currentFolderId;
    if (prev !== currentFolderId && page !== 1) {
      updateSearchParams({ page: null });
    }
  }, [folderId, page, updateSearchParams]);

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);

  const canEdit = usePermission('formtemplate::edit');
  const canDelete = usePermission('formtemplate::delete');
  const [deleteFolder] = useDeleteFormTemplateFolderMutation();

  const { data: folderData, isLoading: loadingFolder } =
    useGetFormTemplateFolderQuery(folderId!, {
      skip: !folderId,
    });
  const currentFolder = folderData?.data?.folder;

  const { data: foldersData, isLoading: loadingFolders } =
    useGetFormTemplateFoldersQuery({
      parent: folderId || '',
      page: 1,
      perPage: 500,
      sortBy: 'name',
      order: 'asc',
    });
  const folders = foldersData?.data?.records ?? [];

  const handleFolderClick = useCallback(
    (folder: FormTemplateFolder) => {
      const params = new URLSearchParams();
      if (perPage !== 10) params.set('perPage', String(perPage));
      const qs = params.toString();
      navigate(PATH_FORMS.templatesFolder(folder._id) + (qs ? `?${qs}` : ''));
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
            <FormOutlined />
            <span>Forms</span>
          </>
        ),
      },
      {
        title: (
          <a
            href={buildPathWithParams(PATH_FORMS.templates)}
            onClick={(e) => {
              e.preventDefault();
              navigate(buildPathWithParams(PATH_FORMS.templates));
            }}
          >
            Templates
          </a>
        ),
      },
    ];
    if (currentFolder?.parents) {
      currentFolder.parents.forEach((parent) => {
        items.push({
          title: (
            <a
              href={buildPathWithParams(PATH_FORMS.templatesFolder(parent._id))}
              onClick={(e) => {
                e.preventDefault();
                navigate(
                  buildPathWithParams(PATH_FORMS.templatesFolder(parent._id))
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
    } else if (items.length === 2) {
      items[1] = { title: 'Templates' };
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
        <title>Templates - Eval Hero</title>
      </Helmet>
      <PageHeader title="Templates" breadcrumbs={breadcrumbItems} />

      <div style={{ padding: isMobile ? token.paddingSM : token.paddingMD }}>
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
          <ProtectedComponent permission="formtemplate::create">
            <Button
              onClick={() =>
                navigate(PATH_FORMS.templates + '/add', {
                  state: { folderId: folderId || null },
                })
              }
              type="primary"
              style={{ marginBottom: 0, width: isMobile ? '100%' : undefined }}
            >
              Add Template
            </Button>
          </ProtectedComponent>
          <ProtectedComponent permission="formtemplate::create">
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
            description="No folders yet. Create a folder or add a template (uncategorized)."
            style={{ marginBottom: 16 }}
          />
        )}

        {viewMode === 'list' && (
          <TemplatesTable
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
                            description="Templates in this folder will become uncategorized."
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

            <TemplatesTable
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

      <CreateFormTemplateFolderModal
        open={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        parentId={folderId || null}
      />
      <EditFormTemplateFolderModal
        open={!!editFolderId}
        folderId={editFolderId}
        onClose={() => setEditFolderId(null)}
      />
    </>
  );
};

export { TemplatesPage };
