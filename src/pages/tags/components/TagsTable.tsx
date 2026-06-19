import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { TableColumnsType, TablePaginationConfig, MenuProps } from 'antd';
import {
  Button,
  Card,
  Dropdown,
  Col,
  Grid,
  Input,
  message,
  Popconfirm,
  Row,
  Space,
  Table,
  Tag,
  theme,
  Typography,
} from 'antd';
import {
  MoreOutlined,
  EyeOutlined,
  DeleteOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { FilterValue, SorterResult } from 'antd/es/table/interface';
import {
  Tag as TagType,
  useGetTagsQuery,
  useDeleteTagMutation,
  useUpdateTagMutation,
} from '../../../services/tagsApi';
import { ResponsivePagination } from '../../../components/ResponsivePagination';
import { useLazyGetUserInfoQuery } from '../../../services/authApi';
import { usePermission } from '../../../hooks/usePermission';

const { useBreakpoint } = Grid;
const SEARCH_DEBOUNCE_MS = 500;

const TagsTable: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { token } = theme.useToken();
  // 🔹 Local state for pagination and sorting
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedSearch(searchTerm.trim()),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // 🔹 RTK Query hooks
  const { data, isFetching } = useGetTagsQuery({
    page,
    perPage,
    sortBy,
    order,
    ...(debouncedSearch && { name: debouncedSearch }),
  });

  const [deleteTag] = useDeleteTagMutation();
  const [updateTag] = useUpdateTagMutation();
  const [getUserInfo] = useLazyGetUserInfoQuery();
  const navigate = useNavigate();

  // Permission checks
  const canView = usePermission('tag::view');
  const canEdit = usePermission('tag::edit');
  const canDelete = usePermission('tag::delete');
  const canRestore = usePermission('tag::restore');

  // 🔹 Handlers
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteTag({ id }).unwrap();
        getUserInfo();
        message.success('Tag deleted successfully');
      } catch (err) {
        const errObj = err as { data?: { message?: string } };
        const errMsg = errObj.data?.message || 'Failed to delete tag';
        message.error(errMsg);
      }
    },
    [deleteTag, getUserInfo]
  );

  const handleRestore = useCallback(
    async (record: TagType) => {
      try {
        await updateTag({
          id: record._id,
          name: record.name,
          restore: true,
        }).unwrap();
        getUserInfo();
        message.success('Tag restored successfully');
      } catch (err) {
        const errObj = err as { data?: { message?: string } };
        const errMsg = errObj.data?.message || 'Failed to restore tag';
        message.error(errMsg);
      }
    },
    [updateTag, getUserInfo]
  );

  const handleTableChange = (
    _pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<TagType> | SorterResult<TagType>[]
  ) => {
    if (!Array.isArray(sorter) && sorter.field && sorter.order) {
      setSortBy(sorter.field as string);
      setOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
    } else {
      setSortBy('name');
      setOrder('asc');
    }
  };

  // 🔹 Table Columns (responsive: xs / sm / md / lg per Ant Design)
  const columns: TableColumnsType<TagType> = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        width: isMobile ? '50%' : '25%',
        sorter: true,
        // Always visible (no responsive)
        render: (text: string, record: TagType) => (
          <Typography.Text
            delete={!!record.deletedAt}
            type={record.deletedAt ? 'secondary' : undefined}
            style={{ fontSize: isMobile ? '13px' : undefined }}
          >
            {text}
          </Typography.Text>
        ),
      },
      {
        title: 'Created At',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: '20%',
        sorter: true,
        responsive: ['md'], // md and up (≥768px)
        render: (date: string) => (
          <Typography.Text style={{ fontSize: isMobile ? '12px' : undefined }}>
            {date ? dayjs(date).format('MMM D, YYYY, h:mm A') : '-'}
          </Typography.Text>
        ),
      },
      {
        title: 'Updated At',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: '20%',
        sorter: true,
        responsive: ['xl'], // xl and up (≥1200px)
        render: (date: string) => (
          <Typography.Text style={{ fontSize: isMobile ? '12px' : undefined }}>
            {date ? dayjs(date).format('MMM D, YYYY, h:mm A') : '-'}
          </Typography.Text>
        ),
      },
      {
        title: 'Operations',
        dataIndex: 'operation',
        width: isMobile ? 'auto' : '35%',
        render: (_, record) => (
          <Space
            size={isMobile ? 'small' : 'middle'}
            wrap={isMobile}
            direction={isMobile ? 'vertical' : 'horizontal'}
          >
            {record.deletedAt ? (
              canRestore && (
                <Popconfirm
                  title="Are you sure you want to restore this tag?"
                  onConfirm={() => handleRestore(record)}
                >
                  <Button
                    type="primary"
                    variant="solid"
                    color="green"
                    size={isMobile ? 'small' : 'middle'}
                    style={{ width: '80px' }}
                  >
                    Restore
                  </Button>
                </Popconfirm>
              )
            ) : (
              <>
                {canView && (
                  <Button
                    type="default"
                    variant="solid"
                    color="purple"
                    onClick={() => navigate(`/tags/${record._id}/stats`)}
                    size={isMobile ? 'small' : 'middle'}
                    style={{ width: '80px' }}
                  >
                    Stats
                  </Button>
                )}
                {canEdit && (
                  <Button
                    type="primary"
                    onClick={() => navigate(`/tags/edit/${record._id}`)}
                    size={isMobile ? 'small' : 'middle'}
                    style={{ width: '80px' }}
                  >
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Popconfirm
                    title="Are you sure you want to delete this tag?"
                    onConfirm={() => handleDelete(record._id)}
                  >
                    <Button
                      type="primary"
                      danger
                      size={isMobile ? 'small' : 'middle'}
                      style={{ width: '80px' }}
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
      canView,
      canEdit,
      canDelete,
      canRestore,
      navigate,
      handleDelete,
      handleRestore,
    ]
  );

  // ---- Mobile card helpers ----

  const buildMobileDropdownItems = useCallback(
    (record: TagType): MenuProps['items'] => {
      const deleted = !!record.deletedAt;
      const items: MenuProps['items'] = [];

      if (!deleted && canView) {
        items.push({
          key: 'stats',
          label: (
            <Space>
              <EyeOutlined style={{ color: '#7c3aed' }} />
              <span>Stats</span>
            </Space>
          ),
          onClick: () => navigate(`/tags/${record._id}/stats`),
        });
      }

      if (!deleted && canEdit) {
        items.push({
          key: 'edit',
          label: (
            <Space>
              <span>Edit</span>
            </Space>
          ),
          onClick: () => navigate(`/tags/edit/${record._id}`),
        });
      }

      if (!deleted && canDelete) {
        items.push({
          key: 'delete',
          danger: true,
          label: (
            <Popconfirm
              title="Are you sure you want to delete this tag?"
              onConfirm={() => handleDelete(record._id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
              placement="topRight"
            >
              <Space>
                <DeleteOutlined />
                <span>Delete</span>
              </Space>
            </Popconfirm>
          ),
        });
      }

      if (deleted && canRestore) {
        items.push({
          key: 'restore',
          label: (
            <Popconfirm
              title="Are you sure you want to restore this tag?"
              onConfirm={() => handleRestore(record)}
              okText="Restore"
              placement="topRight"
            >
              <Space>
                <UndoOutlined style={{ color: '#52c41a' }} />
                <span>Restore</span>
              </Space>
            </Popconfirm>
          ),
        });
      }

      return items;
    },
    [
      canView,
      canEdit,
      canDelete,
      canRestore,
      navigate,
      handleDelete,
      handleRestore,
    ]
  );

  const renderMobileCard = useCallback(
    (record: TagType) => {
      const deleted = !!record.deletedAt;
      const dropdownItems = buildMobileDropdownItems(record);
      const hasSecondaryActions = (dropdownItems?.length ?? 0) > 0;

      return (
        <Card
          key={record._id}
          size="small"
          styles={{ body: { padding: 12 } }}
          style={{
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
            opacity: deleted ? 0.75 : 1,
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: token.marginXS,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <Typography.Text
                strong
                delete={deleted}
                type={deleted ? 'secondary' : undefined}
                style={{
                  display: 'block',
                  fontSize: 15,
                  lineHeight: '22px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                }}
              >
                {record.name}
              </Typography.Text>
            </div>
            {hasSecondaryActions && (
              <Dropdown
                menu={{ items: dropdownItems }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Button
                  type="text"
                  size="small"
                  icon={<MoreOutlined style={{ fontSize: 18 }} />}
                  style={{ flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                />
              </Dropdown>
            )}
          </div>

          {/* Deleted badge */}
          {deleted && (
            <div style={{ marginTop: token.marginXS }}>
              <Tag color="red" style={{ margin: 0, fontSize: 12 }}>
                Deleted
              </Tag>
            </div>
          )}

          {/* Primary action for non-deleted tags */}
          {!deleted && canView && (
            <Button
              type="primary"
              block
              icon={<EyeOutlined />}
              style={{ marginTop: token.marginXS }}
              onClick={() => navigate(`/tags/${record._id}/stats`)}
            >
              Stats
            </Button>
          )}
        </Card>
      );
    },
    [buildMobileDropdownItems, canView, navigate, token]
  );

  const total = data?.data.tags.metadata.count || 0;

  return (
    <div style={{ padding: isMobile ? token.paddingSM : token.paddingMD }}>
      {!isMobile && (
        <>
        <Row gutter={[12, 12]} style={{ marginBottom: token.marginMD }}>
        <Col xs={24} sm={16} md={12} lg={10} xl={8}>
          <Input
            allowClear
            placeholder="Search tags by name"
            prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size={isMobile ? 'middle' : 'large'}
            style={{ width: '100%' }}
          />
        </Col>
      </Row>

      <Table<TagType>
          scroll={{ x: true }}
          columns={columns}
          dataSource={data?.data.tags.records}
          loading={isFetching}
          rowKey="_id"
          pagination={false}
          onChange={handleTableChange}
          size={isMobile ? 'small' : 'middle'}
          style={{ fontSize: isMobile ? '13px' : undefined }}
        />
        </>
      )}

      {isMobile && (
        <div style={{ paddingBottom: 80 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {data?.data.tags.records.map((record) => renderMobileCard(record))}
          </Space>
        </div>
      )}

      <div style={{ marginTop: isMobile ? token.marginSM : token.marginMD }}>
        <ResponsivePagination
          page={page}
          perPage={perPage}
          total={total}
          onChange={(p, size) => {
            setPage(p);
            setPerPage(size);
          }}
          loading={isFetching}
        />
      </div>
    </div>
  );
};

export default TagsTable;
