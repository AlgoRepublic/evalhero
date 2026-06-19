/* eslint-disable @typescript-eslint/no-explicit-any */
import { NodeViewContent, NodeViewProps, NodeViewWrapper, useEditor as useTiptapEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import React, { useState, useMemo, useEffect } from 'react';
import { Button, Card, Form, Input, Space, theme, Tooltip, Modal, Tag, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, SettingOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
// import { getSetEditingNodeFromEditor } from '../../utils';
import LongTextEditModal from './editModel';
import { NodeGroupingManager } from '../ShortTextField/NodeGroupingManager';
import { GroupedInputs } from '../ShortTextField/GroupedInputs';
import { getQueryParam, evaluateVisibility, extractNodeLabel } from '../../utils';
import { useGetTagsByIdsQuery } from '../../../../../services/tagsApi';

const { TextArea } = Input;
const { Text } = Typography;

type FormBuilderStorage = {
  formBuilder?: {
    mode?: 'readonly' | 'edit' | 'submit' | string;
  };
};

const LongTextComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { token } = theme.useToken();
  const {
    // label,
    // name,
    placeholder,
    minLength,
    maxLength,
    regex,
    requiredKeywords = [],
    requiredKeywordsMode = 'all',
    required,
    approvalRequired: rawApprovalRequired = false,
    enableRichText = false,
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
  const mode =
    (editor.storage as unknown as FormBuilderStorage)?.formBuilder?.mode ||
    'readonly';
  const [value, setValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  //   const setEditingNode = getSetEditingNodeFromEditor(editor);
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

  // const IsSubmitMode = mode === 'submit';
  // const isReadonlyMode = mode === 'readonly';
  const isEditMode = mode === 'edit';
  const isSubmitMode = mode === 'submit';
  const submitted = (editor.storage as any)?.formBuilder?.submitted === true;
  // Query parameter handling - pre-populate from URL
  React.useEffect(() => {
    if (queryParam && isSubmitMode && !value) {
      const paramValue = getQueryParam(queryParam);
      if (paramValue) {
        setValue(paramValue);
        updateAttributes({ value: paramValue });
      }
    }
  }, [queryParam, isSubmitMode]);

  // Visibility evaluation - get all field values from editor
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

  const isReadonlyMode = mode === 'readonly';
  const shouldShowGrouping =
    (isSubmitMode || isReadonlyMode) &&
    (isSubmitMode ? isAllLocked : true) && // In submit mode, require isAllLocked; in readonly, always show if groups exist
    (groupsToUse.length > 0 || availableSubjects.length > 0);

  // Rich text editor for when enableRichText is true
  const richTextEditor = useTiptapEditor({
    extensions: [
      StarterKit,
      TextStyleKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
    ],
    content: enableRichText ? (value || '<p></p>') : '<p></p>',
    editorProps: {
      attributes: { class: 'nested-rich-editor' },
      handleDOMEvents: {
        mousedown: (_view, event) => {
          event.stopPropagation();
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => {
      if (enableRichText) {
        const html = editor.getHTML();
        const textOnly = editor.state?.doc?.textContent ?? '';
        if (maxLength && textOnly.length > maxLength) return;
        setValue(html);
        updateAttributes({ value: html });
      }
    },
    editable: (isEditMode || isSubmitMode) && enableRichText,
  });

  useEffect(() => {
    if (richTextEditor && enableRichText && value && richTextEditor.getHTML() !== value) {
      richTextEditor.commands.setContent(value || '<p></p>', { emitUpdate: false });
    }
  }, [richTextEditor, enableRichText, value]);

  // Ensure rich text editor is editable in submit mode
  useEffect(() => {
    if (richTextEditor && enableRichText) {
      richTextEditor.setEditable(isEditMode || isSubmitMode);
    }
  }, [richTextEditor, enableRichText, isEditMode, isSubmitMode]);

  useEffect(() => {
    return () => {
      richTextEditor?.destroy();
    };
  }, [richTextEditor]);

  // initialize value from node.attrs.value (if exists)
  React.useEffect(() => {
    const v = node.attrs.value ?? '';
    setValue(String(v));
    // validate initial
    if (!enableRichText) {
      validate(String(v));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkKeywords = (text: string) => {
    if (!Array.isArray(requiredKeywords) || requiredKeywords.length === 0)
      return [];
    const lower = text.toLowerCase();
    const missing = requiredKeywords
      .map((k: string) => String(k).trim())
      .filter(Boolean)
      .filter((k: string) => {
        // case-insensitive substring match; change to regex/word-boundary if needed
        return !lower.includes(k.toLowerCase());
      });
    // for "any" mode, if at least one keyword exists, then none are missing
    if (requiredKeywordsMode === 'any') {
      const anyPresent = requiredKeywords.some(
        (k: string) => String(k).trim() && lower.includes(k.toLowerCase())
      );
      return anyPresent ? [] : requiredKeywords.filter(Boolean);
    }
    // 'all' mode: return missing list
    return missing;
  };

  const validate = (val: string) => {
    if (minLength && val.length < minLength) {
      setError(`Minimum length is ${minLength}`);
      return false;
    }
    if (maxLength && val.length > maxLength) {
      setError(`Maximum length is ${maxLength}`);
      return false;
    }
    if (regex) {
      try {
        const re = new RegExp(regex);
        if (!re.test(val)) {
          setError('Invalid format');
          return false;
        }
      } catch {
        // if regex invalid, consider it non-blocking but show message
        setError('Invalid regex configured');
        return false;
      }
    }

    const missing = checkKeywords(val);
    // setMissingKeywords(missing);
    if (missing.length > 0) {
      setError(`Missing required keywords: ${missing.join(', ')}`);
      return false;
    }
    setError(null);
    return true;
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValue(v);
    validate(v);
    // persist to node attribute
    updateAttributes({ ...node.attrs, value: v });
    // updateAttributes({ value: v }); // persist only value
  };

  const requiredErrorSubmit = isSubmitMode && submitted && !!required && String(value || '').trim().length === 0;

  // Don't render if not visible (except in edit mode)
  if (!isVisible && !isEditMode) {
    return null;
  }

  return (
    <NodeViewWrapper
      {...(isEditMode ? { 'data-drag-handle': true } : {})}
      style={{ margin: '8px 0', display: isVisible || isEditMode ? 'block' : 'none' }}
      data-node-type="longText"
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
      <Card
        size="small"
        style={{
          margin: '8px 0',
          borderColor: error || requiredErrorSubmit ? token.colorError : token.colorBorder,
          borderRadius: token.borderRadiusLG,
          transition: 'border-color 0.2s ease',
          background: token.colorBgContainer,
        }}
        variant="outlined"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
          }}
        >
          <div style={{ flex: 1, width: '100%' }}>
            <div style={{ marginBottom: 6 }} contentEditable={mode === 'submit' ? false : undefined}>
              <NodeViewContent className="longtext-label" />
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
            {isSubmitMode && effectiveApprovalRequired && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <Tag
                  color="warning"
                  style={{
                    marginLeft: 0,
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
                <ExclamationCircleOutlined style={{ fontSize: 12 }} />
                <span style={{ marginLeft: 4 }}>Approval required</span>
              </Tag>
            )}
            <Form.Item
              style={{ marginBottom: 0 }}
              validateStatus={error || requiredErrorSubmit ? 'error' : undefined}
              help={error || (requiredErrorSubmit ? 'This field is required' : undefined)}
              labelCol={{ span: 24 }}
            >
              {shouldShowGrouping ? (
                <>
                  {isSubmitMode && (
                    <div style={{ marginBottom: 12, textAlign: 'right' }}>
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
                  <GroupedInputs
                    groups={groupsToUse}
                    availableSubjects={availableSubjects}
                    variant="text"
                    placeholder={placeholder}
                    minLength={minLength}
                    maxLength={maxLength}
                    required={required}
                    // name/phone-specific props are not used for long text
                    namePrefix={false}
                    nameSuffix={false}
                    namePrefixRequired={false}
                    nameSuffixRequired={false}
                    middleName={false}
                    middleNameRequired={false}
                    phoneCountryIsoCode={undefined}
                    initialValues={nodeGroupValues}
                    isReadonly={isReadonlyMode}
                    onValueChange={(entityId, val) => {
                      const updated = { ...nodeGroupValues, [entityId]: val };

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
                    }}
                    subjectsOptions={subjectsOptionsFromStorage}
                    approvalRequired={effectiveApprovalRequired}
                    approvalStatus={node.attrs.approvalStatus}
                    editor={editor}
                    node={node}
                  />
                </>
              ) : enableRichText && richTextEditor ? (
                <div
                  style={{
                    border: `1px solid ${token.colorBorder}`,
                    borderRadius: token.borderRadius,
                    padding: 8,
                  }}
                >
                  <EditorContent editor={richTextEditor} />
                  {maxLength && (
                    <div
                      style={{
                        fontSize: 12,
                        textAlign: 'right',
                        color: token.colorTextSecondary,
                        marginTop: 4,
                      }}
                    >
                      {(richTextEditor.state?.doc?.textContent || '').length}/
                      {maxLength}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <TextArea
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    autoSize={{ minRows: 3, maxRows: 8 }}
                    maxLength={maxLength || undefined}
                    readOnly={!isSubmitMode}
                  />
                  {maxLength && (
                    <div
                      style={{
                        fontSize: 12,
                        textAlign: 'right',
                        color: token.colorTextSecondary,
                      }}
                    >
                      {value.length}/{maxLength}
                    </div>
                  )}
                </>
              )}
            </Form.Item>
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
        </div>
      </Card>
      <LongTextEditModal
        open={showModal}
        onClose={() => setShowModal(false)}
        nodeAttrs={node.attrs}
        onSave={(values) => {
          updateAttributes(values);
          setShowModal(false);
        }}
      />
    </NodeViewWrapper>
  );
};

export default LongTextComponent;
