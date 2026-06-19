import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import {
  Button,
  Card,
  Dropdown,
  Empty,
  Col,
  Grid,
  Input,
  message,
  Popconfirm,
  Row,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import {
  MoreOutlined,
  DeleteOutlined,
  UndoOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { FilterValue, SorterResult } from 'antd/es/table/interface';
import {
  ConfigSet,
  useListConfigSetsQuery,
  useUpdateConfigSetMutation,
  useDeleteConfigSetMutation,
} from '../../../services/configSetsApi';
import { User } from '../../../features/auth/authSlice';
import { ResponsivePagination } from '../../../components/ResponsivePagination';
import { ProtectedComponent } from '../../../components';
import { PATH_FORMS } from '../../../constants/routes';

const { useBreakpoint } = Grid;
const { Text } = Typography;
const SEARCH_DEBOUNCE_MS = 500;

type ProfileLike = { _id: string; user?: string | User };

function getProfileDisplayName(p: ProfileLike): string {
  if (typeof p.user === 'object' && p.user && 'name' in p.user) {
    return (p.user as User).name ?? (p.user as User).email ?? p._id;
  }
  return p._id;
}

function ProfileCountCell({
  profiles,
  title,
  emptyLabel = '—',
}: {
  profiles: ProfileLike[] | undefined;
  title: string;
  emptyLabel?: string;
}) {
  const list = Array.isArray(profiles) ? profiles : [];
  const names = list.map(getProfileDisplayName).filter(Boolean);
  if (names.length === 0) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {emptyLabel}
      </Text>
    );
  }
  const content = (
    <Tag style={{ margin: 0, fontSize: 11, cursor: 'default' }}>
      {names.length}
    </Tag>
  );
  return (
    <Tooltip
      title={
        <div style={{ maxHeight: 200, overflow: 'auto' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
          {names.map((name, i) => (
            <div key={i} style={{ marginBottom: 2 }}>
              {name}
            </div>
          ))}
        </div>
      }
    >
      <span>{content}</span>
    </Tooltip>
  );
}

const ConfigSetsTable: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { token } = theme.useToken();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
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

  const { data, isFetching } = useListConfigSetsQuery({
    page,
    perPage,
    sortBy,
    order,
    ...(debouncedSearch && { name: debouncedSearch }),
  });

  const [updateConfigSet, { isLoading: updating }] =
    useUpdateConfigSetMutation();
  const [deleteConfigSet, { isLoading: deleting }] =
    useDeleteConfigSetMutation();

  const records = useMemo(() => {
    const list = data?.data?.configSets?.records ?? [];
    if (showDeleted) return list;
    return list.filter((r) => !r.deletedAt);
  }, [data?.data?.configSets?.records, showDeleted]);

  const metadata = data?.data?.configSets?.metadata;
  const totalFromApi = metadata?.count ?? 0;

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        await deleteConfigSet(id).unwrap();
        message.success('Config set deleted');
      } catch {
        message.error('Failed to delete config set');
      } finally {
        setDeletingId(null);
      }
    },
    [deleteConfigSet]
  );

  const handleRestore = useCallback(
    async (id: string) => {
      setRestoringId(id);
      try {
        await updateConfigSet({ id, body: { restore: true } }).unwrap();
        message.success('Config set restored');
      } catch {
        message.error('Failed to restore config set');
      } finally {
        setRestoringId(null);
      }
    },
    [updateConfigSet]
  );

  const handleTableChange = useCallback(
    (
      _pagination: TablePaginationConfig,
      _filters: Record<string, FilterValue | null>,
      sorter: SorterResult<ConfigSet> | SorterResult<ConfigSet>[]
    ) => {
      if (!Array.isArray(sorter) && sorter.field && sorter.order) {
        setSortBy((sorter.field as string) ?? 'createdAt');
        setOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
      } else {
        setSortBy('createdAt');
        setOrder('asc');
      }
    },
    []
  );

  const columns: TableColumnsType<ConfigSet> = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        sorter: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
        ellipsis: true,
        width: '30%',
        render: (text: string, record: ConfigSet) => (
          <Space size={4} style={{ width: '100%' }}>
            <Text ellipsis strong={!record.deletedAt} style={{ fontSize: 13 }}>
              {text || '—'}
            </Text>
            {record.deletedAt && (
              <Tag color="default" style={{ margin: 0, fontSize: 11 }}>
                deleted
              </Tag>
            )}
          </Space>
        ),
      },
      {
        title: 'Config',
        key: 'config',
        width: '15%',
        render: (_: unknown, r: ConfigSet) => (
          <Space size={4} wrap style={{ lineHeight: 1.2 }}>
            {r.hasApproval && (
              <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                Approval
              </Tag>
            )}
            {r.hasDisputes && (
              <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>
                Disputes
              </Tag>
            )}
            {r.approvalRule && r.approvalRule !== 'NONE' && (
              <Tag style={{ margin: 0, fontSize: 11 }}>
                {r.approvalRule}
                {r.approvalRule === 'MIN' && r.approvalMinCount != null
                  ? `:${r.approvalMinCount}`
                  : ''}
              </Tag>
            )}
            {!r.hasApproval &&
              !r.hasDisputes &&
              (!r.approvalRule || r.approvalRule === 'NONE') && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  —
                </Text>
              )}
          </Space>
        ),
      },
      {
        title: 'People',
        key: 'people',
        width: isMobile ? '28%' : '22%',
        render: (_: unknown, r: ConfigSet) => (
          <Space size={4} wrap style={{ lineHeight: 1.2 }}>
            <ProfileCountCell profiles={r.approvers} title="Approvers" />
            <ProfileCountCell profiles={r.subjects} title="Subjects" />
            <ProfileCountCell
              profiles={r.omitSignatureApprovers}
              title="Omit signature approvers"
            />
            <ProfileCountCell
              profiles={r.questionApprovers}
              title="Question approvers"
            />
          </Space>
        ),
      },
      {
        title: 'Actions',
        key: 'actions',
        width: isMobile ? 'auto' : '25%',
        align: 'left',
        render: (_: unknown, record: ConfigSet) => (
          <Space
            size={isMobile ? 'small' : 'middle'}
            direction={isMobile ? 'vertical' : 'horizontal'}
            wrap
          >
            {record.deletedAt ? (
              <ProtectedComponent permission="configset::edit">
                <Popconfirm
                  title="Are you sure you want to restore this config set?"
                  onConfirm={() => handleRestore(record._id)}
                >
                  <Button
                    type="primary"
                    variant="solid"
                    color="green"
                    size={isMobile ? 'small' : 'middle'}
                    loading={updating && restoringId === record._id}
                    style={{ minWidth: 80 }}
                  >
                    Restore
                  </Button>
                </Popconfirm>
              </ProtectedComponent>
            ) : (
              <>
                <ProtectedComponent permission="configset::edit">
                  <Button
                    type="primary"
                    size={isMobile ? 'small' : 'middle'}
                    onClick={() =>
                      navigate(`${PATH_FORMS.configSets}/edit/${record._id}`)
                    }
                    style={{ minWidth: 80 }}
                  >
                    Edit
                  </Button>
                </ProtectedComponent>
                <ProtectedComponent permission="configset::delete">
                  <Popconfirm
                    title="Are you sure you want to delete this config set?"
                    onConfirm={() => handleDelete(record._id)}
                  >
                    <Button
                      type="primary"
                      danger
                      size={isMobile ? 'small' : 'middle'}
                      loading={deleting && deletingId === record._id}
                      style={{ minWidth: 80 }}
                    >
                      Delete
                    </Button>
                  </Popconfirm>
                </ProtectedComponent>
              </>
            )}
          </Space>
        ),
      },
    ],
    [
      isMobile,
      handleDelete,
      handleRestore,
      deleting,
      deletingId,
      updating,
      restoringId,
      navigate,
    ]
  );

  return (
    <div
      style={{
        padding: isMobile ? token.paddingSM : token.paddingMD,
      }}
    >
      <Row gutter={[12, 12]} style={{ marginBottom: token.marginSM }}>
        <Col xs={24}>
          <ProtectedComponent permission="configset::create">
            <Button
              type="primary"
              size="middle"
              onClick={() => navigate(`${PATH_FORMS.configSets}/add`)}
            style={isMobile ? { width: '100%' } : undefined}
            >
              Add Quick Setting
            </Button>
          </ProtectedComponent>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginBottom: token.marginMD }}>
        <Col xs={24} sm={16} md={14} lg={12} xl={10}>
          <Input
            allowClear
            placeholder="Search quick settings by name"
            prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size={isMobile ? 'middle' : 'large'}
            style={{ width: '100%' }}
          />
        </Col>
        <Col xs={24} sm={8} md={10} lg={12} xl={14}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              minHeight: isMobile ? undefined : token.controlHeightLG,
            }}
          >
            <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
          }}
        >
              <Switch
            checked={showDeleted}
            onChange={setShowDeleted}
            size="small"
          />
              <span>Show deleted</span>
            </label>
          </div>
        </Col>
      </Row>

      {!isMobile && (
        <>
          <Table<ConfigSet>
            scroll={{ x: 'auto' }}
            columns={columns}
            dataSource={records}
            loading={isFetching}
            rowKey="_id"
            pagination={false}
            onChange={handleTableChange}
            size="small"
            locale={{ emptyText: 'No quick settings yet' }}
            showSorterTooltip
            style={{ marginBottom: 0 }}
          />
          <div style={{ marginTop: 12 }}>
            <ResponsivePagination
              page={page}
              perPage={perPage}
              total={totalFromApi}
              onChange={(p, size) => {
                setPage(p);
                setPerPage(size);
              }}
              loading={isFetching}
            />
          </div>
        </>
      )}

      {isMobile && (
        <div style={{ paddingBottom: 80 }}>
          {records.length === 0 && !isFetching && (
            <Empty description="No quick settings yet" />
          )}
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {records.map((record) => {
              const configChips: React.ReactNode[] = [];
              if (record.hasApproval) {
                configChips.push(
                  <Tag
                    key="approval"
                    color="blue"
                    style={{ margin: 0, fontSize: 11 }}
                  >
                    Approval
                  </Tag>
                );
              }
              if (record.hasDisputes) {
                configChips.push(
                  <Tag
                    key="disputes"
                    color="orange"
                    style={{ margin: 0, fontSize: 11 }}
                  >
                    Disputes
                  </Tag>
                );
              }
              if (record.approvalRule && record.approvalRule !== 'NONE') {
                configChips.push(
                  <Tag key="rule" style={{ margin: 0, fontSize: 11 }}>
                    {record.approvalRule}
                    {record.approvalRule === 'MIN' &&
                    record.approvalMinCount != null
                      ? `:${record.approvalMinCount}`
                      : ''}
                  </Tag>
                );
              }

              const deleteMenuItems = [
                {
                  key: 'delete',
                  label: (
                    <ProtectedComponent permission="configset::delete">
                      <Popconfirm
                        title="Are you sure you want to delete this config set?"
                        onConfirm={() => handleDelete(record._id)}
                      >
                        <span style={{ color: token.colorError }}>
                          <DeleteOutlined /> Delete
                        </span>
                      </Popconfirm>
                    </ProtectedComponent>
                  ),
                },
              ];

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
                      <Text
                        strong={!record.deletedAt}
                        style={{
                          fontSize: 14,
                          textDecoration: record.deletedAt
                            ? 'line-through'
                            : undefined,
                        }}
                        ellipsis
                      >
                        {record.name || '—'}
                      </Text>
                    </div>
                    {record.deletedAt && (
                      <Tag
                        color="default"
                        style={{
                          margin: 0,
                          fontSize: 11,
                          flexShrink: 0,
                        }}
                      >
                        Deleted
                      </Tag>
                    )}
                    {!record.deletedAt && (
                      <ProtectedComponent permission="configset::delete">
                        <Dropdown
                          menu={{ items: deleteMenuItems }}
                          trigger={['click']}
                          placement="bottomRight"
                        >
                          <Button
                            type="text"
                            size="small"
                            icon={<MoreOutlined />}
                            style={{ flexShrink: 0 }}
                          />
                        </Dropdown>
                      </ProtectedComponent>
                    )}
                  </div>

                  {configChips.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <Space size={4} wrap style={{ lineHeight: 1.2 }}>
                        {configChips}
                      </Space>
                    </div>
                  )}

                  <div style={{ marginTop: 8 }}>
                    <Space size={4} wrap style={{ lineHeight: 1.2 }}>
                      <ProfileCountCell
                        profiles={record.approvers}
                        title="Approvers"
                      />
                      <ProfileCountCell
                        profiles={record.subjects}
                        title="Subjects"
                      />
                      <ProfileCountCell
                        profiles={record.omitSignatureApprovers}
                        title="Omit signature approvers"
                      />
                      <ProfileCountCell
                        profiles={record.questionApprovers}
                        title="Question approvers"
                      />
                    </Space>
                  </div>

                  {record.deletedAt ? (
                    <ProtectedComponent permission="configset::edit">
                      <Popconfirm
                        title="Are you sure you want to restore this config set?"
                        onConfirm={() => handleRestore(record._id)}
                      >
                        <Button
                          type="primary"
                          variant="solid"
                          color="green"
                          size="small"
                          loading={updating && restoringId === record._id}
                          icon={<UndoOutlined />}
                          block
                          style={{ marginTop: 12 }}
                        >
                          Restore
                        </Button>
                      </Popconfirm>
                    </ProtectedComponent>
                  ) : (
                    <ProtectedComponent permission="configset::edit">
                      <Button
                        type="primary"
                        size="small"
                        onClick={() =>
                          navigate(
                            `${PATH_FORMS.configSets}/edit/${record._id}`
                          )
                        }
                        icon={<EditOutlined />}
                        block
                        style={{ marginTop: 12 }}
                      >
                        Edit
                      </Button>
                    </ProtectedComponent>
                  )}
                </Card>
              );
            })}
          </Space>

          <div style={{ marginTop: 12 }}>
            <ResponsivePagination
              page={page}
              perPage={perPage}
              total={totalFromApi}
              onChange={(p, size) => {
                setPage(p);
                setPerPage(size);
              }}
              loading={isFetching}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigSetsTable;
