import React, { useState, useMemo, useCallback } from 'react';
import type { TableColumnsType, TablePaginationConfig, MenuProps } from 'antd';
import {
  Button,
  Card,
  Dropdown,
  message,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Grid,
  theme,
  Breadcrumb,
} from 'antd';
import {
  MoreOutlined,
  EyeOutlined,
  DeleteOutlined,
  UndoOutlined,
  EditOutlined,
  SendOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { FilterValue, SorterResult } from 'antd/es/table/interface';
import {
  Template,
  useGetTemplatesQuery,
  useDeleteTemplateMutation,
  useUpdateTemplateMutation,
  useGetFormTemplateFoldersQuery,
  useMoveFormTemplateToFolderMutation,
} from '../../../services/templatesAPI';
import { ResponsivePagination } from '../../../components/ResponsivePagination';
import { MoveToFolderModal, UNCATEGORIZED_VALUE } from '../../../components';
import { useLazyGetUserInfoQuery } from '../../../services/authApi';
import { usePermission } from '../../../hooks/usePermission';
import { PATH_FORMS } from '../../../constants/routes';

const { useBreakpoint } = Grid;

export interface TemplatesTableProps {
  folderId?: string;
  all?: boolean;
  page?: number;
  perPage?: number;
  onPaginationChange?: (page: number, perPage: number) => void;
  showLocationColumn?: boolean;
}

const TemplatesTable: React.FC<TemplatesTableProps> = ({
  folderId,
  all = false,
  page: pageProp = 1,
  perPage: perPageProp = 10,
  onPaginationChange,
  showLocationColumn = false,
}) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { token } = theme.useToken();

  const [page, setPage] = useState(pageProp);
  const [perPage, setPerPage] = useState(perPageProp);
  const [sortBy, setSortBy] = useState('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const effectivePage = onPaginationChange ? pageProp : page;
  const effectivePerPage = onPaginationChange ? perPageProp : perPage;

  const { data, isFetching } = useGetTemplatesQuery({
    page: effectivePage,
    perPage: effectivePerPage,
    sortBy,
    order,
    folder: folderId || undefined,
    // When no folderId: default to "all" for backward compat; when folderId set: only this folder
    all: folderId ? undefined : all !== false ? true : undefined,
  });

  const [deleteTemplate] = useDeleteTemplateMutation();
  const [updateTemplate] = useUpdateTemplateMutation();
  const [moveToFolder, { isLoading: moveLoading }] =
    useMoveFormTemplateToFolderMutation();
  const [getUserInfo] = useLazyGetUserInfoQuery();
  const navigate = useNavigate();
  const [moveModalRecord, setMoveModalRecord] = useState<Template | null>(null);

  const { data: foldersData } = useGetFormTemplateFoldersQuery(
    { page: 1, perPage: 500, sortBy: 'name', order: 'asc' },
    { skip: !moveModalRecord }
  );
  const formTemplateFolderOptions = useMemo(() => {
    const options: Array<{ label: string; value: string }> = [
      { label: 'Uncategorized', value: UNCATEGORIZED_VALUE },
    ];
    const folders = foldersData?.data?.records ?? [];
    folders.forEach((f) => {
      const pathParts = f.parents?.map((p) => p.name) ?? [];
      pathParts.push(f.name);
      options.push({ label: pathParts.join(' / '), value: f._id });
    });
    return options;
  }, [foldersData]);

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

  // Permission checks
  const canEdit = usePermission('formtemplate::edit');
  const canDelete = usePermission('formtemplate::delete');
  const canRestore = usePermission('formtemplate::restore');
  const canQuickSubmit = usePermission('formtemplate::quicksubmit');

  // 🔹 Handlers
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteTemplate(id).unwrap();
        getUserInfo();
        message.success('Template deleted successfully');
      } catch (err) {
        message.error('Failed to delete template');
      }
    },
    [deleteTemplate, getUserInfo]
  );

  const handleRestore = useCallback(
    async (record: Template) => {
      try {
        await updateTemplate({
          id: record._id,
          body: {
            name: record.name,
            restore: true,
          },
        }).unwrap();
        getUserInfo();
        message.success('Template restored successfully');
      } catch {
        message.error('Failed to restore template');
      }
    },
    [updateTemplate, getUserInfo]
  );

  const handleMoveToFolder = useCallback(
    async (folderId: string | null) => {
      if (!moveModalRecord) return;
      await moveToFolder({
        id: moveModalRecord._id,
        folder: folderId,
      }).unwrap();
      setMoveModalRecord(null);
    },
    [moveModalRecord, moveToFolder]
  );

  const handleTableChange = useCallback(
    (
      _pagination: TablePaginationConfig,
      _filters: Record<string, FilterValue | null>,
      sorter: SorterResult<Template> | SorterResult<Template>[]
    ) => {
      if (!Array.isArray(sorter) && sorter.field && sorter.order) {
        setSortBy(sorter.field as string);
        setOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
      } else {
        setSortBy('name');
        setOrder('asc');
      }
    },
    []
  );

  // 🔹 Table Columns (responsive: xs / sm / md / lg per Ant Design)
  const columns: TableColumnsType<Template> = useMemo(
    () => [
      {
        title: 'Template Name',
        dataIndex: 'name',
        key: 'name',
        sorter: (a, b) => a.name.localeCompare(b.name),
        width: isMobile ? '70%' : '20%',
        render: (text: string, record: Template) => (
          <Tooltip title={text} placement="topLeft">
            <Typography.Text
              delete={!!record.deletedAt}
              type={record.deletedAt ? 'secondary' : undefined}
              style={{ fontSize: isMobile ? '13px' : undefined }}
              ellipsis
            >
              {text}
            </Typography.Text>
          </Tooltip>
        ),
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        sorter: (a, b) =>
          (a?.description ?? '').localeCompare(b?.description ?? ''),
        width: isMobile ? '30%' : '20%',
        responsive: ['md'],
        render: (text: string | undefined, record: Template) => (
          <Tooltip title={text || '-'} placement="topLeft">
            <Typography.Text
              delete={!!record.deletedAt}
              type={record.deletedAt ? 'secondary' : undefined}
              style={{ fontSize: isMobile ? '12px' : undefined }}
              // ellipsis
            >
              {text ?? '-'}
            </Typography.Text>
          </Tooltip>
        ),
      },
      {
        title: 'Quick Settings',
        dataIndex: 'configSets',
        key: 'configSets',
        sorter: (a, b) =>
          (a?.configSets?.length ?? 0) - (b?.configSets?.length ?? 0),
        width: '15%',
        align: 'center',
        responsive: ['md'],
        render: (configSets: Template['configSets']) => {
          const count = configSets?.length || 0;
          return (
            <Tag
              color="blue"
              style={{
                minWidth: 36,
                display: 'inline-flex',
                justifyContent: 'center',
                fontSize: isMobile ? '11px' : undefined,
                margin: 0,
              }}
            >
              {count}
            </Tag>
          );
        },
      },
      ...(showLocationColumn
        ? [
            {
              title: 'Location',
              dataIndex: 'folder',
              key: 'location',
              responsive: ['lg'] as (
                | 'xs'
                | 'sm'
                | 'md'
                | 'lg'
                | 'xl'
                | 'xxl'
              )[],
              render: (folder: Template['folder']) => {
                if (!folder) {
                  return (
                    <Typography.Text
                      type="secondary"
                      ellipsis
                      style={{ maxWidth: 200, cursor: 'pointer' }}
                      onClick={() =>
                        navigate(buildPathWithParams(PATH_FORMS.templates))
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
                                      PATH_FORMS.templatesFolder(p._id)
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
                            PATH_FORMS.templatesFolder(folder._id)
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
      // {
      //   title: 'Created At',
      //   dataIndex: 'createdAt',
      //   key: 'createdAt',
      //   sorter: (a, b) =>
      //     new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      //   sortDirections: ['descend', 'ascend'],
      //   width: '16%',
      //   responsive: ['lg'] as const,
      //   render: (createdAt: string, record: Template) => {
      //     const formatted = dayjs(createdAt).format('MMM D, YYYY, h:mm A');
      //     return (
      //       <Typography.Text
      //         delete={!!record.deletedAt}
      //         type={record.deletedAt ? 'secondary' : undefined}
      //         style={{ fontSize: isMobile ? '12px' : undefined }}
      //       >
      //         {formatted}
      //       </Typography.Text>
      //     );
      //   },
      // },
      {
        title: 'Actions',
        dataIndex: 'operation',
        key: 'operation',
        width: isMobile ? 'auto' : '45%',
        render: (_: unknown, record: Template) => (
          <Space
            size={isMobile ? 'small' : 'middle'}
            direction={isMobile ? 'vertical' : 'horizontal'}
            wrap={!isMobile}
            style={{ width: isMobile ? '100%' : 'auto' }}
            align={isMobile ? 'start' : 'center'}
          >
            {record.deletedAt ? (
              canRestore && (
                <Popconfirm
                  title="Are you sure you want to restore this template?"
                  onConfirm={() => handleRestore(record)}
                >
                  <Button
                    type="primary"
                    variant="solid"
                    color="green"
                    size={isMobile ? 'small' : 'middle'}
                    block={isMobile}
                    style={{ minWidth: isMobile ? 100 : 80 }}
                  >
                    Restore
                  </Button>
                </Popconfirm>
              )
            ) : (
              <>
                {canQuickSubmit && (
                  <Button
                    type="primary"
                    variant="solid"
                    color="purple"
                    size={isMobile ? 'small' : 'middle'}
                    block={isMobile}
                    onClick={() =>
                      navigate(
                        `/forms/templates/${record._id}/quick-submission`
                      )
                    }
                    style={{ minWidth: isMobile ? 100 : 100 }}
                  >
                    Quick Submit
                  </Button>
                )}
                {canEdit && (
                  <Button
                    type="primary"
                    size={isMobile ? 'small' : 'middle'}
                    block={isMobile}
                    onClick={() =>
                      navigate(`/forms/templates/edit/${record._id}`)
                    }
                    style={{ minWidth: isMobile ? 100 : 70 }}
                  >
                    Edit
                  </Button>
                )}
                {canEdit && (
                  <Button
                    size={isMobile ? 'small' : 'middle'}
                    block={isMobile}
                    variant="solid"
                    color="magenta"
                    onClick={() => setMoveModalRecord(record)}
                    style={{ minWidth: isMobile ? 100 : 70 }}
                  >
                    Move
                  </Button>
                )}
                {canDelete && (
                  <Popconfirm
                    title="Are you sure you want to delete this template?"
                    onConfirm={() => handleDelete(record._id)}
                  >
                    <Button
                      type="primary"
                      danger
                      size={isMobile ? 'small' : 'middle'}
                      block={isMobile}
                      style={{ minWidth: isMobile ? 100 : 70 }}
                    >
                      Delete
                    </Button>
                  </Popconfirm>
                )}
              </>
            )}
          </Space>
        ),
      },
    ],
    [
      isMobile,
      canEdit,
      canDelete,
      canRestore,
      canQuickSubmit,
      navigate,
      handleDelete,
      handleRestore,
      showLocationColumn,
      buildPathWithParams,
    ]
  );

  const total = data?.data.metadata.count || 0;

  const getMobileDropdownItems = useCallback(
    (record: Template) => {
      const items: MenuProps['items'] = [];

      if (!record.deletedAt) {
        if (canEdit) {
          items.push({
            key: 'view',
            label: 'View',
            icon: <EyeOutlined />,
            onClick: () => navigate(`/forms/templates/${record._id}`),
          });
          items.push({
            key: 'edit',
            label: 'Edit',
            icon: <EditOutlined />,
            onClick: () => navigate(`/forms/templates/edit/${record._id}`),
          });
          items.push({
            key: 'move',
            label: 'Move',
            icon: <FolderOutlined />,
            onClick: () => setMoveModalRecord(record),
          });
        }
        if (canDelete) {
          items.push({
            key: 'delete',
            label: (
              <Popconfirm
                title="Delete this template?"
                onConfirm={() => handleDelete(record._id)}
                okText="Delete"
                okButtonProps={{ danger: true }}
                placement="topRight"
              >
                <span>Delete</span>
              </Popconfirm>
            ),
            icon: <DeleteOutlined />,
            danger: true,
            onClick: (e: { domEvent?: { stopPropagation: () => void } }) =>
              e?.domEvent?.stopPropagation?.(),
          });
        }
      } else {
        if (canRestore) {
          items.push({
            key: 'restore',
            label: (
              <Popconfirm
                title="Restore this template?"
                onConfirm={() => handleRestore(record)}
                okText="Restore"
                placement="topRight"
              >
                <span>Restore</span>
              </Popconfirm>
            ),
            icon: <UndoOutlined />,
            onClick: (e: { domEvent?: { stopPropagation: () => void } }) =>
              e?.domEvent?.stopPropagation?.(),
          });
        }
      }

      return items;
    },
    [canEdit, canDelete, canRestore, navigate, handleDelete, handleRestore]
  );

  return (
    <div style={{ padding: isMobile ? token.paddingSM : token.paddingMD }}>
      {!isMobile && (
        <Table<Template>
          scroll={{ x: true }}
          columns={columns}
          dataSource={data?.data.records}
          loading={isFetching}
          rowKey="_id"
          pagination={false}
          onChange={handleTableChange}
          size={isMobile ? 'small' : 'middle'}
          style={{ fontSize: isMobile ? '13px' : undefined }}
          locale={{
            emptyText: folderId
              ? 'No templates in this folder'
              : 'No templates yet',
          }}
          showSorterTooltip
        />
      )}

      {isMobile && (
        <div style={{ paddingBottom: 80 }}>
          {data?.data.records && data.data.records.length > 0 ? (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {data.data.records.map((record) => {
                const dropdownItems = getMobileDropdownItems(record);
                const configSetsCount = record.configSets?.length || 0;

                let locationText: string | null = null;
                if (showLocationColumn) {
                  if (!record.folder) {
                    locationText = 'Uncategorized';
                  } else {
                    const pathParts =
                      record.folder.parents?.map((p) => p.name) || [];
                    pathParts.push(record.folder.name);
                    locationText = pathParts.join(' / ');
                  }
                }

                return (
                  <Card
                    key={record._id}
                    size="small"
                    styles={{ body: { padding: '12px 16px' } }}
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
                        <Typography.Text
                          strong
                          delete={!!record.deletedAt}
                          type={record.deletedAt ? 'secondary' : undefined}
                          style={{ display: 'block', fontSize: 15 }}
                        >
                          {record.name}
                        </Typography.Text>

                        {record.description && (
                          <Typography.Text
                            type="secondary"
                            delete={!!record.deletedAt}
                            style={{
                              display: 'block',
                              fontSize: 13,
                              marginTop: 4,
                            }}
                            ellipsis
                          >
                            {record.description}
                          </Typography.Text>
                        )}

                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 6,
                            marginTop: 8,
                            alignItems: 'center',
                          }}
                        >
                          <Tag
                            color="blue"
                            style={{
                              minWidth: 36,
                              display: 'inline-flex',
                              justifyContent: 'center',
                              margin: 0,
                            }}
                          >
                            {configSetsCount}
                          </Tag>

                          {locationText && (
                            <Typography.Text
                              type="secondary"
                              style={{ fontSize: 12 }}
                              ellipsis
                            >
                              {locationText}
                            </Typography.Text>
                          )}

                          {record.deletedAt && (
                            <Tag color="red" style={{ margin: 0 }}>
                              Deleted
                            </Tag>
                          )}
                        </div>
                      </div>

                      {dropdownItems.length > 0 && (
                        <Dropdown
                          menu={{ items: dropdownItems }}
                          trigger={['click']}
                          placement="bottomRight"
                        >
                          <Button
                            type="text"
                            icon={<MoreOutlined />}
                            size="small"
                          />
                        </Dropdown>
                      )}
                    </div>

                    {!record.deletedAt && canQuickSubmit && (
                      <Button
                        type="primary"
                        variant="solid"
                        color="purple"
                        block
                        icon={<SendOutlined />}
                        onClick={() =>
                          navigate(
                            `/forms/templates/${record._id}/quick-submission`
                          )
                        }
                        style={{ marginTop: 12 }}
                      >
                        Quick Submit
                      </Button>
                    )}
                  </Card>
                );
              })}
            </Space>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 0',
                color: token.colorTextSecondary,
              }}
            >
              {folderId ? 'No templates in this folder' : 'No templates yet'}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: isMobile ? token.marginSM : token.marginMD }}>
        <ResponsivePagination
          page={effectivePage}
          perPage={effectivePerPage}
          total={total}
          onChange={handlePaginationChange}
          loading={isFetching}
        />
      </div>

      <MoveToFolderModal
        open={!!moveModalRecord}
        onClose={() => setMoveModalRecord(null)}
        title="Move template"
        itemName={moveModalRecord?.name ?? ''}
        folderOptions={formTemplateFolderOptions}
        currentFolderId={moveModalRecord?.folder?._id ?? null}
        onMove={handleMoveToFolder}
        loading={moveLoading}
      />
    </div>
  );
};

export default TemplatesTable;
