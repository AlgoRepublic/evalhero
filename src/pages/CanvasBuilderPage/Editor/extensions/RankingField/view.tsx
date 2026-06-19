/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import Sortable, { SortableEvent } from 'sortablejs';
import { Button, Card, Flex, Space, theme, Tooltip, InputNumber, Modal, Tag, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, SettingOutlined, ExclamationCircleOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { validateNodeRequirements, getApprovalStatusForSubject } from '../../../../forms/QueuesComponents/questionApprovalUtils';
import type { JSONContent } from '@tiptap/core';
// import { getSetEditingNodeFromEditor } from '../../utils';
import RankingEditModal from './editModel';
import { NodeGroupingManager } from '../ShortTextField/NodeGroupingManager';
import { extractNodeLabel } from '../../utils';

const { Text } = Typography;

// These will be computed with theme tokens inside the component
const getContainerStyle = (token: any): React.CSSProperties => ({
  padding: 8,
  border: `1px dashed ${token.colorBorderSecondary}`,
  margin: '8px 0',
  background: token.colorBgContainer,
});

const getItemStyle = (isDragging: boolean, token: any): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  marginBottom: 8,
  background: isDragging ? token.colorFillTertiary : token.colorBgContainer,
  border: `1px solid ${token.colorBorderSecondary}`,
  borderRadius: 6,
});

const RankingComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { token } = theme.useToken();

  // const [value, setValue] = useState('');
  const [error] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showGroupingModal, setShowGroupingModal] = useState(false);

  const builderMode = (editor as any)?.storage?.formBuilder?.mode ?? 'readonly';
  const isEditMode = builderMode === 'edit';
  const isSubmitMode = builderMode === 'submit';

  // const setEditingNode = getSetEditingNodeFromEditor(editor);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const sortableRef = useRef<Sortable | null>(null);

  const items = useMemo(() => {
    type Option = { id: string | number; label: string | number };

    const raw = (node.attrs.options ?? []) as unknown[];
    if (!Array.isArray(raw)) return [];
    if (raw.length === 0) return [];

    const isOption = (v: unknown): v is Option =>
      typeof v === 'object' && v !== null && 'id' in (v as object) && 'label' in (v as object);

    if (isOption(raw[0])) {
      return raw.map((o) => {
        const opt = o as Option;
        return {
          id: String(opt.id),
          label: String(opt.label),
        };
      });
    }

    return (raw as string[]).map((label, idx) => ({
      id: `${String(label)}-${idx}`,
      label: String(label),
    }));
  }, [node.attrs.options]);

  const orderIds = useMemo(() => {
    const rawOrder = node.attrs.order;
    if (
      Array.isArray(rawOrder) &&
      rawOrder.length === items.length &&
      rawOrder.every(Boolean)
    ) {
      return rawOrder.map(String);
    }
    return items.map((it) => it.id);
  }, [node.attrs.order, items]);

  const ordered = useMemo(
    () =>
      orderIds.map(
        (id) => items.find((it) => it.id === id) ?? { id, label: id }
      ),
    [items, orderIds]
  );

  const mode: 'drag' | 'numeric' = (node.attrs.mode as 'drag' | 'numeric') ?? 'drag';
  const iconStyle: 'star' | 'emoji' = (node.attrs.iconStyle as 'star' | 'emoji') ?? 'star';
  const emojiChar: string = (node.attrs.emoji as string) || '⭐';
  const showSuffix: boolean = !!node.attrs.showSuffix;
  const suffixText: string = (node.attrs.suffixText as string) || '';
  const approvalRequired: boolean = !!(node.attrs as any)?.approvalRequired;
  const templateHasApproval = (editor.storage as any)?.formBuilder?.templateHasApproval;
  const effectiveApprovalRequired = templateHasApproval !== false && approvalRequired;
  const rawRequired = (node.attrs as any)?.required;
  const requiredBool = typeof rawRequired === 'string'
    ? rawRequired === 'true'
    : !!rawRequired;
  const enableGrouping: boolean = !!(node.attrs as any)?.enableGrouping;
  const nodeGroups: any[] = ((node.attrs as any)?.nodeGroups || []) as any[];
  const nodeGroupValues: Record<string, any> =
    ((node.attrs as any)?.nodeGroupValues || {}) as Record<string, any>;

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
    enableGrouping && nodeGroups.length > 0 ? nodeGroups : globalGroups;

  // Compute node-level ungrouped subjects when node groups exist,
  // otherwise fall back to global ungrouped subjects
  const usedSubjectIds = new Set<string>();
  if (enableGrouping && nodeGroups.length > 0) {
    nodeGroups.forEach((g: any) => {
      (g.subjectIds || []).forEach((id: string) => usedSubjectIds.add(id));
    });
  }
  const availableSubjects =
    enableGrouping && nodeGroups.length > 0
      ? subjectsOptionsFromStorage.filter(
          (s: any) => !usedSubjectIds.has(s.value),
        )
      : globalAvailableSubjects;

  const isReadonlyMode: boolean = builderMode === 'readonly';
  const shouldShowGrouping =
    (isSubmitMode || isReadonlyMode) &&
    (isSubmitMode ? isAllLocked : true) && // In submit mode, require isAllLocked; in readonly, always show if groups exist
    (groupsToUse.length > 0 || availableSubjects.length > 0);

  const renderIcon = () => {
    if (iconStyle === 'emoji') {
      return <span aria-hidden style={{ fontSize: 16 }}>{emojiChar}</span>;
    }
    // default star - use warning color token for dark theme compatibility
    return <span aria-hidden style={{ color: token.colorWarning, fontSize: 16 }}>★</span>;
  };

  const handleNumericRankChange = (itemId: string, newRank?: number | null) => {
    if (!newRank || Number.isNaN(newRank)) return;
    const maxRank = items.length;
    const clamped = Math.min(Math.max(Math.floor(newRank), 1), maxRank);
    const currentOrder = [...orderIds];
    const without = currentOrder.filter((id) => id !== itemId);
    without.splice(clamped - 1, 0, itemId);
    updateAttributes({ ...node.attrs, order: without });
  };

  // Get per-entity order (fallback to base order when not customized yet)
  const getEntityOrder = (entityId: string): string[] => {
    const stored = nodeGroupValues[entityId];
    if (Array.isArray(stored) && stored.length === items.length) {
      return stored.map(String);
    }
    return orderIds;
  };

  const handleEntityNumericRankChange = (
    entityId: string,
    itemId: string,
    newRank?: number | null,
  ) => {
    if (!newRank || Number.isNaN(newRank)) return;
    const maxRank = items.length;
    const clamped = Math.min(Math.max(Math.floor(newRank), 1), maxRank);
    const currentOrder = [...getEntityOrder(entityId)];
    const without = currentOrder.filter((id) => id !== itemId);
    without.splice(clamped - 1, 0, itemId);
    const updatedValues = {
      ...nodeGroupValues,
      [entityId]: without,
    };
    updateAttributes({
      ...node.attrs,
      nodeGroupValues: updatedValues,
    });
  };

  // Prevent native drop/drag events and initialize Sortable
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    // Defensive: prevent native drag/drop on wrapper
    const preventNative = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    el.addEventListener('dragstart', preventNative);
    el.addEventListener('dragover', preventNative);
    el.addEventListener('dragenter', preventNative);
    el.addEventListener('drop', preventNative);

    // Destroy existing Sortable if present
    if (sortableRef.current) {
      try {
        sortableRef.current.destroy();
      } catch (e) {
        /* ignore */
      }
      sortableRef.current = null;
    }

    // Only initialize Sortable in drag mode and when grouping UI is not shown
    if (mode === 'drag' && !shouldShowGrouping) {
      sortableRef.current = Sortable.create(el, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        forceFallback: true,
        fallbackOnBody: true,
        fallbackTolerance: 3,
        onEnd: (evt: SortableEvent) => {
          console.log('evt', evt)
          // Build new order from the current DOM children using element property (__rid)
          const children = Array.from(el.children) as HTMLElement[];
          const newOrder = children.map((child, idx) => {
            const did = (child as unknown as { __rid?: string }).__rid;
            if (did) return String(did);
            return items[idx]?.id ?? String(idx);
          });
          // Update only order attr (keep options intact)
          updateAttributes({ ...node.attrs, order: newOrder });
        },
      });
    }

    return () => {
      // cleanup
      el.removeEventListener('dragstart', preventNative);
      el.removeEventListener('dragover', preventNative);
      el.removeEventListener('dragenter', preventNative);
      el.removeEventListener('drop', preventNative);
      try {
        sortableRef.current?.destroy();
      } catch (e) {
        console.log('e', e)
      }
      sortableRef.current = null;
    };
    // NOTE: avoid including 'ordered' here to prevent re-creating Sortable on each reorder
  }, [wrapRef, updateAttributes, node.attrs, items, mode, shouldShowGrouping]);

  return (
    <NodeViewWrapper
      style={getContainerStyle(token)}
      as="div"
      data-type="ranking"
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
              enableGrouping: enableGrouping || false,
              nodeGroups: nodeGroups || [],
            }}
            onChange={(val) => {
              updateAttributes({
                ...node.attrs,
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
      <RankingEditModal
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
          borderColor: error ? token.colorError : token.colorBorder,
          borderRadius: token.borderRadiusLG,
          transition: 'border-color 0.2s ease',
          background: token.colorBgContainer,
        }}
        variant="outlined"
      >
        <Flex justify="space-between" style={{ marginLeft: 8 }}>
          <div style={{ marginBottom: 8, width: '100%' }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'baseline', gap: 6, width: '100%' }}>
              <div style={{ width: '100%' }}>
                <NodeViewContent as="div" />
              </div>
              {showSuffix && suffixText ? (
                <span style={{ color: token.colorTextSecondary, fontWeight: 400 }}>
                  {suffixText}
                </span>
              ) : null}
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
          </div>
          {isEditMode && (
            <Space size={4} style={{ alignSelf: 'flex-start', marginLeft: 8 }} contentEditable={false}>
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
        {/* When grouping is active in submit mode after lock, ranking is per group/subject
            via nodeGroupValues. The single global ranking UI is used only when grouping
            is not shown. */}
        {isSubmitMode && shouldShowGrouping ? (
          <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size={12}>
            {/* Per-group rankings */}
            {groupsToUse.map((group: any) => {
              const entityId = `group-${group.id}`;
              const entityOrderIds = getEntityOrder(entityId);
              const orderedForEntity = entityOrderIds.map(
                (id) => items.find((it) => it.id === id) ?? { id, label: id },
              );
              const groupSubjects = (group.subjectIds || [])
                .map((id: string) =>
                  subjectsOptionsFromStorage.find((s: any) => s.value === id),
                )
                .filter(Boolean)
                .map((s: any) => s.label)
                .join(', ');

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
                  {orderedForEntity.map((it, idx) => (
                    <div
                      key={it.id}
                      className="ranking-item"
                      style={getItemStyle(false, token)}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <strong
                          style={{ width: 24, color: token.colorText }}
                        >
                          {idx + 1}.
                        </strong>
                        <span>{renderIcon()}</span>
                        <div style={{ color: token.colorText }}>
                          {it.label}
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                        }}
                      >
                        <InputNumber
                          min={1}
                          max={items.length}
                          size="small"
                          value={idx + 1}
                          onChange={(v) =>
                            handleEntityNumericRankChange(
                              entityId,
                              it.id,
                              v,
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                  
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

            {/* Per-ungrouped-subject rankings */}
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
                    const entityOrderIds = getEntityOrder(entityId);
                    const orderedForEntity = entityOrderIds.map(
                      (id) =>
                        items.find((it) => it.id === id) ?? {
                          id,
                          label: id,
                        },
                    );

                    return (
                      <div key={entityId}>
                        <div style={{ marginBottom: 4 }}>
                          <Tag>{subject.label}</Tag>
                        </div>
                        {orderedForEntity.map((it, idx) => (
                          <div
                            key={it.id}
                            className="ranking-item"
                            style={getItemStyle(false, token)}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                              }}
                            >
                              <strong
                                style={{
                                  width: 24,
                                  color: token.colorText,
                                }}
                              >
                                {idx + 1}.
                              </strong>
                              <span>{renderIcon()}</span>
                              <div style={{ color: token.colorText }}>
                                {it.label}
                              </div>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                gap: 8,
                                alignItems: 'center',
                              }}
                            >
                              <InputNumber
                                min={1}
                                max={items.length}
                                size="small"
                                value={idx + 1}
                                onChange={(v) =>
                                  handleEntityNumericRankChange(
                                    entityId,
                                    it.id,
                                    v,
                                  )
                                }
                              />
                            </div>
                          </div>
                        ))}
                        
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
          <div ref={wrapRef} contentEditable={false}>
            {ordered.map((it, idx) => (
              <div
                key={it.id}
                className="ranking-item"
                style={getItemStyle(false, token)}
                draggable={false}
                ref={(el) => {
                  if (el) {
                    (el as unknown as { __rid?: string }).__rid = it.id;
                  }
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <strong
                    style={{ width: 24, color: token.colorText }}
                  >
                    {idx + 1}.
                  </strong>
                  <span>{renderIcon()}</span>
                  <div style={{ color: token.colorText }}>{it.label}</div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  {mode === 'drag' ? (
                    <span
                      className="drag-handle"
                      style={{
                        cursor: 'grab',
                        padding: '0 8px',
                        fontSize: 18,
                        color: token.colorTextTertiary,
                      }}
                      aria-hidden
                      draggable={false}
                    >
                      ⋮
                    </span>
                  ) : (
                    <InputNumber
                      min={1}
                      max={items.length}
                      size="small"
                      value={idx + 1}
                      onChange={(v) =>
                        handleNumericRankChange(it.id, v)
                      }
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </NodeViewWrapper>
  );
};

export default RankingComponent;
