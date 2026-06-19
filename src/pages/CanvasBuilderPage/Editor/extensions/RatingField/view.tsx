/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { Rate, Space, Button, theme, Card, Flex, Tooltip, Typography, Modal, Tag } from 'antd';
import { EditOutlined, DeleteOutlined, SettingOutlined, ExclamationCircleOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { validateNodeRequirements, getApprovalStatusForSubject } from '../../../../forms/QueuesComponents/questionApprovalUtils';
import type { JSONContent } from '@tiptap/core';
import { getQueryParam, evaluateVisibility } from '../../utils';
import RatingEditModal from './editModel';
import { NodeGroupingManager } from '../ShortTextField/NodeGroupingManager';
import { extractNodeLabel } from '../../utils';
import { useGetTagsByIdsQuery } from '../../../../../services/tagsApi';

const { Text } = Typography;

const RatingComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { token } = theme.useToken();
  const {
    label,
    variant = 'stars', // 'stars' | 'anchors' | 'emoji'
    scale = 5, // 1..scale
    allowHalf = false,
    anchorLabels: rawAnchorLabels,
    value: initialValue,
    required = false,
    approvalRequired: rawApprovalRequired = false,
    showSuffix = false,
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

  // Process anchorLabels: ensure it's an array and matches scale
  const anchorLabels = useMemo(() => {
    if (Array.isArray(rawAnchorLabels) && rawAnchorLabels.length === scale) {
      return rawAnchorLabels;
    }
    // Default labels for common scales
    const defaultLabels: Record<number, string[]> = {
      3: ['Poor', 'Fair', 'Excellent'],
      4: ['Poor', 'Fair', 'Good', 'Excellent'],
      5: ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'],
      7: ['Very Poor', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent', 'Outstanding'],
      10: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    };
    return defaultLabels[scale] || Array.from({ length: scale }, (_, i) => String(i + 1));
  }, [rawAnchorLabels, scale]);

  const [value, setValue] = useState<number | null>(initialValue ?? null);
  const [showModal, setShowModal] = useState(false);
  const [showGroupingModal, setShowGroupingModal] = useState(false);
  // const setEditingNode = getSetEditingNodeFromEditor(editor);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const mode = (editor.storage as any)?.formBuilder?.mode ?? 'readonly';
  const isEditMode = mode === 'edit';
  const isSubmitMode = mode === 'submit';
  const submitted = (editor.storage as any)?.formBuilder?.submitted === true;

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
    if (queryParam && isSubmitMode && !value) {
      const paramValue = getQueryParam(queryParam);
      if (paramValue) {
        const numValue = parseFloat(paramValue);
        if (!isNaN(numValue) && numValue >= 1 && numValue <= scale) {
          const clampedValue = allowHalf ? numValue : Math.round(numValue);
          setValue(clampedValue);
          updateAttributes({ value: clampedValue });
        }
      }
    }
  }, [queryParam, isSubmitMode, scale, allowHalf, value, updateAttributes]);

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
    setValue(initialValue ?? null);
  }, [initialValue]);

  const onChange = (v: number) => {
    setValue(v);
    // partial update of node attrs — only the value
    updateAttributes({ value: v });
  };

  const setEntityValue = (entityId: string, v: number | null) => {
    const updated = {
      ...(nodeGroupValues as any),
      [entityId]: v,
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
          updated[ungroupedKey] = v;
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
        updated[groupKey] = v;
        // Also update ungrouped values for all other subjects in the same group
        group.subjectIds.forEach((otherSubjectId: string) => {
          const otherUngroupedKey = `ungrouped-${otherSubjectId}`;
          updated[otherUngroupedKey] = v;
        });
      });
    }

    updateAttributes({ nodeGroupValues: updated });
  };

  // Render anchors as pill buttons (clickable in submit mode)
  const renderPills = () => {
    if (!Array.isArray(anchorLabels) || anchorLabels.length !== scale) {
      // fallback to segmented numeric UI
      return (
        <div contentEditable={false} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          {Array.from({ length: scale }, (_, i) => {
            const idx = i + 1;
            const selected = value === idx;
            return (
              <span
                key={idx}
                contentEditable={false}
                onClick={isSubmitMode ? () => onChange(idx) : undefined}
                style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  backgroundColor: selected ? token.colorPrimary : token.colorFillSecondary,
                  color: selected ? '#fff' : token.colorText,
                  fontSize: 14,
                  fontWeight: selected ? 500 : 400,
                  opacity: selected ? 1 : 0.6,
                  cursor: isSubmitMode ? 'pointer' : 'default',
                  userSelect: 'none',
                  pointerEvents: isSubmitMode ? 'auto' : 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={isSubmitMode ? (e) => {
                  if (!selected) {
                    (e.currentTarget as HTMLElement).style.opacity = '0.8';
                  }
                } : undefined}
                onMouseLeave={isSubmitMode ? (e) => {
                  if (!selected) {
                    (e.currentTarget as HTMLElement).style.opacity = '0.6';
                  }
                } : undefined}
                aria-label={`Rating ${idx} of ${scale}${selected ? ' (selected)' : ''}`}
              >
                {String(idx)}
              </span>
            );
          })}
        </div>
      );
    }

    return (
      <div
        contentEditable={false}
        ref={groupRef}
        role="radiogroup"
        style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
        aria-label={label || 'Rating'}
      >
        {anchorLabels.map((lab: string, idx: number) => {
          const index = idx + 1;
          const selected = value === index;
          return (
            <span
              key={index}
              contentEditable={false}
              onClick={isSubmitMode ? () => onChange(index) : undefined}
              style={{
                display: 'inline-block',
                minWidth: 84,
                padding: '4px 12px',
                borderRadius: '16px',
                backgroundColor: selected ? token.colorPrimary : token.colorFillSecondary,
                color: selected ? '#fff' : token.colorText,
                fontSize: 14,
                fontWeight: selected ? 500 : 400,
                whiteSpace: 'normal',
                textAlign: 'center',
                opacity: selected ? 1 : 0.6,
                cursor: isSubmitMode ? 'pointer' : 'default',
                userSelect: 'none',
                pointerEvents: isSubmitMode ? 'auto' : 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={isSubmitMode ? (e) => {
                if (!selected) {
                  (e.currentTarget as HTMLElement).style.opacity = '0.8';
                }
              } : undefined}
              onMouseLeave={isSubmitMode ? (e) => {
                if (!selected) {
                  (e.currentTarget as HTMLElement).style.opacity = '0.6';
                }
              } : undefined}
              aria-label={`${lab} (Rating ${index} of ${scale})${selected ? ' (selected)' : ''}`}
            >
              {lab}
            </span>
          );
        })}
      </div>
    );
  };

  // Generate emoji mapping for any scale
  const getEmojiForIndex = useMemo(() => {
    const emojiSets = [
      ['😞', '😐', '🙂', '😊', '😄'], // 5-point scale
      ['😢', '😞', '😐', '🙂', '😊', '😄', '🤩'], // 7-point scale
      ['😢', '😞', '😐', '🙂', '😊', '😄', '🤩', '🌟', '💯', '🎉'], // 10-point scale
    ];
    
    // Select appropriate emoji set based on scale
    let selectedSet: string[] = [];
    if (scale <= 5) {
      selectedSet = emojiSets[0].slice(0, scale);
    } else if (scale <= 7) {
      selectedSet = emojiSets[1].slice(0, scale);
    } else if (scale <= 10) {
      selectedSet = emojiSets[2].slice(0, scale);
    } else {
      // For scales > 10, interpolate between min and max emoji
      const minEmoji = '😞';
      const maxEmoji = '😄';
      selectedSet = Array.from({ length: scale }, (_, i) => {
        if (i === 0) return minEmoji;
        if (i === scale - 1) return maxEmoji;
        // Interpolate: use middle emojis for intermediate values
        const progress = i / (scale - 1);
        if (progress < 0.33) return '😐';
        if (progress < 0.66) return '🙂';
        return '😊';
      });
    }
    
    return (index: number): string => {
      return selectedSet[index - 1] || '⭐';
    };
  }, [scale]);

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
    <NodeViewWrapper 
      {...(isEditMode ? { 'data-drag-handle': true } : {})} 
      style={{ margin: '8px 0', display: isVisible || isEditMode ? 'block' : 'none' }}
      data-node-type="ratingField"
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
      <RatingEditModal
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
          borderColor: requiredError ? token.colorError : token.colorBorder,
          borderRadius: token.borderRadiusLG,
          transition: 'border-color 0.2s ease',
          background: token.colorBgContainer,
        }}
        variant="outlined"
      >
        <Flex justify="space-between" style={{ marginLeft: 8 }}>
          <div style={{ fontWeight: 600, width: '100%' }}>
            <div contentEditable={isSubmitMode ? false : undefined}>
              <NodeViewContent className="rating-label" />
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

        <div contentEditable={false} style={{ marginTop: 8 }}>
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
              {/* Per-group ratings */}
              {groupsToUse.map((group: any) => {
                const entityId = `group-${group.id}`;
                const entityValue =
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

                const handleEntityChange = (v: number | null) => {
                  setEntityValue(entityId, v);
                };

                const renderControl = () => {
                  if (variant === 'stars') {
                    return (
                      <div
                        contentEditable={false}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Rate
                          count={Number(scale) || 5}
                          allowHalf={allowHalf}
                          value={entityValue ?? 0}
                          onChange={(v) => handleEntityChange(v)}
                          disabled={mode === 'readonly'}
                          aria-label={`Rating: ${entityValue ?? 0} out of ${scale}`}
                        />
                        {showSuffix && (
                          <Text
                            type="secondary"
                            style={{ fontSize: 12 }}
                            aria-label={`Current rating: ${entityValue ?? 0} out of ${scale}`}
                          >
                            ({entityValue ?? 0}/{scale})
                          </Text>
                        )}
                      </div>
                    );
                  }
                  if (variant === 'emoji') {
                    return (
                      <div
                        contentEditable={false}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        {Array.from({ length: scale }, (_, i) => {
                          const idx = i + 1;
                          const selected = entityValue === idx;
                          return (
                            <span
                              key={idx}
                              contentEditable={false}
                              onClick={
                                isSubmitMode
                                  ? () => handleEntityChange(idx)
                                  : undefined
                              }
                              style={{
                                fontSize: 24,
                                padding: '4px 8px',
                                opacity: selected ? 1 : 0.4,
                                cursor: isSubmitMode
                                  ? 'pointer'
                                  : 'default',
                                display: 'inline-block',
                                userSelect: 'none',
                                pointerEvents: isSubmitMode
                                  ? 'auto'
                                  : 'none',
                                transition: 'all 0.2s',
                              }}
                              aria-label={`Rating ${idx} of ${scale}${
                                selected ? ' (selected)' : ''
                              }`}
                            >
                              {getEmojiForIndex(idx)}
                            </span>
                          );
                        })}
                        {showSuffix && (
                          <Text
                            type="secondary"
                            style={{ fontSize: 12 }}
                            aria-label={`Current rating: ${entityValue ?? 0} out of ${scale}`}
                          >
                            ({entityValue ?? 0}/{scale})
                          </Text>
                        )}
                      </div>
                    );
                  }
                  // anchors / pills
                  return (
                    <div
                      contentEditable={false}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      {Array.isArray(anchorLabels) &&
                      anchorLabels.length === scale ? (
                        anchorLabels.map((lab: string, idx: number) => {
                          const index = idx + 1;
                          const selected = entityValue === index;
                          return (
                            <span
                              key={index}
                              contentEditable={false}
                              onClick={
                                isSubmitMode
                                  ? () => handleEntityChange(index)
                                  : undefined
                              }
                              style={{
                                display: 'inline-block',
                                minWidth: 84,
                                padding: '4px 12px',
                                borderRadius: '16px',
                                backgroundColor: selected
                                  ? token.colorPrimary
                                  : token.colorFillSecondary,
                                color: selected
                                  ? '#fff'
                                  : token.colorText,
                                fontSize: 14,
                                fontWeight: selected ? 500 : 400,
                                whiteSpace: 'normal',
                                textAlign: 'center',
                                opacity: selected ? 1 : 0.6,
                                cursor: isSubmitMode
                                  ? 'pointer'
                                  : 'default',
                                userSelect: 'none',
                                pointerEvents: isSubmitMode
                                  ? 'auto'
                                  : 'none',
                                transition: 'all 0.2s',
                              }}
                            >
                              {lab}
                            </span>
                          );
                        })
                      ) : (
                        renderPills()
                      )}
                      {showSuffix && (
                        <Text
                          type="secondary"
                          style={{ fontSize: 12 }}
                          aria-label={`Current rating: ${entityValue ?? 0} out of ${scale}`}
                        >
                          ({entityValue ?? 0}/{scale})
                        </Text>
                      )}
                    </div>
                  );
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
                    {renderControl()}
                    
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

              {/* Per-ungrouped-subject ratings */}
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
                        (nodeGroupValues as any)[entityId] ?? null;

                      const handleEntityChange = (v: number | null) => {
                        setEntityValue(entityId, v);
                      };

                      const renderControl = () => {
                        if (variant === 'stars') {
                          return (
                            <div
                              contentEditable={false}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                flexWrap: 'wrap',
                              }}
                            >
                              <Rate
                                count={Number(scale) || 5}
                                allowHalf={allowHalf}
                                value={entityValue ?? 0}
                                onChange={(v) => handleEntityChange(v)}
                                disabled={mode === 'readonly'}
                                aria-label={`Rating: ${entityValue ?? 0} out of ${scale}`}
                              />
                              {showSuffix && (
                                <Text
                                  type="secondary"
                                  style={{ fontSize: 12 }}
                                  aria-label={`Current rating: ${entityValue ?? 0} out of ${scale}`}
                                >
                                  ({entityValue ?? 0}/{scale})
                                </Text>
                              )}
                            </div>
                          );
                        }
                        if (variant === 'emoji') {
                          return (
                            <div
                              contentEditable={false}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              {Array.from({ length: scale }, (_, i) => {
                                const idx = i + 1;
                                const selected = entityValue === idx;
                                return (
                                  <span
                                    key={idx}
                                    contentEditable={false}
                                    onClick={
                                      isSubmitMode
                                        ? () => handleEntityChange(idx)
                                        : undefined
                                    }
                                    style={{
                                      fontSize: 24,
                                      padding: '4px 8px',
                                      opacity: selected ? 1 : 0.4,
                                      cursor: isSubmitMode
                                        ? 'pointer'
                                        : 'default',
                                      display: 'inline-block',
                                      userSelect: 'none',
                                      pointerEvents: isSubmitMode
                                        ? 'auto'
                                        : 'none',
                                      transition: 'all 0.2s',
                                    }}
                                    aria-label={`Rating ${idx} of ${scale}${
                                      selected
                                        ? ' (selected)'
                                        : ''
                                    }`}
                                  >
                                    {getEmojiForIndex(idx)}
                                  </span>
                                );
                              })}
                              {showSuffix && (
                                <Text
                                  type="secondary"
                                  style={{ fontSize: 12 }}
                                  aria-label={`Current rating: ${entityValue ?? 0} out of ${scale}`}
                                >
                                  ({entityValue ?? 0}/{scale})
                                </Text>
                              )}
                            </div>
                          );
                        }
                        return (
                          <div
                            contentEditable={false}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            {renderPills()}
                            {showSuffix && (
                              <Text
                                type="secondary"
                                style={{ fontSize: 12 }}
                                aria-label={`Current rating: ${entityValue ?? 0} out of ${scale}`}
                              >
                                ({entityValue ?? 0}/{scale})
                              </Text>
                            )}
                          </div>
                        );
                      };

                      return (
                        <div key={entityId}>
                          <div style={{ marginBottom: 4 }}>
                            <Tag>{subject.label}</Tag>
                          </div>
                          {renderControl()}
                          
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
                                          if (openDrawer) {
                                            const subjectContext = {
                                              type: 'ungrouped' as const,
                                              subjectId: [subject.value],
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
              {variant === 'stars' ? (
                <div
                  contentEditable={false}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <Rate
                    count={Number(scale) || 5}
                    allowHalf={allowHalf}
                    value={value ?? 0}
                    onChange={(v) => onChange(v)}
                    disabled={mode === 'readonly'}
                    aria-label={`Rating: ${value ?? 0} out of ${scale}`}
                  />
                  {showSuffix && (
                    <Text
                      type="secondary"
                      style={{ fontSize: 12 }}
                      aria-label={`Current rating: ${value ?? 0} out of ${scale}`}
                    >
                      ({value ?? 0}/{scale})
                    </Text>
                  )}
                </div>
              ) : variant === 'emoji' ? (
                <div
                  contentEditable={false}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {Array.from({ length: scale }, (_, i) => {
                    const idx = i + 1;
                    const selected = value === idx;
                    return (
                      <span
                        key={idx}
                        contentEditable={false}
                        onClick={
                          isSubmitMode ? () => onChange(idx) : undefined
                        }
                        style={{
                          fontSize: 24,
                          padding: '4px 8px',
                          opacity: selected ? 1 : 0.4,
                          cursor: isSubmitMode ? 'pointer' : 'default',
                          display: 'inline-block',
                          userSelect: 'none',
                          pointerEvents: isSubmitMode
                            ? 'auto'
                            : 'none',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={
                          isSubmitMode
                            ? (e) => {
                                if (!selected) {
                                  (e.currentTarget as HTMLElement).style.opacity =
                                    '0.7';
                                }
                              }
                            : undefined
                        }
                        onMouseLeave={
                          isSubmitMode
                            ? (e) => {
                                if (!selected) {
                                  (e.currentTarget as HTMLElement).style.opacity =
                                    '0.4';
                                }
                              }
                            : undefined
                        }
                        aria-label={`Rating ${idx} of ${scale}${
                          selected ? ' (selected)' : ''
                        }`}
                      >
                        {getEmojiForIndex(idx)}
                      </span>
                    );
                  })}
                  {showSuffix && (
                    <Text
                      type="secondary"
                      style={{ fontSize: 12 }}
                      aria-label={`Current rating: ${value ?? 0} out of ${scale}`}
                    >
                      ({value ?? 0}/{scale})
                    </Text>
                  )}
                </div>
              ) : (
                <div
                  contentEditable={false}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {renderPills()}
                  {showSuffix && (
                    <Text
                      type="secondary"
                      style={{ fontSize: 12 }}
                      aria-label={`Current rating: ${value ?? 0} out of ${scale}`}
                    >
                      ({value ?? 0}/{scale})
                    </Text>
                  )}
                </div>
              )}
              {requiredError && (
                <div
                  style={{
                    color: token.colorError,
                    marginTop: 6,
                    fontSize: 12,
                  }}
                >
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

export default RatingComponent;