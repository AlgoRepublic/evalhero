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
import { FC, useState, useCallback, useMemo } from 'react';
import { usePermission } from '../../../hooks/usePermission';
import {
  useAddLocationMutation,
  useUpdateLocationMutation,
  useDeleteLocationMutation,
  useGetLocationsQuery,
  Location,
  // useLazyGetLocationsQuery,
} from '../../../services/locationsApi';

const { useBreakpoint } = Grid;

const LocationManagement: FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md; // Below md (768px) is mobile
  const buttonSize = screens.xs ? 'small' : screens.md ? 'large' : 'middle';
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { token } = theme.useToken();
  const canView = usePermission('location::view');
  const canCreate = usePermission('location::create');
  const canEdit = usePermission('location::edit');
  const canDelete = usePermission('location::delete');
  const canRestore = usePermission('location::restore');

  const [addLocation, { isLoading: isAdding }] = useAddLocationMutation();
  const [updateLocation, { isLoading: isUpdating }] =
    useUpdateLocationMutation();
  const [deleteLocation] = useDeleteLocationMutation();
  const { data, isLoading: isLoadingLocations } = useGetLocationsQuery();
  // const [fetchLocations] = useLazyGetLocationsQuery();

  // useEffect(() => {
  //   fetchLocations();
  // }, []);

  const handleAdd = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;
    try {
      await addLocation({ name: trimmedInput }).unwrap();
      message.success('Location added successfully');
      setInput('');
    } catch (error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Failed to add location';
      message.error(errMsg);
    }
  };

  const handleSaveEdit = async (id: string) => {
    const trimmedEditValue = editValue.trim();
    if (!trimmedEditValue) return;

    try {
      await updateLocation({ id, name: trimmedEditValue }).unwrap();
      message.success('Location updated successfully');
      setEditingId(null);
      setEditValue('');
    } catch (error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Failed to update location';
      message.error(errMsg);
    }
  };

  const handleRestore = async (record: Location) => {
    try {
      updateLocation({
        id: record._id,
        name: record.name,
        restore: true,
      }).unwrap();

      message.success('Location restored successfully');
    } catch {
      message.error('Failed to restore location');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLocation({ id }).unwrap();
      message.success('Location deleted successfully');
    } catch (error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Failed to delete location';
      message.error(errMsg);
    }
  };

  const handleStartEdit = useCallback((id: string, name: string) => {
    setEditingId(id);
    setEditValue(name);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditValue('');
  }, []);

  const buttonStyle = useMemo(() => ({ 
    minWidth: isMobile ? '60px' : '80px' 
  }), [isMobile]);

  const renderItemActions = useCallback(
    (item: Location) => {
      if (!canView) return [];

      const isEditing = editingId === item._id;
      const isDeleted = !!item.deletedAt;

      // Restore button for deleted items
      if (isDeleted) {
        return canRestore
          ? [
              <Popconfirm
                key="restore"
                title="Are you sure you want to restore this location?"
                onConfirm={() => handleRestore(item)}
              >
                <Button
                  type="primary"
                  variant="solid"
                  color="green"
                  style={buttonStyle}
                  size={buttonSize}
                >
                  Restore
                </Button>
              </Popconfirm>,
            ]
          : [];
      }

      // Edit mode buttons
      if (isEditing) {
        return [
          canEdit && (
            <Button
              key="save"
              type="primary"
              onClick={() => handleSaveEdit(item._id)}
              size={buttonSize}
              style={buttonStyle}
              loading={isUpdating}
              disabled={!editValue.trim() || isUpdating}
            >
              Save
            </Button>
          ),
          <Button
            key="cancel"
            onClick={handleCancelEdit}
            size={buttonSize}
            style={buttonStyle}
            disabled={isUpdating}
          >
            Cancel
          </Button>,
        ].filter(Boolean);
      }

      // Default view buttons
      return [
        canEdit && (
          <Button
            key="edit"
            type="primary"
            onClick={() => handleStartEdit(item._id, item.name)}
            size={buttonSize}
            style={buttonStyle}
          >
            Edit
          </Button>
        ),
        canDelete && (
          <Popconfirm
            key="delete"
            title="Are you sure you want to delete this location?"
            onConfirm={() => handleDelete(item._id)}
          >
            <Button 
              type="primary" 
              danger 
              size={buttonSize}
              style={buttonStyle}
            >
              Delete
            </Button>
          </Popconfirm>
        ),
      ].filter(Boolean);
    },
    [
      canView,
      canEdit,
      canDelete,
      canRestore,
      editingId,
      isUpdating,
      buttonStyle,
      buttonSize,
      handleStartEdit,
      handleCancelEdit,
      handleSaveEdit,
      handleDelete,
      handleRestore,
    ]
  );

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
        Locations
      </Typography.Title>

      {canView && canCreate && (
        <Row 
          gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} 
          style={{ marginBottom: isMobile ? 12 : 16 }}
        >
          <Col xs={24} sm={24} md={undefined} flex={isMobile ? undefined : 'auto'}>
            <Input
              placeholder="Add a new location"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              size={isMobile ? 'middle' : 'large'}
              readOnly={isAdding}
            />
          </Col>
          <Col xs={24} sm={24} md={undefined} flex={isMobile ? undefined : '120px'}>
            <Button
              icon={<PlusOutlined />}
              type="primary"
              size={isMobile ? 'middle' : 'large'}
              block={isMobile}
              style={{ width: '100%' }}
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
        dataSource={data?.data?.locations?.records || []}
        loading={isLoadingLocations}
        locale={{ emptyText: 'No locations found' }}
        style={{ 
          maxHeight: isMobile ? 300 : 400, 
          overflowY: 'auto' 
        }}
        size={isMobile ? 'small' : 'default'}
        renderItem={(item) => {
          const isEditing = editingId === item._id;
          const isDeleted = !!item.deletedAt;

          return (
            <List.Item 
              actions={renderItemActions(item)}
              style={{
                padding: isMobile ? '8px 12px' : undefined,
              }}
            >
              {isEditing ? (
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
                  delete={isDeleted} 
                  type={isDeleted ? 'secondary' : undefined}
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

export default LocationManagement;
