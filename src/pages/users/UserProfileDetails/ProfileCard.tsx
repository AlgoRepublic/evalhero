import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Typography,
  Spin,
  Button,
  Form,
  Select,
  Switch,
  Tag,
  message,
  Flex,
  theme,
  Input,
  Upload,
  Avatar,
  Popconfirm,
} from 'antd';
import {
  UserOutlined,
  EditOutlined,
  SafetyOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  CheckOutlined,
  CloseOutlined,
  CameraOutlined,
  DeleteOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { AssetAvatar } from '../../../components/AssetAvatar/AssetAvatar';
import { usePermission } from '../../../hooks/usePermission';
import {
  useUpdateUserProfileMutation,
  useSetAdminStatusMutation,
  useDeleteUserMutation,
} from '../../../services/usersApi';
import { useGetRolesQuery } from '../../../services/roleApi';
import { useGetDepartmentsQuery } from '../../../services/departmentApi';
import { useGetLocationsQuery } from '../../../services/locationsApi';
import type { Profile } from '../../../features/auth/authSlice';

function getRoleIds(roles: Profile['roles']): string[] {
  if (!roles?.length) return [];
  return roles.map((r) => String(typeof r.role === 'string' ? r.role : (r.role as { _id: string })._id));
}
function getDepartmentIds(departments: Profile['departments']): string[] {
  if (!departments?.length) return [];
  return departments.map((d) =>
    String(typeof d.department === 'string' ? d.department : (d.department as { _id: string })._id)
  );
}
function getLocationIds(locations: Profile['locations']): string[] {
  if (!locations?.length) return [];
  return locations.map((l) =>
    String(typeof l.location === 'string' ? l.location : (l.location as { _id: string })._id)
  );
}

function getRoleName(roleItem: Profile['roles'][0], roleMap: Map<string, string>): string {
  const id = typeof roleItem.role === 'string' ? roleItem.role : (roleItem.role as { _id: string; name?: string })._id;
  const name = typeof roleItem.role === 'object' && roleItem.role && 'name' in roleItem.role
    ? (roleItem.role as { name: string }).name
    : null;
  return name ?? roleMap.get(id) ?? id;
}
function getDepartmentName(deptItem: Profile['departments'][0], departmentMap: Map<string, string>): string {
  const id = typeof deptItem.department === 'string' ? deptItem.department : (deptItem.department as { _id: string })._id;
  const name = typeof deptItem.department === 'object' && deptItem.department && 'name' in deptItem.department
    ? (deptItem.department as { name: string }).name
    : null;
  return name ?? departmentMap.get(id) ?? id;
}
function getLocationName(locItem: Profile['locations'][0], locationMap: Map<string, string>): string {
  const id = typeof locItem.location === 'string' ? locItem.location : (locItem.location as { _id: string })._id;
  const name = typeof locItem.location === 'object' && locItem.location && 'name' in locItem.location
    ? (locItem.location as { name: string }).name
    : null;
  return name ?? locationMap.get(id) ?? id;
}

const selectFilterOption = (input: string, option?: { label?: string; value?: string }) =>
  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase());

export interface ProfileCardProps {
  displayName: string;
  email?: string;
  phone?: string;
  avatar?: string | null;
  /** Whether the profile's user is an admin */
  isAdmin?: boolean;
  /** When true (logged-in user is admin), the Admin badge and Make admin control are shown */
  showAdminField?: boolean;
  /** When true, the viewed profile is the current user's; hide Make admin to avoid self-demotion */
  isOwnProfile?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  profileId?: string;
  profile?: Profile | null;
}

export function ProfileCard({
  displayName,
  email,
  phone,
  avatar,
  isAdmin = false,
  showAdminField = false,
  isOwnProfile = false,
  isLoading,
  isError,
  profileId,
  profile,
}: ProfileCardProps) {
  const { token } = theme.useToken();
  const canEdit = usePermission('user::update');
  const canDelete = usePermission('user::delete');
  const canRestore = usePermission('user::restore');
  const [editing, setEditing] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeletingLocal, setIsDeletingLocal] = useState(false);
  const [identityDisplayName, setIdentityDisplayName] = useState(displayName);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [form] = Form.useForm();

  // Keep identity form in sync when props or edit mode change
  useEffect(() => {
    if (!editingIdentity) {
      setIdentityDisplayName(displayName);
      setAvatarFile(null);
    }
  }, [displayName, editingIdentity]);

  const avatarPreviewUrl = useMemo(() => {
    if (!avatarFile) return undefined;
    return URL.createObjectURL(avatarFile);
  }, [avatarFile]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const [updateProfile, { isLoading: isUpdating }] = useUpdateUserProfileMutation();
  const [setAdminStatus, { isLoading: isSettingAdmin }] = useSetAdminStatusMutation();
  const [deleteUser] = useDeleteUserMutation();
  const { data: rolesData } = useGetRolesQuery(undefined, { skip: !profile });
  const { data: departmentsData } = useGetDepartmentsQuery(undefined, { skip: !profile });
  const { data: locationsData } = useGetLocationsQuery(undefined, { skip: !profile });

  const roleMap = useMemo(() => {
    const map = new Map<string, string>();
    rolesData?.data?.roles?.records?.forEach((r) => map.set(r._id, r.name));
    return map;
  }, [rolesData]);
  const departmentMap = useMemo(() => {
    const map = new Map<string, string>();
    departmentsData?.data?.departments?.records?.forEach((d) => map.set(d._id, d.name));
    return map;
  }, [departmentsData]);
  const locationMap = useMemo(() => {
    const map = new Map<string, string>();
    locationsData?.data?.locations?.records?.forEach((l) => map.set(l._id, l.name));
    return map;
  }, [locationsData]);

  const roleOptions = rolesData?.data?.roles?.records ?? [];
  const departmentOptions = departmentsData?.data?.departments?.records ?? [];
  const locationOptions = locationsData?.data?.locations?.records ?? [];

  const showEdit = Boolean(canEdit && profileId && profile);
  const canEditIdentity = Boolean(canEdit && profileId && profile);

  // Sync form values when entering edit mode so Selects show current selections
  const initialAssignmentValues = useMemo(() => {
    if (!profile) return undefined;
    return {
      roleIds: getRoleIds(profile.roles ?? []),
      departmentIds: getDepartmentIds(profile.departments ?? []),
      locationIds: getLocationIds(profile.locations ?? []),
    };
  }, [profile]);

  useEffect(() => {
    if (!editing || !initialAssignmentValues) return;
    form.resetFields();
    // Defer so Form and Selects are mounted and options are available
    const id = setTimeout(() => {
      form.setFieldsValue(initialAssignmentValues);
    }, 0);
    return () => clearTimeout(id);
  }, [editing, initialAssignmentValues, form]);

  const startEditing = () => {
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    form.resetFields();
  };

  const handleSave = async () => {
    if (!profileId) return;
    try {
      const values = await form.validateFields();
      await updateProfile({
        profileId,
        roleIds: values.roleIds ?? [],
        departmentIds: values.departmentIds ?? [],
        locationIds: values.locationIds ?? [],
      }).unwrap();
      message.success('Profile updated successfully');
      setEditing(false);
    } catch (err: unknown) {
      const e = err as { data?: { message?: string }; message?: string };
      message.error(e?.data?.message ?? e?.message ?? 'Failed to update profile');
    }
  };

  const canChangeAdmin = Boolean(showAdminField && !isOwnProfile && profileId && profile);
  const userId =
    profile && typeof profile.user === 'object' && profile.user
      ? (profile.user as { _id: string })._id
      : (profile?.user as string) ?? '';

  const handleAdminChange = async (checked: boolean) => {
    if (!userId) return;
    try {
      await setAdminStatus({ userId, isAdmin: checked, profileId: profileId ?? undefined }).unwrap();
      message.success(checked ? 'User is now an admin' : 'Admin access removed');
    } catch (err: unknown) {
      const e = err as { data?: { message?: string }; message?: string };
      message.error(e?.data?.message ?? e?.message ?? 'Failed to update admin status');
    }
  };

  const handleDeleteUser = async () => {
    if (!profileId || isOwnProfile) return;
    setIsDeletingLocal(true);
    try {
      await deleteUser(profileId).unwrap();
      message.success('User deleted successfully');
    } catch (err: unknown) {
      const e = err as { data?: { message?: string }; message?: string };
      message.error(e?.data?.message ?? e?.message ?? 'Failed to delete user');
    } finally {
      setIsDeletingLocal(false);
    }
  };

  const handleRestoreUser = async () => {
    if (!profileId) return;
    setIsRestoring(true);
    try {
      await updateProfile({ profileId, restore: true }).unwrap();
      message.success('User restored successfully');
    } catch (err: unknown) {
      const e = err as { data?: { message?: string }; message?: string };
      message.error(e?.data?.message ?? e?.message ?? 'Failed to restore user');
    } finally {
      setIsRestoring(false);
    }
  };

  const startEditingIdentity = () => {
    setIdentityDisplayName(displayName);
    setAvatarFile(null);
    setEditingIdentity(true);
  };

  const cancelEditingIdentity = () => {
    setEditingIdentity(false);
    setAvatarFile(null);
    setIdentityDisplayName(displayName);
  };

  const handleSaveIdentity = async () => {
    if (!profileId || !profile) return;
    const nameTrimmed = identityDisplayName?.trim();
    if (!nameTrimmed) {
      message.warning('Username is required');
      return;
    }
    try {
      await updateProfile({
        profileId,
        name: nameTrimmed,
        ...(avatarFile ? { avatar: avatarFile } : {}),
        // Keep current assignments so backend receives a valid payload if it requires at least one
        roleIds: getRoleIds(profile.roles ?? []),
        departmentIds: getDepartmentIds(profile.departments ?? []),
        locationIds: getLocationIds(profile.locations ?? []),
      }).unwrap();
      message.success('Avatar and username updated');
      setEditingIdentity(false);
      setAvatarFile(null);
    } catch (err: unknown) {
      const e = err as { data?: { message?: string }; message?: string };
      message.error(e?.data?.message ?? e?.message ?? 'Failed to update profile');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <Flex align="center" gap={token.marginLG} style={{ minHeight: 100 }}>
          <Spin size="large" />
          <Typography.Text type="secondary">Loading profile...</Typography.Text>
        </Flex>
      </Card>
    );
  }

  return (
    <Card
      styles={{
        body: { padding: token.paddingLG },
      }}
    >
      {/* Identity block */}
      <Flex
        gap={token.marginLG}
        wrap="wrap"
        align="flex-start"
        style={{ marginBottom: profile ? token.marginLG : 0 }}
      >
        {canEditIdentity && editingIdentity ? (
          <Flex vertical align="center" gap={token.marginXS} style={{ flexShrink: 0 }}>
            {avatarPreviewUrl ? (
              <Avatar
                size={72}
                src={avatarPreviewUrl}
                style={{ borderRadius: token.borderRadiusLG }}
              />
            ) : (
              <AssetAvatar
                avatarKey={avatar}
                fallback={<UserOutlined />}
                size={72}
                style={{ flexShrink: 0, borderRadius: token.borderRadiusLG }}
              />
            )}
            <Upload
              showUploadList={false}
              accept="image/*"
              beforeUpload={(file) => {
                setAvatarFile(file);
                return false; // prevent auto upload
              }}
            >
              <Button type="link" size="small" icon={<CameraOutlined />}>
                Change photo
              </Button>
            </Upload>
          </Flex>
        ) : (
          <AssetAvatar
            avatarKey={avatar}
            fallback={<UserOutlined />}
            size={72}
            style={{ flexShrink: 0, borderRadius: token.borderRadiusLG }}
          />
        )}
        <Flex vertical gap={token.marginXS} style={{ minWidth: 0, flex: 1 }}>
          {canEditIdentity && editingIdentity ? (
            <Flex vertical gap={token.marginSM} style={{ maxWidth: 320 }}>
              <Input
                value={identityDisplayName}
                onChange={(e) => setIdentityDisplayName(e.target.value)}
                placeholder="Display name"
                size="large"
                style={{ fontWeight: 600 }}
              />
              <Flex gap={token.marginXS}>
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={handleSaveIdentity}
                  loading={isUpdating}
                >
                  Save
                </Button>
                <Button size="small" icon={<CloseOutlined />} onClick={cancelEditingIdentity} disabled={isUpdating}>
                  Cancel
                </Button>
              </Flex>
            </Flex>
          ) : (
            <Flex align="center" gap={token.marginXS} wrap="wrap">
              <Typography.Title
                level={4}
                style={{ margin: 0, fontWeight: 600 }}
                delete={!!profile?.deletedAt}
                type={profile?.deletedAt ? 'secondary' : undefined}
              >
                {displayName}
              </Typography.Title>
              {canEditIdentity && (
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={startEditingIdentity}
                  style={{ padding: 0, height: 'auto' }}
                >
                  Edit
                </Button>
              )}
              {showAdminField && isAdmin && (
                <Tag color="gold" icon={<SafetyOutlined />} style={{ fontWeight: 600 }}>
                  Admin
                </Tag>
              )}
            </Flex>
          )}
          {email && (
            <Typography.Text type="secondary" style={{ fontSize: token.fontSize }}>
              {email}
            </Typography.Text>
          )}
          {phone && (
            <Typography.Text type="secondary" style={{ fontSize: token.fontSize }}>
              {phone}
            </Typography.Text>
          )}
          {canChangeAdmin && (
            <Flex
              align="flex-start"
              gap={token.marginMD}
              style={{
                marginTop: token.marginSM,
                padding: token.paddingSM,
                paddingLeft: token.paddingMD,
                background: token.colorFillTertiary,
                borderRadius: token.borderRadius,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Flex vertical gap={token.marginXS} style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text strong style={{ fontSize: token.fontSizeSM }}>
                  {isAdmin ? 'Admin' : 'User'}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  {isAdmin
                    ? 'Currently Admin. Turn off to remove admin access (demote to User).'
                    : 'Currently User. Turn on to make this person an Admin.'}
                </Typography.Text>
              </Flex>
              <Flex align="center" gap={token.marginSM} style={{ flexShrink: 0 }}>
                {/* <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, whiteSpace: 'nowrap' }}>
                  User
                </Typography.Text> */}
                <Switch
                  checked={isAdmin}
                  onChange={handleAdminChange}
                  disabled={isSettingAdmin || !userId}
                  loading={isSettingAdmin}
                  checkedChildren="Admin"
                  unCheckedChildren="User"
                />
                {/* <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, whiteSpace: 'nowrap' }}>
                 Admin
                </Typography.Text> */}
              </Flex>
            </Flex>
          )}
          {isError && (
            <Typography.Text type="danger" style={{ fontSize: token.fontSizeSM }}>
              Could not load profile details
            </Typography.Text>
          )}
        </Flex>
      </Flex>

      {/* Assignments: roles, departments, locations */}
      {profile && (
        <div
          style={{
            padding: token.paddingMD,
            background: token.colorFillQuaternary,
            borderRadius: token.borderRadius,
          }}
        >
          {editing ? (
            <Form
              form={form}
              layout="vertical"
              preserve={false}
              initialValues={initialAssignmentValues}
            >
              <Flex vertical gap={token.marginMD}>
                <Form.Item name="roleIds" label="Roles" style={{ marginBottom: 0 }}>
                  <Select
                    mode="multiple"
                    placeholder="Select roles"
                    size="middle"
                    options={roleOptions.map((r) => ({ label: r.name, value: String(r._id) }))}
                    allowClear
                    showSearch
                    filterOption={selectFilterOption}
                    maxTagCount="responsive"
                  />
                </Form.Item>
                <Form.Item name="departmentIds" label="Departments" style={{ marginBottom: 0 }}>
                  <Select
                    mode="multiple"
                    placeholder="Select departments"
                    size="middle"
                    options={departmentOptions.map((d) => ({ label: d.name, value: String(d._id) }))}
                    allowClear
                    showSearch
                    filterOption={selectFilterOption}
                    maxTagCount="responsive"
                  />
                </Form.Item>
                <Form.Item name="locationIds" label="Locations" style={{ marginBottom: 0 }}>
                  <Select
                    mode="multiple"
                    placeholder="Select locations"
                    size="middle"
                    options={locationOptions.map((l) => ({ label: l.name, value: String(l._id) }))}
                    allowClear
                    showSearch
                    filterOption={selectFilterOption}
                    maxTagCount="responsive"
                  />
                </Form.Item>
                <Flex gap={token.marginSM} style={{ marginTop: token.marginXS }}>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={handleSave}
                    loading={isUpdating}
                  >
                    Save
                  </Button>
                  <Button icon={<CloseOutlined />} onClick={cancelEditing} disabled={isUpdating}>
                    Cancel
                  </Button>
                </Flex>
              </Flex>
            </Form>
          ) : (
            <Flex vertical gap={token.marginSM}>
              <Flex align="center" gap={token.marginXS} wrap="wrap">
                <SafetyOutlined style={{ color: token.colorPrimary, width: 16, flexShrink: 0 }} />
                <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, minWidth: 72 }}>Roles</span>
                {profile.roles?.length ? (
                  <Flex wrap="wrap" gap={4}>
                    {profile.roles.map((roleItem) => (
                      <Tag key={roleItem._id} color="blue">
                        {getRoleName(roleItem, roleMap)}
                      </Tag>
                    ))}
                  </Flex>
                ) : (
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>—</Typography.Text>
                )}
              </Flex>
              <Flex align="center" gap={token.marginXS} wrap="wrap">
                <TeamOutlined style={{ color: token.colorPrimary, width: 16, flexShrink: 0 }} />
                <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, minWidth: 72 }}>Departments</span>
                {profile.departments?.length ? (
                  <Flex wrap="wrap" gap={4}>
                    {profile.departments.map((deptItem) => (
                      <Tag key={deptItem._id} color="purple">
                        {getDepartmentName(deptItem, departmentMap)}
                      </Tag>
                    ))}
                  </Flex>
                ) : (
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>—</Typography.Text>
                )}
              </Flex>
              <Flex align="center" gap={token.marginXS} wrap="wrap">
                <EnvironmentOutlined style={{ color: token.colorPrimary, width: 16, flexShrink: 0 }} />
                <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, minWidth: 72 }}>Locations</span>
                {profile.locations?.length ? (
                  <Flex wrap="wrap" gap={4}>
                    {profile.locations.map((locItem) => (
                      <Tag key={locItem._id} color="green">
                        {getLocationName(locItem, locationMap)}
                      </Tag>
                    ))}
                  </Flex>
                ) : (
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>—</Typography.Text>
                )}
              </Flex>
            </Flex>
          )}
          <Flex justify="space-between" align="center" wrap="wrap" gap={token.marginSM} style={{ marginTop: editing ? token.marginMD : token.marginSM }}>
            {/* <Typography.Text strong style={{ fontSize: token.fontSize }}>
              Assignments
            </Typography.Text> */}
            <Flex gap={token.marginXS} wrap="wrap">
              {showEdit && !editing && (
                <Button type="primary" size="middle" icon={<EditOutlined />} onClick={startEditing}>
                  Edit
                </Button>
              )}
              {canRestore && profile?.deletedAt && (
                <Popconfirm
                  title="Restore this user?"
                  description="The user will be able to access the organization again."
                  onConfirm={handleRestoreUser}
                  okText="Restore"
                >
                  <Button
                    type="primary"
                    color="green"
                    size="middle"
                    icon={<RollbackOutlined />}
                    loading={isRestoring}
                  >
                    Restore
                  </Button>
                </Popconfirm>
              )}
              {canDelete && !isOwnProfile && profile && !profile.deletedAt && (
                <Popconfirm
                  title="Delete this user?"
                  description="The user will be soft-deleted and can be restored later."
                  onConfirm={handleDeleteUser}
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    danger
                    size="middle"
                    icon={<DeleteOutlined />}
                    loading={isDeletingLocal}
                  >
                    Delete
                  </Button>
                </Popconfirm>
              )}
            </Flex>
          </Flex>
        </div>
      )}
    </Card>
  );
}
