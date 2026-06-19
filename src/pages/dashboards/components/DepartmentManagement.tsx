import { PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  Grid,
  Input,
  List,
  Popconfirm,
  Row,
  Typography,
  message,
  theme,
} from 'antd';
import React, { FC, useState } from 'react';
import { usePermission } from '../../../hooks/usePermission';
import {
  useAddDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useGetDepartmentsQuery,
  Department,
} from '../../../services/departmentApi';

const { useBreakpoint } = Grid;

const DepartmentManagement: FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md; // Below md (768px) is mobile
  const buttonSize = screens.xs ? 'small' : screens.md ? 'large' : 'middle';
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { token } = theme.useToken();
  const canView = usePermission('department::view');
  const canCreate = usePermission('department::create');
  const canEdit = usePermission('department::edit');
  const canDelete = usePermission('department::delete');
  const canRestore = usePermission('department::restore');

  const [addDepartment, { isLoading: isAdding }] = useAddDepartmentMutation();
  const [updateDepartment, { isLoading: isUpdating }] =
    useUpdateDepartmentMutation();
  const [deleteDepartment] = useDeleteDepartmentMutation();
  const { data, isLoading: isLoadingDepartments } = useGetDepartmentsQuery();
  // const [fetchDepartments] = useLazyGetDepartmentsQuery();

  // useEffect(() => {
  //   fetchDepartments();
  // }, []);

  const handleAdd = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;
    try {
      await addDepartment({ name: trimmedInput }).unwrap();
      message.success('Department added successfully');
      setInput('');
    } catch (error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Failed to add department';
      message.error(errMsg);
    }
  };

  const handleSaveEdit = async (id: string) => {
    const trimmedEditValue = editValue.trim();
    if (!trimmedEditValue) return;

    try {
      await updateDepartment({ id, name: trimmedEditValue }).unwrap();
      message.success('Department updated successfully');
      setEditingId(null);
      setEditValue('');
    } catch (error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Failed to update department';
      message.error(errMsg);
    }
  };

  const handleRestore = async (record: Department) => {
    try {
      updateDepartment({
        id: record._id,
        name: record.name,
        restore: true,
      }).unwrap();

      message.success('Department restored successfully');
    } catch {
      message.error('Failed to restore department');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDepartment({ id }).unwrap();
      message.success('Department deleted successfully');
    } catch (error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Failed to delete department';
      message.error(errMsg);
    }
  };

  return (
    <div
      style={{
        padding: isMobile ? token.paddingMD : token.paddingLG,
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        paddingTop: isMobile ? token.paddingSM : token.paddingMD,
        marginTop: isMobile ? 12 : 16,
      }}
    >
      <Typography.Title 
        level={5} 
        style={{ 
          marginTop: 0,
          fontSize: isMobile ? '16px' : undefined,
        }}
      >
        Departments
      </Typography.Title>

      {canView && canCreate && (
        <Row 
          gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} 
          style={{ marginBottom: isMobile ? 12 : 16 }}
        >
          <Col xs={24} sm={24} md={undefined} flex={isMobile ? undefined : 'auto'}>
            <Input
              placeholder="Add a new department"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              size={isMobile ? 'middle' : 'large'}
            />
          </Col>
          <Col xs={24} sm={24} md={undefined} flex={isMobile ? undefined : '120px'}>
            <Button
              icon={<PlusOutlined />}
              type="primary"
              size={buttonSize}
              block={isMobile}
              style={{ width: isMobile ? '100%' : '100%' }}
              onClick={handleAdd}
              disabled={!input.trim() || isAdding}
              loading={isAdding}
            >
              Add
            </Button>
          </Col>
        </Row>
      )}

      <List
        bordered
        dataSource={data?.data?.departments?.records || []}
        loading={isLoadingDepartments}
        locale={{ emptyText: 'No departments found' }}
        style={{ 
          maxHeight: isMobile ? 300 : 400, 
          overflowY: 'auto' 
        }}
        size={isMobile ? 'small' : 'default'}
        renderItem={(item) => {
          const getActions = (): React.ReactNode[] => {
            if (!canView) return [];

            // Deleted item - show restore button
            if (item.deletedAt) {
              return canRestore
                ? [
                    <Popconfirm
                      key="restore"
                      title="Are you sure you want to restore this department?"
                      onConfirm={() => handleRestore(item)}
                    >
                      <Button
                        type="primary"
                        variant="solid"
                        color="green"
                        size={buttonSize}
                        style={{ minWidth: isMobile ? '60px' : '80px' }}
                      >
                        Restore
                      </Button>
                    </Popconfirm>,
                  ]
                : [];
            }

            // Editing mode
            if (editingId === item._id) {
              return [
                canEdit && (
                  <Button
                    key="save"
                    type="primary"
                    onClick={() => handleSaveEdit(item._id)}
                    loading={isUpdating}
                    disabled={!editValue.trim() || isUpdating}
                    size={buttonSize}
                    style={{ minWidth: isMobile ? '60px' : '80px' }}
                  >
                    Save
                  </Button>
                ),
                <Button
                  key="cancel"
                  onClick={() => setEditingId(null)}
                  disabled={isUpdating}
                  size={buttonSize}
                  style={{ minWidth: isMobile ? '60px' : '80px' }}
                >
                  Cancel
                </Button>,
              ].filter(Boolean);
            }

            // Normal mode - show edit/delete buttons
            return [
              canEdit && (
                <Button
                  key="edit"
                  type="primary"
                  onClick={() => {
                    setEditingId(item._id);
                    setEditValue(item.name);
                  }}
                  size={buttonSize}
                  style={{ minWidth: isMobile ? '60px' : '80px' }}
                >
                  Edit
                </Button>
              ),
              canDelete && (
                <Popconfirm
                  key="delete"
                  title="Are you sure you want to delete this department?"
                  onConfirm={() => handleDelete(item._id)}
                >
                  <Button 
                    type="primary" 
                    danger 
                    size={buttonSize}
                    style={{ minWidth: isMobile ? '60px' : '80px' }}
                  >
                    Delete
                  </Button>
                </Popconfirm>
              ),
            ].filter(Boolean);
          };

          return (
            <List.Item 
              actions={getActions()}
              style={{
                padding: isMobile ? '8px 12px' : undefined,
              }}
            >
              {editingId === item._id ? (
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  size={isMobile ? 'small' : 'middle'}
                  disabled={!canEdit}
                  style={{ 
                    maxWidth: isMobile ? '48%' : '300px'
                  }}
                />
              ) : (
                <Typography.Text
                  delete={!!item.deletedAt}
                  type={item.deletedAt ? 'secondary' : undefined}
                  style={{ fontSize: isMobile ? '13px' : undefined }}
                >
                  {item.name}
                </Typography.Text>
              )}
            </List.Item>
          );
        }}
      />
    </div>
  );
};

export default DepartmentManagement;
