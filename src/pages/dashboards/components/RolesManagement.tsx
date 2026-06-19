import { useState } from 'react';
import {
  Typography,
  Row,
  Col,
  Grid,
  Input,
  Button,
  Space,
  Spin,
  message,
  theme,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  useGetRolesQuery,
  useAddRoleMutation,
  Role,
} from '../../../services/roleApi';
// import { useAppSelector } from '../../../hooks';
import { groupPermissionsByEntity } from '../../../utils';
import RoleCard from './RoleCard';
import { useGetPermissionsQuery } from '../../../services/permissionsApi';
import { usePermission } from '../../../hooks/usePermission';

const { useBreakpoint } = Grid;

const { Title } = Typography;

export default function RolesManager() {
  const screens = useBreakpoint();
  const isMobile = !screens.md; // Below md (768px) is mobile
  const { token } = theme.useToken();
  const { data, isLoading } = useGetRolesQuery();
  const [addRole, { isLoading: isAdding }] = useAddRoleMutation();
  // const [fetchPermissions] = useLazyGetPermissionsQuery();
  const { data: permissions } = useGetPermissionsQuery();
  // const { permissions } = useAppSelector((state) => state.auth);
  const canView = usePermission('role::view');
  const canCreate = usePermission('role::create');

  const [newRole, setNewRole] = useState('');
  const roles: Role[] = data?.data?.roles?.records ?? [];
  const permissionGroups = groupPermissionsByEntity(
    permissions?.data?.permissions?.records || []
  );

  // useEffect(() => {
  //   if (permissions.length > 0) return;
  //   fetchPermissions();
  // }, []);

  const handleAddRole = async () => {
    if (!newRole.trim()) return;
    try {
      await addRole({ name: newRole, permissionCodes: [] }).unwrap();
      message.success('Role added');
      setNewRole('');
    } catch(error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Failed to add role';
      message.error(errMsg);
    }
  };

  if (isLoading)
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
        }}
      >
        <Spin size="default" />
      </div>
    );

  return (
    <div
      style={{
        padding: isMobile ? token.paddingMD : token.paddingLG,
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        marginTop: isMobile ? 12 : 16,
      }}
    >
      <Title 
        level={5}
        style={{ fontSize: isMobile ? '16px' : undefined }}
      >
        Roles ({roles.length})
      </Title>

      {/* Add Role */}
      {canView && canCreate && (
        <Row 
          gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} 
          style={{ marginBottom: isMobile ? 12 : 16 }}
        >
          <Col xs={24} sm={24} md={undefined} flex={isMobile ? undefined : 'auto'}>
            <Input
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Add a new role"
              size={isMobile ? 'middle' : 'large'}
              readOnly={isAdding}
            />
          </Col>
          <Col xs={24} sm={24} md={undefined} flex={isMobile ? undefined : '120px'}>
            <Button
              type="primary"
              onClick={handleAddRole}
              disabled={!newRole.trim() || isAdding}
              loading={isAdding}
              icon={<PlusOutlined />}
              size={isMobile ? 'middle' : 'large'}
              block={isMobile}
              style={{ width: '100%' }}
            >
              Add
            </Button>
          </Col>
        </Row>
      )}

      {/* Roles List */}
      <Space 
        direction="vertical" 
        size={isMobile ? 'small' : 'middle'}
        style={{ width: '100%' }}
      >
        {roles.map((role) => (
          <RoleCard
            key={role._id}
            role={role}
            permissionGroups={permissionGroups}
          />
        ))}
      </Space>
    </div>
  );
}
