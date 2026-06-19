/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { Slider, Space, Button, theme, Card, Flex, Tooltip, Typography, Modal, Tag } from 'antd';
import { EditOutlined, DeleteOutlined, SettingOutlined, ExclamationCircleOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { validateNodeRequirements, getApprovalStatusForSubject } from '../../../../forms/QueuesComponents/questionApprovalUtils';
import type { JSONContent } from '@tiptap/core';
// import { getSetEditingNodeFromEditor } from '../../utils';
import SliderRangeEditModal from './editModel';
import { getQueryParam, evaluateVisibility, extractNodeLabel } from '../../utils';
import { NodeGroupingManager } from '../ShortTextField/NodeGroupingManager';
import { useGetTagsByIdsQuery } from '../../../../../services/tagsApi';

const { Text } = Typography;

const SliderComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { token } = theme.useToken();

  const {
    // label,
    min: rawMin = 0,
    max: rawMax = 10,
    step: rawStep = 1,
    rangeMode = false,
    marks = undefined,
    value: initialValue,
    showTicks = false,
    displayValue = 'tooltip', // 'tooltip' | 'above' | 'below' | 'none'
    displayStepValues = 'minmax', // 'none' | 'minmax' | 'all'
    prefix = '',
    suffix = '',
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

  // Ensure min, max, and step are numbers
  const min = typeof rawMin === 'number' ? rawMin : Number(rawMin) || 0;
  const max = typeof rawMax === 'number' ? rawMax : Number(rawMax) || 10;
  const step = typeof rawStep === 'number' ? rawStep : Number(rawStep) || 1;

  const coerceSingleValue = useCallback(
    (val: unknown) => {
      const numericValue =
        typeof val === 'number' ? val : val !== undefined ? Number(val) : undefined;
      if (numericValue === undefined || Number.isNaN(numericValue)) {
        return min;
      }
      return Math.min(Math.max(numericValue, min), max);
    },
    [min, max]
  );

  const coerceRangeValue = useCallback(
    (val: unknown) => {
      const defaultRange: [number, number] = [min, max];
      const arrayValue = Array.isArray(val) ? val : defaultRange;
      const [rawStart, rawEnd] = arrayValue.length >= 2 ? arrayValue : defaultRange;
      const parseNumber = (input: unknown, fallback: number) => {
        if (typeof input === 'number' && Number.isFinite(input)) {
          return input;
        }
        const parsed = Number(input);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      const start = Math.min(Math.max(parseNumber(rawStart, min), min), max);
      const end = Math.min(Math.max(parseNumber(rawEnd, max), min), max);
      const sorted: [number, number] = start <= end ? [start, end] : [end, start];
      return sorted;
    },
    [min, max]
  );

  const [value, setValue] = useState<number | number[]>(
    rangeMode ? coerceRangeValue(initialValue) : coerceSingleValue(initialValue)
  );
  const [error] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showGroupingModal, setShowGroupingModal] = useState(false);
  const mode = (editor as any)?.storage?.formBuilder?.mode ?? 'readonly';
  const isEditMode = mode === 'edit';
  const isSubmitMode = mode === 'submit';
  const submitted = (editor as any)?.storage?.formBuilder?.submitted === true;

  // Fetch tags for display using getByIds API (always, in all modes)
  // First check if tags are already in storage (from SubmitQueue optimization)
  // Otherwise, fetch by IDs using the getByIds API
  const editorStorage = useMemo(() => (editor as any)?.storage?.formBuilder, [editor]);
  const tagsFromStorage = editorStorage?.tagsByIds || [];
  const tagIds = (tags || []) as string[];
  const hasTagsInStorage = tagIds.length > 0 && tagsFromStorage.length > 0 && 
    tagIds.every((id) => tagsFromStorage.some((t: { _id: string; }) => t._id === id));
  
  const { data: tagsByIdsResponse } = useGetTagsByIdsQuery(
    { tagIds },
    { skip: tagIds.length === 0 || hasTagsInStorage }
  );
  
  const fetchedTags = tagsByIdsResponse?.data?.tags || [];
  
  const associatedTags = useMemo(() => {
    if (!tagIds || tagIds.length === 0) return [];
    // Use tags from storage if available and complete, otherwise use fetched tags
    const availableTags = hasTagsInStorage ? tagsFromStorage : fetchedTags;
    return availableTags.filter((tag: { _id: string; }) => tagIds.includes(tag._id));
  }, [tagIds, hasTagsInStorage, tagsFromStorage, fetchedTags]);

  // Query parameter handling
  useEffect(() => {
    if (!queryParam || !isSubmitMode) {
      return;
    }
    if (initialValue !== undefined && initialValue !== null) {
      return;
    }
    const paramValue = getQueryParam(queryParam);
    if (!paramValue) {
      return;
    }
    if (rangeMode) {
      const parts = paramValue.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length === 2 && !parts.some(Number.isNaN)) {
        const newValue = coerceRangeValue(parts as unknown as number[]);
        setValue(newValue);
        updateAttributes({ value: newValue });
      }
    } else {
      const numValue = parseFloat(paramValue);
      if (!Number.isNaN(numValue)) {
        const coercedSingle = coerceSingleValue(numValue);
        setValue(coercedSingle);
        updateAttributes({ value: coercedSingle });
      }
    }
  }, [
    queryParam,
    isSubmitMode,
    initialValue,
    rangeMode,
    coerceRangeValue,
    coerceSingleValue,
    updateAttributes,
  ]);

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
    setValue(rangeMode ? coerceRangeValue(initialValue) : coerceSingleValue(initialValue));
  }, [initialValue, min, max, rangeMode, coerceRangeValue, coerceSingleValue]);

  // Build marks if passed as array of {value,label} or object mapping
  const marksObj = useMemo(() => {
    if (!marks) return undefined;
    if (Array.isArray(marks)) {
      const out: Record<number, string> = {};
      marks.forEach((m: unknown) => {
        if (typeof m === 'object' && m !== null && 'value' in m) {
          const item = m as { value?: unknown; label?: unknown };
          out[Number(item.value)] = String(item.label ?? item.value);
        }
      });
      return out;
    }
    if (typeof marks === 'object') return marks as Record<number, string>;
    return undefined;
  }, [marks]);

  const onChangeSingle = (v: number) => {
    const coercedValue = coerceSingleValue(v);
    setValue(coercedValue);
    updateAttributes({ value: coercedValue });
  };

  const onChangeRange = (v: number[]) => {
    const coercedValue = coerceRangeValue(v);
    setValue(coercedValue);
    updateAttributes({ value: coercedValue });
  };

  // Don't render if not visible (except in edit mode)
  // Build marks for step values display
  const stepMarks = useMemo(() => {
    if (displayStepValues === 'none') return marksObj;
    if (step <= 0) return marksObj;
    if (displayStepValues === 'minmax') {
      const baseMarks: Record<number, string> = { ...(marksObj || {}) };
      baseMarks[min] = baseMarks[min] ?? String(min);
      baseMarks[max] = baseMarks[max] ?? String(max);
      return baseMarks;
    }
    // 'all' - show all step values
    const baseMarks: Record<number, string> = { ...(marksObj || {}) };
    const totalSteps = Math.floor((max - min) / step);
    const cappedSteps = Math.min(totalSteps, 500);
    for (let i = 0; i <= cappedSteps; i += 1) {
      const stepValue = min + i * step;
      // Ensure stepValue is a valid number before calling toFixed
      if (typeof stepValue === 'number' && Number.isFinite(stepValue)) {
        const current = Number(stepValue.toFixed(10));
        if (!baseMarks[current]) {
          baseMarks[current] = String(current);
        }
      }
    }
    if (!baseMarks[max]) {
      baseMarks[max] = String(max);
    }
    return baseMarks;
  }, [displayStepValues, min, max, step, marksObj]);

  if (!isVisible && !isEditMode) {
    return null;
  }

  const requiredErrorBase =
    isSubmitMode && submitted && required && (value === undefined || value === null);
  // When grouping UI is shown, we'll rely on per-entity values, so avoid showing
  // a misleading global required error on the base slider.
  const requiredError = shouldShowGrouping ? false : requiredErrorBase;


  const formatValue = (val: number | number[]): string => {
    if (Array.isArray(val)) {
      const [start, end] = val;
      return `${prefix}${start}${suffix} - ${prefix}${end}${suffix}`;
    }
    return `${prefix}${val}${suffix}`;
  };

  return (
    <NodeViewWrapper 
      {...(isEditMode ? { 'data-drag-handle': true } : {})} 
      style={{ margin: '8px 0', display: isVisible || isEditMode ? 'block' : 'none' }}
      data-node-type="sliderField"
      data-node-name={String((node.attrs as any)?.name || '')}
    >
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
      <SliderRangeEditModal
        open={showModal}
        onClose={() => setShowModal(false)}
        nodeAttrs={node.attrs}
        onSave={(values) => {
          updateAttributes(values);
          setShowModal(false);
        }}
      />
      <Card
        size="small"
        style={{
          margin: '8px 0',
          borderColor:
            (error || (((editor as any)?.storage?.formBuilder?.mode) === 'submit' && (editor as any)?.storage?.formBuilder?.submitted && (node.attrs as any)?.required && (node.attrs as any)?.value == null))
              ? token.colorError
              : token.colorBorder,
          borderRadius: token.borderRadiusLG,
          transition: 'border-color 0.2s ease',
          background: token.colorBgContainer,
        }}
        variant="outlined"
      >
        <Flex justify="space-between" style={{ marginLeft: 8 }}>
          <div style={{ marginBottom: 8, fontWeight: 600, width: '100%' }}>
            <div contentEditable={mode === 'submit' ? false : undefined}>
              <NodeViewContent className="slider-label" />
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
                {associatedTags.map((tag: { _id: string; name: string; }) => (
                  <Tag key={tag._id} color="blue" style={{ fontSize: 11, flexShrink: 0 }}>
                    {tag.name}
                  </Tag>
                ))}
              </div>
            )}
          </div>
          {isEditMode && (
            <Space size={4} style={{ alignSelf: 'flex-start', marginLeft: 8 }}>
              <Tooltip title="Edit field settings">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => setShowModal(true)}
                />
              </Tooltip>
              <Tooltip title="Delete field">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={deleteNode}
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
        
        {!isSubmitMode && approvalRequired && (
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

        <div style={{ marginTop: 8 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
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
                {/* Per-group sliders */}
                {groupsToUse.map((group: any) => {
                  const entityId = `group-${group.id}`;
                  const entityValue =
                    (nodeGroupValues as any)[entityId] ??
                    (rangeMode ? coerceRangeValue(initialValue) : coerceSingleValue(initialValue));
                  const groupSubjects = (group.subjectIds || [])
                    .map((id: string) =>
                      subjectsOptionsFromStorage.find((s: any) => s.value === id),
                    )
                    .filter(Boolean)
                    .map((s: any) => s.label)
                    .join(', ');

                  const handleGroupChange = (val: number | number[]) => {
                    const coerced = rangeMode
                      ? coerceRangeValue(val)
                      : coerceSingleValue(val);
                    const updated = {
                      ...(nodeGroupValues as any),
                      [entityId]: coerced,
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
                          updated[ungroupedKey] = coerced;
                        });
                      }
                    }

                    updateAttributes({ nodeGroupValues: updated });
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
                      {displayValue === 'above' && entityValue != null && (
                        <Text
                          strong
                          style={{ textAlign: 'center', display: 'block' }}
                        >
                          {formatValue(entityValue as number | number[])}
                        </Text>
                      )}
                      {rangeMode ? (
                        <Slider
                          min={min}
                          max={max}
                          step={step}
                          range
                          marks={stepMarks}
                          value={entityValue as number[]}
                          onChange={(v) =>
                            handleGroupChange(v as number[])
                          }
                          tooltip={
                            displayValue === 'tooltip'
                              ? {
                                  formatter: (v) =>
                                    formatValue(
                                      v ??
                                        (rangeMode ? [min, max] : min),
                                    ),
                                }
                              : { open: false }
                          }
                          dots={showTicks}
                          disabled={mode === 'readonly'}
                        />
                      ) : (
                        <Slider
                          min={min}
                          max={max}
                          step={step}
                          marks={stepMarks}
                          value={entityValue as number}
                          onChange={(v) =>
                            handleGroupChange(v as number)
                          }
                          tooltip={
                            displayValue === 'tooltip'
                              ? {
                                  formatter: (v) =>
                                    formatValue(v ?? min),
                                }
                              : { open: false }
                          }
                          dots={showTicks}
                          disabled={mode === 'readonly'}
                        />
                      )}
                      {displayValue === 'below' && entityValue != null && (
                        <Text
                          strong
                          style={{ textAlign: 'center', display: 'block' }}
                        >
                          {formatValue(entityValue as number | number[])}
                        </Text>
                      )}
                      
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

                {/* Per-ungrouped-subject sliders */}
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
                        const entityValue =
                          (nodeGroupValues as any)[entityId] ??
                          (rangeMode
                            ? coerceRangeValue(initialValue)
                            : coerceSingleValue(initialValue));

                        const handleSubjectChange = (
                          val: number | number[],
                        ) => {
                          const coerced = rangeMode
                            ? coerceRangeValue(val)
                            : coerceSingleValue(val);
                          const updated = {
                            ...(nodeGroupValues as any),
                            [entityId]: coerced,
                          };

                          // Sync values between grouped and ungrouped subjects
                          // If an ungrouped value is changed, also update the group value if that subject is in a group
                          if (entityId.startsWith('ungrouped-')) {
                            const subjectId = entityId.replace('ungrouped-', '');
                            // Find which group(s) this subject belongs to
                            const subjectGroups = groupsToUse.filter((g: any) =>
                              g.subjectIds && g.subjectIds.includes(subjectId)
                            );
                            // Update group value for each group this subject belongs to
                            subjectGroups.forEach((group: any) => {
                              const groupKey = `group-${group.id}`;
                              updated[groupKey] = coerced;
                              // Also update ungrouped values for all other subjects in the same group
                              group.subjectIds.forEach((otherSubjectId: string) => {
                                const otherUngroupedKey = `ungrouped-${otherSubjectId}`;
                                updated[otherUngroupedKey] = coerced;
                              });
                            });
                          }

                          updateAttributes({ nodeGroupValues: updated });
                        };

                        return (
                          <div key={entityId}>
                            <div style={{ marginBottom: 4 }}>
                              <Tag>{subject.label}</Tag>
                            </div>
                            {displayValue === 'above' &&
                              entityValue != null && (
                                <Text
                                  strong
                                  style={{
                                    textAlign: 'center',
                                    display: 'block',
                                  }}
                                >
                                  {formatValue(
                                    entityValue as number | number[],
                                  )}
                                </Text>
                              )}
                            {rangeMode ? (
                              <Slider
                                min={min}
                                max={max}
                                step={step}
                                range
                                marks={stepMarks}
                                value={entityValue as number[]}
                                onChange={(v) =>
                                  handleSubjectChange(v as number[])
                                }
                                tooltip={
                                  displayValue === 'tooltip'
                                    ? {
                                        formatter: (v) =>
                                          formatValue(
                                            v ??
                                              (rangeMode
                                                ? [min, max]
                                                : min),
                                          ),
                                      }
                                    : { open: false }
                                }
                                dots={showTicks}
                                disabled={mode === 'readonly'}
                              />
                            ) : (
                              <Slider
                                min={min}
                                max={max}
                                step={step}
                                marks={stepMarks}
                                value={entityValue as number}
                                onChange={(v) =>
                                  handleSubjectChange(v as number)
                                }
                                tooltip={
                                  displayValue === 'tooltip'
                                    ? {
                                        formatter: (v) =>
                                          formatValue(v ?? min),
                                      }
                                    : { open: false }
                                }
                                dots={showTicks}
                                disabled={mode === 'readonly'}
                              />
                            )}
                          {displayValue === 'below' &&
                            entityValue != null && (
                              <Text
                                strong
                                style={{
                                  textAlign: 'center',
                                  display: 'block',
                                }}
                              >
                                {formatValue(
                                  entityValue as number | number[],
                                )}
                              </Text>
                            )}
                          
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
                {displayValue === 'above' &&
                  value !== undefined &&
                  value !== null && (
                    <Text
                      strong
                      style={{ textAlign: 'center', display: 'block' }}
                    >
                      {formatValue(value as number | number[])}
                    </Text>
                  )}
                {rangeMode ? (
                  <Slider
                    min={min}
                    max={max}
                    step={step}
                    range
                    marks={stepMarks}
                    value={value as number[]}
                    onChange={onChangeRange}
                    tooltip={
                      displayValue === 'tooltip'
                        ? {
                            formatter: (v) =>
                              formatValue(
                                v ?? (rangeMode ? [min, max] : min),
                              ),
                          }
                        : { open: false }
                    }
                    dots={showTicks}
                    disabled={mode === 'readonly'}
                  />
                ) : (
                  <Slider
                    min={min}
                    max={max}
                    step={step}
                    marks={stepMarks}
                    value={value as number}
                    onChange={onChangeSingle}
                    tooltip={
                      displayValue === 'tooltip'
                        ? { formatter: (v) => formatValue(v ?? min) }
                        : { open: false }
                    }
                    dots={showTicks}
                    disabled={mode === 'readonly'}
                  />
                )}
                {displayValue === 'below' &&
                  value !== undefined &&
                  value !== null && (
                    <Text
                      strong
                      style={{ textAlign: 'center', display: 'block' }}
                    >
                      {formatValue(value as number | number[])}
                    </Text>
                  )}
              </>
            )}
            {requiredError && (
              <div style={{ color: token.colorError, marginTop: 6, fontSize: 12 }}>
                This field is required
              </div>
            )}
          </Space>
        </div>
      </Card>
    </NodeViewWrapper>
  );
};

export default SliderComponent;

