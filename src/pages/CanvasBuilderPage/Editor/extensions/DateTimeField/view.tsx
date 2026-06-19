/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo } from 'react';
import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { DatePicker, Space, Button, theme, Card, Flex, Tooltip, Modal, Tag, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, SettingOutlined, ExclamationCircleOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { validateNodeRequirements, getApprovalStatusForSubject } from '../../../../forms/QueuesComponents/questionApprovalUtils';
import type { JSONContent } from '@tiptap/core';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
// import { getSetEditingNodeFromEditor } from '../../utils';
import DateTimeEditModal from './editModel';
import { getQueryParam, evaluateVisibility } from '../../utils';
import { NodeGroupingManager } from '../ShortTextField/NodeGroupingManager';
import { extractNodeLabel } from '../../utils';
import { Tag as TagType, useGetTagsByIdsQuery } from '../../../../../services/tagsApi';
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const { Text } = Typography;

const DateTimeComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { token } = theme.useToken();

  const {
    // label,
    value: initialISO,
    min: minISO,
    max: maxISO,
    notInFuture = false,
    notInPast = false,
    timeFormat = '24',
    showSeconds = false,
    timezone = undefined,
    placeholder,
    timeIncrement = null,
    timeLimits = null,
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

  const [error] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showGroupingModal, setShowGroupingModal] = useState(false);
  const [value, setValue] = useState<string | null>(initialISO ?? null);

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
  // const setEditingNode = getSetEditingNodeFromEditor(editor);
  const mode = (editor as any)?.storage?.formBuilder?.mode ?? 'readonly';
  const submitted = (editor as any)?.storage?.formBuilder?.submitted === true;
  const isEditMode = mode === 'edit';
  const isSubmitMode = mode === 'submit';

  // Query parameter handling - pre-populate from URL
  useEffect(() => {
    if (queryParam && isSubmitMode && !value) {
      const paramValue = getQueryParam(queryParam);
      if (paramValue) {
        // Try to parse as date/time
        const parsed = dayjs(paramValue);
        if (parsed.isValid()) {
          const iso = parsed.toISOString();
          setValue(iso);
          updateAttributes({ value: iso });
        }
      }
    }
  }, [queryParam, isSubmitMode]);

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
    enableGrouping && (nodeGroups as any[]).length > 0
      ? (nodeGroups as any[])
      : globalGroups;

  // Compute node-level ungrouped subjects when node groups exist,
  // otherwise fall back to global ungrouped subjects
  const usedSubjectIds = new Set<string>();
  if (enableGrouping && (nodeGroups as any[]).length > 0) {
    (nodeGroups as any[]).forEach((g: any) => {
      (g.subjectIds || []).forEach((id: string) => usedSubjectIds.add(id));
    });
  }
  const availableSubjects =
    enableGrouping && (nodeGroups as any[]).length > 0
      ? subjectsOptionsFromStorage.filter(
          (s: any) => !usedSubjectIds.has(s.value),
        )
      : globalAvailableSubjects;

  const isReadonlyMode = mode === 'readonly';
  const shouldShowGrouping =
    (isSubmitMode || isReadonlyMode) &&
    (isSubmitMode ? isAllLocked : true) && // In submit mode, require isAllLocked; in readonly, always show if groups exist
    (groupsToUse.length > 0 || availableSubjects.length > 0);

  useEffect(() => setValue(initialISO ?? null), [initialISO]);

  // Helper to get dayjs object for picker with timezone support
  const toDayjs = (iso?: string | null) => {
    if (!iso) return null;
    try {
      if (timezone) {
        // If timezone is specified, convert from UTC to that timezone for display
        return dayjs.utc(iso).tz(timezone);
      }
      return dayjs(iso);
    } catch (error) {
      // Fallback if timezone is invalid
      console.warn('Invalid timezone:', timezone, error);
      return dayjs(iso);
    }
  };

  const disabledDate = (current: dayjs.Dayjs) => {
    if (!current) return false;
    try {
      const min = toDayjs(minISO);
      const max = toDayjs(maxISO);
      const now = timezone ? dayjs().tz(timezone) : dayjs();
      if (min && current.isBefore(min, 'day')) return true;
      if (max && current.isAfter(max, 'day')) return true;
      if (notInFuture && current.isAfter(now, 'day')) return true;
      if (notInPast && current.isBefore(now, 'day')) return true;
      return false;
    } catch (error) {
      console.warn('Error in disabledDate:', error);
      return false;
    }
  };

  const timeFormatStr =
    timeFormat === '12'
      ? showSeconds
        ? 'hh:mm:ss A'
        : 'hh:mm A'
      : showSeconds
        ? 'HH:mm:ss'
        : 'HH:mm';

  // Disable time based on limits
  const disabledTime = (current: dayjs.Dayjs | null) => {
    console.log('current', current);
    if (!timeLimits) return {};
    const limits = timeLimits as { start?: string; end?: string };
    
    if (!limits.start || !limits.end) return {};
    
    const startParts = String(limits.start).split(':');
    const endParts = String(limits.end).split(':');
    
    if (startParts.length < 2 || endParts.length < 2) return {};
    
    const startHour = Number(startParts[0]);
    const startMin = Number(startParts[1]);
    const endHour = Number(endParts[0]);
    const endMin = Number(endParts[1]);
    
    // Validate parsed values
    if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
      return {};
    }
    
    const disabledHours: number[] = [];
    const disabledMinutes = (hour: number) => {
      const minutes: number[] = [];
      
      if (hour < startHour || hour > endHour) {
        // If hour is completely outside range, disable all minutes
        for (let m = 0; m < 60; m++) {
          minutes.push(m);
        }
        return minutes;
      }
      
      if (hour === startHour) {
        // Disable minutes before start time
        for (let m = 0; m < startMin; m++) {
          minutes.push(m);
        }
      }
      
      if (hour === endHour) {
        // Disable minutes after end time
        for (let m = endMin + 1; m < 60; m++) {
          minutes.push(m);
        }
      }
      
      return minutes;
    };
    
    // Disable hours completely outside range
    for (let h = 0; h < 24; h++) {
      if (h < startHour || h > endHour) {
        disabledHours.push(h);
      }
    }
    
    return {
      disabledHours: () => disabledHours,
      disabledMinutes: disabledMinutes,
    };
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

  const onChange = (date: dayjs.Dayjs | null) => {
    if (!date) {
      setValue(null);
      updateAttributes({ value: null });
      return;
    }
    // Store as ISO string in UTC
    // If timezone is specified, treat the selected date/time as being in that timezone
    let iso: string;
    try {
      if (timezone) {
        // The date picker gives us a date in local time, but we want to interpret it as being in the specified timezone
        // Create a new dayjs object in the target timezone, then convert to UTC
        const year = date.year();
        const month = date.month();
        const day = date.date();
        const hour = date.hour();
        const minute = date.minute();
        const second = date.second();
        const millisecond = date.millisecond();
        
        // Create date in the specified timezone
        const tzDate = dayjs
          .tz(
            `${year}-${(month + 1).toString().padStart(2, '0')}-${day
              .toString()
              .padStart(2, '0')}T${hour
              .toString()
              .padStart(2, '0')}:${minute
              .toString()
              .padStart(2, '0')}:${second
              .toString()
              .padStart(2, '0')}.${millisecond
              .toString()
              .padStart(3, '0')}`,
            timezone
          );
        iso = tzDate.utc().toISOString();
      } else {
        // Use local timezone, convert to UTC
        iso = date.utc().toISOString();
      }
      setValue(iso);
      updateAttributes({ value: iso });
    } catch (error) {
      // Fallback if timezone conversion fails
      console.warn('Error converting date/time:', error);
      iso = date.utc().toISOString();
      setValue(iso);
      updateAttributes({ value: iso });
    }
  };

  // Don't render if not visible (except in edit mode)
  if (!isVisible && !isEditMode) {
    return null;
  }

  const requiredErrorBase =
    isSubmitMode && submitted && required && !value;
  const requiredError = shouldShowGrouping ? false : requiredErrorBase;

  return (
    <NodeViewWrapper 
      {...(isEditMode ? { 'data-drag-handle': true } : {})} 
      style={{ margin: '4px 0', display: isVisible || isEditMode ? 'block' : 'none' }}
      data-node-type="dateTimeField"
      data-node-name={String((node.attrs as any)?.name || '')}
    >
      <DateTimeEditModal
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
              enableGrouping: enableGrouping || false,
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
              <NodeViewContent className="datetime-label" />
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
        {isSubmitMode && approvalRequired && (
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
              {/* Per-group date/times */}
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
                  let iso: string;
                  try {
                    if (timezone) {
                      const tzDate = toDayjs(date.toISOString());
                      iso = (tzDate || date).utc().toISOString();
                    } else {
                      iso = date.utc().toISOString();
                    }
                  } catch {
                    iso = date.utc().toISOString();
                  }
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
                      showTime={{
                        format: timeFormatStr,
                        minuteStep: timeIncrement || undefined,
                        ...disabledTime(
                          entityISO ? toDayjs(entityISO) : null,
                        ),
                        use12Hours: timeFormat === '12',
                      }}
                      format={`YYYY-MM-DD ${timeFormatStr}`}
                      value={entityISO ? toDayjs(entityISO) : null}
                      onChange={(d) => handleEntityChange(d)}
                      disabledDate={disabledDate}
                      placeholder={placeholder || `Select date and time`}
                      size="small"
                      readOnly={mode === 'readonly'}
                      disabled={mode === 'readonly'}
                      allowClear
                      style={{ width: '100%', maxWidth: 250 }}
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

              {/* Per-ungrouped-subject date/times */}
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
                        let iso: string;
                        try {
                          if (timezone) {
                            const tzDate = toDayjs(date.toISOString());
                            iso = (tzDate || date).utc().toISOString();
                          } else {
                            iso = date.utc().toISOString();
                          }
                        } catch {
                          iso = date.utc().toISOString();
                        }
                        setEntityValue(entityId, iso);
                      };

                      return (
                        <div key={entityId}>
                          <div style={{ marginBottom: 4 }}>
                            <Tag>{subject.label}</Tag>
                          </div>
                          <DatePicker
                            showTime={{
                              format: timeFormatStr,
                              minuteStep: timeIncrement || undefined,
                              ...disabledTime(
                                entityISO ? toDayjs(entityISO) : null,
                              ),
                              use12Hours: timeFormat === '12',
                            }}
                            format={`YYYY-MM-DD ${timeFormatStr}`}
                            value={entityISO ? toDayjs(entityISO) : null}
                            onChange={(d) => handleEntityChange(d)}
                            disabledDate={disabledDate}
                            placeholder={
                              placeholder || `Select date and time`
                            }
                            size="small"
                            readOnly={mode === 'readonly'}
                            disabled={mode === 'readonly'}
                            allowClear
                            style={{ width: '100%', maxWidth: 250 }}
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
                showTime={{ 
                  format: timeFormatStr,
                  minuteStep: timeIncrement || undefined,
                  ...disabledTime(value ? toDayjs(value) : null),
                  use12Hours: timeFormat === '12',
                }}
                format={`YYYY-MM-DD ${timeFormatStr}`}
                value={value ? toDayjs(value) : null}
                onChange={(d) => onChange(d)}
                disabledDate={disabledDate}
                placeholder={placeholder || `Select date and time`}
                size="small"
                status={requiredError ? 'error' : undefined}
                readOnly={mode === 'readonly' || (mode === 'submit' && submitted)}
                disabled={mode === 'readonly'}
                allowClear
                style={{ width: '100%', maxWidth: 250 }}
              />
              {(timezone || requiredError) && (
                <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {timezone && (
                    <div style={{ color: token.colorTextSecondary, fontSize: 11 }}>
                      TZ: {String(timezone)}
                    </div>
                  )}
                  {requiredError && (
                    <div style={{ color: token.colorError, fontSize: 11 }}>
                      This field is required
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </NodeViewWrapper>
  );
};

export default DateTimeComponent;
