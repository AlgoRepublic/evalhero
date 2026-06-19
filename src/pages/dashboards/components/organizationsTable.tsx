import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import {
  Button,
  Col,
  Input,
  message,
  Popconfirm,
  Row,
  Space,
  Table,
  Tooltip,
  Typography,
  Grid,
  theme,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { AssetImage } from '../../../components';
import { useNavigate } from 'react-router-dom';
import {
  Organization,
  useDeleteOrganizationMutation,
  useGetOrganizationsQuery,
  useUpdateOrganizationMutation,
} from '../../../services/orgApi';
import dayjs from 'dayjs';
import { FilterValue, SorterResult } from 'antd/es/table/interface';
import { ResponsivePagination } from '../../../components/ResponsivePagination';
import { useLazyGetUserInfoQuery } from '../../../services/authApi';
import { usePermission } from '../../../hooks/usePermission';

const { useBreakpoint } = Grid;
const SEARCH_DEBOUNCE_MS = 500;

const OrganizationTable: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md; // Below md (768px) is mobile
  const isXS = !screens.sm; // Below sm (576px) is extra small
  const { token } = theme.useToken();
  
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

  const { data, isFetching } = useGetOrganizationsQuery({
    page,
    perPage,
    sortBy,
    order,
    ...(debouncedSearch && { name: debouncedSearch }),
  });

  const [deleteOrg] = useDeleteOrganizationMutation();
  const [updateOrganization] = useUpdateOrganizationMutation();
  const [getUserInfo] = useLazyGetUserInfoQuery();
  const navigate = useNavigate();

  // Permission checks
  const canEdit = usePermission('organization::edit');
  const canDelete = usePermission('organization::delete');
  const canRestore = usePermission('organization::restore');
  
  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteOrg(id).unwrap();
      getUserInfo();
      message.success('Organization deleted successfully');
    } catch (err) {
      message.error('Failed to delete organization');
    }
  }, [deleteOrg, getUserInfo]);

  const handleRestore = useCallback(async (record: Organization) => {
    try {
      await updateOrganization({
        id: record._id,
        name: record.name,
        restore: true,
      }).unwrap();
      getUserInfo();
      message.success('Organization restored successfully');
    } catch {
      message.error('Failed to restore organization');
    }
  }, [updateOrganization, getUserInfo]);

  const handleTableChange = (
    _pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<Organization> | SorterResult<Organization>[]
  ) => {
    if (!Array.isArray(sorter) && sorter.field && sorter.order) {
      setSortBy(sorter.field as string);
      setOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
    } else {
      setSortBy('name');
      setOrder('asc');
    }
  };

  const columns: TableColumnsType<Organization> = useMemo(() => {
    const baseColumns: TableColumnsType<Organization> = [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        width: isMobile ? '40%' : '30%',
        sorter: (a, b) => a.name.localeCompare(b.name),
        render: (_, record) => (
          <Space 
            size={isMobile ? 'small' : 'middle'} 
            align="center"
            style={{ 
              padding: isMobile ? `${token.paddingXXS}px 0` : undefined 
            }}
          >
            {record.icon && (
              <AssetImage
                src={record.icon}
                alt={isMobile ? "" : record.name}
                fallback={record?.name?.charAt(0)?.toUpperCase()}
                style={{
                  width: isMobile ? 28 : 36,
                  height: isMobile ? 28 : 36,
                  objectFit: 'cover',
                  borderRadius: '50%',
                }}
              />
            )}

            <Typography.Text
              delete={!!record.deletedAt}
              type={record.deletedAt ? 'secondary' : undefined}
              style={{ 
                fontSize: isMobile ? '13px' : undefined 
              }}
            >
              {record.name}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Users',
        dataIndex: 'usersCount',
        key: 'usersCount',
        width: isMobile ? '12%' : '10%',
        sorter: (a, b) => (a.usersCount ?? 0) - (b.usersCount ?? 0),
        render: (usersCount: number | undefined, record: Organization) => (
          <Typography.Text
            delete={!!record.deletedAt}
            type={record.deletedAt ? 'secondary' : undefined}
            style={{ fontSize: isMobile ? '12px' : undefined }}
          >
            {usersCount ?? '—'}
          </Typography.Text>
        ),
      },
      {
        title: 'Created At',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: isMobile ? '15%' : '15%',
        sorter: (a, b) => a.createdAt.length - b.createdAt.length,
        sortDirections: ['descend', 'ascend'],
        render: (createdAt: string, record: Organization) => {
          const date = dayjs(createdAt).format(
            isMobile ? 'MM/DD/YY' : 'DD MMM YYYY'
          );
          return (
            <Typography.Text
              delete={!!record.deletedAt}
              type={record.deletedAt ? 'secondary' : undefined}
              style={{ 
                fontSize: isMobile ? '12px' : undefined 
              }}
            >
              {date}
            </Typography.Text>
          );
        },
      },
      {
        title: 'Storage',
        dataIndex: ['wasabiStorage'],
        key: 'wasabiStorage',
        width: isMobile ? 'auto' : '25%',
        render: (_: unknown, record: Organization) => {
          const ws = record.wasabiStorage;
          if (!ws) {
            return (
              <Typography.Text type="secondary" style={{ fontSize: isMobile ? '12px' : undefined }}>
                —
              </Typography.Text>
            );
          }
          const used = ws.usedMb ? ws.usedMb.toFixed(2) : 0;
          const limit = ws.limitMb;
          const label = isMobile ? `${used}/${limit}` : `${used} / ${limit} MB`;
          const tip = `Used: ${used} MB · Limit: ${limit} MB${ws.isOverQuota ? ' · Over quota' : ''}${ws.provisioningStatus ? ` · ${ws.provisioningStatus}` : ''}`;
          return (
            <Tooltip title={tip}>
              <Typography.Text
                delete={!!record.deletedAt}
                type={record.deletedAt ? 'secondary' : ws.isOverQuota ? 'danger' : undefined}
                style={{ fontSize: isMobile ? '12px' : undefined }}
              >
                {label}
                {ws.isOverQuota && !isMobile ? ' ⚠' : ''}
              </Typography.Text>
            </Tooltip>
          );
        },
      },
      {
        title: 'Actions',
        dataIndex: 'actions',
        width: isMobile ? 'auto' : '30%',
        render: (_, record) => (
          <Space 
            size={isMobile ? 'small' : 'middle'} 
            align="end"
            // direction={isMobile ? 'vertical' : 'horizontal'}
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            {record.deletedAt ? (
              canRestore && (
                <Popconfirm
                  title="Are you sure you want to restore this organization?"
                  onConfirm={() => handleRestore(record)}
                >
                  <Button
                    type="primary"
                    variant="solid"
                    color="green"
                    size={isMobile ? 'small' : 'middle'}
                    style={{ 
                      width: isMobile ? '100%' : '80px',
                      minWidth: isMobile ? undefined : '80px'
                    }}
                  >
                    Restore
                  </Button>
                </Popconfirm>
              )
            ) : (
              <>
                {canEdit && (
                  <Button
                    type="primary"
                    onClick={() =>
                      navigate(`/dashboard/organizations/edit/${record._id}`)
                    }
                    size={isMobile ? 'small' : 'middle'}
                    style={{ 
                      width: isMobile ? '100%' : '80px',
                      minWidth: isMobile ? undefined : '80px'
                    }}
                  >
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Popconfirm
                    title="Are you sure you want to delete this organization?"
                    onConfirm={() => handleDelete(record._id)}
                  >
                    <Button 
                      type="primary" 
                      danger 
                      size={isMobile ? 'small' : 'middle'}
                      style={{ 
                        width: isMobile ? '100%' : '80px',
                        minWidth: isMobile ? undefined : '80px'
                      }}
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
    ];

    // Hide createdAt column on XS screens
    if (isXS) {
      return baseColumns.filter(col => col.key !== 'createdAt');
    }

    return baseColumns;
  }, [isMobile, isXS, token, canEdit, canDelete, canRestore, navigate, handleDelete, handleRestore]);

  const total = data?.data.organizations.metadata.count || 0;

  return (
    <div
      style={{
        padding: isMobile ? token.paddingSM : token.paddingMD,
      }}
    >
      <Row gutter={[12, 12]} style={{ marginBottom: token.marginMD }}>
        <Col xs={24} sm={16} md={12} lg={10} xl={8}>
          <Input
            allowClear
            placeholder="Search organization by name"
            prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size={isMobile ? 'middle' : 'large'}
            style={{ width: '100%' }}
          />
        </Col>
      </Row>

      <Table<Organization>
        scroll={{ x: true }}
        columns={columns}
        dataSource={data?.data.organizations.records}
        loading={isFetching}
        rowKey="_id"
        pagination={false}
        onChange={handleTableChange}
        size={isMobile ? 'small' : 'middle'}
        style={{
          fontSize: isMobile ? '13px' : undefined,
        }}
      />

      <div
        style={{
          marginTop: isMobile ? token.marginSM : token.marginMD,
        }}
      >
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

export default OrganizationTable;
