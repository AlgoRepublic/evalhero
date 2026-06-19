import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { TableColumnsType, TablePaginationConfig, MenuProps } from 'antd';
import {
  Table,
  Typography,
  Tag,
  Grid,
  Row,
  Col,
  Space,
  theme,
  Button,
  Input,
  Select,
  Tooltip,
  Popconfirm,
  message,
  Card,
  Dropdown,
  Drawer,
  Empty,
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  MoreOutlined,
  EyeOutlined,
  DeleteOutlined,
  UndoOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { FilterValue, SorterResult } from 'antd/es/table/interface';
import { useNavigate } from 'react-router-dom';
import { ResponsivePagination } from '../../../components/ResponsivePagination';
import { AssetAvatar } from '../../../components/AssetAvatar/AssetAvatar';
import { useGetProfilesQuery } from '../../../services/profilesAPI';
import { useGetRolesQuery } from '../../../services/roleApi';
import { useGetDepartmentsQuery } from '../../../services/departmentApi';
import { useGetLocationsQuery } from '../../../services/locationsApi';
import {
  useDeleteUserMutation,
  useUpdateUserProfileMutation,
} from '../../../services/usersApi';
import { usePermission, useAppSelector } from '../../../hooks';
import type { Profile, User } from '../../../features/auth/authSlice';
import { PATH_USERS } from '../../../constants/routes';

const { useBreakpoint } = Grid;

const SEARCH_DEBOUNCE_MS = 500;

/** Map table column key to backend sortBy value */
function tableSortFieldToApiSortBy(field: string): string {
  if (field === 'user.name') return 'userName';
  if (field === 'user.email') return 'userEmailOrPhone';
  return field;
}

/** Get display names from profile roles (populated role has .role.name) */
function getRoleNames(roles: Profile['roles']): string[] {
  if (!roles?.length) return [];
  return roles
    .map((r) =>
      typeof (r as { role?: { name?: string } }).role === 'object'
        ? (r as { role: { name?: string } }).role?.name
        : null
    )
    .filter(Boolean) as string[];
}

/** Get display names from profile departments */
function getDepartmentNames(departments: Profile['departments']): string[] {
  if (!departments?.length) return [];
  return departments
    .map((d) =>
      typeof (d as { department?: { name?: string } }).department === 'object'
        ? (d as { department: { name?: string } }).department?.name
        : null
    )
    .filter(Boolean) as string[];
}

/** Get display names from profile locations */
function getLocationNames(locations: Profile['locations']): string[] {
  if (!locations?.length) return [];
  return locations
    .map((l) =>
      typeof (l as { location?: { name?: string } }).location === 'object'
        ? (l as { location: { name?: string } }).location?.name
        : null
    )
    .filter(Boolean) as string[];
}

const UsersTable: React.FC = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { token } = theme.useToken();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchTermEmailOrPhone, setSearchTermEmailOrPhone] = useState('');
  const [debouncedSearchEmailOrPhone, setDebouncedSearchEmailOrPhone] =
    useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(
    null
  );
  const [restoringProfileId, setRestoringProfileId] = useState<string | null>(
    null
  );
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const { data: rolesData } = useGetRolesQuery();
  const { data: departmentsData } = useGetDepartmentsQuery();
  const { data: locationsData } = useGetLocationsQuery();

  const roleOptions = rolesData?.data?.roles?.records ?? [];
  const departmentOptions = departmentsData?.data?.departments?.records ?? [];
  const locationOptions = locationsData?.data?.locations?.records ?? [];

  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedSearch(searchTerm.trim()),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedSearchEmailOrPhone(searchTermEmailOrPhone.trim()),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(t);
  }, [searchTermEmailOrPhone]);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    debouncedSearchEmailOrPhone,
    roleIds,
    departmentIds,
    locationIds,
  ]);

  const queryParams = useMemo(
    () => ({
      page,
      perPage,
      sortBy,
      order,
      ...(debouncedSearch && { userName: debouncedSearch }),
      ...(debouncedSearchEmailOrPhone && {
        userEmailOrPhone: debouncedSearchEmailOrPhone,
      }),
      ...(roleIds.length > 0 && { roles: roleIds }),
      ...(departmentIds.length > 0 && { departments: departmentIds }),
      ...(locationIds.length > 0 && { locations: locationIds }),
    }),
    [
      page,
      perPage,
      sortBy,
      order,
      debouncedSearch,
      debouncedSearchEmailOrPhone,
      roleIds,
      departmentIds,
      locationIds,
    ]
  );

  const { data, isFetching } = useGetProfilesQuery(queryParams);
  const canDelete = usePermission('user::delete');
  const canRestore = usePermission('user::restore');
  const selectedProfileId = useAppSelector((s) => s.auth.selectedProfile?._id);
  const [deleteUser] = useDeleteUserMutation();
  const [updateProfile] = useUpdateUserProfileMutation();

  const handleDeleteUser = async (profileId: string) => {
    setDeletingProfileId(profileId);
    try {
      await deleteUser(profileId).unwrap();
      message.success('User deleted successfully');
    } catch (err: unknown) {
      const e = err as { data?: { message?: string }; message?: string };
      message.error(e?.data?.message ?? e?.message ?? 'Failed to delete user');
    } finally {
      setDeletingProfileId(null);
    }
  };

  const handleRestoreUser = async (profileId: string) => {
    setRestoringProfileId(profileId);
    try {
      await updateProfile({ profileId, restore: true }).unwrap();
      message.success('User restored successfully');
    } catch (err: unknown) {
      const e = err as { data?: { message?: string }; message?: string };
      message.error(e?.data?.message ?? e?.message ?? 'Failed to restore user');
    } finally {
      setRestoringProfileId(null);
    }
  };

  const handleTableChange = (
    _pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<Profile> | SorterResult<Profile>[]
  ) => {
    if (!Array.isArray(sorter) && sorter.order) {
      const field = String(sorter.columnKey ?? sorter.field ?? 'createdAt');
      setSortBy(tableSortFieldToApiSortBy(field));
      setOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
    }
  };

  // ---- Desktop columns (unchanged) ----

  const columns: TableColumnsType<Profile> = useMemo(
    () => [
      {
        title: 'Name',
        key: 'user.name',
        width: isMobile ? '45%' : '22%',
        sorter: true,
        render: (_: unknown, record: Profile) => {
          const user =
            typeof record.user === 'object' && record.user
              ? (record.user as User)
              : null;
          const name = user?.name;
          const initial = name
            ? name.trim().charAt(0).toUpperCase()
            : undefined;
          const deleted = !!record.deletedAt;
          return (
            <Space size="small" align="center">
              <AssetAvatar
                avatarKey={user?.avatar}
                fallback={initial ? <span>{initial}</span> : undefined}
                size={isMobile ? 'small' : 'default'}
              />
              <Typography.Text
                delete={deleted}
                type={deleted ? 'secondary' : undefined}
                style={{ fontSize: isMobile ? '13px' : undefined }}
              >
                {name || '-'}
              </Typography.Text>
            </Space>
          );
        },
      },
      {
        title: 'Email / Phone',
        key: 'user.email',
        width: isMobile ? '55%' : '22%',
        sorter: true,
        render: (_: unknown, record: Profile) => {
          const u =
            typeof record.user === 'object' && record.user
              ? (record.user as User)
              : null;
          const contact = u ? (u.email ?? u.phone) : undefined;
          const deleted = !!record.deletedAt;
          return (
            <Typography.Text
              delete={deleted}
              type={deleted ? 'secondary' : undefined}
              style={{ fontSize: isMobile ? '12px' : undefined }}
              ellipsis
            >
              {contact || '-'}
            </Typography.Text>
          );
        },
      },
      {
        title: 'Roles',
        key: 'rolesCount',
        width: '10%',
        responsive: ['md'],
        render: (_: unknown, record: Profile) => {
          const count = record.roles?.length || 0;
          const names = getRoleNames(record.roles);
          const tooltipTitle = names.length > 0 ? names.join(', ') : '—';
          return (
            <Tooltip title={tooltipTitle}>
              <Tag
                color="blue"
                style={{
                  minWidth: 40,
                  display: 'inline-flex',
                  justifyContent: 'center',
                  fontSize: isMobile ? '11px' : undefined,
                }}
              >
                {count}
              </Tag>
            </Tooltip>
          );
        },
      },
      {
        title: 'Departments',
        key: 'departmentsCount',
        width: '10%',
        responsive: ['md'],
        render: (_: unknown, record: Profile) => {
          const count = record.departments?.length || 0;
          const names = getDepartmentNames(record.departments);
          const tooltipTitle = names.length > 0 ? names.join(', ') : '—';
          return (
            <Tooltip title={tooltipTitle}>
              <Tag
                color="purple"
                style={{
                  minWidth: 40,
                  display: 'inline-flex',
                  justifyContent: 'center',
                  fontSize: isMobile ? '11px' : undefined,
                }}
              >
                {count}
              </Tag>
            </Tooltip>
          );
        },
      },
      {
        title: 'Locations',
        key: 'locationsCount',
        width: '10%',
        responsive: ['md'],
        render: (_: unknown, record: Profile) => {
          const count = record.locations?.length || 0;
          const names = getLocationNames(record.locations);
          const tooltipTitle = names.length > 0 ? names.join(', ') : '—';
          return (
            <Tooltip title={tooltipTitle}>
              <Tag
                color="green"
                style={{
                  minWidth: 40,
                  display: 'inline-flex',
                  justifyContent: 'center',
                  fontSize: isMobile ? '11px' : undefined,
                }}
              >
                {count}
              </Tag>
            </Tooltip>
          );
        },
      },
      {
        title: 'Actions',
        key: 'actions',
        width: isMobile ? 70 : 80,
        align: 'left' as const,
        fixed: 'right' as const,
        render: (_: unknown, record: Profile) => {
          const deleted = !!record.deletedAt;
          const isOwnProfile = record._id === selectedProfileId;
          return (
            <Space
              size={isMobile ? 'small' : 'middle'}
              style={{ width: isMobile ? '100%' : 'auto' }}
              align={isMobile ? 'start' : 'center'}
              wrap
            >
              <Button
                type="primary"
                size={isMobile ? 'small' : 'middle'}
                block={isMobile}
                onClick={() => navigate(PATH_USERS.profileDetail(record._id))}
                style={{ minWidth: isMobile ? 64 : 80 }}
              >
                View
              </Button>
              {canRestore && deleted && (
                <Popconfirm
                  title="Restore this user?"
                  description="The user will be able to access the organization again."
                  onConfirm={() => handleRestoreUser(record._id)}
                  okText="Restore"
                >
                  <Button
                    type="primary"
                    variant="solid"
                    color="green"
                    size={isMobile ? 'small' : 'middle'}
                    loading={restoringProfileId === record._id}
                  >
                    Restore
                  </Button>
                </Popconfirm>
              )}
              {canDelete && !deleted && !isOwnProfile && (
                <Popconfirm
                  title="Delete this user?"
                  description="The user will be soft-deleted and can be restored later."
                  onConfirm={() => handleDeleteUser(record._id)}
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    type="primary"
                    danger
                    size={isMobile ? 'small' : 'middle'}
                    loading={deletingProfileId === record._id}
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
      canDelete,
      canRestore,
      selectedProfileId,
      deletingProfileId,
      restoringProfileId,
      navigate,
      handleDeleteUser,
      handleRestoreUser,
    ]
  );

  const profiles = data?.data?.profiles?.records ?? [];
  const pagination = data?.data?.profiles?.metadata ?? {
    count: 0,
    page: 1,
    perPage: 50,
  };
  const total = pagination.count ?? 0;

  // ---- Filters ----

  const hasActiveFilters =
    roleIds.length > 0 ||
    departmentIds.length > 0 ||
    locationIds.length > 0 ||
    !!debouncedSearch ||
    !!debouncedSearchEmailOrPhone;

  const clearFilters = useCallback(() => {
    setRoleIds([]);
    setDepartmentIds([]);
    setLocationIds([]);
    setSearchTerm('');
    setSearchTermEmailOrPhone('');
    setPage(1);
  }, []);

  // Active filter chips for mobile
  const activeFilterChips = useMemo(() => {
    if (!isMobile) return [];
    const chips: { key: string; label: string; type: 'search' | 'select' }[] =
      [];
    if (debouncedSearch)
      chips.push({
        key: 'name',
        label: `Name: ${debouncedSearch}`,
        type: 'search',
      });
    if (debouncedSearchEmailOrPhone)
      chips.push({
        key: 'email',
        label: `Contact: ${debouncedSearchEmailOrPhone}`,
        type: 'search',
      });
    roleIds.forEach((id) => {
      const opt = roleOptions.find((o) => o._id === id);
      if (opt)
        chips.push({ key: `role-${id}`, label: opt.name, type: 'select' });
    });
    departmentIds.forEach((id) => {
      const opt = departmentOptions.find((o) => o._id === id);
      if (opt)
        chips.push({ key: `dept-${id}`, label: opt.name, type: 'select' });
    });
    locationIds.forEach((id) => {
      const opt = locationOptions.find((o) => o._id === id);
      if (opt)
        chips.push({ key: `loc-${id}`, label: opt.name, type: 'select' });
    });
    return chips;
  }, [
    isMobile,
    debouncedSearch,
    debouncedSearchEmailOrPhone,
    roleIds,
    departmentIds,
    locationIds,
    roleOptions,
    departmentOptions,
    locationOptions,
  ]);

  const removeFilterChip = useCallback(
    (chip: { key: string; type: 'search' | 'select' }) => {
      if (chip.key === 'name') setSearchTerm('');
      else if (chip.key === 'email') setSearchTermEmailOrPhone('');
      else if (chip.key.startsWith('role-'))
        setRoleIds((prev) => prev.filter((id) => `role-${id}` !== chip.key));
      else if (chip.key.startsWith('dept-'))
        setDepartmentIds((prev) =>
          prev.filter((id) => `dept-${id}` !== chip.key)
        );
      else if (chip.key.startsWith('loc-'))
        setLocationIds((prev) => prev.filter((id) => `loc-${id}` !== chip.key));
    },
    []
  );

  // ---- Mobile card helpers ----

  const buildMobileDropdownItems = useCallback(
    (record: Profile): MenuProps['items'] => {
      const deleted = !!record.deletedAt;
      const isOwnProfile = record._id === selectedProfileId;
      const items: MenuProps['items'] = [];

      if (canRestore && deleted) {
        items.push({
          key: 'restore',
          label: (
            <Popconfirm
              title="Restore this user?"
              description="The user will be able to access the organization again."
              onConfirm={() => handleRestoreUser(record._id)}
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

      if (canDelete && !deleted && !isOwnProfile) {
        items.push({
          key: 'delete',
          danger: true,
          label: (
            <Popconfirm
              title="Delete this user?"
              description="The user will be soft-deleted and can be restored later."
              onConfirm={() => handleDeleteUser(record._id)}
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

      return items;
    },
    [
      canDelete,
      canRestore,
      selectedProfileId,
      handleDeleteUser,
      handleRestoreUser,
    ]
  );

  const renderMobileCard = useCallback(
    (record: Profile) => {
      const user =
        typeof record.user === 'object' && record.user
          ? (record.user as User)
          : null;
      const name = user?.name || '-';
      const initial =
        name !== '-' ? name.trim().charAt(0).toUpperCase() : undefined;
      const contact = user ? (user.email ?? user.phone) : undefined;
      const deleted = !!record.deletedAt;
      const roleCount = record.roles?.length || 0;
      const deptCount = record.departments?.length || 0;
      const locCount = record.locations?.length || 0;
      const dropdownItems = buildMobileDropdownItems(record);
      const hasSecondaryActions = (dropdownItems?.length ?? 0) > 0;

      return (
        <Card
          key={record._id}
          size="small"
          styles={{ body: { padding: token.paddingSM } }}
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: token.marginXS,
                minWidth: 0,
                flex: 1,
              }}
            >
              <AssetAvatar
                avatarKey={user?.avatar}
                fallback={initial ? <span>{initial}</span> : undefined}
                size={36}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <Typography.Text
                  strong
                  delete={deleted}
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
                  {name}
                </Typography.Text>
                {(contact || deleted) && (
                  <Typography.Text
                    type="secondary"
                    delete={deleted}
                    style={{
                      display: 'block',
                      fontSize: 13,
                      lineHeight: '20px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      minWidth: 0,
                    }}
                  >
                    {contact || '—'}
                  </Typography.Text>
                )}
              </div>
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

          {/* Metadata chips */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: token.marginXS,
            }}
          >
            {roleCount > 0 && (
              <Tag color="blue" style={{ margin: 0, fontSize: 12 }}>
                {roleCount} {roleCount === 1 ? 'role' : 'roles'}
              </Tag>
            )}
            {deptCount > 0 && (
              <Tag color="purple" style={{ margin: 0, fontSize: 12 }}>
                {deptCount} {deptCount === 1 ? 'dept' : 'depts'}
              </Tag>
            )}
            {locCount > 0 && (
              <Tag color="green" style={{ margin: 0, fontSize: 12 }}>
                {locCount} {locCount === 1 ? 'location' : 'locations'}
              </Tag>
            )}
            {deleted && (
              <Tag color="red" style={{ margin: 0, fontSize: 12 }}>
                Deleted
              </Tag>
            )}
          </div>

          {/* Primary action */}
          <Button
            type="primary"
            block
            icon={<EyeOutlined />}
            style={{ marginTop: token.marginXS }}
            onClick={() => navigate(PATH_USERS.profileDetail(record._id))}
          >
            View
          </Button>
        </Card>
      );
    },
    [buildMobileDropdownItems, navigate, token]
  );

  // ---- Filter Drawer content (shared between desktop inline & mobile drawer) ----

  const renderFilterControls = useCallback(
    () => (
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Input
          allowClear
          placeholder="Search by name"
          prefix={
            <SearchOutlined style={{ color: token.colorTextPlaceholder }} />
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Input
          allowClear
          placeholder="Search by email or phone"
          prefix={
            <SearchOutlined style={{ color: token.colorTextPlaceholder }} />
          }
          value={searchTermEmailOrPhone}
          onChange={(e) => setSearchTermEmailOrPhone(e.target.value)}
        />
        <Select
          mode="multiple"
          placeholder="Roles (all)"
          allowClear
          value={roleIds}
          onChange={setRoleIds}
          options={roleOptions.map((r) => ({ label: r.name, value: r._id }))}
          style={{ width: '100%' }}
          maxTagCount="responsive"
        />
        <Select
          mode="multiple"
          placeholder="Departments (all)"
          allowClear
          value={departmentIds}
          onChange={setDepartmentIds}
          options={departmentOptions.map((d) => ({
            label: d.name,
            value: d._id,
          }))}
          style={{ width: '100%' }}
          maxTagCount="responsive"
        />
        <Select
          mode="multiple"
          placeholder="Locations (all)"
          allowClear
          value={locationIds}
          onChange={setLocationIds}
          options={locationOptions.map((l) => ({
            label: l.name,
            value: l._id,
          }))}
          style={{ width: '100%' }}
          maxTagCount="responsive"
        />
        {hasActiveFilters && (
          <Button size="small" icon={<ClearOutlined />} onClick={clearFilters}>
            Clear all filters
          </Button>
        )}
      </Space>
    ),
    [
      searchTerm,
      searchTermEmailOrPhone,
      roleIds,
      departmentIds,
      locationIds,
      roleOptions,
      departmentOptions,
      locationOptions,
      hasActiveFilters,
      clearFilters,
      token,
    ]
  );

  // ---- Render ----

  return (
    <div style={{ padding: isMobile ? token.paddingSM : token.paddingMD }}>
      {/* ===== Desktop: original filter row + table ===== */}
      {!isMobile && (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: token.marginMD }}>
            <Col xs={24} sm={12} md={12} lg={8} xl={6} xxl={4}>
              <Input
                allowClear
                placeholder="Search by name"
                prefix={
                  <SearchOutlined
                    style={{ color: token.colorTextPlaceholder }}
                  />
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={24} sm={12} md={12} lg={8} xl={6} xxl={4}>
              <Input
                allowClear
                placeholder="Search by email or phone"
                prefix={
                  <SearchOutlined
                    style={{ color: token.colorTextPlaceholder }}
                  />
                }
                value={searchTermEmailOrPhone}
                onChange={(e) => setSearchTermEmailOrPhone(e.target.value)}
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={24} sm={12} md={12} lg={8} xl={6} xxl={4}>
              <Select
                mode="multiple"
                placeholder="Roles (all)"
                allowClear
                value={roleIds}
                onChange={setRoleIds}
                options={roleOptions.map((r) => ({
                  label: r.name,
                  value: r._id,
                }))}
                style={{ width: '100%' }}
                maxTagCount="responsive"
              />
            </Col>
            <Col xs={24} sm={12} md={12} lg={8} xl={6} xxl={4}>
              <Select
                mode="multiple"
                placeholder="Departments (all)"
                allowClear
                value={departmentIds}
                onChange={setDepartmentIds}
                options={departmentOptions.map((d) => ({
                  label: d.name,
                  value: d._id,
                }))}
                style={{ width: '100%' }}
                maxTagCount="responsive"
              />
            </Col>
            <Col xs={24} sm={12} md={12} lg={8} xl={6} xxl={4}>
              <Select
                mode="multiple"
                placeholder="Locations (all)"
                allowClear
                value={locationIds}
                onChange={setLocationIds}
                options={locationOptions.map((l) => ({
                  label: l.name,
                  value: l._id,
                }))}
                style={{ width: '100%' }}
                maxTagCount="responsive"
              />
            </Col>
            {hasActiveFilters && (
              <Col xs={24} sm={12} md={12} lg={8} xl={6} xxl={4}>
                <Button size="middle" onClick={clearFilters}>
                  Clear filters
                </Button>
              </Col>
            )}
          </Row>
          <Table<Profile>
            scroll={{ x: true }}
            columns={columns}
            dataSource={profiles}
            loading={isFetching}
            rowKey="_id"
            pagination={false}
            onChange={handleTableChange}
            size="middle"
          />
        </>
      )}

      {/* ===== Mobile: compact search + filter drawer trigger ===== */}
      {isMobile && (
        <>
          <Space
            style={{ width: '100%', marginBottom: token.marginSM }}
            size="small"
          >
            <Input
              allowClear
              placeholder="Search by name"
              prefix={
                <SearchOutlined style={{ color: token.colorTextPlaceholder }} />
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button
              icon={<FilterOutlined />}
              onClick={() => setFilterDrawerOpen(true)}
              type={hasActiveFilters ? 'primary' : 'default'}
            >
              Filters
              {activeFilterChips.length > 0 && (
                <Tag
                  color={hasActiveFilters ? 'cyan' : 'default'}
                  style={{ marginLeft: 4, marginRight: 0, lineHeight: '18px' }}
                >
                  {activeFilterChips.length}
                </Tag>
              )}
            </Button>
          </Space>

          {/* Active filter chips */}
          {activeFilterChips.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                marginBottom: token.marginSM,
              }}
            >
              {activeFilterChips.map((chip) => (
                <Tag
                  key={chip.key}
                  closable
                  onClose={(e) => {
                    e.preventDefault();
                    removeFilterChip(chip);
                  }}
                  style={{ maxWidth: 200 }}
                >
                  <Typography.Text
                    style={{
                      fontSize: 12,
                      maxWidth: 160,
                      display: 'inline-block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      verticalAlign: 'bottom',
                    }}
                  >
                    {chip.label}
                  </Typography.Text>
                </Tag>
              ))}
              {activeFilterChips.length > 1 && (
                <Button
                  type="link"
                  size="small"
                  onClick={clearFilters}
                  style={{ padding: 0, height: 'auto' }}
                >
                  Clear all
                </Button>
              )}
            </div>
          )}

          {/* Mobile Filter Drawer */}
          <Drawer
            title="Filters"
            placement="bottom"
            open={filterDrawerOpen}
            onClose={() => setFilterDrawerOpen(false)}
            height="auto"
            styles={{ body: { paddingBottom: token.paddingLG } }}
            extra={
              hasActiveFilters ? (
                <Button
                  size="small"
                  icon={<ClearOutlined />}
                  onClick={clearFilters}
                >
                  Clear
                </Button>
              ) : undefined
            }
          >
            {renderFilterControls()}
          </Drawer>
        </>
      )}

      {/* ===== Mobile: card list ===== */}
      {isMobile && (
        <div style={{ paddingBottom: 80 }}>
          {isFetching && profiles.length === 0 ? (
            <div
              style={{ textAlign: 'center', padding: `${token.paddingXL}px 0` }}
            >
              <Typography.Text type="secondary">Loading users…</Typography.Text>
            </div>
          ) : profiles.length === 0 ? (
            <Empty description="No users found" />
          ) : (
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {profiles.map(renderMobileCard)}
            </Space>
          )}
        </div>
      )}

      {/* ===== Pagination ===== */}
      {!isMobile && (
        <div style={{ marginTop: token.marginMD }}>
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
      )}
      {isMobile && profiles.length > 0 && (
        <div style={{ paddingBottom: 80 }}>
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
      )}
    </div>
  );
};

export default UsersTable;
