import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Grid,
  Input,
  Button,
  Popconfirm,
  Space,
  Typography,
  Collapse,
  Checkbox,
  message,
  Divider,
} from 'antd';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import {
  Role,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} from '../../../services/roleApi';
import { usePermission } from '../../../hooks/usePermission';

const { useBreakpoint } = Grid;

const { Text } = Typography;
const { Panel } = Collapse;

interface RoleCardProps {
  role: Role;
  permissionGroups: {
    entity: string;
    permissions: { _id: string; code: string; name: string }[];
  }[];
}

/**
 * Get all permission codes from all groups
 */
const getAllPermissionCodes = (
  permissionGroups: {
    entity: string;
    permissions: { _id: string; code: string; name: string }[];
  }[]
): string[] => {
  return permissionGroups.flatMap((group) =>
    group.permissions.map((perm) => perm.code)
  );
};

/**
 * Get dependent permissions that should be checked when a permission is checked
 * e.g., if 'edit' is checked, 'view' should also be checked
 */
const getDependentPermissions = (
  code: string,
  allPermissions: { _id: string; code: string; name: string }[]
): string[] => {
  const dependencies: string[] = [];
  
  // Extract entity and action from code (e.g., "role::edit" -> entity: "role", action: "edit")
  const parts = code.split('::');
  if (parts.length !== 2) return dependencies;
  
  const [entity, action] = parts;
  const allCodes = allPermissions.map((p) => p.code);
  
  // If action is edit, delete, or restore, ensure view is also checked
  if (['edit', 'delete', 'restore', 'create'].includes(action)) {
    const viewCode = `${entity}::view`;
    if (allCodes.includes(viewCode)) {
      dependencies.push(viewCode);
    }
  }
  
  // If action is delete, ensure edit is also checked (if exists)
  if (action === 'delete') {
    const editCode = `${entity}::edit`;
    if (allCodes.includes(editCode)) {
      dependencies.push(editCode);
    }
  }
  
  return dependencies;
};

/**
 * Get permissions that depend on the given permission
 * e.g., if 'view' is unchecked, 'edit' and 'delete' should also be unchecked
 */
const getDependentOnPermissions = (
  code: string,
  allPermissions: { _id: string; code: string; name: string }[]
): string[] => {
  const dependents: string[] = [];
  
  const parts = code.split('::');
  if (parts.length !== 2) return dependents;
  
  const [entity, action] = parts;
  const allCodes = allPermissions.map((p) => p.code);
  
  // If view is unchecked, uncheck edit, delete, restore, create
  if (action === 'view') {
    ['edit', 'delete', 'restore', 'create'].forEach((depAction) => {
      const depCode = `${entity}::${depAction}`;
      if (allCodes.includes(depCode)) {
        dependents.push(depCode);
      }
    });
  }
  
  // If edit is unchecked, uncheck delete
  if (action === 'edit') {
    const deleteCode = `${entity}::delete`;
    if (allCodes.includes(deleteCode)) {
      dependents.push(deleteCode);
    }
  }
  
  return dependents;
};

export default function RoleCard({ role, permissionGroups }: RoleCardProps) {
  const screens = useBreakpoint();
  const isMobile = !screens.md; // Below md (768px) is mobile
  const buttonSize = screens.xs ? 'small' : screens.md ? 'large' : 'middle';
  const [updateRole, { isLoading: isUpdating }] = useUpdateRoleMutation();
  const [deleteRole, { isLoading: isDeleting }] = useDeleteRoleMutation();

  const canView = usePermission('role::view');
  const canEdit = usePermission('role::edit');
  const canDelete = usePermission('role::delete');
  const canRestore = usePermission('role::restore');

  const [isEditing, setIsEditing] = useState(false);
  const [activePanelKeys, setActivePanelKeys] = useState<string[]>([]);
  const [editedName, setEditedName] = useState(role.name);
  const [editedPermissions, setEditedPermissions] = useState(
    role.permissionCodes
  );

  // Get all permissions flattened for dependency checking
  const allPermissions = useMemo(
    () => permissionGroups.flatMap((group) => group.permissions),
    [permissionGroups]
  );

  // Sync state when role prop changes (but not when editing)
  useEffect(() => {
    if (!isEditing) {
      setEditedName(role.name);
      setEditedPermissions(role.permissionCodes);
    }
  }, [role.name, role.permissionCodes, isEditing]);

  // Toggle permission with dependency handling
  const togglePermission = (code: string, checked: boolean) => {
    setEditedPermissions((prev) => {
      let newPermissions = [...prev];
      
      if (checked) {
        // Add the permission and its dependencies
        if (!newPermissions.includes(code)) {
          newPermissions.push(code);
        }
        
        // Add dependent permissions (e.g., view when edit is checked)
        const dependencies = getDependentPermissions(code, allPermissions);
        dependencies.forEach((depCode) => {
          if (!newPermissions.includes(depCode)) {
            newPermissions.push(depCode);
          }
        });
      } else {
        // Remove the permission
        newPermissions = newPermissions.filter((c) => c !== code);
        
        // Remove permissions that depend on this one (e.g., edit/delete when view is unchecked)
        const dependents = getDependentOnPermissions(code, allPermissions);
        dependents.forEach((depCode) => {
          newPermissions = newPermissions.filter((c) => c !== depCode);
        });
      }
      
      return newPermissions;
    });
  };

  // Check all permissions in a specific group
  const checkAllInGroup = (group: {
    entity: string;
    permissions: { _id: string; code: string; name: string }[];
  }) => {
    setEditedPermissions((prev) => {
      const newPermissions = [...prev];
      
      group.permissions.forEach((perm) => {
        if (!newPermissions.includes(perm.code)) {
          newPermissions.push(perm.code);
        }
        
        // Add dependencies
        const dependencies = getDependentPermissions(perm.code, allPermissions);
        dependencies.forEach((depCode) => {
          if (!newPermissions.includes(depCode)) {
            newPermissions.push(depCode);
          }
        });
      });
      
      return newPermissions;
    });
  };

  // Uncheck all permissions in a specific group
  const uncheckAllInGroup = (group: {
    entity: string;
    permissions: { _id: string; code: string; name: string }[];
  }) => {
    setEditedPermissions((prev) => {
      const groupCodes = group.permissions.map((p) => p.code);
      return prev.filter((code) => !groupCodes.includes(code));
    });
  };

  // Check if all permissions in a group are checked
  const isAllCheckedInGroup = (group: {
    entity: string;
    permissions: { _id: string; code: string; name: string }[];
  }): boolean => {
    return group.permissions.every((perm) =>
      editedPermissions.includes(perm.code)
    );
  };

  // Check if some (but not all) permissions in a group are checked
  const isSomeCheckedInGroup = (group: {
    entity: string;
    permissions: { _id: string; code: string; name: string }[];
  }): boolean => {
    const checkedCount = group.permissions.filter((perm) =>
      editedPermissions.includes(perm.code)
    ).length;
    return checkedCount > 0 && checkedCount < group.permissions.length;
  };

  // Check all permissions globally
  const checkAllPermissions = () => {
    const allCodes = getAllPermissionCodes(permissionGroups);
    setEditedPermissions((prev) => {
      const newPermissions = [...prev];
      
      allCodes.forEach((code) => {
        if (!newPermissions.includes(code)) {
          newPermissions.push(code);
        }
        
        // Add dependencies
        const dependencies = getDependentPermissions(code, allPermissions);
        dependencies.forEach((depCode) => {
          if (!newPermissions.includes(depCode)) {
            newPermissions.push(depCode);
          }
        });
      });
      
      return newPermissions;
    });
  };

  // Uncheck all permissions globally
  const uncheckAllPermissions = () => {
    setEditedPermissions([]);
  };

  // Check if all permissions are checked
  const allPermissionsChecked = useMemo(() => {
    const allCodes = getAllPermissionCodes(permissionGroups);
    return allCodes.length > 0 && allCodes.every((code) => editedPermissions.includes(code));
  }, [permissionGroups, editedPermissions]);

  // Save changes
  const handleSave = async () => {
    try {
      await updateRole({
        id: role._id,
        name: editedName,
        permissionCodes: editedPermissions,
      }).unwrap();
      message.success('Role updated');
      setIsEditing(false);
    } catch(error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Failed to update role';
      message.error(errMsg);
    }
  };

  // Cancel changes
  const handleCancel = () => {
    setEditedName(role.name);
    setEditedPermissions(role.permissionCodes);
    setIsEditing(false);
  };

  // Delete role
  const handleDelete = async () => {
    try {
      await deleteRole({ id: role._id }).unwrap();
      message.success('Role deleted');
    } catch {
      message.error('Failed to delete role');
    }
  };

  // Restore role
  const handleRestore = async () => {
    try {
      await updateRole({
        id: role._id,
        name: role.name,
        restore: true,
      }).unwrap();
      message.success('Role restored');
    } catch {
      message.error('Failed to restore role');
    }
  };

  return (
    <Card 
      size="small" 
      style={{ 
        borderRadius: 8, 
        marginBottom: isMobile ? 8 : 12,
        padding: isMobile ? '12px' : undefined,
      }}
    >
      <Row 
        align={screens.xs ? 'top' : 'middle'} 
        gutter={screens.xs ? [0, 8] : 16}
        justify='space-between'
        // wrap={false}
      >
        <Col xs={undefined} sm={undefined} md={undefined} flex={screens.xs ? undefined : '1 1 auto'}>
          {isEditing && !role.deletedAt ? (
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              style={{ fontWeight: 600 }}
              size={screens.xs ? 'small' : screens.sm ? 'small' : 'middle'}
              disabled={isDeleting || isUpdating}
            />
          ) : (
            <Text
              strong
              delete={!!role.deletedAt}
              type={role.deletedAt ? 'secondary' : undefined}
              style={{ fontSize: screens.xs ? '14px' : undefined }}
            >
              {role.name}
            </Text>
          )}
        </Col>

        {canView && (
          <Col 
            xs={undefined} 
            sm={undefined} 
            md={undefined}
            // flex={screens.xs ? undefined : '0 0 auto'}
            style={{ 
              textAlign: 'right',
            //   marginTop: screens.xs ? 8 : 0,
            }}
          >
            <Space 
              size={screens.xs ? 'small' : screens.sm ? 'small' : 'middle'}
              // direction={screens.xs ? 'vertical' : 'horizontal'}
              style={{ width: screens.xs ? '100%' : 'auto' }}
              align='end'
            >
              {role.deletedAt ? (
                canRestore && (
                  <Popconfirm
                    title="Are you sure you want to restore this role?"
                    onConfirm={handleRestore}
                  >
                    <Button 
                      type="primary" 
                      variant='solid' 
                      color='green' 
                      size={buttonSize}
                      block={screens.xs}
                    >
                      Restore
                    </Button>
                  </Popconfirm>
                )
              ) : !isEditing ? (
                <>
                  {canEdit && (
                    <Button
                      type="primary"
                      size={buttonSize}
                      onClick={() => {
                        setIsEditing(true);
                        setActivePanelKeys(['permissions']);
                      }}
                      block={screens.xs}
                    >
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Popconfirm
                      title="Are you sure you want to delete this role?"
                      onConfirm={handleDelete}
                    >
                      <Button 
                        danger 
                        type="primary" 
                        size={buttonSize}
                        block={screens.xs}
                      >
                        Delete
                      </Button>
                    </Popconfirm>
                  )}
                </>
              ) : (
                <>
                  {canEdit && (
                    <Button
                      type="primary"
                      onClick={handleSave}
                      loading={isUpdating}
                      disabled={!editedName.trim()}
                      size={buttonSize}
                      block={screens.xs}
                    >
                      Save
                    </Button>
                  )}
                  <Button
                    type="default"
                    onClick={handleCancel}
                    disabled={isDeleting || isUpdating}
                    size={buttonSize}
                    block={screens.xs}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </Space>
          </Col>
        )}
      </Row>

      {/* Permissions */}
      {!role.deletedAt && (
        <Collapse
          activeKey={activePanelKeys}
          onChange={(keys) =>
            setActivePanelKeys(
              Array.isArray(keys) ? keys.map((key) => String(key)) : [String(keys)]
            )
          }
          bordered={false}
          expandIcon={({ isActive }) =>
            isActive ? <UpOutlined /> : <DownOutlined />
          }
          style={{ 
            marginTop: isMobile ? 12 : 12,
            backgroundColor: 'transparent'
          }}
          size={isMobile ? 'small' : 'large'}
        >
          <Panel 
            header={
              <span style={{ 
                fontSize: isMobile ? '14px' : undefined,
                fontWeight: 500
              }}>
                Permissions 
                {!isEditing && editedPermissions.length === 0 ? (
                    <Text type="secondary"> (No permissions attached to this role.)</Text>
                  ):  <></>
                }
              </span>
            } 
            key="permissions"
            style={{
              padding: isMobile ? '8px 0' : undefined
            }}
          >
            {isEditing && canView && canEdit && (
              <div style={{ marginBottom: isMobile ? 16 : 16 }}>
                <Space 
                  size={isMobile ? 'middle' : 'middle'}
                  wrap
                  style={{ width: isMobile ? '100%' : 'auto' }}
                >
                  <Button
                    size={isMobile ? 'middle' : 'small'}
                    type="link"
                    onClick={checkAllPermissions}
                    disabled={allPermissionsChecked || isDeleting || isUpdating}
                    style={{ 
                      padding: isMobile ? '8px 12px' : undefined,
                      fontSize: isMobile ? '13px' : undefined,
                      height: isMobile ? 'auto' : undefined
                    }}
                  >
                    Check All
                  </Button>
                  <Button
                    size={isMobile ? 'middle' : 'small'}
                    type="link"
                    onClick={uncheckAllPermissions}
                    disabled={editedPermissions.length === 0 || isDeleting || isUpdating}
                    style={{ 
                      padding: isMobile ? '8px 12px' : undefined,
                      fontSize: isMobile ? '13px' : undefined,
                      height: isMobile ? 'auto' : undefined
                    }}
                  >
                    Uncheck All
                  </Button>
                </Space>
                <Divider style={{ margin: isMobile ? '12px 0' : '12px 0' }} />
              </div>
            )}
            
            {permissionGroups.map((group) => (
              <div 
                key={group.entity} 
                style={{ 
                  marginBottom: isMobile ? 16 : 20,
                  paddingBottom: isMobile ? 12 : 16,
                  borderBottom: isMobile ? '1px solid #f0f0f0' : 'none'
                }}
              >
                <Row 
                  justify="space-between" 
                  align="middle" 
                  gutter={[8, isMobile ? 8 : 0]}
                  style={{ marginBottom: isMobile ? 12 : 8 }}
                >
                  <Col xs={24} sm={24} md={undefined}>
                    <Text 
                      strong 
                      style={{ 
                        fontSize: isMobile ? '14px' : undefined,
                        display: 'block',
                        marginBottom: isMobile ? 8 : 0
                      }}
                    >
                      {group.entity}
                    </Text>
                  </Col>
                  {isEditing && canView && canEdit && (
                    <Col xs={24} sm={24} md={undefined}>
                      <Space 
                        size="small" 
                        wrap
                        style={{ width: isMobile ? '100%' : 'auto' }}
                      >
                        <Button
                          size={isMobile ? 'middle' : 'small'}
                          type="link"
                          onClick={() => checkAllInGroup(group)}
                          disabled={
                            isAllCheckedInGroup(group) || isDeleting || isUpdating
                          }
                          style={{ 
                            padding: isMobile ? '8px 12px' : undefined,
                            fontSize: isMobile ? '13px' : undefined,
                            height: isMobile ? 'auto' : undefined
                          }}
                        >
                          Check All
                        </Button>
                        <Button
                          size={isMobile ? 'middle' : 'small'}
                          type="link"
                          onClick={() => uncheckAllInGroup(group)}
                          disabled={
                            (!isSomeCheckedInGroup(group) && !isAllCheckedInGroup(group)) ||
                            isDeleting ||
                            isUpdating
                          }
                          style={{ 
                            padding: isMobile ? '8px 12px' : undefined,
                            fontSize: isMobile ? '13px' : undefined,
                            height: isMobile ? 'auto' : undefined
                          }}
                        >
                          Uncheck All
                        </Button>
                      </Space>
                    </Col>
                  )}
                </Row>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    flexWrap: isMobile ? 'nowrap' : 'wrap',
                    gap: isMobile ? '8px' : '12px',
                    marginTop: isMobile ? 8 : 8
                  }}
                >
                  {group.permissions.map((perm) => (
                    <Checkbox
                      key={perm.code}
                      checked={editedPermissions.includes(perm.code)}
                      disabled={!isEditing || isDeleting || isUpdating || !canView || !canEdit}
                      onChange={(e) => {
                        if (canView && canEdit) {
                          togglePermission(perm.code, e.target.checked);
                        }
                      }}
                      style={{ 
                        fontSize: isMobile ? '14px' : undefined,
                        minHeight: isMobile ? '32px' : undefined,
                        display: 'flex',
                        alignItems: 'center',
                        padding: isMobile ? '4px 0' : undefined,
                        margin: 0,
                        width: isMobile ? '100%' : 'auto'
                      }}
                    >
                      {perm.name}
                    </Checkbox>
                  ))}
                </div>
              </div>
            ))}
          </Panel>
        </Collapse>
      )}
    </Card>
  );
}
