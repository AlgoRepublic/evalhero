/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import {
  Form,
  InputNumber,
  Space,
  Button,
  Card,
  theme,
  Flex,
  Tooltip,
  Typography,
  Tag,
  Modal,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { validateNodeRequirements, getApprovalStatusForSubject } from '../../../../forms/QueuesComponents/questionApprovalUtils';
import type { JSONContent } from '@tiptap/core';
// import { getSetEditingNodeFromEditor } from '../../utils';
import NumberEditModal from './editModel';
import { NodeGroupingManager } from '../ShortTextField/NodeGroupingManager';
import { getQueryParam, evaluateVisibility, extractNodeLabel } from '../../utils';
import { useGetTagsByIdsQuery } from '../../../../../services/tagsApi';

const { Text } = Typography;

const NumberComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { token } = theme.useToken();

  const {
    min,
    max,
    step,
    unit,
    value: initialValue,
    placeholder,
    required,
    approvalRequired: rawApprovalRequired = false,
    calculable = false,
    prefix = '',
    suffix = '',
    numberFormat = 'none',
    rounding = null,
    queryParam = null,
    visibility = { match: 'all', rules: [] },
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
  const [value, setValue] = useState<number | null>(initialValue ?? null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showGroupingModal, setShowGroupingModal] = useState(false);

  // Fetch tags for display using getByIds API (always, in all modes)
  // First check if tags are already in storage (from SubmitQueue optimization)
  // Otherwise, fetch by IDs using the getByIds API
  const editorStorage = useMemo(() => (editor as any)?.storage?.formBuilder, [editor]);
  const tagsFromStorage = useMemo(() => editorStorage?.tagsByIds || [], [editorStorage]);
  const tagIds = useMemo(() => (tags || []) as string[], [tags]);
  const hasTagsInStorage = useMemo(() => 
    tagIds.length > 0 && tagsFromStorage.length > 0 && 
    tagIds.every((id) => tagsFromStorage.some((t: { _id: string; }) => t._id === id)),
    [tagIds, tagsFromStorage]
  );
  
  const { data: tagsByIdsResponse } = useGetTagsByIdsQuery(
    { tagIds },
    { skip: tagIds.length === 0 || hasTagsInStorage }
  );
  
  const fetchedTags = useMemo(() => tagsByIdsResponse?.data?.tags || [], [tagsByIdsResponse]);
  
  const associatedTags = useMemo(() => {
    if (!tagIds || tagIds.length === 0) return [];
    // Use tags from storage if available and complete, otherwise use fetched tags
    const availableTags = hasTagsInStorage ? tagsFromStorage : fetchedTags;
    return availableTags.filter((tag: { _id: string; }) => tagIds.includes(tag._id));
  }, [tagIds, hasTagsInStorage, tagsFromStorage, fetchedTags]);

  const mode = (editor as any)?.storage?.formBuilder?.mode || 'readonly';
  const isEditMode = mode === 'edit';
  const isSubmitMode = mode === 'submit';
  const submitted = (editor as any)?.storage?.formBuilder?.submitted === true;

  const formatConfig = useMemo(() => {
    switch (numberFormat) {
      case 'comma':
        return {
          locale: 'en-US',
          options: { useGrouping: true } as Intl.NumberFormatOptions,
          decimalSeparator: '.',
          groupSeparator: ',',
        };
      case 'dot':
        return {
          locale: 'de-DE',
          options: { useGrouping: true } as Intl.NumberFormatOptions,
          decimalSeparator: ',',
          groupSeparator: '.',
        };
      case 'space':
        return {
          locale: 'fr-FR',
          options: { useGrouping: true } as Intl.NumberFormatOptions,
          decimalSeparator: ',',
          groupSeparator: ' ',
        };
      case 'none':
      default:
        return {
          locale: 'en-US',
          options: { useGrouping: false } as Intl.NumberFormatOptions,
          decimalSeparator: '.',
          groupSeparator: '',
        };
    }
  }, [numberFormat]);

  const applyRounding = useCallback(
    (num: number) => {
      if (rounding === null || rounding === undefined || rounding < 0) return num;
      if (!Number.isFinite(num)) return num;
      const factor = Math.pow(10, rounding);
      return Math.round(num * factor) / factor;
    },
    [rounding],
  );

  const intlFormatter = useMemo(() => {
    const options: Intl.NumberFormatOptions = { ...formatConfig.options };
    if (rounding !== null && rounding !== undefined && rounding >= 0) {
      options.minimumFractionDigits = rounding;
      options.maximumFractionDigits = rounding;
    }
    return new Intl.NumberFormat(formatConfig.locale, options);
  }, [formatConfig, rounding]);

  const formatNumber = useCallback(
    (num: number | null): string => {
      if (num === null || num === undefined || Number.isNaN(num)) return '';
      return intlFormatter.format(num).replace(/\u00A0/g, ' ');
    },
    [intlFormatter],
  );

  const parseInputValue = useCallback(
    (val: string | undefined | null): string => {
      if (val === undefined || val === null) return '';
      let normalized = val.replace(/\u00A0/g, ' ');

      if (formatConfig.groupSeparator) {
        if (formatConfig.groupSeparator === ' ') {
          normalized = normalized.replace(/\s+/g, '');
        } else {
          const escapedGroup = formatConfig.groupSeparator.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
          normalized = normalized.replace(new RegExp(escapedGroup, 'g'), '');
        }
      } else {
        normalized = normalized.replace(/\s+/g, '');
      }

      const decimalSeparator = formatConfig.decimalSeparator;
      if (decimalSeparator !== '.') {
        const parts = normalized.split(decimalSeparator);
        if (parts.length > 1) {
          const [integerPart, ...rest] = parts;
          const fractionPart = rest.join('');
          normalized = `${integerPart}.${fractionPart}`;
        } else {
          normalized = normalized.replace(new RegExp(`\\${decimalSeparator}`, 'g'), '');
        }
      } else {
        const parts = normalized.split('.');
        if (parts.length > 1) {
          const [integerPart, ...rest] = parts;
          const fractionPart = rest.join('');
          normalized = `${integerPart}.${fractionPart}`;
        }
      }

      normalized = normalized.replace(/[^0-9.-]/g, '');

      if (normalized.includes('-')) {
        const isNegative = normalized.startsWith('-');
        normalized = (isNegative ? '-' : '') + normalized.replace(/-/g, '');
      }

      return normalized;
    },
    [formatConfig],
  );

  // Query parameter handling
  useEffect(() => {
    if (queryParam && isSubmitMode && value === null) {
      const paramValue = getQueryParam(queryParam);
      if (paramValue) {
        const numValue = parseFloat(paramValue);
        if (!isNaN(numValue)) {
          const rounded = applyRounding(numValue);
          setValue(rounded);
          updateAttributes({ value: rounded });
        }
      }
    }
  }, [queryParam, isSubmitMode, value, applyRounding, updateAttributes]);

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

  useEffect(() => {
    setValue(initialValue === undefined ? null : initialValue);
  }, [initialValue]);

  const validate = useCallback(
    (v: number | null) => {
    if (v === null || v === undefined) {
      if (required) {
        setError('Required');
        return false;
      }
      setError(null);
      return true;
    }
    if (min !== undefined && v < min) {
      setError(`Minimum is ${min}`);
      return false;
    }
    if (max !== undefined && v > max) {
      setError(`Maximum is ${max}`);
      return false;
    }
    setError(null);
    return true;
    },
    [required, min, max],
  );

  const onChange = (raw: number | string | null) => {
    if (raw === null || raw === undefined || raw === '') {
      setValue(null);
      validate(null);
      updateAttributes({ value: null });
      return;
    }

    const numericValue =
      typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;

    if (Number.isNaN(numericValue)) {
      return;
    }

    const roundedValue = applyRounding(numericValue);
    setValue(roundedValue);
    validate(roundedValue);
    updateAttributes({ value: roundedValue });
  };

  useEffect(() => {
    if (initialValue === null || initialValue === undefined) {
      setValue(null);
      return;
    }
    const rounded = applyRounding(initialValue);
    setValue(rounded);
  }, [initialValue, applyRounding]);

  useEffect(() => {
    validate(value);
  }, [min, max, required, value, validate]);

  useEffect(() => {
    if (value === null || value === undefined) return;
    const rounded = applyRounding(value);
    if (rounded !== value) {
      setValue(rounded);
      updateAttributes({ value: rounded });
    }
  }, [value, applyRounding, updateAttributes]);

  // Global/default groups and subjects from editor storage
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

  // Don't render if not visible (except in edit mode)
  if (!isVisible && !isEditMode) {
    return null;
  }

  return (
    <NodeViewWrapper
      {...(isEditMode ? { 'data-drag-handle': true } : {})}
      style={{
        margin: '8px 0',
        display: isVisible || isEditMode ? 'block' : 'none',
      }}
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
            onChange={(value) => {
              updateAttributes({
                enableGrouping: value.enableGrouping,
                nodeGroups: value.nodeGroups,
              });
            }}
            subjectsOptions={subjectsOptionsFromStorage}
            globalGroups={globalGroups}
            fieldLabel={extractNodeLabel(node)}
          />
        </Modal>
      )}
      <NumberEditModal
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
          borderColor: (!isEditMode && (error || (isSubmitMode && submitted && required && (value == null)))) ? token.colorError : token.colorBorder,
          borderRadius: token.borderRadiusLG,
          transition: 'border-color 0.2s ease',
          background: token.colorBgContainer,
        }}
        variant="outlined"
      >
        <Flex justify="space-between" style={{ marginLeft: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 8, fontWeight: 600, width: '100%' }} contentEditable={(editor as any)?.storage?.formBuilder?.mode === 'submit' ? false : undefined}>
              <NodeViewContent className="number-label" />
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
                  marginBottom: 6,
                }}
              >
                Required
              </Tag>
            )}
            {associatedTags.length > 0 && (
              <div style={{ marginBottom: 6, display: 'flex', flexWrap: 'nowrap', gap: 4, alignItems: 'center', overflowX: 'auto' }}>
                <span style={{ fontSize: 11, color: token.colorTextSecondary, marginRight: 4, flexShrink: 0 }}>Tags:</span>
                {associatedTags.map((tag: any) => (
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

        <Form.Item
          style={{ marginTop: 8 }}
          validateStatus={
            !isEditMode &&
            (error || (isSubmitMode && submitted && required && value == null))
              ? 'error'
              : undefined
          }
          help={
            !isEditMode
              ? error ||
                (isSubmitMode && submitted && required && value == null
                  ? 'This field is required'
                  : undefined)
              : undefined
          }
          labelCol={{ span: 24 }}
        >
          {shouldShowGrouping && isSubmitMode && (
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
              {/* Per-group values */}
              {groupsToUse.map((group: any) => {
                const entityId = `group-${group.id}`;
                const groupValue =
                  (nodeGroupValues as any)[entityId] ?? null;
                const groupSubjects = (group.subjectIds || [])
                  .map((id: string) =>
                    subjectsOptionsFromStorage.find((s: any) => s.value === id),
                  )
                  .filter(Boolean)
                  .map((s: any) => s.label)
                  .join(', ');
                
                // Get approval status for this group to disable inputs if approved
                const globalGroups = (editor.storage as any)?.formBuilder?.globalGroups || [];
                const groupApprovalStatus = effectiveApprovalRequired
                  ? getApprovalStatusForSubject(
                      node as unknown as JSONContent,
                      (group.subjectIds || [])[0] || '',
                      globalGroups
                    )
                  : null;
                const isApproved = groupApprovalStatus === 'approved';

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
                    <InputNumber
                      min={min}
                      max={max}
                      step={step}
                      placeholder={placeholder}
                      value={groupValue}
                      onChange={(raw) => {
                        const updated = {
                          ...(nodeGroupValues as any),
                          [entityId]: raw,
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
                              updated[ungroupedKey] = raw;
                            });
                          }
                        }

                        updateAttributes({ nodeGroupValues: updated });
                      }}
                      style={{ width: '100%' }}
                      formatter={(val) => {
                        if (val === undefined || val === null || val === '')
                          return '';
                        const num = Number(
                          parseInputValue(val.toString()),
                        );
                        if (Number.isNaN(num)) return '';
                        return formatNumber(num);
                      }}
                      parser={(val) => parseInputValue(val)}
                      readOnly={mode === 'readonly'}
                      disabled={mode === 'readonly' || isApproved}
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
                                    const subjectsProfiles = (editor.storage as any)?.formBuilder?.subjectsProfiles || [];
                                    if (openDrawer) {
                                      // Get Profile objects for all subjects in the group
                                      const groupProfiles = group.subjectIds
                                        .map((id: string) => subjectsProfiles.find((profile: any) => profile._id === id))
                                        .filter(Boolean);
                                      
                                      const subjectContext = {
                                        type: 'group' as const,
                                        subjectId: group.subjectIds || [],
                                        subjectName: groupSubjects,
                                        groupId: group.id,
                                        groupName: group.name,
                                        subjects: groupProfiles,
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

              {/* Per-ungrouped-subject values */}
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
                      const subjectValue =
                        (nodeGroupValues as any)[entityId] ?? null;
                      return (
                        <div key={entityId}>
                          <div style={{ marginBottom: 4 }}>
                            <Tag>{subject.label}</Tag>
                          </div>
                          <InputNumber
                            min={min}
                            max={max}
                            step={step}
                            placeholder={placeholder}
                            value={subjectValue}
                            onChange={(raw) => {
                              const updated = {
                                ...(nodeGroupValues as any),
                                [entityId]: raw,
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
                                  updated[groupKey] = raw;
                                  // Also update ungrouped values for all other subjects in the same group
                                  group.subjectIds.forEach((otherSubjectId: string) => {
                                    const otherUngroupedKey = `ungrouped-${otherSubjectId}`;
                                    updated[otherUngroupedKey] = raw;
                                  });
                                });
                              }

                              updateAttributes({
                                nodeGroupValues: updated,
                              });
                            }}
                            style={{ width: '100%' }}
                            formatter={(val) => {
                              if (
                                val === undefined ||
                                val === null ||
                                val === ''
                              )
                                return '';
                              const num = Number(
                                parseInputValue(val.toString()),
                              );
                              if (Number.isNaN(num)) return '';
                              return formatNumber(num);
                            }}
                            parser={(val) => parseInputValue(val)}
                            readOnly={mode === 'readonly'}
                            disabled={mode === 'readonly' || (effectiveApprovalRequired && (() => {
                              const globalGroups = (editor.storage as any)?.formBuilder?.globalGroups || [];
                              const subjectApprovalStatus = getApprovalStatusForSubject(
                                node as unknown as JSONContent,
                                subject.value,
                                globalGroups
                              );
                              return subjectApprovalStatus === 'approved';
                            })())}
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
                                          const subjectsProfiles = (editor.storage as any)?.formBuilder?.subjectsProfiles || [];
                                          if (openDrawer) {
                                            // Get Profile object for the ungrouped subject
                                            const subjectProfile = subjectsProfiles.find((profile: any) => profile._id === subject.value);
                                            
                                            const subjectContext = {
                                              type: 'ungrouped' as const,
                                              subjectId: [subject.value],
                                              subjectName: subject.label,
                                              subjects: subjectProfile ? [subjectProfile] : [],
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

              {calculable && (
                <Tag color="blue" style={{ marginTop: 4 }}>
                  Calculable
                </Tag>
              )}
              {unit && (
                <Text
                  type="secondary"
                  style={{ marginLeft: 8, fontSize: 12 }}
                >
                  {unit}
                </Text>
              )}
            </Space>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'stretch',
                }}
              >
                {prefix && (
                  <div
                    style={{
                      padding: '4px 8px',
                      border: `1px solid ${token.colorBorder}`,
                      borderRight: 'none',
                      borderRadius: `${token.borderRadius}px 0 0 ${token.borderRadius}px`,
                      background: token.colorFillSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Text type="secondary">{prefix}</Text>
                  </div>
                )}
                <InputNumber
                  min={min}
                  max={max}
                  step={step}
                  placeholder={placeholder}
                  value={value ?? null}
                  onChange={onChange}
                  style={{
                    flex: 1,
                    borderRadius:
                      prefix || suffix ? 0 : token.borderRadius,
                  }}
                  formatter={(val) => {
                    if (val === undefined || val === null || val === '')
                      return '';
                    const num = Number(
                      parseInputValue(val.toString()),
                    );
                    if (Number.isNaN(num)) return '';
                    return formatNumber(num);
                  }}
                  parser={(val) => parseInputValue(val)}
                  readOnly={
                    mode === 'readonly' ||
                    (mode === 'submit' && submitted)
                  }
                  disabled={mode === 'readonly' || (effectiveApprovalRequired && node.attrs.approvalStatus === 'approved')}
                />
                {suffix && (
                  <div
                    style={{
                      padding: '4px 8px',
                      border: `1px solid ${token.colorBorder}`,
                      borderLeft: 'none',
                      borderRadius: `0 ${token.borderRadius}px ${token.borderRadius}px 0`,
                      background: token.colorFillSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Text type="secondary">{suffix}</Text>
                  </div>
                )}
              </div>
              {calculable && (
                <Tag color="blue" style={{ marginTop: 4 }}>
                  Calculable
                </Tag>
              )}
              {unit && (
                <Text
                  type="secondary"
                  style={{ marginLeft: 8, fontSize: 12 }}
                >
                  {unit}
                </Text>
              )}
            </>
          )}
        </Form.Item>
      </Card>
    </NodeViewWrapper>
  );
};

export default NumberComponent;
