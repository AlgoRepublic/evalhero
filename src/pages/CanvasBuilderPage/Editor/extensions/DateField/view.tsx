/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo } from 'react';
import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { DatePicker, Space, Button, Card, Flex, Tooltip, theme, Modal, Tag, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, SettingOutlined, ExclamationCircleOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { validateNodeRequirements, getApprovalStatusForSubject } from '../../../../forms/QueuesComponents/questionApprovalUtils';
import type { JSONContent } from '@tiptap/core';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
// import { getSetEditingNodeFromEditor } from '../../utils';
import DateEditModal from './editModel';
import { getQueryParam, evaluateVisibility } from '../../utils';
import { NodeGroupingManager } from '../ShortTextField/NodeGroupingManager';
import { extractNodeLabel } from '../../utils';
import { Tag as TagType, useGetTagsByIdsQuery } from '../../../../../services/tagsApi';

dayjs.extend(customParseFormat);

const { Text } = Typography;

const DateComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { token } = theme.useToken();

  const {
    // label,
    placeholder,
    value: initialISO,
    min: minISO,
    max: maxISO,
    notInFuture = false,
    notInPast = false,
    defaultDate = 'none',
    dateFormat = 'MM-DD-YYYY',
    disabledDates = [],
    queryParam = null,
    visibility = { match: 'all', rules: [] },
    required = false,
    approvalRequired: rawApprovalRequired = false,
    enableGrouping = false,
    nodeGroups = [],
    nodeGroupValues = {},
    tags = [],
  } = node.attrs;
  const approvalRequired = typeof rawApprovalRequired === 'string' 
    ? rawApprovalRequired === 'true' 
    : !!rawApprovalRequired;
  const templateHasApproval = (editor.storage as any)?.formBuilder?.templateHasApproval;
  const effectiveApprovalRequired = templateHasApproval !== false && approvalRequired;
  const requiredBool = typeof required === 'string'
    ? required === 'true'
    : !!required;
  const enableGroupingBool =
    typeof enableGrouping === 'string'
      ? enableGrouping === 'true'
      : !!enableGrouping;
  const [error] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(initialISO ?? null);
  // const setEditingNode = getSetEditingNodeFromEditor(editor);
  const [showModal, setShowModal] = useState(false);
  const [showGroupingModal, setShowGroupingModal] = useState(false);

  // Fetch tags for display using getByIds API (always, in all modes)
  // First check if tags are already in storage (from SubmitQueue optimization)
  // Otherwise, fetch by IDs using the getByIds API
  const editorStorage = (editor as any)?.storage?.formBuilder;
  const tagsFromStorage = editorStorage?.tagsByIds || [];
  const tagIds = (tags || []) as string[];
  const hasTagsInStorage = tagIds.length > 0 && tagsFromStorage.length > 0 && 
    tagIds.every((id) => tagsFromStorage.some((t: { _id: string; }) => t._id === id));
  
  const { data: tagsByIdsResponse } = useGetTagsByIdsQuery(
    { tagIds },
    { skip: tagIds.length === 0 || hasTagsInStorage }
  );
  
  const fetchedTags = tagsByIdsResponse?.data?.tags || [];
  
  const associatedTags: TagType[] = useMemo(() => {
    if (!tagIds || tagIds.length === 0) return [];
    // Use tags from storage if available and complete, otherwise use fetched tags
    const availableTags = hasTagsInStorage ? tagsFromStorage : fetchedTags;
    return availableTags.filter((tag: { _id: string; }) => tagIds.includes(tag._id));
  }, [tagIds, hasTagsInStorage, tagsFromStorage, fetchedTags]);
  const mode = (editor as any)?.storage?.formBuilder?.mode ?? 'readonly';
  const submitted = (editor as any)?.storage?.formBuilder?.submitted === true;
  const isEditMode = mode === 'edit';
  const isSubmitMode = mode === 'submit';

  // Query parameter handling - pre-populate from URL
  useEffect(() => {
    if (queryParam && isSubmitMode && !value) {
      const paramValue = getQueryParam(queryParam);
      if (paramValue) {
        // Try to parse as date
        const parsed = dayjs(paramValue);
        if (parsed.isValid()) {
          const iso = parsed.startOf('day').toISOString();
          setValue(iso);
          updateAttributes({ value: iso });
        }
      }
    }
  }, [queryParam, isSubmitMode]);

  // Set default date
  useEffect(() => {
    if (defaultDate !== 'none' && !value && isSubmitMode) {
      let defaultDateValue: dayjs.Dayjs | null = null;
      if (defaultDate === 'today') {
        defaultDateValue = dayjs();
      } else if (defaultDate === 'future') {
        defaultDateValue = dayjs().add(1, 'day');
      }
      if (defaultDateValue) {
        const iso = defaultDateValue.startOf('day').toISOString();
        setValue(iso);
        updateAttributes({ value: iso });
      }
    }
  }, [defaultDate, isSubmitMode]);

  // Visibility evaluation
  const formState = useMemo(() => {
    const json = editor.getJSON();
    const state: Record<string, any> = {};
    const walk = (node: any) => {
      if (node.attrs && node.attrs.name) {
        state[node.attrs.name] = node.attrs.value ?? null;
      }
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(walk);
      }
    };
    if (json.content) json.content.forEach(walk);
    return state;
  }, [editor, node.attrs.value]);

  const isVisible = useMemo(() => {
    if (!visibility?.rules || visibility.rules.length === 0) return true;
    return evaluateVisibility(visibility.rules, formState, visibility.match || 'all');
  }, [visibility, formState]);

  // Subjects & groups from SubmitQueue (global defaults)
  const subjectsOptionsFromStorage =
    (editor.storage as any)?.formBuilder?.subjects || [];
  const globalGroups =
    (editor.storage as any)?.formBuilder?.globalGroups || [];
  const globalAvailableSubjects =
    (editor.storage as any)?.formBuilder?.availableSubjects || [];
  const isAllLocked =
    (editor.storage as any)?.formBuilder?.isAllLocked || false;

  // Determine groups to use: node-level groups if enabled, otherwise global
  const groupsToUse =
    enableGroupingBool && (nodeGroups as any[]).length > 0
      ? (nodeGroups as any[])
      : globalGroups;

  // Compute node-level ungrouped subjects when node groups exist,
  // otherwise fall back to global ungrouped subjects
  const usedSubjectIds = new Set<string>();
  if (enableGroupingBool && (nodeGroups as any[]).length > 0) {
    (nodeGroups as any[]).forEach((g: any) => {
      (g.subjectIds || []).forEach((id: string) => usedSubjectIds.add(id));
    });
  }
  const availableSubjects =
    enableGroupingBool && (nodeGroups as any[]).length > 0
      ? subjectsOptionsFromStorage.filter(
          (s: any) => !usedSubjectIds.has(s.value),
        )
      : globalAvailableSubjects;

  const isReadonlyMode: boolean = mode === 'readonly';
  const shouldShowGrouping =
    (isSubmitMode || isReadonlyMode) &&
    (isSubmitMode ? isAllLocked : true) && // In submit mode, require isAllLocked; in readonly, always show if groups exist
    (groupsToUse.length > 0 || availableSubjects.length > 0);

  useEffect(() => {
    setValue(initialISO ?? null);
  }, [initialISO]);

  // convert stored ISO to dayjs for DatePicker
  const toDayjs = (iso?: string | null) => (iso ? dayjs(iso) : null);

  const disabledDate = (current: dayjs.Dayjs) => {
    // current is a dayjs date (local)
    const min = toDayjs(minISO);
    const max = toDayjs(maxISO);
    // strip time for date comparisons
    const cur = current.startOf('day');

    if (min && cur.isBefore(min.startOf('day'))) return true;
    if (max && cur.isAfter(max.startOf('day'))) return true;
    if (notInFuture && cur.isAfter(dayjs().startOf('day'))) return true;
    if (notInPast && cur.isBefore(dayjs().startOf('day'))) return true;
    
    // Check disabled dates/ranges
    if (Array.isArray(disabledDates) && disabledDates.length > 0) {
      for (const disabled of disabledDates) {
        if (typeof disabled === 'string') {
          // Single date
          if (cur.isSame(dayjs(disabled).startOf('day'))) return true;
        } else if (disabled && typeof disabled === 'object' && disabled.start && disabled.end) {
          // Date range
          const start = dayjs(disabled.start).startOf('day');
          const end = dayjs(disabled.end).startOf('day');
          if (cur.isSame(start) || cur.isSame(end) || (cur.isAfter(start) && cur.isBefore(end))) return true;
        }
      }
    }
    
    return false;
  };

  const onChange = (date: dayjs.Dayjs | null) => {
    if (!date) {
      setValue(null);
      updateAttributes({ value: null });
      return;
    }
    // store ISO date (YYYY-MM-DDT00:00:00.000Z)
    const iso = date.startOf('day').toISOString();
    setValue(iso);
    updateAttributes({ value: iso });
  };

  const setEntityValue = (entityId: string, iso: string | null) => {
    const updated = {
      ...(nodeGroupValues as any),
      [entityId]: iso,
    };

    // Sync values between grouped and ungrouped subjects
    // If a group value is changed, also store it for each subject in that group
    if (entityId.startsWith('group-')) {
      const groupId = entityId.replace('group-', '');
      const group = groupsToUse.find((g: any) => g.id === groupId);
      if (group && group.subjectIds) {
        // Store the group value for each subject in the group as ungrouped value
        group.subjectIds.forEach((subjectId: string) => {
          const ungroupedKey = `ungrouped-${subjectId}`;
          updated[ungroupedKey] = iso;
        });
      }
    }
    // If an ungrouped value is changed, also update the group value if that subject is in a group
    else if (entityId.startsWith('ungrouped-')) {
      const subjectId = entityId.replace('ungrouped-', '');
      // Find which group(s) this subject belongs to
      const subjectGroups = groupsToUse.filter((g: any) =>
        g.subjectIds && g.subjectIds.includes(subjectId)
      );
      // Update group value for each group this subject belongs to
      subjectGroups.forEach((group: any) => {
        const groupKey = `group-${group.id}`;
        updated[groupKey] = iso;
        // Also update ungrouped values for all other subjects in the same group
        group.subjectIds.forEach((otherSubjectId: string) => {
          const otherUngroupedKey = `ungrouped-${otherSubjectId}`;
          updated[otherUngroupedKey] = iso;
        });
      });
    }

    updateAttributes({ nodeGroupValues: updated });
  };

  // Don't render if not visible (except in edit mode)
  if (!isVisible && !isEditMode) {
    return null;
  }

  const requiredErrorBase =
    isSubmitMode && submitted && required && !value;
  // When grouping UI is shown, per-entity required handling is driven by consumer;
  // avoid showing a misleading global error on the base control.
  const requiredError = shouldShowGrouping ? false : requiredErrorBase;

  return (
    // NodeViewWrapper drag handle only in edit mode
    <NodeViewWrapper 
      {...(isEditMode ? { 'data-drag-handle': true } : {})} 
      style={{ margin: '4px 0', display: isVisible || isEditMode ? 'block' : 'none' }}
      data-node-type="dateField"
      data-node-name={String((node.attrs as any)?.name || '')}
    >
      <DateEditModal
        open={showModal}
        onClose={() => setShowModal(false)}
        nodeAttrs={node.attrs}
        onSave={(values) => {
          updateAttributes(values);
          setShowModal(false);
        }}
      />
      {/* Submit-mode only: per-field grouping configuration in a popup */}
      {isSubmitMode && (
        <Modal
          open={showGroupingModal}
          title="Configure Groups for This Field"
          onCancel={() => setShowGroupingModal(false)}
          footer={null}
          destroyOnHidden
        >
          <NodeGroupingManager
            value={{
              enableGrouping: enableGroupingBool,
              nodeGroups: (nodeGroups as any[]) || [],
            }}
            onChange={(val) => {
              updateAttributes({
                enableGrouping: val.enableGrouping,
                nodeGroups: val.nodeGroups,
              });
            }}
            subjectsOptions={subjectsOptionsFromStorage}
            globalGroups={globalGroups}
            fieldLabel={extractNodeLabel(node)}
          />
        </Modal>
      )}
      <Card
        size="small"
        styles={{ body: { padding: '8px 12px' } }}
        style={{
          margin: '4px 0',
          borderColor:
            (error || requiredError)
              ? token.colorError
              : token.colorBorder,
          borderRadius: token.borderRadius,
          transition: 'border-color 0.2s ease',
          background: token.colorBgContainer,
        }}
        variant="outlined"
      >
        <Flex justify="space-between" align="center" gap={8} style={{ marginBottom: 4 }}>
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <div style={{ fontWeight: 500, fontSize: 13 }} contentEditable={mode === 'submit' ? false : undefined}>
              <NodeViewContent className="date-label" />
            </div>
            {requiredBool && (
              <Tag
                color="red"
                style={{
                  marginLeft: 0,
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  paddingInline: 8,
                  paddingBlock: 2,
                  marginTop: 6,
                  marginBottom: 6,
                }}
              >
                Required
              </Tag>
            )}
            {associatedTags.length > 0 && (
              <div style={{ marginTop: 6, marginBottom: 6, display: 'flex', flexWrap: 'nowrap', gap: 4, alignItems: 'center', overflowX: 'auto' }}>
                <span style={{ fontSize: 11, color: token.colorTextSecondary, marginRight: 4, flexShrink: 0 }}>Tags:</span>
                {associatedTags.map((tag) => (
                  <Tag key={tag._id} color="blue" style={{ fontSize: 11, flexShrink: 0 }}>
                    {tag.name}
                  </Tag>
                ))}
              </div>
            )}
          </div>
          {isEditMode && (
            <Space size={2} style={{ alignSelf: 'flex-start', marginLeft: 8 }}>
              <Tooltip title="Edit field settings">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setShowModal(true)}
                  style={{ padding: '2px 4px', height: 'auto' }}
                />
              </Tooltip>
              <Tooltip title="Delete field">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={deleteNode}
                  style={{ padding: '2px 4px', height: 'auto' }}
                />
              </Tooltip>
            </Space>
          )}
        </Flex>
        {isSubmitMode && effectiveApprovalRequired && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <Tag
              color="warning"
              style={{
                marginLeft: 8,
                fontSize: 11,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                paddingInline: 8,
                paddingBlock: 2,
              }}
            >
              <ExclamationCircleOutlined style={{ fontSize: 12 }} />
              <span style={{ marginLeft: 4 }}>Approval required</span>
            </Tag>
            
            {/* Approval Status Badge */}
            {/* Don't show tag when status is "pending" - that means approval hasn't been requested yet */}
            {node.attrs.approvalStatus && node.attrs.approvalStatus !== 'pending' && (
              <Tag
                color={
                  node.attrs.approvalStatus === 'approved' 
                    ? 'success' 
                    : node.attrs.approvalStatus === 'rejected' 
                      ? 'error' 
                      : 'processing'
                }
                style={{
                  fontSize: 11,
                  paddingInline: 8,
                  paddingBlock: 2,
                }}
              >
                {node.attrs.approvalStatus === 'approved' && '✓ Approved'}
                {node.attrs.approvalStatus === 'rejected' && '✗ Rejected'}
                {node.attrs.approvalStatus === 'requested' && '⏱ Pending Approval'}
              </Tag>
            )}
          </div>
        )}
        
        {/* Rejection Message */}
        {isSubmitMode && node.attrs.rejectionMessage && (
          <div
            style={{
              padding: 8,
              background: token.colorErrorBg,
              border: `1px solid ${token.colorErrorBorder}`,
              borderRadius: 6,
              marginBottom: 8,
            }}
          >
            <Text type="danger" style={{ fontSize: 12 }}>
              <strong>Rejection Feedback:</strong> {node.attrs.rejectionMessage}
            </Text>
          </div>
        )}
        
        {!isSubmitMode && effectiveApprovalRequired && (
          <Tag
            color="warning"
            style={{
              marginLeft: 8,
              fontSize: 11,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              paddingInline: 8,
              paddingBlock: 2,
              marginBottom: 8,
            }}
          >
            <ExclamationCircleOutlined style={{ fontSize: 12 }} />
            <span style={{ marginLeft: 4 }}>Approval required</span>
          </Tag>
        )}

        <div>
          {isSubmitMode && shouldShowGrouping && (
            <div style={{ marginBottom: 8, textAlign: 'right' }}>
              <Button
                size="small"
                type="default"
                icon={<SettingOutlined />}
                variant='solid'
                color='blue'
                onClick={() => setShowGroupingModal(true)}
              >
                Subject Group Settings
              </Button>
            </div>
          )}

          {shouldShowGrouping ? (
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {/* Per-group dates */}
              {groupsToUse.map((group: any) => {
                const entityId = `group-${group.id}`;
                const entityISO =
                  (nodeGroupValues as any)[entityId] ?? null;
                const groupSubjects = (group.subjectIds || [])
                  .map((id: string) =>
                    subjectsOptionsFromStorage.find(
                      (s: any) => s.value === id,
                    ),
                  )
                  .filter(Boolean)
                  .map((s: any) => s.label)
                  .join(', ');

                const handleEntityChange = (date: dayjs.Dayjs | null) => {
                  if (!date) {
                    setEntityValue(entityId, null);
                    return;
                  }
                  const iso = date.startOf('day').toISOString();
                  setEntityValue(entityId, iso);
                };

                return (
                  <Card
                    key={entityId}
                    size="small"
                    style={{ background: token.colorFillAlter }}
                    title={
                      <Space>
                        <Tag color="blue">Group</Tag>
                        <span>{group.name}</span>
                        {groupSubjects && (
                          <span
                            style={{
                              color: token.colorTextSecondary,
                              fontSize: 12,
                            }}
                          >
                            ({groupSubjects})
                          </span>
                        )}
                      </Space>
                    }
                  >
                    <DatePicker
                      placeholder={
                        placeholder || `Select date (${dateFormat})`
                      }
                      value={entityISO ? dayjs(entityISO) : null}
                      onChange={(d) => handleEntityChange(d)}
                      disabledDate={disabledDate}
                      format={dateFormat}
                      size="small"
                      style={{ width: '100%', maxWidth: 200 }}
                      readOnly={mode === 'readonly'}
                      disabled={mode === 'readonly'}
                      allowClear
                    />
                    
                    {/* Approval Status and Request Button for Group */}
                    {effectiveApprovalRequired && (() => {
                      // Get global groups and available subjects from editor storage
                      const globalGroups = (editor.storage as any)?.formBuilder?.globalGroups || [];
                      const globalAvailableSubjects = (editor.storage as any)?.formBuilder?.availableSubjects || [];
                      
                      // Get approval status for this specific group
                      const groupApprovalStatus = getApprovalStatusForSubject(
                        node as unknown as JSONContent,
                        (group.subjectIds || [])[0] || '', // Use first subject ID to get group status
                        globalGroups
                      );
                      
                      // Validate if requirements are fulfilled for this group
                      const requirementsValid = validateNodeRequirements(
                        node as unknown as JSONContent,
                        (group.subjectIds || [])[0] || '',
                        globalGroups,
                        globalAvailableSubjects
                      ).ok;
                      
                      // Show approval status badge
                      // Don't show tag when status is "pending" - that means approval hasn't been requested yet
                      const getStatusBadge = () => {
                        if (groupApprovalStatus === 'approved') {
                          return (
                            <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 11 }}>
                              Approved
                            </Tag>
                          );
                        }
                        // Skip "pending" status - don't show tag when approval hasn't been requested yet
                        if (groupApprovalStatus === 'rejected') {
                          return (
                            <Tag icon={<CloseCircleOutlined />} color="error" style={{ fontSize: 11 }}>
                              Rejected
                            </Tag>
                          );
                        }
                        if (groupApprovalStatus === 'requested') {
                          return (
                            <Tag icon={<ClockCircleOutlined />} color="processing" style={{ fontSize: 11 }}>
                              Pending
                            </Tag>
                          );
                        }
                        return null;
                      };
                      
                      return (
                        <div style={{ marginTop: 8 }}>
                          <Space>
                            {getStatusBadge()}
                            {!isReadonlyMode && (
                              <Tooltip 
                                title={
                                  !requirementsValid 
                                    ? 'Please fill this field before requesting approval' 
                                    : groupApprovalStatus === 'approved'
                                    ? 'This question has been approved. You can still view the conversation.'
                                    : ''
                                }
                              >
                                <Button
                                  size="small"
                                  type={groupApprovalStatus === 'rejected' ? 'primary' : 'default'}
                                  danger={groupApprovalStatus === 'rejected'}
                                  onClick={() => {
                                    const openDrawer = (editor.storage as any)?.formBuilder?.openQuestionApprovalDrawer;
                                    if (openDrawer) {
                                      const subjectContext = {
                                        type: 'group' as const,
                                        subjectId: group.subjectIds || [],
                                        subjectName: groupSubjects,
                                        groupId: group.id,
                                        groupName: group.name,
                                      };
                                      openDrawer(
                                        {
                                          type: node.type.name,
                                          attrs: node.attrs,
                                          content: node.content,
                                        },
                                        subjectContext
                                      );
                                    }
                                  }}
                                  disabled={!requirementsValid}
                                  style={{ 
                                    fontSize: 11,
                                    opacity: groupApprovalStatus === 'approved' ? 0.6 : 1,
                                  }}
                                >
                                  {groupApprovalStatus === 'rejected' 
                                    ? 'Re-request Approval' 
                                    : groupApprovalStatus === 'approved'
                                    ? 'View Approval'
                                    : 'Request Approval'}
                                </Button>
                              </Tooltip>
                            )}
                          </Space>
                        </div>
                      );
                    })()}
                  </Card>
                );
              })}

              {/* Per-ungrouped-subject dates */}
              {availableSubjects.length > 0 && (
                <Card
                  size="small"
                  style={{ background: token.colorFillAlter }}
                  title={
                    <Space>
                      <Tag>Ungrouped Subjects</Tag>
                    </Space>
                  }
                >
                  <Space
                    direction="vertical"
                    style={{ width: '100%' }}
                    size={8}
                  >
                    {availableSubjects.map((subject: any) => {
                      const entityId = `ungrouped-${subject.value}`;
                      const entityISO =
                        (nodeGroupValues as any)[entityId] ?? null;

                      const handleEntityChange = (
                        date: dayjs.Dayjs | null,
                      ) => {
                        if (!date) {
                          setEntityValue(entityId, null);
                          return;
                        }
                        const iso = date
                          .startOf('day')
                          .toISOString();
                        setEntityValue(entityId, iso);
                      };

                      return (
                        <div key={entityId}>
                          <div style={{ marginBottom: 4 }}>
                            <Tag>{subject.label}</Tag>
                          </div>
                          <DatePicker
                            placeholder={
                              placeholder ||
                              `Select date (${dateFormat})`
                            }
                            value={entityISO ? dayjs(entityISO) : null}
                            onChange={(d) => handleEntityChange(d)}
                            disabledDate={disabledDate}
                            format={dateFormat}
                            size="small"
                            style={{
                              width: '100%',
                              maxWidth: 200,
                            }}
                            readOnly={mode === 'readonly'}
                            disabled={mode === 'readonly'}
                            allowClear
                          />
                          
                          {/* Approval Status and Request Button for Ungrouped Subject */}
                          {effectiveApprovalRequired && (() => {
                            // Get global groups and available subjects from editor storage
                            const globalGroups = (editor.storage as any)?.formBuilder?.globalGroups || [];
                            const globalAvailableSubjects = (editor.storage as any)?.formBuilder?.availableSubjects || [];
                            
                            // Get approval status for this specific subject
                            const subjectApprovalStatus = getApprovalStatusForSubject(
                              node as unknown as JSONContent,
                              subject.value,
                              globalGroups
                            );
                            
                            // Validate if requirements are fulfilled for this subject
                            const requirementsValid = validateNodeRequirements(
                              node as unknown as JSONContent,
                              subject.value,
                              globalGroups,
                              globalAvailableSubjects
                            ).ok;
                            
                            // Show approval status badge
                            // Don't show tag when status is "pending" - that means approval hasn't been requested yet
                            const getStatusBadge = () => {
                              if (subjectApprovalStatus === 'approved') {
                                return (
                                  <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 11 }}>
                                    Approved
                                  </Tag>
                                );
                              }
                              // Skip "pending" status - don't show tag when approval hasn't been requested yet
                              if (subjectApprovalStatus === 'rejected') {
                                return (
                                  <Tag icon={<CloseCircleOutlined />} color="error" style={{ fontSize: 11 }}>
                                    Rejected
                                  </Tag>
                                );
                              }
                              if (subjectApprovalStatus === 'requested') {
                                return (
                                  <Tag icon={<ClockCircleOutlined />} color="processing" style={{ fontSize: 11 }}>
                                    Pending
                                  </Tag>
                                );
                              }
                              return null;
                            };
                            
                            return (
                              <div style={{ marginTop: 8 }}>
                                <Space>
                                  {getStatusBadge()}
                                  {!isReadonlyMode && (
                                    <Tooltip 
                                      title={
                                        !requirementsValid 
                                          ? 'Please fill this field before requesting approval' 
                                          : subjectApprovalStatus === 'approved'
                                          ? 'This question has been approved. You can still view the conversation.'
                                          : ''
                                      }
                                    >
                                      <Button
                                        size="small"
                                        type={subjectApprovalStatus === 'rejected' ? 'primary' : 'default'}
                                        danger={subjectApprovalStatus === 'rejected'}
                                        onClick={() => {
                                          const openDrawer = (editor.storage as any)?.formBuilder?.openQuestionApprovalDrawer;
                                          if (openDrawer) {
                                            const subjectContext = {
                                              type: 'ungrouped' as const,
                                              subjectId: subject.value,
                                              subjectName: subject.label,
                                            };
                                            openDrawer(
                                              {
                                                type: node.type.name,
                                                attrs: node.attrs,
                                                content: node.content,
                                              },
                                              subjectContext
                                            );
                                          }
                                        }}
                                        disabled={!requirementsValid}
                                        style={{ 
                                          fontSize: 11,
                                          opacity: subjectApprovalStatus === 'approved' ? 0.6 : 1,
                                        }}
                                      >
                                        {subjectApprovalStatus === 'rejected' 
                                          ? 'Re-request Approval' 
                                          : subjectApprovalStatus === 'approved'
                                          ? 'View Approval'
                                          : 'Request Approval'}
                                      </Button>
                                    </Tooltip>
                                  )}
                                </Space>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </Space>
                </Card>
              )}
            </Space>
          ) : (
            <>
              <DatePicker
                placeholder={placeholder || `Select date (${dateFormat})`}
                value={value ? dayjs(value) : null}
                onChange={(d) => onChange(d)}
                disabledDate={disabledDate}
                format={dateFormat}
                size="small"
                style={{ width: '100%', maxWidth: 200 }}
                status={requiredError ? 'error' : undefined}
                readOnly={mode === 'readonly' || (mode === 'submit' && submitted)}
                disabled={mode === 'readonly'}
                allowClear
              />
              {requiredError && (
                <div style={{ color: token.colorError, marginTop: 4, fontSize: 11 }}>
                  This field is required
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </NodeViewWrapper>
  );
};

export default DateComponent;
