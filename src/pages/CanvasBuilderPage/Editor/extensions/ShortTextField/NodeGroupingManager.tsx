import React, { useState, useEffect } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  Tooltip,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MergeCellsOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface NodeGroup {
  id: string;
  name: string;
  subjectIds: string[];
}

interface NodeGroupingManagerProps {
  value?: {
    enableGrouping: boolean;
    nodeGroups: NodeGroup[];
  };
  onChange?: (value: { enableGrouping: boolean; nodeGroups: NodeGroup[] }) => void;
  subjectsOptions: Array<{ label: string; value: string }>;
  /**
   * Global/default groups coming from SubmitQueue.
   * These are used as the initial/default groups for this node
   * when node-based grouping is first enabled.
   */
  globalGroups?: NodeGroup[];
  /**
   * Field label to display at the top of the modal
   */
  fieldLabel?: string;
}

export const NodeGroupingManager: React.FC<NodeGroupingManagerProps> = ({
  value = { enableGrouping: false, nodeGroups: [] },
  onChange,
  subjectsOptions,
  globalGroups = [],
  fieldLabel,
}) => {
  // Normalize incoming enableGrouping to a real boolean in case legacy
  // schemas stored it as the string "true"/"false".
  const normalizedEnableGrouping =
    typeof value.enableGrouping === 'string'
      ? value.enableGrouping === 'true'
      : !!value.enableGrouping;

  const [groups, setGroups] = useState<NodeGroup[]>(value.nodeGroups || []);
  const [enableGrouping, setEnableGrouping] = useState<boolean>(
    normalizedEnableGrouping,
  );
  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<NodeGroup | null>(null);
  const [groupForm] = Form.useForm<{ name: string; subjectIds: string[] }>();
  const [modal, contextHolder] = Modal.useModal();

  useEffect(() => {
    // Determine which groups to show in the modal:
    // 1) If node already has its own groups, always show those (persisted state)
    // 2) Else, if global groups exist, preview them as the default grouping
    //    (without persisting) so the user sees the current global state
    if (value.nodeGroups && value.nodeGroups.length > 0) {
      setGroups(value.nodeGroups);
    } else if (globalGroups && globalGroups.length > 0) {
      const previewGroups: NodeGroup[] = globalGroups.map((g) => ({
        id: g.id,
        name: g.name,
        subjectIds: [...g.subjectIds],
      }));
      setGroups(previewGroups);
    } else {
      setGroups([]);
    }

    // If enableGrouping was turned on previously but nodeGroups are still empty,
    // we'll still show the preview (2) and only persist when the user toggles
    // grouping ON again.
    const nextEnable =
      typeof value.enableGrouping === 'string'
        ? value.enableGrouping === 'true'
        : !!value.enableGrouping;
    setEnableGrouping(nextEnable);
  }, [value.nodeGroups, value.enableGrouping, globalGroups]);

  const usedSubjectIds = new Set<string>();
  groups.forEach((group) => {
    group.subjectIds.forEach((id) => usedSubjectIds.add(id));
  });

  const availableSubjects = subjectsOptions.filter(
    (opt) => !usedSubjectIds.has(opt.value) || (editingGroup && editingGroup.subjectIds.includes(opt.value))
  );

  const handleCreateGroup = () => {
    setEditingGroup(null);
    groupForm.resetFields();
    setIsGroupModalVisible(true);
  };

  const handleEditGroup = (group: NodeGroup) => {
    setEditingGroup(group);
    groupForm.setFieldsValue({
      name: group.name,
      subjectIds: group.subjectIds,
    });
    setIsGroupModalVisible(true);
  };

  const handleDeleteGroup = (groupId: string) => {
    const updated = groups.filter((g) => g.id !== groupId);
    setGroups(updated);
    onChange?.({ enableGrouping, nodeGroups: updated });
  };

  const handleSaveGroup = () => {
    groupForm.validateFields().then((values) => {
      if (editingGroup) {
        // Update existing group
        const updated = groups.map((g) =>
          g.id === editingGroup.id
            ? { ...g, name: values.name, subjectIds: values.subjectIds }
            : g
        );
        setGroups(updated);
        onChange?.({ enableGrouping, nodeGroups: updated });
      } else {
        // Create new group
        const newGroup: NodeGroup = {
          id: `group-${Date.now()}`,
          name: values.name,
          subjectIds: values.subjectIds,
        };
        const updated = [...groups, newGroup];
        setGroups(updated);
        onChange?.({ enableGrouping, nodeGroups: updated });
      }
      setIsGroupModalVisible(false);
      groupForm.resetFields();
      setEditingGroup(null);
    });
  };

  const handleToggleGrouping = (checked: boolean) => {
    if (checked) {
      // When turning ON:
      // - If there are no existing nodeGroups and globalGroups exist, commit
      //   the current preview (which will be globalGroups) as nodeGroups.
      // - Otherwise, use whatever groups are currently in state (persisted nodeGroups).
      let nextGroups = groups;
      if (
        (!value.nodeGroups || value.nodeGroups.length === 0) &&
        (!nextGroups || nextGroups.length === 0) &&
        globalGroups.length > 0
      ) {
        nextGroups = globalGroups.map((g) => ({
          id: g.id,
          name: g.name,
          subjectIds: [...g.subjectIds],
        }));
        setGroups(nextGroups);
      }

      setEnableGrouping(true);
      onChange?.({ enableGrouping: true, nodeGroups: nextGroups || [] });
    } else {
      // Turning OFF: keep existing nodeGroups persisted, just disable grouping.
      setEnableGrouping(false);
      onChange?.({ enableGrouping: false, nodeGroups: groups || [] });
    }
  };

  return (
    <>
      {contextHolder}
      {fieldLabel && (
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
          <Text strong style={{ fontSize: 16 }}>Field: {fieldLabel}</Text>
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={enableGrouping}
            onChange={(e) => handleToggleGrouping(e.target.checked)}
          />
          <Text strong>Enable Node-Based Grouping</Text>
        </label>
        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
          Enable grouping for this specific field. When enabled, this field will show separate inputs for each group and ungrouped subject.
        </Text>
      </div>

      {enableGrouping && (
        <>
          <Card
            size="small"
            title={
              <Space>
                <Text strong>Groups for this Field</Text>
                {enableGrouping && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={handleCreateGroup}
                  >
                    Create Group
                  </Button>
                )}
              </Space>
            }
            style={{ marginTop: 16 }}
          >
            {groups.length === 0 ? (
              <Text type="secondary">
                No groups created. Create a group to organize subjects for this field.
              </Text>
            ) : (
              <Space wrap>
                {groups.map((group) => {
                  const groupSubjects = group.subjectIds
                    .map((id) => subjectsOptions.find((opt) => opt.value === id))
                    .filter(Boolean)
                    .map((opt) => opt?.label)
                    .join(', ');

                  return (
                    <Card
                      key={group.id}
                      size="small"
                      style={{ minWidth: 200 }}
                      title={
                        <Space>
                          <Text strong>{group.name}</Text>
                          {groupSubjects && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              ({groupSubjects})
                            </Text>
                          )}
                          {enableGrouping && (
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => handleEditGroup(group)}
                            />
                          )}
                          {enableGrouping && groups.length > 1 && (
                            <Tooltip title="Merge this group into another">
                              <Button
                                type="text"
                                size="small"
                                icon={<MergeCellsOutlined />}
                                onClick={() => {
                                  const otherGroups = groups.filter((g) => g.id !== group.id);
                                  if (otherGroups.length === 0) {
                                    message.warning('No other groups to merge with');
                                    return;
                                  }
                                  let targetGroupId: string | null = null;
                                  modal.confirm({
                                    title: 'Merge Group',
                                    content: (
                                      <div>
                                        <p style={{ marginBottom: 8 }}>Select the group to merge "{group.name}" into:</p>
                                        <Select
                                          style={{ width: '100%', marginTop: 8 }}
                                          placeholder="Select target group"
                                          options={otherGroups.map((g) => ({
                                            label: g.name,
                                            value: g.id,
                                          }))}
                                          onChange={(value) => {
                                            targetGroupId = value;
                                          }}
                                        />
                                      </div>
                                    ),
                                    okText: 'Merge',
                                    cancelText: 'Cancel',
                                    onOk: () => {
                                      if (targetGroupId) {
                                        const targetGroup = groups.find((g) => g.id === targetGroupId);
                                        if (targetGroup) {
                                          const updated = groups.map((g) =>
                                            g.id === targetGroupId
                                              ? { ...g, subjectIds: Array.from(new Set([...g.subjectIds, ...group.subjectIds])) }
                                              : g
                                          ).filter((g) => g.id !== group.id);
                                          setGroups(updated);
                                          onChange?.({ enableGrouping, nodeGroups: updated });
                                          message.success(`Groups merged successfully.`);
                                        }
                                      }
                                    },
                                  });
                                }}
                              />
                            </Tooltip>
                          )}
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            disabled={!enableGrouping}
                            onClick={() => {
                              if (enableGrouping) handleDeleteGroup(group.id);
                            }}
                          />
                        </Space>
                      }
                    >
                      <Space wrap>
                        {group.subjectIds.map((subjectId) => {
                          const subject = subjectsOptions.find((opt) => opt.value === subjectId);
                          return (
                            <Tag key={subjectId} color="blue">
                              {subject?.label || subjectId}
                            </Tag>
                          );
                        })}
                      </Space>
                    </Card>
                  );
                })}
              </Space>
            )}
          </Card>

          {/* Show ungrouped subjects for this node */}
          <Card
            size="small"
            title={
              <Text strong>
                Ungrouped Subjects {availableSubjects.length > 0 && `(${availableSubjects.length})`}
              </Text>
            }
            style={{ marginTop: 16 }}
          >
            {availableSubjects.length === 0 ? (
              <Text type="secondary">
                All subjects are organized into groups for this field.
              </Text>
            ) : (
              <Space wrap>
                {availableSubjects.map((subject) => (
                  <Tag key={subject.value} color="default">
                    {subject.label}
                  </Tag>
                ))}
              </Space>
            )}
          </Card>
        </>
      )}

      <Modal
        title={editingGroup ? 'Edit Group' : 'Create Group'}
        open={isGroupModalVisible}
        onOk={handleSaveGroup}
        onCancel={() => {
          setIsGroupModalVisible(false);
          groupForm.resetFields();
          setEditingGroup(null);
        }}
        destroyOnHidden
      >
        <Form
          form={groupForm}
          layout="vertical"
          initialValues={{ name: '', subjectIds: [] }}
        >
          <Form.Item
            name="name"
            label="Group Name"
            rules={[{ required: true, message: 'Group name is required' }]}
          >
            <Input placeholder="Enter group name" />
          </Form.Item>
          <Form.Item
            name="subjectIds"
            label="Subjects"
            rules={[{ required: true, message: 'Select at least one subject' }]}
          >
            <Select
              mode="multiple"
              placeholder="Select subjects"
              options={availableSubjects}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

