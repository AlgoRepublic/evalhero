/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState, useEffect, Suspense } from 'react';
import { JSONContent, NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import {
  Button,
  Flex,
  Space,
  Tooltip,
  theme,
  Input,
  InputNumber,
  Modal,
  Card,
  Tag,
  Typography,
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
import AddressEditModal from './editModel';
import { getAllQueryParams, evaluateVisibility, extractNodeLabel } from '../../utils';
import { NodeGroupingManager } from '../ShortTextField/NodeGroupingManager';
import { getApprovalStatusForSubject, validateNodeRequirements } from '../../../../forms/QueuesComponents/questionApprovalUtils';
import { useGetTagsByIdsQuery } from '../../../../../services/tagsApi';

const { Text } = Typography;

// Lazy-load MapLeaflet only in browser (avoids bundling Leaflet for server-side)
const MapLeafletLazy = typeof window !== 'undefined' 
  ? React.lazy(() => import('./MapPicker'))
  : null;

// Wrapper component to safely render the lazy-loaded map
const MapLeafletWrapper = ({ initialLat, initialLng, onSelect }: {
  initialLat?: number | null;
  initialLng?: number | null;
  onSelect?: (p: { lat: number; lng: number }) => void;
}) => {
  if (typeof window === 'undefined' || !MapLeafletLazy) {
    return null;
  }
  
  return (
    <Suspense fallback={<div style={{ padding: 8, textAlign: 'center', fontSize: 12, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading map…</div>}>
      <MapLeafletLazy
        initialLat={initialLat ?? null}
        initialLng={initialLng ?? null}
        onSelect={onSelect}
      />
    </Suspense>
  );
};

const AddressComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { token } = theme.useToken();

  const [error] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showGroupingModal, setShowGroupingModal] = useState(false);

  const initialAttrs = useMemo(
    () => ({
      label: node.attrs?.label ?? 'Address',
      street: node.attrs?.street ?? '',
      apartment: node.attrs?.apartment ?? '',
      city: node.attrs?.city ?? '',
      state: node.attrs?.state ?? '',
      postalCode: node.attrs?.postalCode ?? '',
      country: node.attrs?.country ?? '',
      formatted: node.attrs?.formatted ?? '',
      lat: node.attrs?.lat ?? null,
      lng: node.attrs?.lng ?? null,
      mapEnabled: !!node.attrs?.mapEnabled,
      streetEnabled: node.attrs?.streetEnabled ?? true,
      apartmentEnabled: node.attrs?.apartmentEnabled ?? true,
      cityEnabled: node.attrs?.cityEnabled ?? true,
      stateEnabled: node.attrs?.stateEnabled ?? true,
      postalCodeEnabled: node.attrs?.postalCodeEnabled ?? true,
      countryEnabled: node.attrs?.countryEnabled ?? true,
      queryParam: node.attrs?.queryParam ?? null,
      visibility: node.attrs?.visibility ?? { match: 'all', rules: [] },
      required: node.attrs?.required ?? false,
      enableGrouping: node.attrs?.enableGrouping ?? false,
      nodeGroups: node.attrs?.nodeGroups ?? [],
      nodeGroupValues: node.attrs?.nodeGroupValues ?? {},
      approvalRequired: node.attrs?.approvalRequired ?? false,
      tags: node.attrs?.tags ?? [],
    }),
    [node.attrs]
  );
  
  // Normalize individual enabled attributes to handle both boolean true and string "true"
  const normalizeBool = (value: any, defaultValue: boolean = true): boolean => {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'string') return value === 'true';
    return !!value;
  };
  
  const enabledFields = useMemo(() => ({
    street: normalizeBool(initialAttrs.streetEnabled, true),
    apartment: normalizeBool(initialAttrs.apartmentEnabled, true),
    city: normalizeBool(initialAttrs.cityEnabled, true),
    state: normalizeBool(initialAttrs.stateEnabled, true),
    postalCode: normalizeBool(initialAttrs.postalCodeEnabled, true),
    country: normalizeBool(initialAttrs.countryEnabled, true),
  }), [initialAttrs.streetEnabled, initialAttrs.apartmentEnabled, initialAttrs.cityEnabled, initialAttrs.stateEnabled, initialAttrs.postalCodeEnabled, initialAttrs.countryEnabled]);
  
  const requiredBool = typeof initialAttrs.required === 'string'
    ? initialAttrs.required === 'true'
    : !!initialAttrs.required;
  const templateHasApproval = (editor.storage as any)?.formBuilder?.templateHasApproval;
  const effectiveApprovalRequired = templateHasApproval !== false && initialAttrs.approvalRequired;

  // Fetch tags for display using getByIds API (always, in all modes)
  // First check if tags are already in storage (from SubmitQueue optimization)
  // Otherwise, fetch by IDs using the getByIds API
  const editorStorage = useMemo(() => (editor as any)?.storage?.formBuilder, [editor]);
  const tagsFromStorage = useMemo(() => editorStorage?.tagsByIds || [], [editorStorage]);
  const tagIds = useMemo(() => (initialAttrs.tags || []) as string[], [initialAttrs.tags]);
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

  const [addressFields, setAddressFields] = useState({
    street: initialAttrs.street,
    apartment: initialAttrs.apartment,
    city: initialAttrs.city,
    state: initialAttrs.state,
    postalCode: initialAttrs.postalCode,
    country: initialAttrs.country,
  });

  // Sync addressFields when initialAttrs change
  useEffect(() => {
    setAddressFields({
      street: initialAttrs.street,
      apartment: initialAttrs.apartment,
      city: initialAttrs.city,
      state: initialAttrs.state,
      postalCode: initialAttrs.postalCode,
      country: initialAttrs.country,
    });
  }, [initialAttrs.street, initialAttrs.apartment, initialAttrs.city, initialAttrs.state, initialAttrs.postalCode, initialAttrs.country]);

  const mode = (editor as any)?.storage?.formBuilder?.mode ?? 'readonly';
  const isEditMode = mode === 'edit';
  const isSubmitMode = mode === 'submit';
  const submitted = (editor as any)?.storage?.formBuilder?.submitted === true;

  // Grouping data from editor storage
  const subjectsOptionsFromStorage =
    (editor.storage as any)?.formBuilder?.subjects || [];
  const globalGroups =
    (editor.storage as any)?.formBuilder?.globalGroups || [];
  const globalAvailableSubjects =
    (editor.storage as any)?.formBuilder?.availableSubjects || [];
  const isAllLocked =
    (editor.storage as any)?.formBuilder?.isAllLocked || false;

  const {
    enableGrouping = false,
    nodeGroups = [],
    nodeGroupValues = {},
  } = node.attrs as any;

  // Normalize potentially string-based enableGrouping from older schemas
  const enableGroupingBool =
    typeof enableGrouping === 'string'
      ? enableGrouping === 'true'
      : !!enableGrouping;

  // Determine which groups to use:
  // - If node-based grouping is enabled and nodeGroups exist, use node groups
  // - Otherwise use global groups (default for all nodes)
  const groupsToUse =
    enableGroupingBool && (nodeGroups as any[]).length > 0
      ? (nodeGroups as any[])
      : globalGroups;

  // Compute ungrouped subjects for this node:
  // - If node-based groups are enabled and present, ungrouped = subjects not in any node group
  // - Otherwise, fall back to global ungrouped subjects
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

  // Show grouping in submit mode or readonly mode, after "Start Submission" lock, and
  // when there is at least one group or ungrouped subject
  // In readonly mode, show groups even if isAllLocked is false (for viewing before submission starts)
  const isReadonlyMode: boolean = mode === 'readonly';
  const shouldShowGrouping =
    (isSubmitMode || isReadonlyMode) &&
    (isSubmitMode ? isAllLocked : true) && // In submit mode, require isAllLocked; in readonly, always show if groups exist
    (groupsToUse.length > 0 || availableSubjects.length > 0);

  // Helper function to sync grouped/ungrouped values
  const updateEntityValue = (entityId: string, val: string) => {
    const updated = {
      ...(nodeGroupValues as any),
      [entityId]: val,
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
          updated[ungroupedKey] = val;
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
        updated[groupKey] = val;
        // Also update ungrouped values for all other subjects in the same group
        group.subjectIds.forEach((otherSubjectId: string) => {
          const otherUngroupedKey = `ungrouped-${otherSubjectId}`;
          updated[otherUngroupedKey] = val;
        });
      });
    }

    updateAttributes({ nodeGroupValues: updated });
  };

  // Query parameter handling - pre-populate from URL
  useEffect(() => {
    if (initialAttrs.queryParam && isSubmitMode) {
      const allParams = getAllQueryParams();
      const paramValue = allParams[initialAttrs.queryParam];
      
      if (paramValue) {
        // Try to parse as JSON first (for structured address)
        try {
          const parsed = JSON.parse(paramValue);
          if (typeof parsed === 'object') {
            const newFields = {
              street: parsed.street || '',
              apartment: parsed.apartment || '',
              city: parsed.city || '',
              state: parsed.state || '',
              postalCode: parsed.postalCode || '',
              country: parsed.country || '',
            };
            setAddressFields(newFields);
            updateAttributes({
              ...newFields,
              formatted: Object.values(newFields).filter(Boolean).join(', '),
            });
            return;
          }
        } catch {
          // Not JSON, treat as formatted address string
        }
        
        // Treat as formatted address
        updateAttributes({
          formatted: paramValue,
        });
      }
    }
  }, [initialAttrs.queryParam, isSubmitMode, updateAttributes]);

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
  }, [editor, node.attrs]);

  const isVisible = useMemo(() => {
    if (!initialAttrs.visibility?.rules || initialAttrs.visibility.rules.length === 0) return true;
    return evaluateVisibility(initialAttrs.visibility.rules, formState, initialAttrs.visibility.match || 'all');
  }, [initialAttrs.visibility, formState]);

  // const [draft, setDraft] = useState({ ...initialAttrs });

  // keep draft synced when attrs change and modal is closed
  // useEffect(() => {
  //   setDraft({ ...initialAttrs });
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [node.attrs]);

  // const openModal = () => {
  //   form.setFieldsValue({
  //     label: draft.label,
  //     street: draft.street,
  //     city: draft.city,
  //     state: draft.state,
  //     postalCode: draft.postalCode,
  //     country: draft.country,
  //     formatted: draft.formatted,
  //     lat: draft.lat,
  //     lng: draft.lng,
  //     mapEnabled: draft.mapEnabled,
  //   });
  //   setShowModal(true);
  //   setEditingNode?.({
  //     attrs: node.attrs,
  //     type: node.type.name,
  //     updateAttributes,
  //     deleteNode,
  //   });
  // };

  // const closeModal = () => {
  //   setDraft({ ...initialAttrs }); // revert unsaved changes
  //   setShowModal(false);
  // };

  // const onMapSelect = (p: { lat: number; lng: number }) => {
  //   setDraft((s) => ({ ...s, lat: p.lat, lng: p.lng }));
  //   form.setFieldsValue({ lat: p.lat, lng: p.lng });
  // };

  // const onSave = async () => {
  //   try {
  //     const values = await form.validateFields();

  //     const merged = {
  //       ...node.attrs,
  //       label: values.label ?? draft.label,
  //       street: values.street ?? draft.street ?? '',
  //       city: values.city ?? draft.city ?? '',
  //       state: values.state ?? draft.state ?? '',
  //       postalCode: values.postalCode ?? draft.postalCode ?? '',
  //       country: values.country ?? draft.country ?? '',
  //       formatted:
  //         values.formatted && String(values.formatted).trim().length > 0
  //           ? values.formatted
  //           : [
  //               values.street ?? draft.street,
  //               values.city ?? draft.city,
  //               values.state ?? draft.state,
  //               values.postalCode ?? draft.postalCode,
  //               values.country ?? draft.country,
  //             ]
  //               .filter(Boolean)
  //               .join(', '),
  //       lat:
  //         values.lat === '' || values.lat === null || values.lat === undefined
  //           ? draft.lat ?? null
  //           : Number(values.lat),
  //       lng:
  //         values.lng === '' || values.lng === null || values.lng === undefined
  //           ? draft.lng ?? null
  //           : Number(values.lng),
  //       mapEnabled: !!values.mapEnabled,
  //     };

  //     // Atomic update: single call
  //     updateAttributes(merged);
  //     setShowModal(false);
  //     message.success('Address saved');
  //   } catch (err) {
  //     console.error(err);
  //     message.error('Failed to save address');
  //   }
  // };

  // Don't render if not visible (except in edit mode)
  if (!isVisible && !isEditMode) {
    return null;
  }

  const requiredError = isSubmitMode && submitted && requiredBool && !initialAttrs.formatted;

  const handleFieldChange = (field: string, value: string | number | null) => {
    // Only update if the field is enabled
    if (!enabledFields[field as keyof typeof enabledFields]) {
      return;
    }
    
    const newFields = { ...addressFields, [field]: value ?? '' };
    setAddressFields(newFields);
    
    // Build formatted address only from enabled fields
    const enabledFieldValues = Object.entries(newFields)
      .filter(([key]) => enabledFields[key as keyof typeof enabledFields])
      .map(([, val]) => val)
      .filter(Boolean);
    
    const formatted = enabledFieldValues.join(', ');
    updateAttributes({
      ...newFields,
      formatted,
    });
  };

  return (
    <NodeViewWrapper 
      {...(isEditMode ? { 'data-drag-handle': true } : {})} 
      style={{ 
        margin: '8px 0', 
        display: isVisible || isEditMode ? 'block' : 'none',
        padding: '12px',
        border: `1px solid ${(error || requiredError) ? token.colorError : token.colorBorder}`,
        borderRadius: token.borderRadius,
        background: token.colorBgContainer,
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
      <AddressEditModal
        open={showModal}
        onClose={() => setShowModal(false)}
        nodeAttrs={node.attrs}
        onSave={(values) => {
          updateAttributes(values);
          setShowModal(false);
        }}
      />
      
      <Flex justify="space-between" align="center" style={{ marginBottom: 12, width: '100%' }}>
        <div style={{ flex: 1 }}>
          <div 
            contentEditable={mode === 'submit' ? false : undefined}
            style={{ fontWeight: 500, fontSize: 14, alignItems: 'center', gap: 6, width: '100%' }}
          >
            <NodeViewContent className="address-label" />
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
                size="small"
                icon={<EditOutlined />}
                onClick={() => setShowModal(true)}
              />
            </Tooltip>
            <Tooltip title="Delete field">
              <Button
                type="text"
                size="small"
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
          {/* Per-group full address inputs */}
          {groupsToUse.map((group: any) => {
            const entityId = `group-${group.id}`;
            const raw = (nodeGroupValues as any)[entityId];
            const base = {
              street: '',
              apartment: '',
              city: '',
              state: '',
              postalCode: '',
              country: '',
            };
            let entityFields = { ...base };
            if (raw && typeof raw === 'string') {
              try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                  entityFields = { ...base, ...parsed };
                }
              } catch {
                // ignore malformed JSON, fall back to base
              }
            }

            const updateEntityField = (field: string, value: string | number | null) => {
              const next = {
                ...entityFields,
                [field]: value ?? '',
              };
              // Build formatted address only from enabled fields
              const enabledFieldValues = [
                enabledFields.street ? next.street : null,
                enabledFields.apartment ? next.apartment : null,
                enabledFields.city ? next.city : null,
                enabledFields.state ? next.state : null,
                enabledFields.postalCode ? next.postalCode : null,
                enabledFields.country ? next.country : null,
              ]
                .filter(Boolean);
              const formatted = enabledFieldValues.join(', ');
              const payload = { ...next, formatted };
              updateEntityValue(entityId, JSON.stringify(payload));
            };

            const groupSubjects = (group.subjectIds || [])
              .map((id: string) =>
                subjectsOptionsFromStorage.find((s: any) => s.value === id),
              )
              .filter(Boolean)
              .map((s: any) => s.label)
              .join(', ');

            const readonly = mode === 'readonly' || (mode === 'submit' && submitted);

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
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {enabledFields.street && (
                    <Input
                      placeholder="Street Address"
                      value={entityFields.street}
                      onChange={(e) => updateEntityField('street', e.target.value)}
                      size="small"
                      readOnly={readonly}
                      disabled={mode === 'readonly'}
                    />
                  )}
                  {enabledFields.apartment && (
                    <Input
                      placeholder="Apartment, suite, etc."
                      value={entityFields.apartment}
                      onChange={(e) => updateEntityField('apartment', e.target.value)}
                      size="small"
                      readOnly={readonly}
                      disabled={mode === 'readonly'}
                    />
                  )}
                  {(enabledFields.city || enabledFields.state || enabledFields.postalCode) && (
                    <Space.Compact style={{ width: '100%' }}>
                      {enabledFields.city && (
                        <Input
                          placeholder="City"
                          value={entityFields.city}
                          onChange={(e) => updateEntityField('city', e.target.value)}
                          style={{ flex: 1 }}
                          size="small"
                          readOnly={readonly}
                          disabled={mode === 'readonly'}
                        />
                      )}
                      {enabledFields.state && (
                        <Input
                          placeholder="State / Province"
                          value={entityFields.state}
                          onChange={(e) => updateEntityField('state', e.target.value)}
                          style={{ flex: 1 }}
                          size="small"
                          readOnly={readonly}
                          disabled={mode === 'readonly'}
                        />
                      )}
                      {enabledFields.postalCode && (
                        <InputNumber
                          placeholder="ZIP / Postal code"
                          value={
                            entityFields.postalCode
                              ? Number(entityFields.postalCode)
                              : null
                          }
                          onChange={(val) => updateEntityField('postalCode', val)}
                          style={{ width: 140 }}
                          size="small"
                          controls={false}
                          readOnly={readonly}
                          disabled={mode === 'readonly'}
                        />
                      )}
                    </Space.Compact>
                  )}
                  {enabledFields.country && (
                    <Input
                      placeholder="Country"
                      value={entityFields.country}
                      onChange={(e) => updateEntityField('country', e.target.value)}
                      size="small"
                      readOnly={readonly}
                      disabled={mode === 'readonly'}
                    />
                  )}
                </Space>
                
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

          {/* Per-ungrouped-subject full address inputs */}
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
                  const raw = (nodeGroupValues as any)[entityId];
                  const base = {
                    street: '',
                    apartment: '',
                    city: '',
                    state: '',
                    postalCode: '',
                    country: '',
                  };
                  let entityFields = { ...base };
                  if (raw && typeof raw === 'string') {
                    try {
                      const parsed = JSON.parse(raw);
                      if (parsed && typeof parsed === 'object') {
                        entityFields = { ...base, ...parsed };
                      }
                    } catch {
                      // ignore malformed JSON
                    }
                  }

                  const updateEntityField = (field: string, value: string | number | null) => {
                    const next = {
                      ...entityFields,
                      [field]: value ?? '',
                    };
                    // Build formatted address only from enabled fields
                    const enabledFieldValues = [
                      enabledFields.street ? next.street : null,
                      enabledFields.apartment ? next.apartment : null,
                      enabledFields.city ? next.city : null,
                      enabledFields.state ? next.state : null,
                      enabledFields.postalCode ? next.postalCode : null,
                      enabledFields.country ? next.country : null,
                    ]
                      .filter(Boolean);
                    const formatted = enabledFieldValues.join(', ');
                    const payload = { ...next, formatted };
                    updateEntityValue(entityId, JSON.stringify(payload));
                  };

                  const readonly = mode === 'readonly' || (mode === 'submit' && submitted);

                  return (
                    <div key={entityId}>
                      <div style={{ marginBottom: 4 }}>
                        <Tag>{subject.label}</Tag>
                      </div>
                      <Space
                        direction="vertical"
                        style={{ width: '100%' }}
                        size="small"
                      >
                        {enabledFields.street && (
                          <Input
                            placeholder="Street Address"
                            value={entityFields.street}
                            onChange={(e) =>
                              updateEntityField('street', e.target.value)
                            }
                            size="small"
                            readOnly={readonly}
                            disabled={mode === 'readonly'}
                          />
                        )}
                        {enabledFields.apartment && (
                          <Input
                            placeholder="Apartment, suite, etc."
                            value={entityFields.apartment}
                            onChange={(e) =>
                              updateEntityField('apartment', e.target.value)
                            }
                            size="small"
                            readOnly={readonly}
                            disabled={mode === 'readonly'}
                          />
                        )}
                        {(enabledFields.city || enabledFields.state || enabledFields.postalCode) && (
                          <Space.Compact style={{ width: '100%' }}>
                            {enabledFields.city && (
                              <Input
                                placeholder="City"
                                value={entityFields.city}
                                onChange={(e) =>
                                  updateEntityField('city', e.target.value)
                                }
                                style={{ flex: 1 }}
                                size="small"
                                readOnly={readonly}
                                disabled={mode === 'readonly'}
                              />
                            )}
                            {enabledFields.state && (
                              <Input
                                placeholder="State / Province"
                                value={entityFields.state}
                                onChange={(e) =>
                                  updateEntityField('state', e.target.value)
                                }
                                style={{ flex: 1 }}
                                size="small"
                                readOnly={readonly}
                                disabled={mode === 'readonly'}
                              />
                            )}
                            {enabledFields.postalCode && (
                              <InputNumber
                                placeholder="ZIP / Postal code"
                                value={
                                  entityFields.postalCode
                                    ? Number(entityFields.postalCode)
                                    : null
                                }
                                onChange={(val) =>
                                  updateEntityField('postalCode', val)
                                }
                                style={{ width: 140 }}
                                size="small"
                                controls={false}
                                readOnly={readonly}
                                disabled={mode === 'readonly'}
                              />
                            )}
                          </Space.Compact>
                        )}
                        {enabledFields.country && (
                          <Input
                            placeholder="Country"
                            value={entityFields.country}
                            onChange={(e) =>
                              updateEntityField('country', e.target.value)
                            }
                            size="small"
                            readOnly={readonly}
                            disabled={mode === 'readonly'}
                          />
                        )}
                      </Space>
                      
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
        </Space>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          {enabledFields.street && (
            <Input
              placeholder="Street Address"
              value={addressFields.street}
              onChange={(e) => handleFieldChange('street', e.target.value)}
              readOnly={
                mode === 'readonly' ||
                (mode === 'submit' && submitted)
              }
              disabled={mode === 'readonly'}
              size="small"
            />
          )}
          {enabledFields.apartment && (
            <Input
              placeholder="Apartment, suite, etc."
              value={addressFields.apartment}
              onChange={(e) => handleFieldChange('apartment', e.target.value)}
              readOnly={
                mode === 'readonly' ||
                (mode === 'submit' && submitted)
              }
              disabled={mode === 'readonly'}
              size="small"
            />
          )}
          {(enabledFields.city || enabledFields.state || enabledFields.postalCode) && (
            <Space.Compact style={{ width: '100%' }}>
              {enabledFields.city && (
                <Input
                  placeholder="City"
                  value={addressFields.city}
                  onChange={(e) => handleFieldChange('city', e.target.value)}
                  readOnly={
                    mode === 'readonly' ||
                    (mode === 'submit' && submitted)
                  }
                  disabled={mode === 'readonly'}
                  style={{ flex: 1 }}
                  size="small"
                />
              )}
              {enabledFields.state && (
                <Input
                  placeholder="State / Province"
                  value={addressFields.state}
                  onChange={(e) => handleFieldChange('state', e.target.value)}
                  readOnly={
                    mode === 'readonly' ||
                    (mode === 'submit' && submitted)
                  }
                  disabled={mode === 'readonly'}
                  style={{ flex: 1 }}
                  size="small"
                />
              )}
              {enabledFields.postalCode && (
                <InputNumber
                  placeholder="ZIP / Postal code"
                  value={
                    addressFields.postalCode
                      ? Number(addressFields.postalCode)
                      : null
                  }
                  onChange={(value) => handleFieldChange('postalCode', value)}
                  readOnly={
                    mode === 'readonly' ||
                    (mode === 'submit' && submitted)
                  }
                  disabled={mode === 'readonly'}
                  style={{ width: 140 }}
                  size="small"
                  controls={false}
                />
              )}
            </Space.Compact>
          )}
          {enabledFields.country && (
            <Input
              placeholder="Country"
              value={addressFields.country}
              onChange={(e) => handleFieldChange('country', e.target.value)}
              readOnly={
                mode === 'readonly' ||
                (mode === 'submit' && submitted)
              }
              disabled={mode === 'readonly'}
              size="small"
            />
          )}
        </Space>
      )}

      {isEditMode && initialAttrs.mapEnabled && false && (
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 200, borderRadius: 6, overflow: 'hidden', border: '1px solid #d9d9d9', position: 'relative' }}>
            <MapLeafletWrapper
              key={`map-${initialAttrs.lat}-${initialAttrs.lng}`}
              initialLat={initialAttrs.lat ?? null}
              initialLng={initialAttrs.lng ?? null}
              onSelect={(p: { lat: number; lng: number }) => {
                updateAttributes({ lat: p.lat, lng: p.lng });
              }}
            />
          </div>
        </div>
      )}

      {!isSubmitMode && initialAttrs.formatted && (
        <div style={{ color: token.colorTextSecondary, marginTop: 8, fontSize: 12 }}>
          Formatted: {initialAttrs.formatted}
        </div>
      )}

      {initialAttrs.lat != null && initialAttrs.lng != null && (
        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 4 }}>
          Lat: {(initialAttrs.lat as number).toFixed(6)}, Lng: {(initialAttrs.lng as number).toFixed(6)}
        </div>
      )}

      {requiredError && (
        <div style={{ color: token.colorError, marginTop: 6, fontSize: 12 }}>
          This field is required
        </div>
      )}
    </NodeViewWrapper>
  );
};

export default AddressComponent;
