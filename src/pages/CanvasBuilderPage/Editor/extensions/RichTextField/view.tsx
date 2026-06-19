/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  NodeViewProps,
  NodeViewWrapper,
  useEditor as useTiptapEditor,
  EditorContent,
  JSONContent,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Space,
  Button,
  Card,
  theme,
  Tooltip,
  Flex,
  Modal,
  Typography,
  Tag,
  Input,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
// import { getSetEditingNodeFromEditor } from '../../utils';
import RichTextEditModal from './editModel';
// import type { Editor } from '@tiptap/react';
import RichTextMenuBar from '../../RichTextMenuBar';
import { getQueryParam, evaluateVisibility } from '../../utils';
import { NodeGroupingManager } from '../ShortTextField/NodeGroupingManager';
import { extractNodeLabel } from '../../utils';
import { getApprovalStatusForSubject, validateNodeRequirements } from '../../../../forms/QueuesComponents/questionApprovalUtils';
import { Tag as TagType, useGetTagsByIdsQuery } from '../../../../../services/tagsApi';

const { Text } = Typography;

// Rich text variant of grouped inputs - renders a nested rich-text editor per
// group and per ungrouped subject.
interface GroupedRichTextEditorsProps {
  groups: Array<{ id: string; name: string; subjectIds: string[] }>;
  availableSubjects: Array<{ label: string; value: string }>;
  maxLength?: number | null;
  initialValues: Record<string, string>;
  onValueChange: (entityId: string, value: string) => void;
  subjectsOptions: Array<{ label: string; value: string }>;
  // Approval-related props
  approvalRequired?: boolean;
  approvalStatus?: string | null;
  editor?: any;
  node?: any;
  // Readonly mode
  readonly?: boolean;
}

interface EntityRichTextEditorProps {
  value: string | any; // Can be HTML string or JSONContent object
  maxLength?: number | null;
  onChange: (value: string | any) => void; // Can return HTML or JSON
  storeAsJSON?: boolean; // Whether to store as JSONContent instead of HTML
  readonly?: boolean;
}

const EntityRichTextEditor: React.FC<EntityRichTextEditorProps> = ({
  value,
  maxLength,
  onChange,
  storeAsJSON = true, // Default to storing as JSON for better preservation
  readonly = false,
}) => {
  // Parse value: if it's a string, try to parse as JSON first, otherwise treat as HTML
  const parseValue = (val: string | any): any => {
    if (!val || val === '<p></p>') return { type: 'doc', content: [{ type: 'paragraph' }] };
    if (typeof val === 'object' && val.type === 'doc') return val; // Already JSON
    if (typeof val === 'string') {
      // Try to parse as JSON first
      try {
        const parsed = JSON.parse(val);
        if (parsed && parsed.type === 'doc') return parsed;
      } catch {
        // Not JSON, treat as HTML
      }
      // Return as HTML string
      return val;
    }
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  };

  const initialContent = parseValue(value);
  // const [localValue, setLocalValue] = useState<any>(initialContent);

  const editor = useTiptapEditor({
    extensions: [
      StarterKit,
      TextStyleKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
    ],
    content: initialContent,
    editable: !readonly,
    editorProps: {
      attributes: { class: 'nested-rich-editor' },
      handleDOMEvents: {
        mousedown: (_view, event) => {
          event.stopPropagation();
          return false;
        },
        mouseup: (_view, event) => {
          event.stopPropagation();
          return false;
        },
        click: (_view, event) => {
          event.stopPropagation();
          return false;
        },
        focus: (_view, event) => {
          event.stopPropagation();
          return false;
        },
        blur: (_view, event) => {
          event.stopPropagation();
          return false;
        },
        keydown: (_view, event) => {
          event.stopPropagation();
          return false;
        },
        keyup: (_view, event) => {
          event.stopPropagation();
          return false;
        },
        keypress: (_view, event) => {
          event.stopPropagation();
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => {
      if (maxLength) {
        const textOnly =
          editor.state?.doc?.textContent ?? editor.getText?.() ?? '';
        if (textOnly && textOnly.length > maxLength) return;
      }
      
      // Store as JSONContent to preserve full editor state
      if (storeAsJSON) {
        const json = editor.getJSON();
        // setLocalValue(json);
        onChange(json);
      } else {
        // Fallback to HTML
        const html = editor.getHTML();
        // setLocalValue(html);
        onChange(html);
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = parseValue(value);
    // Compare JSON structure if both are objects, otherwise compare as strings
    const currentContent = editor.getJSON();
    const isEqual = storeAsJSON 
      ? JSON.stringify(currentContent) === JSON.stringify(next)
      : editor.getHTML() === (typeof next === 'string' ? next : editor.getHTML());
    
    if (!isEqual) {
      // setLocalValue(next);
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [value, editor, storeAsJSON]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readonly);
    }
  }, [editor, readonly]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => e.stopPropagation()}
      onBlur={(e) => e.stopPropagation()}
    >
      <RichTextMenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};

const GroupedRichTextEditors: React.FC<GroupedRichTextEditorsProps> = ({
  groups,
  availableSubjects,
  maxLength,
  initialValues,
  onValueChange,
  subjectsOptions,
  approvalRequired = false,
  approvalStatus = null,
  editor,
  node,
  readonly = false,
}) => {
  const { token } = theme.useToken();

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {groups.map((group) => {
        const groupSubjects = group.subjectIds
          .map((id) => subjectsOptions.find((opt) => opt.value === id))
          .filter(Boolean)
          .map((opt) => opt?.label)
          .join(', ');

        const entityId = `group-${group.id}`;
        const value = initialValues[entityId] || '<p></p>';

        return (
          <Card
            key={entityId}
            size="small"
            style={{
              background: token.colorFillAlter,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
            title={
              <Space>
                <Text strong>Group: {group.name}</Text>
                {groupSubjects ? <Tag color="blue">{groupSubjects}</Tag> : null}
              </Space>
            }
          >
            <EntityRichTextEditor
              value={value}
              maxLength={maxLength || undefined}
              onChange={(content) => onValueChange(entityId, content)}
              storeAsJSON={true}
              readonly={readonly}
            />
            
            {/* Approval Status and Request Button for Group */}
            {approvalRequired && (() => {
              // Get global groups and available subjects from editor storage
              const globalGroups = (editor?.storage as any)?.formBuilder?.globalGroups || [];
              const globalAvailableSubjects = (editor?.storage as any)?.formBuilder?.availableSubjects || [];
              
              // Get approval status for this specific group
              const groupApprovalStatus = node ? getApprovalStatusForSubject(
                node as unknown as JSONContent,
                (group.subjectIds || [])[0] || '', // Use first subject ID to get group status
                globalGroups
              ) : approvalStatus;
              
              // Helper function to check if RichText value has actual content
              const hasRichTextContent = (val: any): boolean => {
                if (!val) return false;
                
                // If it's a string, check if it's not empty HTML
                if (typeof val === 'string') {
                  if (val === '<p></p>' || val.trim() === '') return false;
                  // Check if it has actual text content (not just HTML tags)
                  const textOnly = val.replace(/<[^>]*>/g, '').trim();
                  return textOnly.length > 0;
                }
                
                // If it's a JSONContent object (or stringified JSON), check for text content
                let jsonContent: any = val;
                if (typeof val === 'string') {
                  try {
                    jsonContent = JSON.parse(val);
                  } catch {
                    // Not JSON, treat as HTML string (already handled above)
                    return false;
                  }
                }
                
                if (jsonContent && typeof jsonContent === 'object') {
                  // Check if JSONContent has actual text
                  const hasText = (n?: any): boolean => {
                    if (!n) return false;
                    if (n.type === 'text' && typeof n.text === 'string') {
                      return (n.text || '').trim().length > 0;
                    }
                    if (Array.isArray(n.content)) {
                      return n.content.some((c: any) => hasText(c));
                    }
                    return false;
                  };
                  return hasText(jsonContent);
                }
                
                return false;
              };
              
              // Validate if requirements are fulfilled for this group
              const requirementsValid = node && hasRichTextContent(value)
                ? validateNodeRequirements(
                    node as JSONContent,
                    (group.subjectIds || [])[0] || '',
                    globalGroups,
                    globalAvailableSubjects
                  ).ok
                : hasRichTextContent(value);
              
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
                // Skip "pending" status - don't show tag when approval hasn't been requested
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
                    {!readonly && (
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
                            const openDrawer = (editor?.storage as any)?.formBuilder?.openQuestionApprovalDrawer;
                            const subjectsProfiles = (editor?.storage as any)?.formBuilder?.subjectsProfiles || [];
                            if (openDrawer && node) {
                              // Get Profile objects for all subjects in the group
                              const groupProfiles = group.subjectIds
                                .map((id) => subjectsProfiles.find((profile: any) => profile._id === id))
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

      {availableSubjects.map((subject) => {
        const entityId = `ungrouped-${subject.value}`;
        const value = initialValues[entityId] || '<p></p>';

        return (
          <Card
            key={entityId}
            size="small"
            style={{
              background: token.colorFillAlter,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
            title={<Text strong>Ungrouped: {subject.label}</Text>}
          >
            <EntityRichTextEditor
              value={value}
              maxLength={maxLength || undefined}
              onChange={(content) => onValueChange(entityId, content)}
              storeAsJSON={true}
              readonly={readonly}
            />
            
            {/* Approval Status and Request Button for Ungrouped Subject */}
            {approvalRequired && (() => {
              // Get global groups and available subjects from editor storage
              const globalGroups = (editor?.storage as any)?.formBuilder?.globalGroups || [];
              const globalAvailableSubjects = (editor?.storage as any)?.formBuilder?.availableSubjects || [];
              
              // Get approval status for this specific subject
              const subjectApprovalStatus = node ? getApprovalStatusForSubject(
                node as JSONContent,
                subject.value,
                globalGroups
              ) : approvalStatus;
              
              // Helper function to check if RichText value has actual content
              const hasRichTextContent = (val: any): boolean => {
                if (!val) return false;
                
                // If it's a string, check if it's not empty HTML
                if (typeof val === 'string') {
                  if (val === '<p></p>' || val.trim() === '') return false;
                  // Check if it has actual text content (not just HTML tags)
                  const textOnly = val.replace(/<[^>]*>/g, '').trim();
                  return textOnly.length > 0;
                }
                
                // If it's a JSONContent object (or stringified JSON), check for text content
                let jsonContent: any = val;
                if (typeof val === 'string') {
                  try {
                    jsonContent = JSON.parse(val);
                  } catch {
                    // Not JSON, treat as HTML string (already handled above)
                    return false;
                  }
                }
                
                if (jsonContent && typeof jsonContent === 'object') {
                  // Check if JSONContent has actual text
                  const hasText = (n?: any): boolean => {
                    if (!n) return false;
                    if (n.type === 'text' && typeof n.text === 'string') {
                      return (n.text || '').trim().length > 0;
                    }
                    if (Array.isArray(n.content)) {
                      return n.content.some((c: any) => hasText(c));
                    }
                    return false;
                  };
                  return hasText(jsonContent);
                }
                
                return false;
              };
              
              // Validate if requirements are fulfilled for this subject
              const requirementsValid = node && hasRichTextContent(value)
                ? validateNodeRequirements(
                    node as JSONContent,
                    subject.value,
                    globalGroups,
                    globalAvailableSubjects
                  ).ok
                : hasRichTextContent(value);
              
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
                // Skip "pending" status - don't show tag when approval hasn't been requested
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
                    {!readonly && (
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
                            const openDrawer = (editor?.storage as any)?.formBuilder?.openQuestionApprovalDrawer;
                            const subjectsProfiles = (editor?.storage as any)?.formBuilder?.subjectsProfiles || [];
                            if (openDrawer && node) {
                              // Get Profile object for the ungrouped subject
                              const subjectProfile = subjectsProfiles.find((profile: any) => profile._id === subject.value);

                              const subjectContext = {
                                type: 'ungrouped' as const,
                                subjectId: subject.value,
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
          </Card>
        );
      })}
    </Space>
  );
};

// toolbar replaced by full-featured RichTextMenuBar

const RichTextComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { token } = theme.useToken();

  // content is handled by main editor; no value/maxLength logic
  const [error] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // const setEditingNode = getSetEditingNodeFromEditor(editor);

  type FormBuilderStorage = {
    formBuilder?: {
      mode?: 'readonly' | 'edit' | 'submit' | string;
    };
  };

  const storage = editor.storage as unknown as FormBuilderStorage;
  const mode = storage.formBuilder?.mode ?? 'readonly';
  const submitted = (editor.storage as any)?.formBuilder?.submitted === true;
  const isEditMode = mode === 'edit';

  // const IsSubmitMode = mode === 'submit';
  // const isReadonlyMode = mode === 'readonly';

  const {
    value,
    maxLength,
    required,
    approvalRequired: rawApprovalRequired = false,
    queryParam = null,
    visibility = { match: 'all', rules: [] },
    // Historic schemas might have stored this as a string; normalize to boolean.
    enableGrouping = false,
    nodeGroups = [],
    nodeGroupValues = {},
    tags = [],
  } = node.attrs as any;
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

  const [nestedValue, setNestedValue] = useState<string>(value || '<p></p>');
  const [labelText, setLabelText] = useState<string>(node.attrs.label || '');
  const [showGroupingModal, setShowGroupingModal] = useState(false);
  const isSubmitMode = mode === 'submit';

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

  const updateTimerRef = useRef<number | null>(null);
  const labelUpdateTimerRef = useRef<number | null>(null);

  const nestedEditor = useTiptapEditor({
    extensions: [
      StarterKit,
      TextStyleKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
    ],
    content: nestedValue,
    editorProps: {
      attributes: { class: 'nested-rich-editor' },
      handleDOMEvents: {
        mousedown: (_view, event) => {
          event.stopPropagation();
          return false;
        },
        mouseup: (_view, event) => {
          event.stopPropagation();
          return false;
        },
        click: (_view, event) => {
          event.stopPropagation();
          return false;
        },
        focus: (_view, event) => {
          event.stopPropagation();
          return false;
        },
        blur: (_view, event) => {
          event.stopPropagation();
          // persist latest value on blur to avoid mid-typing re-renders
          // const finalHtml = _view.state?.doc ? _view.dom.innerHTML ? undefined : undefined : undefined;
          // use the tracked nestedValue instead of reading DOM
          if (nestedValue !== (node.attrs.value || '<p></p>')) {
            updateAttributes({ ...node.attrs, value: nestedValue });
          }
          return false;
        },
        keydown: (_view, event) => {
          // prevent bubbling to outer submit-mode editor so typing works in nested editor
          event.stopPropagation();
          return false;
        },
        keyup: (_view, event) => {
          event.stopPropagation();
          return false;
        },
        keypress: (_view, event) => {
          event.stopPropagation();
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (maxLength) {
        const textOnly = editor.state?.doc?.textContent ?? editor.getText?.() ?? '';
        if (textOnly && textOnly.length > maxLength) return;
      }
      if (updateTimerRef.current) window.clearTimeout(updateTimerRef.current);
      updateTimerRef.current = window.setTimeout(() => {
        setNestedValue(html);
        // keep attrs.value in sync so submit-time JSON is accurate even without blur
        if (html !== (node.attrs.value || '<p></p>')) {
          updateAttributes({ ...node.attrs, value: html });
        }
      }, 150);
    },
  });
  // Query parameter handling - pre-populate from URL
  useEffect(() => {
    if (queryParam && isSubmitMode && (!nestedValue || nestedValue === '<p></p>')) {
      const paramValue = getQueryParam(queryParam);
      if (paramValue) {
        const htmlValue = `<p>${paramValue}</p>`;
        setNestedValue(htmlValue);
        if (nestedEditor) {
          nestedEditor.commands.setContent(htmlValue, { emitUpdate: false });
        }
        updateAttributes({ value: htmlValue });
      }
    }
  }, [queryParam, isSubmitMode, nestedEditor]);

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

  const requiredErrorSubmit = mode === 'submit' && submitted && requiredBool && (!nestedValue || nestedValue === '<p></p>' || nestedValue.replace(/<[^>]*>/g, '').trim().length === 0);

  useEffect(() => {
    if (!nestedEditor) return;
    const html = node.attrs.value || '<p></p>';
    if (html !== nestedValue) {
      setNestedValue(html);
      if (nestedEditor.getHTML() !== html) {
        nestedEditor.commands.setContent(html, { emitUpdate: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.attrs.value, nestedEditor]);

  // Ensure nested editor is editable in submit mode
  useEffect(() => {
    if (!nestedEditor) return;
    // In submit mode, the nested editor should be editable
    // In edit mode, it should also be editable (for form structure editing)
    // In readonly mode, it should be non-editable
    nestedEditor.setEditable(mode === 'submit' || mode === 'edit');
  }, [nestedEditor, mode]);

  useEffect(() => {
    return () => {
      nestedEditor?.destroy();
    };
  }, [nestedEditor]);

  // Keep local label state in sync when attrs change externally
  useEffect(() => {
    const next = node.attrs.label || '';
    if (next !== labelText) {
      setLabelText(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.attrs.label]);

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
      data-node-type="richText"
      data-node-name={String((node.attrs as any)?.name || '')}
      data-node-id={String((node.attrs as any)?.id || '')}
    >
      {/* Submit-mode only: per-field grouping configuration in a popup */}
      {mode === 'submit' && (
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
            subjectsOptions={
              (editor.storage as any)?.formBuilder?.subjects || []
            }
            globalGroups={
              (editor.storage as any)?.formBuilder?.globalGroups || []
            }
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
        <Flex justify="space-between" style={{ marginLeft: 8 }}>
          <div style={{ marginBottom: 8, flex: 1 }}>
            {isEditMode ? (
              <Input
                value={labelText}
                onChange={(e) => {
                  const newText = e.target.value;
                  setLabelText(newText);
                  if (labelUpdateTimerRef.current) {
                    window.clearTimeout(labelUpdateTimerRef.current);
                  }
                  labelUpdateTimerRef.current = window.setTimeout(() => {
                    const finalText = newText.trim() || '';
                    if (finalText !== node.attrs.label) {
                      updateAttributes({ ...node.attrs, label: finalText });
                    }
                  }, 300);
                }}
                onBlur={() => {
                  const finalText = labelText.trim() || '';
                  if (finalText !== node.attrs.label) {
                    updateAttributes({ ...node.attrs, label: finalText });
                  }
                  if (finalText !== labelText) {
                    setLabelText(finalText);
                  }
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                style={{
                  fontWeight: 600,
                  border: 'none',
                  padding: 0,
                  boxShadow: 'none',
                  background: 'transparent',
                }}
              />
            ) : (
              <Text strong style={{ fontWeight: 600 }}>
                {labelText}
              </Text>
            )}
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
            {isSubmitMode && effectiveApprovalRequired && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
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
                  marginTop: 6,
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
                  marginTop: 6,
                }}
              >
                <ExclamationCircleOutlined style={{ fontSize: 12 }} />
                <span style={{ marginLeft: 4 }}>Approval required</span>
              </Tag>
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

        {mode === 'submit' && shouldShowGrouping && (
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

        {!shouldShowGrouping && nestedEditor && (isEditMode || isSubmitMode) ? (
          <RichTextMenuBar editor={nestedEditor} />
        ) : null}
        {shouldShowGrouping ? (
          <GroupedRichTextEditors
            groups={groupsToUse}
            availableSubjects={availableSubjects}
            maxLength={maxLength}
            initialValues={nodeGroupValues}
            readonly={isReadonlyMode}
            onValueChange={(entityId, val) => {
              // If val is a JSONContent object, stringify it for storage
              // Otherwise, keep it as is (for backward compatibility with HTML strings)
              const valueToStore =
                typeof val === 'object' &&
                val !== null &&
                'type' in val &&
                (val as any).type === 'doc'
                  ? JSON.stringify(val)
                  : val;

              const updated = { ...nodeGroupValues, [entityId]: valueToStore };

              // Sync values between grouped and ungrouped subjects
              // If a group value is changed, also store it for each subject in that group
              if (entityId.startsWith('group-')) {
                const groupId = entityId.replace('group-', '');
                const group = groupsToUse.find((g: any) => g.id === groupId);
                if (group && group.subjectIds) {
                  // Store the group value for each subject in the group as ungrouped value
                  group.subjectIds.forEach((subjectId: string) => {
                    const ungroupedKey = `ungrouped-${subjectId}`;
                    updated[ungroupedKey] = valueToStore;
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
                  updated[groupKey] = valueToStore;
                  // Also update ungrouped values for all other subjects in the same group
                  group.subjectIds.forEach((otherSubjectId: string) => {
                    const otherUngroupedKey = `ungrouped-${otherSubjectId}`;
                    updated[otherUngroupedKey] = valueToStore;
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
        ) : (
          <div style={{ border: '1px solid #eee', padding: 8 }}>
            {nestedEditor ? (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                onBlur={(e) => e.stopPropagation()}
              >
                <EditorContent editor={nestedEditor} />
                {requiredErrorSubmit ? (
                  <div style={{ color: token.colorError, marginTop: 6, fontSize: 12 }}>
                    This field is required
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </Card>
      <RichTextEditModal
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

export default RichTextComponent;
