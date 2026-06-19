import { PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  Input,
  List,
  Popconfirm,
  Row,
  Typography,
  message,
  theme,
} from 'antd';
import React, { FC, useState } from 'react';
import { usePermission } from '../../hooks/usePermission';
import {
  useAddTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
  useGetTagsQuery,
  Tag,
} from '../../services/tagsApi';

const TagsManagement: FC = () => {
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { token } = theme.useToken();
  const canView = usePermission('tag::view');
  const canCreate = usePermission('tag::create');
  const canEdit = usePermission('tag::edit');
  const canDelete = usePermission('tag::delete');
  const canRestore = usePermission('tag::restore');

  const [addTag, { isLoading: isAdding }] = useAddTagMutation();
  const [updateTag, { isLoading: isUpdating }] = useUpdateTagMutation();
  const [deleteTag] = useDeleteTagMutation();
  const { data, isLoading: isLoadingTags } = useGetTagsQuery({ page: 1, perPage: 10, sortBy: 'name', order: 'asc' });

  const handleAdd = async () => {
    if (!input.trim()) return;
    try {
      await addTag({ name: input }).unwrap();
      message.success('Tag added successfully');
      setInput('');
    } catch (error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Failed to add tag';
      message.error(errMsg);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editValue.trim()) return;

    try {
      await updateTag({ id, name: editValue }).unwrap();
      message.success('Tag updated successfully');
      setEditingId(null);
      setEditValue('');
    } catch (error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Failed to update tag';
      message.error(errMsg);
    }
  };

  const handleRestore = async (record: Tag) => {
    try {
      updateTag({
        id: record._id,
        name: record.name,
        restore: true,
      }).unwrap();

      message.success('Tag restored successfully');
    } catch {
      message.error('Failed to restore tag');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTag({ id }).unwrap();
      message.success('Tag deleted successfully');
    } catch (error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Failed to delete tag';
      message.error(errMsg);
    }
  };

  return (
    <div
      style={{
        padding: token.paddingLG,
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        paddingTop: token.paddingMD,
        marginTop: 16,
      }}
    >
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Tags
      </Typography.Title>

      {canView && canCreate && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col flex="auto">
            <Input
              placeholder="Add a new tag"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              size="large"
              onPressEnter={handleAdd}
            />
          </Col>
          <Col flex="120px">
            <Button
              icon={<PlusOutlined />}
              type="primary"
              size="large"
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
        dataSource={data?.data?.tags?.records || []}
        loading={isLoadingTags}
        locale={{ emptyText: 'No tags found' }}
        style={{ maxHeight: 400, overflowY: 'auto' }}
        renderItem={(item) => {
          const getActions = (): React.ReactNode[] => {
            if (!canView) return [];

            // Deleted item - show restore button
            if (item.deletedAt) {
              return canRestore
                ? [
                    <Popconfirm
                      key="restore"
                      title="Are you sure you want to restore this tag?"
                      onConfirm={() => handleRestore(item)}
                    >
                      <Button
                        type="primary"
                        variant="solid"
                        color="green"
                        style={{ minWidth: '80px' }}
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
                    style={{ minWidth: '80px' }}
                    loading={isUpdating}
                  >
                    Save
                  </Button>
                ),
                <Button
                  key="cancel"
                  onClick={() => setEditingId(null)}
                  style={{ minWidth: '80px' }}
                  disabled={isUpdating}
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
                  style={{ minWidth: '80px' }}
                >
                  Edit
                </Button>
              ),
              canDelete && (
                <Popconfirm
                  key="delete"
                  title="Are you sure you want to delete this tag?"
                  onConfirm={() => handleDelete(item._id)}
                >
                  <Button type="primary" danger style={{ minWidth: '80px' }}>
                    Delete
                  </Button>
                </Popconfirm>
              ),
            ].filter(Boolean);
          };

          return (
            <List.Item actions={getActions()}>
              {editingId === item._id ? (
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  size="middle"
                  disabled={!canEdit}
                  onPressEnter={() => handleSaveEdit(item._id)}
                />
              ) : (
                <Typography.Text
                  delete={!!item.deletedAt}
                  type={item.deletedAt ? 'secondary' : undefined}
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

export default TagsManagement;

