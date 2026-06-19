import { useState, useCallback, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { PageHeader, ProtectedComponent } from '../../components';
import {
  FolderOpenOutlined,
  FolderAddOutlined,
  UploadOutlined,
  FileTextOutlined,
  DeleteOutlined,
  EditOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import {
  Button,
  Space,
  Card,
  Table,
  Typography,
  Grid,
  theme,
  Empty,
  Popconfirm,
  message,
  Tooltip,
  Tag,
  Segmented,
  Breadcrumb,
} from 'antd';
import type { BreadcrumbProps, TableColumnsType } from 'antd';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  KnowledgeBaseDocument,
  KnowledgeBaseFolder,
  useGetKnowledgeBaseFoldersQuery,
  useGetKnowledgeBaseDocumentsQuery,
  useGetKnowledgeBaseFolderQuery,
  useDeleteKnowledgeBaseDocumentMutation,
  useDeleteKnowledgeBaseFolderMutation,
  useMoveKnowledgeBaseDocumentToFolderMutation,
} from '../../services/knowledgeBaseApi';
import { useLazyGetAssetUrlQuery } from '../../services/assetsApi';
import { PATH_KNOWLEDGE_BASE } from '../../constants/routes';
import { usePermission } from '../../hooks/usePermission';
import { ResponsivePagination } from '../../components/ResponsivePagination';
import { MoveToFolderModal, UNCATEGORIZED_VALUE } from '../../components';
import CreateFolderModal from './CreateFolderModal';
import AddDocumentModal from './AddDocumentModal';
import EditDocumentModal from './EditDocumentModal';
import EditFolderModal from './EditFolderModal';
import { DocumentCard, DocumentPreview } from './components';

const { useBreakpoint } = Grid;
const { Text } = Typography;

type ViewMode = 'list' | 'folder';

export const KnowledgeBasePage = () => {
  const navigate = useNavigate();
  const { folderId } = useParams<{ folderId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { token } = theme.useToken();

  // Read state from URL params
  const viewMode: ViewMode = (searchParams.get('view') as ViewMode) || 'folder';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('perPage') || '10', 10);
  // Local document view mode (list/grid) - stored separately, defaults to 'list'
  const docViewMode = (searchParams.get('docView') as 'list' | 'grid') || 'list';

  // Helper to update URL params
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

  // Handler to change view mode
  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      // Reset page to 1 when view mode changes
      updateSearchParams({ view: mode === 'folder' ? null : mode, page: 1 });
    },
    [updateSearchParams]
  );

  // Handler to change document view mode (list/grid)
  const handleDocViewModeChange = useCallback(
    (mode: 'list' | 'grid') => {
      updateSearchParams({ docView: mode === 'list' ? null : mode });
    },
    [updateSearchParams]
  );

  // Handler to change pagination
  const handlePaginationChange = useCallback(
    (newPage: number, newPerPage: number) => {
      updateSearchParams({
        page: newPage === 1 ? null : newPage,
        perPage: newPerPage === 10 ? null : newPerPage,
      });
    },
    [updateSearchParams]
  );

  // Reset page when folder changes
  useEffect(() => {
    if (page !== 1) {
      updateSearchParams({ page: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  // Modal states
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [addDocumentOpen, setAddDocumentOpen] = useState(false);
  const [editDocumentId, setEditDocumentId] = useState<string | null>(null);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [moveDocumentRecord, setMoveDocumentRecord] = useState<KnowledgeBaseDocument | null>(null);
  const [previewDocument, setPreviewDocument] = useState<KnowledgeBaseDocument | null>(null);

  // Permissions
  const canEdit = usePermission('knowledgebase::edit');
  const canDelete = usePermission('knowledgebase::delete');

  // API calls
  const [deleteDocument] = useDeleteKnowledgeBaseDocumentMutation();
  const [deleteFolder] = useDeleteKnowledgeBaseFolderMutation();
  const [moveDocumentToFolder, { isLoading: moveLoading }] = useMoveKnowledgeBaseDocumentToFolderMutation();
  const [getAssetUrl] = useLazyGetAssetUrlQuery();

  // Fetch current folder details (if inside a folder)
  const { data: folderData, isLoading: loadingFolder } = useGetKnowledgeBaseFolderQuery(folderId!, {
    skip: !folderId,
  });
  const currentFolder = folderData?.data?.folder;

  // Fetch subfolders (or root folders if at root)
  const { data: foldersData, isLoading: loadingFolders } = useGetKnowledgeBaseFoldersQuery({
    parent: folderId || '', // '' = root folders, folderId = subfolders
    page: 1,
    perPage: 500,
    sortBy: 'name',
    order: 'asc',
  });
  const folders = foldersData?.data?.records ?? [];

  // Fetch all folders for move modal (only when modal is open)
  const { data: allFoldersData } = useGetKnowledgeBaseFoldersQuery(
    { page: 1, perPage: 500, sortBy: 'name', order: 'asc' },
    { skip: !moveDocumentRecord }
  );
  const kbFolderOptions = useMemo(() => {
    const options: Array<{ label: string; value: string }> = [
      { label: 'Uncategorized', value: UNCATEGORIZED_VALUE },
    ];
    const allFolders = allFoldersData?.data?.records ?? [];
    allFolders.forEach((f) => {
      const pathParts = f.parents?.map((p) => p.name) ?? [];
      pathParts.push(f.name);
      options.push({ label: pathParts.join(' / '), value: f._id });
    });
    return options;
  }, [allFoldersData]);

  // Determine if we should fetch all documents (list view at root)
  const isRootListView = !folderId && viewMode === 'list';

  // Fetch documents in current folder (or all/uncategorized at root)
  const { data: documentsData, isLoading: loadingDocs, isFetching: fetchingDocs } = useGetKnowledgeBaseDocumentsQuery({
    page,
    perPage,
    folder: folderId || undefined,
    all: isRootListView, // At root with list view, get all documents
    sortBy: 'createdAt',
    order: 'desc',
  });
  const documents = documentsData?.data?.records ?? [];
  const totalDocuments = documentsData?.data?.metadata?.count ?? 0;

  // Handlers
  const handleFolderClick = useCallback(
    (folder: KnowledgeBaseFolder) => {
      // Preserve perPage when navigating to subfolder, reset page
      const params = new URLSearchParams();
      if (perPage !== 10) {
        params.set('perPage', String(perPage));
      }
      const queryString = params.toString();
      navigate(
        PATH_KNOWLEDGE_BASE.folder(folder._id) + (queryString ? `?${queryString}` : '')
      );
    },
    [navigate, perPage]
  );

  const handleDeleteDocument = useCallback(
    async (id: string) => {
      try {
        await deleteDocument(id).unwrap();
        message.success('Document deleted');
      } catch {
        message.error('Failed to delete document');
      }
    },
    [deleteDocument]
  );

  const handleMoveDocumentToFolder = useCallback(
    async (folderId: string | null) => {
      if (!moveDocumentRecord) return;
      try {
        await moveDocumentToFolder({ id: moveDocumentRecord._id, folder: folderId }).unwrap();
        setMoveDocumentRecord(null);
      } catch {
        message.error('Failed to move document');
      }
    },
    [moveDocumentRecord, moveDocumentToFolder]
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

  const handleDownloadDocument = useCallback(
    async (doc: KnowledgeBaseDocument) => {
      if (!doc.filePath) {
        message.error('Document has no file path');
        return;
      }
      try {
        const result = await getAssetUrl(doc.filePath);
        const signedUrl = result.data;
        if (!signedUrl) {
          message.error('Could not get download URL');
          return;
        }
        const response = await fetch(signedUrl);
        if (!response.ok) {
          throw new Error('Download failed');
        }
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        const extension = doc.filePath?.split('.').pop() || '';
        const filename = extension ? `${doc.title}.${extension}` : doc.title;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      } catch {
        message.error('Failed to download document');
      }
    },
    [getAssetUrl]
  );

  // Helper to build path with perPage preserved
  const buildPathWithParams = useCallback(
    (basePath: string) => {
      const params = new URLSearchParams();
      if (perPage !== 10) {
        params.set('perPage', String(perPage));
      }
      const queryString = params.toString();
      return basePath + (queryString ? `?${queryString}` : '');
    },
    [perPage]
  );

  // Breadcrumb items
  const breadcrumbItems = useMemo(() => {
    const items: BreadcrumbProps['items'] = [
      {
        title: (
          <>
            <FolderOpenOutlined />
            <span>Knowledge Base</span>
          </>
        ),
        path: buildPathWithParams(PATH_KNOWLEDGE_BASE.root),
      },
    ];

    // Add parent folders from the parents array
    if (currentFolder?.parents) {
      currentFolder.parents.forEach((parent) => {
        items.push({
          title: (
            <>
              <span>{parent.name}</span>
            </>
          ),
          path: buildPathWithParams(PATH_KNOWLEDGE_BASE.folder(parent._id)),
        });
      });
    }

    // Add current folder
    if (currentFolder) {
      items.push(
        {
          title: currentFolder.name,
        }
      );
    }

    return items;
  }, [currentFolder, buildPathWithParams]);

  // Document table columns
  const documentColumns: TableColumnsType<KnowledgeBaseDocument> = useMemo(
    () => [
      {
        title: 'Title',
        dataIndex: 'title',
        key: 'title',
        render: (text: string) => (
          <Tooltip title={text} placement="topLeft">
            <Space size="small">
              <FileTextOutlined style={{ color: token.colorPrimary }} />
              <Text ellipsis style={{ fontSize: isMobile ? 13 : undefined }}>
                {text}
              </Text>
            </Space>
          </Tooltip>
        ),
      },
      {
        title: 'Tags',
        dataIndex: 'tags',
        key: 'tags',
        responsive: ['md'],
        render: (tags: KnowledgeBaseDocument['tags']) =>
          tags?.length ? (
            <Space size={[4, 4]} wrap>
              {tags.slice(0, 3).map((t) => (
                <Tag key={t._id} style={{ margin: 0 }} color='blue'>
                  {t.name}
                </Tag>
              ))}
              {tags.length > 3 && <Tag style={{ margin: 0 }}>+{tags.length - 3}</Tag>}
            </Space>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
      {
        title: 'Location',
        dataIndex: 'folder',
        key: 'location',
        responsive: ['lg'],
        render: (folder: KnowledgeBaseDocument['folder']) => {
          if (!folder) {
            return (
              <Tooltip
              title={
                <Breadcrumb
                  items={[{ title: ( <a
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(buildPathWithParams(PATH_KNOWLEDGE_BASE.root));
                    }}
                    style={{ color: 'rgba(255, 255, 255, 0.85)', cursor: 'pointer' }}
                  >
                    Knowledge Base
                  </a>), path: PATH_KNOWLEDGE_BASE.root }]}
                  separator={<span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>/</span>}
                />
              }
              styles={{ root: { maxWidth: 400 } }}
            >
              <Text
                type="secondary"
                ellipsis
                style={{ fontSize: isMobile ? 12 : undefined, maxWidth: 200, cursor: 'pointer' }}
              >
                Knowledge Base
              </Text>
            </Tooltip>
            );
          }
          // Build full path from parents array + current folder name
          const pathParts = folder.parents?.map((p) => p.name) || [];
          pathParts.push(folder.name);
          const fullPath = 'Knowledge Base / ' + pathParts.join(' / ');

          // Build breadcrumb items for tooltip
          const tooltipBreadcrumbItems: BreadcrumbProps['items'] = [
            {
              title: (
                <a
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(buildPathWithParams(PATH_KNOWLEDGE_BASE.root));
                  }}
                  style={{ color: 'rgba(255, 255, 255, 0.85)', cursor: 'pointer' }}
                >
                  Knowledge Base
                </a>
              ),
            },
          ];

          // Add parent folders
          folder.parents?.forEach((parent) => {
            tooltipBreadcrumbItems.push({
              title: (
                <a
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(buildPathWithParams(PATH_KNOWLEDGE_BASE.folder(parent._id)));
                  }}
                  style={{ color: 'rgba(255, 255, 255, 0.85)', cursor: 'pointer' }}
                >
                  {parent.name}
                </a>
              ),
            });
          });

          // Add current folder
          tooltipBreadcrumbItems.push({
            title: (
              <a
                onClick={(e) => {
                  e.preventDefault();
                  navigate(buildPathWithParams(PATH_KNOWLEDGE_BASE.folder(folder._id)));
                }}
                style={{ color: 'rgba(255, 255, 255, 0.85)', cursor: 'pointer' }}
              >
                {folder.name}
              </a>
            ),
          });

          return (
            <Tooltip
              title={
                <Breadcrumb
                  items={tooltipBreadcrumbItems}
                  separator={<span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>/</span>}
                />
              }
              styles={{ root: { maxWidth: 400 } }}
            >
              <Text
                type="secondary"
                ellipsis
                style={{ fontSize: isMobile ? 12 : undefined, maxWidth: 200, cursor: 'pointer' }}
              >
                {fullPath}
              </Text>
            </Tooltip>
          );
        },
      },
      {
        title: 'Actions',
        key: 'actions',
        width: isMobile ? '30%' : '40%',
        render: (_: unknown, record: KnowledgeBaseDocument) => (
          <Space
            size={isMobile ? 'small' : 'middle'}
            direction={isMobile ? 'vertical' : 'horizontal'}
            // wrap={!isMobile}
            style={{ width: isMobile ? '100%' : 'auto' }}
            align={isMobile ? 'start' : 'center'}
          >
            <Button
              type="primary"
              variant='solid'
              color='purple'
              size={isMobile ? 'small' : 'middle'}
              block={isMobile}
              onClick={() => handleDownloadDocument(record)}
              style={{ minWidth: isMobile ? 100 : 72 }}
            >
              Download
            </Button>
            {canEdit && (
              <Button
                size={isMobile ? 'small' : 'middle'}
                block={isMobile}
                variant="solid"
                color="magenta"
                onClick={() => setMoveDocumentRecord(record)}
                style={{ minWidth: isMobile ? 100 : 72 }}
              >
                Move
              </Button>
            )}
            {canEdit && (
              <Button
                type="primary"
                size={isMobile ? 'small' : 'middle'}
                block={isMobile}
                onClick={() => setEditDocumentId(record._id)}
                style={{ minWidth: isMobile ? 100 : 72 }}
              >
                Edit
              </Button>
            )}
            {canDelete && (
              <Popconfirm
                title="Delete this document?"
                onConfirm={() => handleDeleteDocument(record._id)}
              >
                <Button
                  type="primary"
                  danger
                  size={isMobile ? 'small' : 'middle'}
                  block={isMobile}
                  style={{ minWidth: isMobile ? 100 : 72 }}
                >
                  Delete
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ],
    [isMobile, canEdit, canDelete, handleDeleteDocument, handleDownloadDocument, buildPathWithParams, navigate, token.colorPrimary]
  );

  // Determine scope label
  const scopeLabel = folderId
    ? currentFolder?.name || 'Folder'
    : 'Root';

  const isLoading = loadingFolders || loadingDocs || (folderId && loadingFolder);
  const hasFolders = folders.length > 0;
  const hasDocuments = documents.length > 0;
  const isEmpty = !hasFolders && !hasDocuments;

  // Root level with list view
  const showListView = !folderId && viewMode === 'list';

  return (
    <>
      <Helmet>
        <title>Knowledge Base - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Knowledge Base"
        breadcrumbs={breadcrumbItems}
      />

      <div style={{ padding: isMobile ? token.paddingSM : token.paddingMD }}>
        {/* Breadcrumb (only when inside a folder) */}
        {/* {folderId && <Breadcrumb items={breadcrumbItems} style={{ marginBottom: 16 }} />} */}

        {/* Action bar */}
        <Space wrap size="middle" style={{ marginBottom: 16 }} align="center">
          {/* View toggle only at root level */}
          {!folderId && (
            <Segmented
              value={viewMode}
              onChange={(v) => handleViewModeChange((v as ViewMode) || 'folder')}
              options={[
                { label: 'Folders', value: 'folder' },
                { label: 'List', value: 'list' },
              ]}
            />
          )}

          {/* Scope indicator */}
          <Text type="secondary">
            Scope: <Text strong>{scopeLabel}</Text>
          </Text>

          {/* Action buttons */}
          <Space wrap size="small">
            <ProtectedComponent permission="knowledgebase::create">
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => setAddDocumentOpen(true)}
              >
                Upload Document
              </Button>
            </ProtectedComponent>
            <ProtectedComponent permission="knowledgebase::create">
              <Button icon={<FolderAddOutlined />} onClick={() => setCreateFolderOpen(true)}>
                Create Folder
              </Button>
            </ProtectedComponent>
          </Space>
        </Space>

        {/* Loading state */}
        {isLoading && isEmpty && <Card loading style={{ marginBottom: 16 }} />}

        {/* Empty state */}
        {!isLoading && isEmpty && (
          <Card>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size="small" align="center">
                  <Text type="secondary">
                    {folderId
                      ? `No subfolders or documents in "${currentFolder?.name || 'this folder'}"`
                      : 'No folders or documents yet'}
                  </Text>
                  <Space>
                    <ProtectedComponent permission="knowledgebase::create">
                      <Button icon={<UploadOutlined />} onClick={() => setAddDocumentOpen(true)}>
                        Upload Document
                      </Button>
                      <Button icon={<FolderAddOutlined />} onClick={() => setCreateFolderOpen(true)}>
                        Create Folder
                      </Button>
                    </ProtectedComponent>
                  </Space>
                </Space>
              }
            />
          </Card>
        )}

        {/* List View (root level only) */}
        {showListView && (
          <Card
            title={
              <Space>
                <InboxOutlined style={{ color: token.colorTextSecondary }} />
                <span>Documents</span>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ({totalDocuments})
                </Text>
              </Space>
            }
            loading={loadingDocs}
          >
            <Table<KnowledgeBaseDocument>
              scroll={{ x: true }}
              columns={documentColumns}
              dataSource={documents}
              rowKey="_id"
              pagination={false}
              loading={fetchingDocs}
              size={isMobile ? 'small' : 'middle'}
              locale={{ emptyText: 'No documents' }}
            />
            <div style={{ marginTop: isMobile ? token.marginSM : token.marginMD }}>
              <ResponsivePagination
                page={page}
                perPage={perPage}
                total={totalDocuments}
                onChange={handlePaginationChange}
                loading={fetchingDocs}
              />
            </div>
          </Card>
        )}

        {/* Folder View */}
        {!showListView && (
          <>
            {/* Folders Grid */}
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
                        style={{ fontSize: 32, color: token.colorPrimary, marginBottom: 8 }}
                      />
                      <div>
                        <Tooltip title={folder.name}>
                          <Text ellipsis style={{ display: 'block', fontWeight: 500 }}>
                            {folder.name}
                          </Text>
                        </Tooltip>
                        {folder.updatedAt && (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            Updated {new Date(folder.updatedAt).toLocaleDateString()}
                          </Text>
                        )}
                      </div>
                      {/* Folder action buttons */}
                      <Space
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                        }}
                        size={0}
                      >
                        {canEdit && (
                          <Tooltip title="Edit folder">
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
                          </Tooltip>
                        )}
                        {canDelete && (
                          <Popconfirm
                            title="Delete this folder?"
                            description="Documents in this folder will become uncategorized."
                            onConfirm={(e) => {
                              e?.stopPropagation();
                              handleDeleteFolder(folder._id);
                            }}
                            onCancel={(e) => e?.stopPropagation()}
                          >
                            <Tooltip title="Delete folder">
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </Tooltip>
                          </Popconfirm>
                        )}
                      </Space>
                    </Card>
                  ))}
                </div>
              </Card>
            )}

            {/* Documents Table with List/Grid toggle */}
            {(hasDocuments || totalDocuments > 0) && (
              <Card
                title={
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <FileTextOutlined style={{ color: token.colorPrimary }} />
                      <span>Documents</span>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ({totalDocuments})
                      </Text>
                    </Space>
                    <Segmented
                      value={docViewMode}
                      onChange={(v) => handleDocViewModeChange(v as 'list' | 'grid')}
                      options={[
                        { label: 'List', value: 'list' },
                        { label: 'Grid', value: 'grid' },
                      ]}
                      size="small"
                    />
                  </Space>
                }
                loading={loadingDocs}
              >
                {docViewMode === 'list' ? (
                  <Table<KnowledgeBaseDocument>
                    scroll={{ x: true }}
                    columns={documentColumns}
                    dataSource={documents}
                    rowKey="_id"
                    pagination={false}
                    loading={fetchingDocs}
                    size={isMobile ? 'small' : 'middle'}
                    locale={{ emptyText: 'No documents' }}
                    onRow={(record) => ({
                      onClick: () => setPreviewDocument(record),
                      style: { cursor: 'pointer' },
                    })}
                  />
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile
                        ? 'repeat(auto-fill, minmax(150px, 1fr))'
                        : 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: 16,
                    }}
                  >
                    {documents.map((doc) => (
                      <DocumentCard
                        key={doc._id}
                        document={doc}
                        onPreview={setPreviewDocument}
                        onDownload={handleDownloadDocument}
                        onEdit={(d) => setEditDocumentId(d._id)}
                        onMove={setMoveDocumentRecord}
                        onDelete={handleDeleteDocument}
                        token={token}
                      />
                    ))}
                  </div>
                )}
                {totalDocuments > 0 && (
                  <div style={{ marginTop: isMobile ? token.marginSM : token.marginMD }}>
                    <ResponsivePagination
                      page={page}
                      perPage={perPage}
                      total={totalDocuments}
                      onChange={handlePaginationChange}
                      loading={fetchingDocs}
                    />
                  </div>
                )}
              </Card>
            )}
          </>
        )}
      </div>

      {/* Create Folder Modal */}
      <CreateFolderModal
        open={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        parentId={folderId || null}
        onSuccess={() => {
          // Folder list will auto-refresh via RTK Query invalidation
        }}
      />

      {/* Add Document Modal */}
      <AddDocumentModal
        open={addDocumentOpen}
        onClose={() => setAddDocumentOpen(false)}
        currentFolderId={folderId || null}
        onCreateFolder={() => {
          setAddDocumentOpen(false);
          setCreateFolderOpen(true);
        }}
      />

      {/* Edit Document Modal */}
      <EditDocumentModal
        open={!!editDocumentId}
        documentId={editDocumentId}
        onClose={() => setEditDocumentId(null)}
        onCreateFolder={() => {
          setEditDocumentId(null);
          setCreateFolderOpen(true);
        }}
      />

      {/* Edit Folder Modal */}
      <EditFolderModal
        open={!!editFolderId}
        folderId={editFolderId}
        onClose={() => setEditFolderId(null)}
      />

      {/* Move Document Modal */}
      <MoveToFolderModal
        open={!!moveDocumentRecord}
        onClose={() => setMoveDocumentRecord(null)}
        title="Move document"
        itemName={moveDocumentRecord?.title ?? ''}
        folderOptions={kbFolderOptions}
        currentFolderId={moveDocumentRecord?.folder?._id ?? null}
        onMove={handleMoveDocumentToFolder}
        loading={moveLoading}
      />

      {/* Document Preview Drawer */}
      <DocumentPreview
        document={previewDocument}
        open={!!previewDocument}
        onClose={() => setPreviewDocument(null)}
        onDownload={previewDocument ? () => handleDownloadDocument(previewDocument) : undefined}
        onEdit={previewDocument ? () => {
          setPreviewDocument(null);
          setEditDocumentId(previewDocument._id);
        } : undefined}
        onMove={previewDocument ? () => {
          setPreviewDocument(null);
          setMoveDocumentRecord(previewDocument);
        } : undefined}
        onDelete={previewDocument ? () => {
          const docToDelete = previewDocument;
          setPreviewDocument(null);
          handleDeleteDocument(docToDelete._id);
        } : undefined}
        isMobile={isMobile}
      />
    </>
  );
};
