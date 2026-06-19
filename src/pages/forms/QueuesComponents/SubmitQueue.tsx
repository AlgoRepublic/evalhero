/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import {
  Affix,
  Button,
  Card,
  Col,
  Form,
  Row,
  Select,
  Space,
  Spin,
  Tooltip,
  Typography,
  message,
  Modal,
  Input,
  Tag,
} from 'antd';
import {
  SaveOutlined,
  FormOutlined,
  EyeOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  MergeCellsOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { theme } from 'antd';

import {
  SubmitQueuePayload,
  useSubmitQueueMutation,
} from '../../../services/queueApi';
import { useGetTagsByIdsQuery } from '../../../services/tagsApi';
// import { useCreateDraftMutation } from '../../../services/templateVersionApi';
import { useTiptapInstance } from '../../../hooks/useTiptapInstance';
import { extensions } from '../../CanvasBuilderPage/Editor/extensions';
import { TemplateEditor } from '../../CanvasBuilderPage';
import { buildSubjectAnswers, getSubjectFormData } from './submitUtils';
import { Assignment } from '../../../services/assignmentsApi';
import { User, Profile } from '../../../features/auth/authSlice';
import { JSONContent } from '@tiptap/core';
import {
  validateQuestionApprovals,
  QuestionNode,
  SubjectContext,
  getQuestionsRequiringApproval,
  getQuestionKeyFromNode,
  isAssigneeGroupFullyPreApproved,
  isSubjectPreApprovedForAllQuestions,
  getPreApprovalForContext,
} from './questionApprovalUtils';
import { QuestionApprovalDrawer } from './QuestionApprovalDrawer';
import { extractNodeLabel } from '../../CanvasBuilderPage/Editor/utils';
import { SubjectFormPreview } from './SubjectFormPreview';
// import { useAnyPermission } from '../../../hooks/usePermission';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { updateNodeAttributesInEditor, findNodeInJSONContent } from './nodeUpdateUtils';

const { Title, Text } = Typography;

interface FormValues {
  subjectId: string | string[];
  name: string;
  code: string;
  description?: string;
  hasApproval: boolean;
  hasDisputes: boolean;
  signatureRequired: boolean;
}

interface SubjectGroup {
  id: string;
  name: string;
  subjectIds: string[];
  locked?: boolean;
}

/* ------------------- UTIL ------------------- */
const normalizeEditorContent = (doc: JSONContent) => {
  if (!doc?.content) return doc;
  const filtered = doc.content.filter(
    (node: JSONContent) => !(node.type === 'paragraph' && !node.content)
  );
  return { ...doc, content: filtered };
};

// Validate required fields (generic) including choice fields with "Other"
// In submit mode, validates all subjects/groups individually
const validateRequiredFields = (
  doc: JSONContent,
  subjectGroups?: Array<{ id: string; name: string; subjectIds: string[] }>,
  availableSubjects?: Array<{ label: string; value: string }>,
  isSubmitMode?: boolean
): {
  ok: boolean;
  message?: string;
  target?: { type: string; name?: string };
} => {
  let invalid = false;
  let target: { type: string; name?: string } | undefined;

  const hasAnyText = (node?: JSONContent): boolean => {
    if (!node) return false;
    if (node.type === 'text' && typeof (node as any).text === 'string') {
      return ((node as any).text || '').trim().length > 0;
    }
    if (Array.isArray(node.content)) {
      return node.content.some((c) => hasAnyText(c));
    }
    return false;
  };

  // Helper to validate a value for a specific subject/group
  const validateValueForSubject = (
    node: JSONContent,
    attrs: any,
    type: string,
    subjectId: string,
    globalGroups?: Array<{ id: string; name: string; subjectIds: string[] }>
  ): boolean => {
    const enableGrouping = attrs?.enableGrouping === true || attrs?.enableGrouping === 'true';
    const nodeGroupValues = attrs?.nodeGroupValues || {};
    
    // Get value for this specific subject/group
    // Matrix nodes use 'cells' instead of 'value'
    let value: any = type === 'matrixField' ? (attrs?.cells || {}) : attrs?.value;
    
    if (enableGrouping && attrs?.nodeGroups && Array.isArray(attrs.nodeGroups)) {
      const nodeGroups = attrs.nodeGroups as Array<{ id: string; name: string; subjectIds: string[] }>;
      const nodeGroup = nodeGroups.find((g) => g.subjectIds.includes(subjectId));
      
      if (nodeGroup) {
        const groupKey = `group-${nodeGroup.id}`;
        value = nodeGroupValues[groupKey];
      } else {
        const ungroupedKey = `ungrouped-${subjectId}`;
        value = nodeGroupValues[ungroupedKey];
      }
    } else if (nodeGroupValues && typeof nodeGroupValues === 'object' && Object.keys(nodeGroupValues).length > 0) {
      const globalGroup = globalGroups?.find((g) => g.subjectIds.includes(subjectId));
      if (globalGroup) {
        const globalGroupKey = `group-${globalGroup.id}`;
        value = nodeGroupValues[globalGroupKey];
      }
      
      const ungroupedKey = `ungrouped-${subjectId}`;
      const ungroupedValue = nodeGroupValues[ungroupedKey];
      if (ungroupedValue !== undefined && ungroupedValue !== null && ungroupedValue !== '') {
        value = ungroupedValue;
      }
    }

    // Validate based on type
    if (type === 'singleChoice') {
      if (!value) return false;
      if (value === '__other__') {
        const otherNode = (node.content || []).find(
          (c: any) => c?.type === 'singleChoiceOther'
        ) as JSONContent | undefined;
        return hasAnyText(otherNode);
      }
      return true;
    }

    if (type === 'multipleChoice') {
      const valueArray: any[] = Array.isArray(value) ? value : [];
      if (!valueArray.length) return false;
      if (valueArray.includes('__other__')) {
        const otherNode = (node.content || []).find(
          (c: any) => c?.type === 'multipleChoiceOther'
        ) as JSONContent | undefined;
        return hasAnyText(otherNode);
      }
      return true;
    }

    if (type === 'richText') {
      if (!value || value === '<p></p>') return false;
      if (typeof value === 'string') {
        return value.replace(/<[^>]*>/g, '').trim().length > 0;
      }
      return hasAnyText(value as JSONContent);
    }

    // Matrix field validation
    if (type === 'matrixField') {
      // For matrix, value is the cells object (or from nodeGroupValues)
      const cells = value && typeof value === 'object' ? value : {};
      const columns = Array.isArray(attrs?.columns) ? attrs.columns : [];
      const rows = Array.isArray(attrs?.rows) ? attrs.rows : [];
      
      // Check if any required column has missing values for any row
      for (const col of columns) {
        if (col.required === true || col.required === 'true') {
          for (const row of rows) {
            const rowId = row.id;
            const colId = col.id;
            const cellValue = cells[rowId] && cells[rowId][colId];
            
            // Check if cell is empty
            const isEmpty = 
              cellValue === null ||
              cellValue === undefined ||
              (typeof cellValue === 'string' && cellValue.trim().length === 0) ||
              (Array.isArray(cellValue) && cellValue.length === 0);
            
            if (isEmpty) {
              return false; // Required cell is missing
            }
          }
        }
      }
      return true; // All required cells are filled
    }

    // Generic validation
    const isEmpty =
      value == null ||
      (typeof value === 'string' && value.trim().length === 0) ||
      (Array.isArray(value) && value.length === 0);
    return !isEmpty;
  };

  const walk = (node?: JSONContent) => {
    if (!node || invalid) return;
    const type = node.type as string | undefined;
    const attrs = (node as any)?.attrs || {};

    // Check if field is required
    const required = attrs?.required === true || attrs?.required === 'true';
    if (!required) {
      // Recurse children even if not required
      if (Array.isArray(node.content)) node.content.forEach((c) => walk(c));
      return;
    }

    // In submit mode with groups, validate each subject/group individually
    if (isSubmitMode && subjectGroups && availableSubjects) {
      // Get all subject IDs
      const allSubjectIds: string[] = [];
      subjectGroups.forEach((group) => {
        allSubjectIds.push(...group.subjectIds);
      });
      availableSubjects.forEach((subject) => {
        allSubjectIds.push(subject.value);
      });
      const uniqueSubjectIds = Array.from(new Set(allSubjectIds));

      // Validate for each subject
      for (const subjectId of uniqueSubjectIds) {
        if (!validateValueForSubject(node, attrs, type || '', subjectId, subjectGroups)) {
          invalid = true;
          if (!target) target = { type: type || 'unknown', name: attrs?.name };
          break; // Stop at first invalid field
        }
      }
    } else {
      // Original validation logic for non-submit mode or when no groups
      // Single Choice validation
      if (type === 'singleChoice' && attrs?.required) {
        const value = attrs?.value;
        const otherSelected = value === '__other__';
        if (!value) {
          invalid = true;
          if (!target) target = { type: 'singleChoice', name: attrs?.name };
        } else if (otherSelected) {
          const otherNode = (node.content || []).find(
            (c: any) => c?.type === 'singleChoiceOther'
          ) as JSONContent | undefined;
          if (!hasAnyText(otherNode)) {
            invalid = true;
            if (!target) target = { type: 'singleChoice', name: attrs?.name };
          }
        }
      }

      // Multiple Choice validation
      if (type === 'multipleChoice' && attrs?.required) {
        const value: any[] = Array.isArray(attrs?.value) ? attrs.value : [];
        if (!value.length) {
          invalid = true;
          if (!target) target = { type: 'multipleChoice', name: attrs?.name };
        } else if (value.includes('__other__')) {
          const otherNode = (node.content || []).find(
            (c: any) => c?.type === 'multipleChoiceOther'
          ) as JSONContent | undefined;
          if (!hasAnyText(otherNode)) {
            invalid = true;
            if (!target) target = { type: 'multipleChoice', name: attrs?.name };
          }
        }
      }

      // Generic required for common field types
      const genericRequiredTypes = new Set([
        'shortText',
        'longText',
        'numberField',
        'ratingField',
        'sliderField',
        'dateField',
        'dateTimeField',
        'richText',
        'addressNode',
        'lookupField',
        'fileField',
        'signatureField',
      ]);
      if (!invalid && attrs?.required && type && genericRequiredTypes.has(type)) {
        const v = (attrs as any)?.value;
        const isEmpty =
          v == null ||
          (typeof v === 'string' && v.trim().length === 0) ||
          (Array.isArray(v) && v.length === 0);
        if (isEmpty && !target) {
          invalid = true;
          target = { type, name: attrs?.name };
        }
        if (!invalid && type === 'richText') {
          const textOnly = !hasAnyText(node);
          if (textOnly && !target) {
            invalid = true;
            target = { type, name: attrs?.name };
          }
        }
      }
    }

    // Recurse children
    if (Array.isArray(node.content)) node.content.forEach((c) => walk(c));
  };

  walk(doc);
  console.log('invalid', invalid, target);
  return invalid
    ? { ok: false, message: 'Please fill all required fields for all subjects/groups.', target }
    : { ok: true };
};

// Try to focus and scroll to a node inside editor by type/name
// const focusNodeInEditor = (
//   editor: any,
//   target?: { type: string; name?: string }
// ) => {
//   if (!editor || !target?.type) return;
//   const doc = editor.state?.doc;
//   if (!doc) return;
//   let foundPos: number | null = null;
//   doc.descendants((node: any, pos: number) => {
//     if (foundPos != null) return false;
//     const matchesType = node?.type?.name === target.type;
//     const matchesName = target.name ? node?.attrs?.name === target.name : true;
//     if (matchesType && matchesName) {
//       foundPos = pos;
//       return false;
//     }
//     return true;
//   });
//   if (foundPos != null) {
//     try {
//       const anchor = Math.max(0, foundPos + 1);
//       editor.chain().setTextSelection(anchor).scrollIntoView().run();
//       editor.commands.focus(anchor);
//     } catch {
//       try {
//         const anchor = Math.max(0, foundPos + 1);
//         editor.commands.setTextSelection(anchor);
//         (editor as any).view?.dispatch?.((editor as any).state.tr.scrollIntoView());
//       } catch {
//         // no-op
//       }
//     }

//     // Try to focus the exact NodeView element and its primary input/content
//     try {
//       const view = editor.view as any;
//       const nodeEl = (view.nodeDOM && view.nodeDOM(foundPos)) as HTMLElement | null;
//       const container: HTMLElement | null = nodeEl || ((): HTMLElement | null => {
//         try {
//           const anchor = Math.max(0, (foundPos as number) + 1);
//           const domAt = view.domAtPos ? view.domAtPos(anchor) : null;
//           const base = (domAt && (domAt.node as HTMLElement)) || null;
//           return base ? (base.closest('[data-node-type]') as HTMLElement | null) : null;
//         } catch {
//           return null;
//         }
//       })();
//       if (container) {
//         container.scrollIntoView({ behavior: 'smooth', block: 'center' });
//         setTimeout(() => {
//           const focusable =
//             (container.querySelector('input, textarea, .ProseMirror, .ant-input, .ant-select-selector, .ant-picker-input input') as HTMLElement | null) ||
//             (container.querySelector('[contenteditable="true"]:not([class$="-label"])') as HTMLElement | null);
//           if (focusable && typeof (focusable as any).focus === 'function') {
//             (focusable as any).focus();
//           }
//         }, 50);
//       }
//     } catch {
//       // ignore DOM focus errors
//     }
//   }
// };

export const SubmitQueueComponent: React.FC<{
  queue: Assignment;
  refetchQueue: () => Promise<unknown>;
  queueLoading: boolean;
  submissionStatus:
    | 'submission_not_started'
    | 'submission_in_progress'
    | 'submission_complete'
    | null
    | undefined;
  readonly?: boolean;
  canSubmit?: boolean;
  selectedAssigneeId?: string;
  /** When true, question approver is viewing (readonly); they can open the approval drawer but cannot fill the form. */
  canOpenApprovalDrawer?: boolean;
}> = ({ queue, refetchQueue, submissionStatus, readonly = true, canSubmit = false, selectedAssigneeId, canOpenApprovalDrawer = false }) => {
  const { token } = theme.useToken();
  const [modal, contextHolder] = Modal.useModal();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [form] = Form.useForm<FormValues>();
  const [isDirty, setIsDirty] = useState(false);
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SubjectGroup | null>(null);
  const [groupForm] = Form.useForm<{ name: string; subjectIds: string[] }>();
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set()
  );
  const [isAllLocked, setIsAllLocked] = useState(false);
  // Store form answers per group/subject: { groupId/subjectId: JSONContent }
  const [answersPerEntity, setAnswersPerEntity] = useState<
    Record<string, JSONContent>
  >({});

  // Question approval drawer state
  const [approvalDrawerOpen, setApprovalDrawerOpen] = useState(false);
  const [selectedQuestionNode, setSelectedQuestionNode] =
    useState<QuestionNode | null>(null);
  const [selectedSubjectContext, setSelectedSubjectContext] =
    useState<SubjectContext | null>(null);

  // Subject form preview state
  const [subjectFormPreviewOpen, setSubjectFormPreviewOpen] = useState(false);
  const [selectedSubjectForPreview, setSelectedSubjectForPreview] = useState<
    string | null
  >(null);
  const [subjectFormData, setSubjectFormData] = useState<any>(null);

  /* ------------------- META ------------------- */

  const [submitQueue, { isLoading: isSubmitting }] = useSubmitQueueMutation();
  // console.log('submissionStatus', submissionStatus);
  // Auto-save state
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoSavingRef = useRef<boolean>(false);
  const hasLoadedSubmissionsRef = useRef<boolean>(false);
  const lastSavedContentRef = useRef<string | null>(null); // Store last saved content as JSON string for comparison
  const initializationCompleteRef = useRef<boolean>(false); // Track if initialization is complete
  const [isInitializationComplete, setIsInitializationComplete] =
    useState<boolean>(false); // State to track initialization for useEffect dependencies
  false &&console.log('isInitializationComplete', isInitializationComplete);
  // Navigation blocking state
  const [showNavigationConfirm, setShowNavigationConfirm] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);

  /* ------------------- PERMISSIONS ------------------- */
  const selectedProfile = useSelector((state: RootState) => state.auth.selectedProfile);

  /* ------------------- DRAFT ------------------- */

  // const [createDraft] = useCreateDraftMutation();
  // const [updateDraft] = useUpdateDraftMutation();
  // const [lockVersion] = useLockVersionMutation();

  // The actual form schema we want to load into the editor
  const schema = queue?.formTemplateSchema?.formSchema ?? null;

  /* ------------------- TAGS ------------------- */
  // Collect all tag IDs from all nodes in the schema
  const allTagIds = useMemo(() => {
    if (!schema) return [];
    const tagIds = new Set<string>();
    
    const walk = (node: JSONContent) => {
      if (!node) return;
      const attrs = node.attrs || {};
      const tags = attrs.tags;
      
      if (Array.isArray(tags) && tags.length > 0) {
        tags.forEach((tagId: string) => {
          if (tagId && typeof tagId === 'string') {
            tagIds.add(tagId);
          }
        });
      }
      
      // Recurse through children
      if (Array.isArray(node.content)) {
        node.content.forEach((child) => walk(child));
      }
    };
    
    if (schema.content && Array.isArray(schema.content)) {
      schema.content.forEach((node) => walk(node));
    }
    
    return Array.from(tagIds);
  }, [schema]);

  // Fetch tags by IDs using the new endpoint
  const { data: tagsByIdsResponse } = useGetTagsByIdsQuery(
    { tagIds: allTagIds },
    { skip: allTagIds.length === 0 }
  );

  const tagsByIds = useMemo(() => {
    return tagsByIdsResponse?.data?.tags || [];
  }, [tagsByIdsResponse]);

  /* ------------------- TIPTAP INSTANCE ------------------- */
  const submitExtensions = React.useMemo(() => {
    try {
      return (extensions || []).filter(
        (ext: any) => ext?.name !== 'slashCommand'
      );
    } catch {
      return extensions;
    }
  }, []);

  // Auto-save trigger function (will be defined later, using ref to avoid dependency issues)
  const handleAutoSaveRef = useRef<(() => Promise<void>) | null>(null);

  // Calculate editor mode based on submissionStatus and readonly prop
  // - If readonly prop is true: readonly mode
  // - If submissionStatus is 'submission_complete': readonly mode (submission is complete, no editing allowed)
  // - If submissionStatus is undefined: readonly mode
  // - Otherwise: submit mode (only if canSubmit is true)
  const editorMode = useMemo(() => {
    if (readonly) {
      return 'readonly';
    }
    // If submission is complete, force readonly mode
    if (submissionStatus === 'submission_complete') {
      return 'readonly';
    }
    if (!canSubmit) {
      return 'readonly';
    }
    const mode = submissionStatus === undefined ? 'readonly' : 'submit';
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ab9e3d5c-bb82-40f9-8c4c-9b25ff821572', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'SubmitQueue.tsx:314',
        message: 'Calculated editor mode',
        data: {
          submissionStatus,
          editorMode: mode,
          hasSubmissions: !!queue?.submissions?.length,
          globalGroupsCount: queue?.submitMeta?.globalGroups?.length || 0,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'A',
      }),
    }).catch(() => {});
    // #endregion
    return mode;
  }, [submissionStatus, queue?.submissions, queue?.submitMeta?.globalGroups, readonly, canSubmit]);

  // Base tiptap instance for template (used when not locked)
  const tiptap = useTiptapInstance({
    extensions: submitExtensions,
    onUpdate: () => {
      setIsDirty(true);
      // Trigger auto-save on editor updates (when locked)
      // Only if there are actual changes (compare with last saved content)
      if (
        isAllLocked &&
        !isAutoSavingRef.current &&
        handleAutoSaveRef.current &&
        tiptap.editor
      ) {
        // Get current content for comparison
        try {
          const currentContent = JSON.stringify(tiptap.getJSON());

          // Only proceed if content has actually changed
          if (currentContent !== lastSavedContentRef.current) {
            // Clear existing timeout
            if (autoSaveTimeoutRef.current) {
              clearTimeout(autoSaveTimeoutRef.current);
            }
            // Debounce auto-save (2 seconds after last change)
            autoSaveTimeoutRef.current = setTimeout(() => {
              // Double-check content hasn't changed back and editor is still available
              if (tiptap.editor && !isAutoSavingRef.current) {
                try {
                  const contentAtSaveTime = JSON.stringify(tiptap.getJSON());
                  if (contentAtSaveTime !== lastSavedContentRef.current) {
                    handleAutoSaveRef.current?.();
                  }
                } catch (err) {
                  // Silently handle errors in timeout callback
                  console.error(
                    'Error checking content before auto-save:',
                    err
                  );
                }
              }
            }, 3000);
          }
        } catch (err) {
          // Silently handle errors in onUpdate
          console.error('Error in onUpdate callback:', err);
        }
      }
    },
    initialContent: schema || '',
    mode: editorMode,
  });

  /* ------------------- INITIAL LOAD ------------------- */
  // useEffect(() => {
  //   if (queue) {
  //     const t = queue;
  //     form.setFieldsValue({
  //       name: t.name,
  //       code: t.code,
  //       description: t.description ?? '',
  //       hasApproval: t.hasApproval,
  //       hasDisputes: t.hasDisputes,
  //       signatureRequired: t.signatureRequired,
  //     });
  //   }

  //   setIsDirty(false);
  // }, [queue, form, tiptap]);

  useEffect(() => {
    if (schema) {
      const sanitized = normalizeEditorContent(schema);
      // Load schema with IDs preserved
      // The UniqueID extension will preserve existing IDs from the template schema
      // This ensures submissions use the same node IDs as the template
      tiptap.setJSON(sanitized);
    }

    setIsDirty(false);
  }, [schema, form, tiptap]);

  // When selected assignee's submission has not started, reset editor to clean schema
  // so we don't show another assignee's filled data when switching assignee
  useEffect(() => {
    if (
      (submissionStatus === 'submission_not_started' || submissionStatus === undefined) &&
      schema &&
      tiptap?.editor
    ) {
      const sanitized = normalizeEditorContent(schema);
      tiptap.setJSON(sanitized);
      setIsDirty(false);
    }
  }, [submissionStatus, schema, tiptap]);

  /* ------------------- POPULATE FROM SUBMITMETA ------------------- */
  // Populate subject groups from submitMeta only when selected assignee's submission has started
  // When submission_not_started we show empty groups so the assignee can configure and start
  useEffect(() => {
    if (submissionStatus === 'submission_not_started' || submissionStatus === undefined) {
      setSubjectGroups([]);
      return;
    }
    if (queue?.submitMeta?.globalGroups) {
      const groups: SubjectGroup[] = queue.submitMeta.globalGroups.map(
        (group) => ({
          id: group.id,
          name: group.name,
          subjectIds: group.subjectIds,
          locked: group.locked === true || group.locked === 'true',
        })
      );
      setSubjectGroups(groups);
    }
  }, [queue?.submitMeta?.globalGroups, submissionStatus]);

  // Populate isAllLocked from submitMeta only when selected assignee's submission has started
  useEffect(() => {
    if (submissionStatus === 'submission_not_started' || submissionStatus === undefined) {
      setIsAllLocked(false);
      return;
    }
    if (queue?.submitMeta?.isAllLocked !== undefined) {
      const locked =
        queue.submitMeta.isAllLocked === true ||
        queue.submitMeta.isAllLocked === 'true';
      setIsAllLocked(locked);
    }
  }, [queue?.submitMeta?.isAllLocked, submissionStatus]);

  /* ------------------- MERGE SUBMISSIONS INTO EDITOR ------------------- */
  // Function to merge autosaved submissions into the editor schema
  const mergeSubmissionsIntoEditor = useCallback(
    (tiptapInstance: typeof tiptap, submissions: any[], submitMeta: any) => {
      if (!tiptapInstance?.editor || !submissions || submissions.length === 0)
        return;

      const currentDoc = tiptapInstance.getJSON();
      if (!currentDoc || !currentDoc.content) return;

      // Create a map of subjectId to groupId (from globalGroups)
      const subjectToGroupMap = new Map<string, string>();
      if (submitMeta?.globalGroups) {
        submitMeta.globalGroups.forEach((group: any) => {
          group.subjectIds.forEach((subjectId: string) => {
            subjectToGroupMap.set(subjectId, group.id);
          });
        });
      }

      // Create a map of subjectId to submission answers
      // Handle both old format (submission.subject._id) and new format (submission.subjectId)
      const subjectAnswersMap = new Map<string, JSONContent>();
      // Track the latest submission for nodeGroups structure (all should be the same, but use the last one)
      // This ensures we get the most recent nodeGroups structure with updated names, subject lists, etc.
      let latestSubmissionAnswers: JSONContent | null = null;

      submissions.forEach((submission: any) => {
        const subjectId = submission.subjectId || submission.subject?._id;
        if (subjectId && submission.answers) {
          const answers = submission.answers as JSONContent;
          subjectAnswersMap.set(subjectId, answers);
          // Keep track of the latest submission for nodeGroups structure
          // The last one in the loop will be the most recent
          latestSubmissionAnswers = answers;
        }
      });

      // Function to merge values from submission into editor node
      // This merges ALL nodeGroupValues from the submission to restore complete state
      // CRITICAL: We merge ALL nodeGroupValues from ALL submissions to get the complete state
      const mergeNodeValues = (
        editorNode: JSONContent,
        submissionNode: JSONContent,
        subjectId: string
      ) => {
        if (!editorNode || !submissionNode || !editorNode.attrs) return;

        // Create a new attrs object to ensure TipTap detects the change
        const editorAttrs = { ...editorNode.attrs } as any;
        const submissionAttrs = submissionNode.attrs || {};

        // Update the node's attrs reference
        editorNode.attrs = editorAttrs;

        // Check if node has grouping enabled
        const enableGrouping =
          editorAttrs.enableGrouping === true ||
          editorAttrs.enableGrouping === 'true';

        // Determine the key for nodeGroupValues
        const groupId = subjectToGroupMap.get(subjectId);
        const groupKey = groupId
          ? `group-${groupId}`
          : `ungrouped-${subjectId}`;

        // Initialize nodeGroupValues if it doesn't exist
        if (!editorAttrs.nodeGroupValues) {
          editorAttrs.nodeGroupValues = {};
        }

        // CRITICAL: Always preserve ALL nodeGroupValues from submission (both grouped and ungrouped)
        // Each submission contains the full state with all nodeGroupValues for all subjects
        // This ensures we maintain values for all subjects even when enableGrouping is false
        // IMPORTANT: We preserve ALL keys including:
        // - group-{groupId} for all groups (both global and node-specific)
        // - ungrouped-{subjectId} for all ungrouped subjects
        // - Orphaned keys from deleted/merged groups (preserve for history)
        if (
          submissionAttrs.nodeGroupValues &&
          typeof submissionAttrs.nodeGroupValues === 'object'
        ) {
          // Create a new object to ensure TipTap detects the change
          const mergedNodeGroupValues = { ...editorAttrs.nodeGroupValues };

          // Merge ALL nodeGroupValues from submission into editor (preserve both grouped and ungrouped)
          // This restores the complete state for all subjects
          // We merge ALL keys to ensure nothing is lost, including:
          // - Current group keys (group-{currentGroupId})
          // - Previous group keys (group-{oldGroupId}) - for groups that were deleted/merged
          // - All ungrouped keys (ungrouped-{subjectId})
          // This handles edge cases:
          // - Node groups were deleted but their values should be preserved
          // - Node groups were merged but values from both groups should be preserved
          // - Subjects were moved between groups but old values should be preserved
          Object.keys(submissionAttrs.nodeGroupValues).forEach((key) => {
            const value = submissionAttrs.nodeGroupValues[key];
            // CRITICAL: Preserve ALL values including empty strings, null, undefined, arrays, and objects
            // For complex values (arrays/objects like in RankingField or AddressNode), we copy the reference
            // This is safe because each submission has its own deep copy from JSON serialization
            // This ensures we maintain the complete state for all subjects
            // We always update to ensure we have the latest state from all submissions
            // Even if a group key is orphaned (group was deleted), preserve it
            mergedNodeGroupValues[key] = value;
          });

          // Assign the merged object to ensure TipTap detects the change
          editorAttrs.nodeGroupValues = mergedNodeGroupValues;
        } else {
          // Fallback: If submission doesn't have nodeGroupValues, extract from value and store
          // This handles legacy submissions that don't have nodeGroupValues
          const nodeType = editorNode.type;
          const valueKey = nodeType === 'ranking' ? 'order' : 'value';
          const submissionValue = submissionAttrs[valueKey];

          if (
            submissionValue !== undefined &&
            submissionValue !== null &&
            submissionValue !== ''
          ) {
            // Store in nodeGroupValues with the appropriate key (for both grouped and ungrouped)
            editorAttrs.nodeGroupValues[groupKey] = submissionValue;

            // Also update the main value if grouping is not enabled (for backward compatibility)
            if (!enableGrouping) {
              editorAttrs[valueKey] = submissionValue;
            }
          }
        }

        // CRITICAL: Also preserve nodeGroupApprovalStatus (approval status per subject/group)
        // This restores approval status for each group and ungrouped subject separately
        // IMPORTANT: We merge ALL nodeGroupApprovalStatus from ALL submissions to get complete state
        if (
          submissionAttrs.nodeGroupApprovalStatus &&
          typeof submissionAttrs.nodeGroupApprovalStatus === 'object'
        ) {
          // Initialize nodeGroupApprovalStatus if it doesn't exist
          if (!editorAttrs.nodeGroupApprovalStatus) {
            editorAttrs.nodeGroupApprovalStatus = {};
          }

          // Create a new object to ensure TipTap detects the change
          // CRITICAL: Start with existing editor statuses to preserve any that were already merged
          const mergedNodeGroupApprovalStatus = {
            ...editorAttrs.nodeGroupApprovalStatus,
          };

          // Merge ALL approval statuses from submission into editor
          // This restores approval status for all subjects/groups
          // CRITICAL: We preserve ALL keys including:
          // - group-{groupId} for all groups (both current and orphaned)
          // - ungrouped-{subjectId} for all ungrouped subjects
          // - Orphaned keys from deleted/merged groups (preserve for history)
          Object.keys(submissionAttrs.nodeGroupApprovalStatus).forEach(
            (key) => {
              const status = submissionAttrs.nodeGroupApprovalStatus[key];
              // CRITICAL: Preserve ALL approval statuses (pending, approved, rejected, and null/undefined)
              // We preserve even null/undefined to maintain complete state
              // This ensures we don't lose status information when groups are deleted/merged
              if (status !== undefined) {
                mergedNodeGroupApprovalStatus[key] = status;
              }
            }
          );

          // Assign the merged object to ensure TipTap detects the change
          editorAttrs.nodeGroupApprovalStatus = mergedNodeGroupApprovalStatus;
        } else if (!editorAttrs.nodeGroupApprovalStatus) {
          // Initialize empty object if submission doesn't have it and editor doesn't have it
          // This ensures the structure exists for future updates
          editorAttrs.nodeGroupApprovalStatus = {};
        }

        // Note: nodeGroups structure and enableGrouping are restored in a separate pass
        // (see restoreNodeGroupsStructure function below) to ensure the structure is correct
        // before merging values

        // Also merge other important attributes like approvalStatus, approvers, etc.
        if (submissionAttrs.approvalStatus !== undefined) {
          editorAttrs.approvalStatus = submissionAttrs.approvalStatus;
        }
        if (submissionAttrs.approvers !== undefined) {
          editorAttrs.approvers = submissionAttrs.approvers;
        }
        if (submissionAttrs.rejectionMessage !== undefined) {
          editorAttrs.rejectionMessage = submissionAttrs.rejectionMessage;
        }
      };

      // Helper function to check if a node type supports variants
      const nodeTypeHasVariant = (nodeType: string): boolean => {
        const variantNodeTypes = [
          'shortText',
          'ratingField',
          'singleChoice',
          'multipleChoice',
        ];
        return variantNodeTypes.includes(nodeType);
      };

      // Helper function to get default variant for a node type
      const getDefaultVariant = (nodeType: string): string => {
        const defaults: Record<string, string> = {
          shortText: 'text',
          ratingField: 'stars',
          singleChoice: 'radio',
          multipleChoice: 'checkbox',
        };
        return defaults[nodeType] || '';
      };

      // Helper function to match nodes considering variant for all node types that support it
      // CRITICAL: Nodes are matched by ID (primary, most reliable) from UniqueID extension
      // The UniqueID extension ensures all nodes have unique UUIDs that persist across saves/loads
      // This ensures node IDs are preserved and nodes are correctly matched during merge operations
      const nodesMatch = (node1: JSONContent, node2: JSONContent): boolean => {
        // Must have same type
        if (node1.type !== node2.type) {
          return false;
        }

        const node1Id = (node1.attrs as any)?.id;
        const node2Id = (node2.attrs as any)?.id;
        const node1Name = (node1.attrs as any)?.name;
        const node2Name = (node2.attrs as any)?.name;

        // CRITICAL: If both nodes have IDs (from UniqueID extension), match by ID only
        // IDs are unique UUIDs generated by UniqueID extension and persist across operations
        // This is the most reliable way to match nodes and ensures node IDs are preserved
        if (node1Id && node2Id) {
          if (node1Id !== node2Id) {
            return false; // Different IDs = different nodes
          }
          // IDs match - for variant-supporting node types, also verify variant matches
          // This handles cases where same node type with same ID but different variants exist
          if (node1.type && nodeTypeHasVariant(node1.type)) {
            const defaultVariant = getDefaultVariant(node1.type);
            const node1Variant =
              (node1.attrs as any)?.variant || defaultVariant;
            const node2Variant =
              (node2.attrs as any)?.variant || defaultVariant;
            return node1Variant === node2Variant;
          }
          return true; // IDs match and same type (non-variant type)
        }

        // Fallback: if one or both don't have IDs, match by name + type + variant
        // This handles edge cases where IDs might be missing (shouldn't happen with UniqueID extension)
        // Log warning if IDs are missing to help debug issues
        if (!node1Id || !node2Id) {
          console.warn('[SubmitQueue] Node missing ID during merge:', {
            node1: { type: node1.type, id: node1Id, name: node1Name },
            node2: { type: node2.type, id: node2Id, name: node2Name },
          });
        }
        
        const name1 = node1Id || node1Name;
        const name2 = node2Id || node2Name;

        if (!name1 || !name2 || name1 !== name2) {
          return false;
        }

        // For variant-supporting node types, also match by variant to distinguish between fields with same name but different variants
        if (node1.type && nodeTypeHasVariant(node1.type)) {
          const defaultVariant = getDefaultVariant(node1.type);
          const node1Variant = (node1.attrs as any)?.variant || defaultVariant;
          const node2Variant = (node2.attrs as any)?.variant || defaultVariant;
          return node1Variant === node2Variant;
        }

        return true;
      };

      // Function to recursively merge submission answers into editor schema
      const mergeAnswers = (
        editorNodes: JSONContent[],
        submissionNodes: JSONContent[],
        subjectId: string
      ) => {
        if (!editorNodes || !submissionNodes) return;

        editorNodes.forEach((editorNode) => {
          // Find matching submission node by ID, type, and variant (for variant-supporting node types)
          const submissionNode = submissionNodes.find((sn) =>
            nodesMatch(editorNode, sn)
          );

          if (submissionNode) {
            mergeNodeValues(editorNode, submissionNode, subjectId);
          }

          // Recursively process children
          if (
            editorNode.content &&
            Array.isArray(editorNode.content) &&
            submissionNode?.content &&
            Array.isArray(submissionNode.content)
          ) {
            mergeAnswers(editorNode.content, submissionNode.content, subjectId);
          }
        });
      };

      // First, restore nodeGroups structure from the latest submission
      // This ensures the updated group structure (with removed/added subjects) is restored
      if (latestSubmissionAnswers && currentDoc) {
        const latest = latestSubmissionAnswers as any;
        const latestContent =
          latest?.content && Array.isArray(latest.content)
            ? latest.content
            : [];
        const currentDocAny = currentDoc as any;
        const currentContent =
          currentDocAny?.content && Array.isArray(currentDocAny.content)
            ? currentDocAny.content
            : [];

        // #region agent log
        fetch(
          'http://127.0.0.1:7242/ingest/ab9e3d5c-bb82-40f9-8c4c-9b25ff821572',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'SubmitQueue.tsx:652',
              message: 'Starting nodeGroups restoration',
              data: {
                hasLatestContent: latestContent.length > 0,
                hasCurrentContent: currentContent.length > 0,
                submissionCount: submissions.length,
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'A',
            }),
          }
        ).catch(() => {});
        // #endregion

        if (latestContent.length > 0 && currentContent.length > 0) {
          const restoreNodeGroupsStructure = (
            editorNodes: JSONContent[],
            submissionNodes: JSONContent[]
          ) => {
            if (!editorNodes || !submissionNodes) return;

            editorNodes.forEach((editorNode) => {
              // Find matching submission node by ID, type, and variant (for short text fields)
              const submissionNode = submissionNodes.find((sn) =>
                nodesMatch(editorNode, sn)
              );

              if (submissionNode) {
                // Create a new attrs object to ensure TipTap detects the change
                const editorAttrs = { ...editorNode.attrs } as any;
                const submissionAttrs = submissionNode.attrs || {};

                // #region agent log
                const nodeId = editorAttrs.id || editorAttrs.name;
                const hadNodeGroups =
                  !!editorAttrs.nodeGroups &&
                  Array.isArray(editorAttrs.nodeGroups);
                const submissionHasNodeGroups =
                  !!submissionAttrs.nodeGroups &&
                  Array.isArray(submissionAttrs.nodeGroups);
                // #endregion

                // Restore nodeGroups structure and enableGrouping from the latest submission
                // CRITICAL: This includes updated group names, subject lists, etc.
                if (submissionAttrs.enableGrouping !== undefined) {
                  editorAttrs.enableGrouping = submissionAttrs.enableGrouping;
                }
                if (
                  submissionAttrs.nodeGroups !== undefined &&
                  Array.isArray(submissionAttrs.nodeGroups)
                ) {
                  // Restore the updated nodeGroups structure including:
                  // - Updated group names
                  // - Updated subject lists (added/removed subjects)
                  // - New groups
                  // - Deleted groups (they won't be in the array)
                  // Deep copy to ensure we have the complete structure
                  editorAttrs.nodeGroups = JSON.parse(
                    JSON.stringify(submissionAttrs.nodeGroups)
                  );

                  // #region agent log
                  fetch(
                    'http://127.0.0.1:7242/ingest/ab9e3d5c-bb82-40f9-8c4c-9b25ff821572',
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        location: 'SubmitQueue.tsx:675',
                        message: 'Restored nodeGroups for node',
                        data: {
                          nodeId,
                          nodeType: editorNode.type,
                          hadNodeGroups,
                          submissionHasNodeGroups,
                          restoredGroupCount: editorAttrs.nodeGroups.length,
                          enableGrouping: editorAttrs.enableGrouping,
                        },
                        timestamp: Date.now(),
                        sessionId: 'debug-session',
                        runId: 'run1',
                        hypothesisId: 'A',
                      }),
                    }
                  ).catch(() => {});
                  // #endregion
                } else {
                  // #region agent log
                  fetch(
                    'http://127.0.0.1:7242/ingest/ab9e3d5c-bb82-40f9-8c4c-9b25ff821572',
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        location: 'SubmitQueue.tsx:675',
                        message: 'No nodeGroups in submission for node',
                        data: {
                          nodeId,
                          nodeType: editorNode.type,
                          hadNodeGroups,
                          submissionHasNodeGroups,
                          submissionEnableGrouping:
                            submissionAttrs.enableGrouping,
                        },
                        timestamp: Date.now(),
                        sessionId: 'debug-session',
                        runId: 'run1',
                        hypothesisId: 'C',
                      }),
                    }
                  ).catch(() => {});
                  // #endregion
                }

                // Update the node's attrs reference to ensure TipTap detects the change
                editorNode.attrs = editorAttrs;
              }

              // Recursively process children
              if (
                editorNode.content &&
                Array.isArray(editorNode.content) &&
                submissionNode?.content &&
                Array.isArray(submissionNode.content)
              ) {
                restoreNodeGroupsStructure(
                  editorNode.content,
                  submissionNode.content
                );
              }
            });
          };

          restoreNodeGroupsStructure(currentContent, latestContent);
        }
      }

      // Then merge all submissions to restore nodeGroupValues
      // CRITICAL: Merge all submissions to accumulate ALL nodeGroupValues from all subjects
      // Each merge creates new object references for attrs and nodeGroupValues,
      // ensuring TipTap detects the changes and React components re-render
      subjectAnswersMap.forEach((submissionAnswers, subjectId) => {
        if (submissionAnswers.content && currentDoc.content) {
          mergeAnswers(
            currentDoc.content,
            submissionAnswers.content,
            subjectId
          );
        }
      });

      // Update the editor with merged content
      // The mergeNodeValues function creates new object references for attrs,
      // so TipTap will properly detect and apply all changes including nodeGroupValues

      // #region agent log
      const nodesWithGroupsBeforeSet = (() => {
        const walk = (nodes: JSONContent[]): number => {
          let count = 0;
          nodes.forEach((node) => {
            const attrs = node.attrs as any;
            if (
              attrs?.nodeGroups &&
              Array.isArray(attrs.nodeGroups) &&
              attrs.nodeGroups.length > 0
            ) {
              count++;
            }
            if (node.content && Array.isArray(node.content)) {
              count += walk(node.content);
            }
          });
          return count;
        };
        return currentDoc.content && Array.isArray(currentDoc.content)
          ? walk(currentDoc.content)
          : 0;
      })();
      fetch(
        'http://127.0.0.1:7242/ingest/ab9e3d5c-bb82-40f9-8c4c-9b25ff821572',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'SubmitQueue.tsx:710',
            message: 'Before setJSON - nodes with groups',
            data: { nodesWithGroups: nodesWithGroupsBeforeSet },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'E',
          }),
        }
      ).catch(() => {});
      // #endregion

      tiptapInstance.setJSON(currentDoc);
      setIsDirty(false); // Reset dirty flag after loading saved data

      // Update last saved content ref to match the loaded state
      // This prevents auto-save from triggering immediately after loading
      const mergedContent = tiptapInstance.getJSON();

      // #region agent log
      const nodesWithGroupsAfterSet = (() => {
        const walk = (nodes: JSONContent[]): number => {
          let count = 0;
          nodes.forEach((node) => {
            const attrs = node.attrs as any;
            if (
              attrs?.nodeGroups &&
              Array.isArray(attrs.nodeGroups) &&
              attrs.nodeGroups.length > 0
            ) {
              count++;
            }
            if (node.content && Array.isArray(node.content)) {
              count += walk(node.content);
            }
          });
          return count;
        };
        return mergedContent?.content && Array.isArray(mergedContent.content)
          ? walk(mergedContent.content)
          : 0;
      })();
      fetch(
        'http://127.0.0.1:7242/ingest/ab9e3d5c-bb82-40f9-8c4c-9b25ff821572',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'SubmitQueue.tsx:720',
            message: 'After setJSON - nodes with groups',
            data: {
              nodesWithGroups: nodesWithGroupsAfterSet,
              preserved: nodesWithGroupsBeforeSet === nodesWithGroupsAfterSet,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'E',
          }),
        }
      ).catch(() => {});
      // #endregion

      if (mergedContent) {
        lastSavedContentRef.current = JSON.stringify(mergedContent);
      }
    },
    []
  );

  // Load submissions into editor only when selected assignee's submission has started
  // When submission_not_started we do not merge so the form shows empty for that assignee
  useEffect(() => {
    if (
      submissionStatus === 'submission_not_started' ||
      submissionStatus === undefined
    ) {
      return;
    }
    if (
      tiptap.editor &&
      queue?.submissions &&
      queue?.submitMeta &&
      schema &&
      !hasLoadedSubmissionsRef.current
    ) {
      const hasSubmissions =
        Array.isArray(queue.submissions) && queue.submissions.length > 0;
      if (hasSubmissions) {
        mergeSubmissionsIntoEditor(tiptap, queue.submissions, queue.submitMeta);
        hasLoadedSubmissionsRef.current = true;
      }
    }
  }, [
    tiptap.editor,
    queue?.submissions,
    queue?.submitMeta,
    schema,
    submissionStatus,
    mergeSubmissionsIntoEditor,
  ]);

  // Reset the loaded flag and last saved content when queue ID, selected assignee, or submission status changes
  // So that when user switches assignee we show the correct assignee's state (or empty when not started)
  useEffect(() => {
    hasLoadedSubmissionsRef.current = false;
    lastSavedContentRef.current = null;
    initializationCompleteRef.current = false;
  }, [id, selectedAssigneeId, submissionStatus]);

  /* ------------------- NAVIGATION BLOCKING ------------------- */
  // Handle browser navigation (refresh, close tab, etc.)
  useEffect(() => {
    // Only block navigation if there are unsaved changes and submission has started
    const shouldBlock = isDirty && isAllLocked;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (shouldBlock) {
        // Modern browsers ignore custom messages, but we still need to set returnValue
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
        return ''; // Some browsers require return value
      }
    };

    if (shouldBlock) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, isAllLocked]);

  // Handle in-app navigation (React Router and link clicks)
  // Intercept navigation attempts when there are unsaved changes
  useEffect(() => {
    // Only block navigation if there are unsaved changes and submission has started
    const shouldBlock = isDirty && isAllLocked;

    if (!shouldBlock) {
      // If no blocking needed, allow any pending navigation
      if (pendingNavigation) {
        pendingNavigation();
        setPendingNavigation(null);
      }
      return;
    }

    // Intercept React Router navigation by wrapping the navigate function
    // We'll intercept link clicks and programmatic navigation
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement;

      if (link && link.href) {
        const href = link.getAttribute('href');
        const currentPath = window.location.pathname;

        // Only intercept if navigating to a different route
        if (
          href &&
          !href.startsWith('#') &&
          !href.startsWith('javascript:') &&
          !href.startsWith('mailto:') &&
          !href.startsWith('tel:')
        ) {
          try {
            const url = new URL(href, window.location.origin);
            // If it's a different path, show confirmation
            if (url.pathname !== currentPath) {
              e.preventDefault();
              e.stopPropagation();

              setPendingNavigation(() => () => {
                window.location.href = href;
              });
              setShowNavigationConfirm(true);
            }
          } catch {
            // If URL parsing fails, allow default behavior
          }
        }
      }
    };

    document.addEventListener('click', handleLinkClick, true);

    return () => {
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [isDirty, isAllLocked, pendingNavigation]);

  // Handle navigation confirmation
  const handleNavigationConfirm = useCallback(
    (confirmed: boolean) => {
      setShowNavigationConfirm(false);
      if (confirmed && pendingNavigation) {
        pendingNavigation();
      }
      setPendingNavigation(null);
    },
    [pendingNavigation]
  );

  // Wrap navigate function to check for unsaved changes
  const safeNavigate = useCallback(
    (to: string | number, options?: any) => {
      if (isDirty && isAllLocked) {
        setPendingNavigation(() => () => {
          navigate(to as any, options);
        });
        setShowNavigationConfirm(true);
      } else {
        navigate(to as any, options);
      }
    },
    [isDirty, isAllLocked, navigate]
  );

  // Initialize last saved content when schema is first loaded (if no submissions exist)
  // This happens after the schema is set but before submissions are loaded
  useEffect(() => {
    if (
      tiptap.editor &&
      schema &&
      !hasLoadedSubmissionsRef.current &&
      (!queue?.submissions || queue.submissions.length === 0) &&
      lastSavedContentRef.current === null
    ) {
      // Set initial content as the "saved" state
      // Use a small delay to ensure editor is fully initialized
      const timeoutId = setTimeout(() => {
        const initialContent = tiptap.getJSON();
        if (initialContent) {
          lastSavedContentRef.current = JSON.stringify(initialContent);
        }
        // Mark initialization as complete when schema is loaded and there are no submissions
        initializationCompleteRef.current = true;
        setIsInitializationComplete(true);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [tiptap.editor, schema, queue?.submissions]);

  // Mark initialization as complete after submissions are loaded
  useEffect(() => {
    if (
      tiptap.editor &&
      schema &&
      hasLoadedSubmissionsRef.current &&
      !initializationCompleteRef.current
    ) {
      // Mark initialization as complete after submissions are merged
      initializationCompleteRef.current = true;
      setIsInitializationComplete(true);
    }
  }, [tiptap.editor, schema]);

  /* ------------------- SAVE META ------------------- */
  // const saveMeta = async (values: FormValues) => {
  //   try {
  //     await updateMeta({ id: id!, ...values }).unwrap();
  //     message.success('Submission saved successfully');
  //   } catch (err: any) {
  //     message.error(err?.data?.message ?? 'Failed to save queue meta');
  //   }
  // };

  /* ------------------- SAVE DRAFT ------------------- */
  const handleSubmitQueue = async (values: FormValues) => {
    console.log('values', values);
    // console.log('subjectGroups', subjectGroups);
    if (!tiptap.editor) return;

    // Check if user can submit (selected assignee must match logged in user's selected profile)
    if (!canSubmit) {
      message.error('You can only submit for your assigned queue. Please select the correct assignee.');
      return;
    }

    const json = tiptap.getJSON();

    if (!json) {
      message.error('Cannot submit empty form');
      return;
    }

    const cleanedSchema = normalizeEditorContent(json);

    // Block submission if required custom fields are not satisfied
    // In submit mode, validate all subjects/groups individually
    const requiredCheck = validateRequiredFields(
      cleanedSchema,
      subjectGroups,
      availableSubjects,
      editorMode === 'submit'
    );
    if (!requiredCheck.ok) {
      message.error(requiredCheck.message || 'Validation failed.');
      // Mark editor as submitted so nodes can show minimal required errors
      if (tiptap.editor) {
        try {
          const storage = tiptap.editor.storage as any;
          storage.formBuilder = storage.formBuilder ?? {};
          storage.formBuilder.submitted = true;
          tiptap.editor.view.dispatch(tiptap.editor.state.tr);
        } catch {
          // no-op
        }
      }
      // Do not auto-focus inputs; only scroll the invalid block into view
      // Fallback: scroll DOM element if data attributes exist
      if (requiredCheck.target?.type) {
        const selector = requiredCheck.target.name
          ? `[data-node-type="${requiredCheck.target.type}"][data-node-name="${requiredCheck.target.name}"]`
          : `[data-node-type="${requiredCheck.target.type}"]`;
        const el = document.querySelector(selector) as HTMLElement | null;
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    // Validate question-level approvals
    // In submit mode, validate all subjects/groups individually
    const approvalCheck = validateQuestionApprovals(
      cleanedSchema,
      subjectGroups,
      availableSubjects,
      editorMode === 'submit'
    );
    if (!approvalCheck.ok) {
      // Show detailed error message
      message.error(
        approvalCheck.message || 'Question approval validation failed.'
      );
      
      // Show detailed information about pending/rejected questions
      if (
        approvalCheck.pendingQuestions &&
        approvalCheck.pendingQuestions.length > 0
      ) {
        console.log('Pending approvals:', approvalCheck.pendingQuestions);
        
        // Group by question name for better error display
        const pendingByQuestion = approvalCheck.pendingQuestions.reduce((acc, q) => {
          const key = q.name || q.type;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(q);
          return acc;
        }, {} as Record<string, typeof approvalCheck.pendingQuestions>);
        
        // Show detailed message in console and optionally in UI
        const pendingDetails = Object.entries(pendingByQuestion).map(([name, questions]) => {
          const subjects = questions
            .map(q => q.groupName ? `${q.subjectName} (${q.groupName})` : q.subjectName)
            .join(', ');
          return `  - ${name}: ${subjects}`;
        }).join('\n');
        
        console.log('Pending approval details:\n' + pendingDetails);
        
        // Show a more detailed error message
        if (approvalCheck.pendingQuestions.length > 0) {
          const firstPending = approvalCheck.pendingQuestions[0];
          const additionalCount = approvalCheck.pendingQuestions.length - 1;
          let detailMessage = `"${firstPending.name || firstPending.type}"`;
          if (firstPending.groupName) {
            detailMessage += ` for ${firstPending.subjectName} (${firstPending.groupName})`;
          } else {
            detailMessage += ` for ${firstPending.subjectName}`;
          }
          if (additionalCount > 0) {
            detailMessage += ` and ${additionalCount} more`;
          }
          message.warning(`Pending approvals: ${detailMessage}. Check console for full details.`, 8);
        }
      }
      
      if (
        approvalCheck.rejectedQuestions &&
        approvalCheck.rejectedQuestions.length > 0
      ) {
        console.log('Rejected questions:', approvalCheck.rejectedQuestions);
        
        // Group by question name for better error display
        const rejectedByQuestion = approvalCheck.rejectedQuestions.reduce((acc, q) => {
          const key = q.name || q.type;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(q);
          return acc;
        }, {} as Record<string, typeof approvalCheck.rejectedQuestions>);
        
        // Show detailed message in console
        const rejectedDetails = Object.entries(rejectedByQuestion).map(([name, questions]) => {
          const subjects = questions
            .map(q => {
              let info = q.groupName ? `${q.subjectName} (${q.groupName})` : q.subjectName;
              if (q.rejectionMessage) {
                info += `: ${q.rejectionMessage}`;
              }
              return info;
            })
            .join(', ');
          return `  - ${name}: ${subjects}`;
        }).join('\n');
        
        console.log('Rejected question details:\n' + rejectedDetails);
        
        // Show a more detailed error message
        if (approvalCheck.rejectedQuestions.length > 0) {
          const firstRejected = approvalCheck.rejectedQuestions[0];
          const additionalCount = approvalCheck.rejectedQuestions.length - 1;
          let detailMessage = `"${firstRejected.name || firstRejected.type}"`;
          if (firstRejected.groupName) {
            detailMessage += ` for ${firstRejected.subjectName} (${firstRejected.groupName})`;
          } else {
            detailMessage += ` for ${firstRejected.subjectName}`;
          }
          if (firstRejected.rejectionMessage) {
            detailMessage += ` - ${firstRejected.rejectionMessage}`;
          }
          if (additionalCount > 0) {
            detailMessage += ` and ${additionalCount} more`;
          }
          message.warning(`Rejected questions: ${detailMessage}. Check console for full details.`, 8);
        }
      }
      
      return;
    }

    // Get selected subject IDs from groups and ungrouped selections
    // Check if submission has been started (all locked)
    if (!isAllLocked) {
      message.warning(
        'Please start submission first to lock groups and subjects before submitting.'
      );
      return;
    }

    // Get all subject IDs (from all groups and ungrouped subjects when all is locked)
    const allSubjectIds: string[] = [];
    // Add all subjects from all groups
    subjectGroups.forEach((group) => {
      allSubjectIds.push(...group.subjectIds);
    });
    // Add all ungrouped subjects
    availableSubjects.forEach((subject) => {
      allSubjectIds.push(subject.value);
    });
    // Remove duplicates
    const uniqueSubjectIds = Array.from(new Set(allSubjectIds));

    if (uniqueSubjectIds.length === 0) {
      message.error('No subjects available to submit');
      return;
    }

    // Helper function to extract approval data from schema for a specific subject
    const extractApprovalDataForSubject = (
      schema: JSONContent,
      subjectId: string
    ): Array<{
      questionId: string;
      questionName: string;
      questionType: string;
      questionLabel?: string;
      approvalRequired: boolean;
      approvalStatus?: 'pending' | 'approved' | 'rejected';
      approvers?: string[];
      rejectionMessage?: string;
      questionValue?: any;
    }> => {
      const approvalData: Array<{
        questionId: string;
        questionName: string;
        questionType: string;
        questionLabel?: string;
        approvalRequired: boolean;
        approvalStatus?: 'pending' | 'approved' | 'rejected';
        approvers?: string[];
        rejectionMessage?: string;
        questionValue?: any;
      }> = [];

      const walk = (node: JSONContent) => {
        if (!node) return;

        const attrs = node.attrs || {};
        const nodeType = node.type || 'unknown';
        const nodeId = (attrs.id || attrs.name || '') as string;

        // Check if this node requires approval
        if (
          attrs.approvalRequired === true ||
          attrs.approvalRequired === 'true'
        ) {
          // Get the value for this subject
          let questionValue: any = attrs.value;

          // Check if subject is in a group (used for both value and approval status)
          const globalGroup = subjectGroups.find((g) =>
            g.subjectIds.includes(subjectId)
          );

          // If grouping is enabled, try to get subject-specific value
          if (
            attrs.enableGrouping === true ||
            attrs.enableGrouping === 'true'
          ) {
            const nodeGroupValues = attrs.nodeGroupValues || {};

            if (globalGroup) {
              const groupKey = `group-${globalGroup.id}`;
              if (nodeGroupValues[groupKey] !== undefined) {
                questionValue = nodeGroupValues[groupKey];
              }
            } else {
              // Check if subject is ungrouped
              const ungroupedKey = `ungrouped-${subjectId}`;
              if (nodeGroupValues[ungroupedKey] !== undefined) {
                questionValue = nodeGroupValues[ungroupedKey];
              }
            }
          }

          // Get approval status for this specific subject/group from nodeGroupApprovalStatus
          const nodeGroupApprovalStatus = attrs.nodeGroupApprovalStatus || {};
          const enableGrouping = attrs.enableGrouping === true || attrs.enableGrouping === 'true';
          
          // Helper function to create status keys with proper prefix handling (matches QuestionApprovalDrawer)
          const createStatusKey = (type: 'group' | 'ungrouped', id: string): string => {
            if (!id) return '';
            const prefix = type === 'group' ? 'group-' : 'ungrouped-';
            // If the ID already starts with the prefix, return it as-is
            if (id.startsWith(prefix)) {
              return id;
            }
            // Otherwise, add the prefix
            return `${prefix}${id}`;
          };
          
          // Determine the status key for this subject/group
          let statusKey: string;
          
          if (enableGrouping && attrs.nodeGroups && Array.isArray(attrs.nodeGroups)) {
            // Node has node-based grouping
            const nodeGroups = attrs.nodeGroups as Array<{ id: string; name: string; subjectIds: string[] }>;
            const nodeGroup = nodeGroups.find((g) => g.subjectIds.includes(subjectId));
            
            if (nodeGroup) {
              statusKey = createStatusKey('group', nodeGroup.id);
            } else {
              statusKey = createStatusKey('ungrouped', subjectId);
            }
          } else if (globalGroup) {
            // Use global group key
            statusKey = createStatusKey('group', globalGroup.id);
          } else {
            // Ungrouped subject
            statusKey = createStatusKey('ungrouped', subjectId);
          }
          
          // Get approval status for this specific subject/group
          const approvalStatusForSubject: 'pending' | 'approved' | 'rejected' | undefined = nodeGroupApprovalStatus[statusKey];
          
          // Get rejection message (currently stored globally, but could be per-subject in future)
          const rejectionMessageForSubject: string | undefined = attrs.rejectionMessage;

          const questionName = (attrs.name ||
            attrs.label ||
            'Unknown') as string;
          approvalData.push({
            questionId: nodeId,
            questionName,
            questionType: nodeType,
            questionLabel: attrs.label,
            approvalRequired: true,
            approvalStatus: approvalStatusForSubject,
            approvers: (attrs.approvers || []) as string[],
            rejectionMessage: rejectionMessageForSubject,
            questionValue,
          });
        }

        // Recurse through children
        if (Array.isArray(node.content)) {
          node.content.forEach((child) => walk(child));
        }
      };

      if (schema.content) {
        schema.content.forEach((node) => walk(node));
      }

      return approvalData;
    };

    try {
      // Prepare data array: one object per subject with filled form and approval data
      const submissionDataArray = uniqueSubjectIds.map((subjectId) => {
        // Find subject info
        const globalGroup = subjectGroups.find((g) =>
          g.subjectIds.includes(subjectId)
        );
        const subject = subjectsOptions.find((opt) => opt.value === subjectId);

        // Build filled form copy for this subject
        const filledFormCopy = buildSubjectAnswers(
          cleanedSchema,
          subjectId,
          subjectGroups,
          availableSubjects
        );

        // Normalize the form while preserving node IDs
        const normalizedForm = normalizeEditorContent(filledFormCopy);

        // Extract approval request data for this subject
        const approvalRequests = extractApprovalDataForSubject(
          cleanedSchema,
          subjectId
        );

        return {
          subjectId,
          subjectName: subject?.label || 'Unknown',
          groupId: globalGroup?.id || null,
          groupName: globalGroup?.name || null,
          type: (globalGroup ? 'grouped' : 'ungrouped') as
            | 'grouped'
            | 'ungrouped',
          filledFormCopy: normalizedForm,
          approvalRequests,
          timestamp: new Date().toISOString(),
        };
      });

      // Log the prepared submission data
      console.log('=== SUBMISSION DATA ARRAY ===');
      console.log('Total Subjects:', submissionDataArray.length);
      console.log(
        'Submission Data Array:',
        JSON.stringify(submissionDataArray, null, 2)
      );

      // Log complete JSON for each subject separately
      submissionDataArray.forEach((data, index) => {
        console.log(`\n${'='.repeat(80)}`);
        console.log(
          `SUBJECT ${index + 1}: ${data.subjectName} (${data.subjectId})`
        );
        console.log(`${'='.repeat(80)}`);
        console.log('Group Info:', {
          groupId: data.groupId,
          groupName: data.groupName,
          type: data.type,
        });
        console.log('Approval Requests Count:', data.approvalRequests.length);
        if (data.approvalRequests.length > 0) {
          console.log(
            'Approval Requests:',
            JSON.stringify(data.approvalRequests, null, 2)
          );
        }
        console.log('\n--- COMPLETE FORM COPY JSON ---');
        console.log(JSON.stringify(data.filledFormCopy, null, 2));
        console.log(`\n--- END SUBJECT ${index + 1} ---\n`);
      });

      // Submit using batch structure with submissions array (same structure as autosave)
      message.loading(
        `Submitting forms for ${submissionDataArray.length} subject(s)...`,
        0
      );

      // Build meta object with global grouping and ungrouped locked data
      const submitMeta = {
        ...queue.submitMeta,
        globalGroups: subjectGroups.map((group) => ({
          id: group.id,
          name: group.name,
          subjectIds: group.subjectIds,
          locked: group.locked || isAllLocked,
        })),
        ungroupedSubjects: availableSubjects.map((subject) => ({
          id: subject.value,
          name: subject.label,
          locked: isAllLocked,
        })),
        isAllLocked,
      };

      // Build submissions array with subject-specific answers
      const submitSubmissions = submissionDataArray.map((data) => ({
        subjectId: data.subjectId,
        answers: data.filledFormCopy,
      }));

      try {
        // Submit using batch structure with submissions array
        await submitQueue({
          assignmentId: id!,
          data: {
            _id: id,
            assigneeId: selectedAssigneeId,
            targetStatus: 'submission_complete',
            validate: true,
            meta: submitMeta,
            submissions: submitSubmissions,
          },
        }).unwrap();
        
        // Close loading message
        message.destroy();
        
        setIsDirty(false);
        message.success(
          `Successfully submitted forms for ${submissionDataArray.length} subject(s).`
        );
        
        // Refetch queue data to update UI
        await refetchQueue();
        
        // Navigate to queues list or submissions page
        // Optionally navigate to submissions page for this queue
        // navigate(`/forms/queues/${id}/submissions`);
      } catch (submitError: unknown) {
        // Close loading message
        message.destroy();
        
        // Handle submission errors
        const safeErr =
          typeof submitError === 'object' && submitError !== null
            ? (submitError as { data?: { message?: string }; message?: string })
            : undefined;

        const errMsg =
          safeErr?.data?.message ??
          safeErr?.message ??
          'Failed to submit one or more forms. Please check the console for details.';

        message.error(errMsg);
        
        // Log detailed error information
        console.error('Submission error:', submitError);
        
        // Re-throw to be caught by outer catch block
        throw submitError;
      }
    } catch (err: unknown) {
      // Narrow the unknown error to a safe shape instead of using `any`
      const safeErr =
        typeof err === 'object' && err !== null
          ? (err as { data?: { message?: string }; message?: string })
          : undefined;

      const errMsg =
        safeErr?.data?.message ??
        safeErr?.message ??
        'Failed to prepare submission data';

      message.error(errMsg);
    }
  };

  /* ------------------- AUTO SAVE ------------------- */

  /* ------------------- PUBLISH ------------------- */
  // const saveAllAndLock = async () => {
  //   try {
  //     const values = await form.validateFields();
  //     await saveMeta(values);
  //     await saveDraft();

  //     if (versionId) {
  //       await lockVersion(versionId).unwrap();
  //       message.success('Template locked and published');
  //     }
  //   } catch (err: any) {
  //     message.error(err?.data?.message ?? 'Failed to publish queue');
  //   }
  // };

  /* ------------------- PREVIEW ------------------- */
  // const handlePreview = () => {
  //   const json = tiptap.getJSON();
  //   message.info({
  //     content: (
  //       <pre style={{ maxHeight: 300, overflow: 'auto', margin: 0 }}>
  //         {json ? JSON.stringify(json, null, 2) : 'Empty'}
  //       </pre>
  //     ),
  //     duration: 6,
  //   });
  // };

  const { subjects, subjectMode } = queue;

  const subjectsOptions = subjects.map((profile) => ({
    label: (profile.user as User)?.name,
    value: profile._id,
  }));

  // Get all subject IDs that are already in groups (for uniqueness check)
  const usedSubjectIds = useMemo(() => {
    const used = new Set<string>();
    subjectGroups.forEach((group) => {
      group.subjectIds.forEach((id) => used.add(id));
    });
    return used;
  }, [subjectGroups]);

  // Get available subjects (not in any group)
  const availableSubjects = useMemo(() => {
    return subjectsOptions.filter((opt) => !usedSubjectIds.has(opt.value));
  }, [subjectsOptions, usedSubjectIds]);

  /* ------------------- AUTO SAVE ------------------- */
  const handleAutoSave = useCallback(async () => {
    // Align with page access: same users who can submit may auto-save (not profile::isassignee alone).
    if (!tiptap.editor || !id || isAutoSavingRef.current || !canSubmit) return;

    // Don't auto-save if submission is complete
    if (submissionStatus === 'submission_complete') return;

    const json = tiptap.getJSON();
    if (!json) return;

    // Only auto-save if submission has been started (all locked)
    if (!isAllLocked) return;

    // Get current content as JSON string for comparison
    const currentContentString = JSON.stringify(json);

    // Skip if content hasn't changed since last save
    if (currentContentString === lastSavedContentRef.current) {
      return;
    }

    try {
      isAutoSavingRef.current = true;
      const cleanedSchema = normalizeEditorContent(json);

      console.log('cleanedSchema', cleanedSchema);

      // Get all subject IDs (from all groups and ungrouped subjects)
      const allSubjectIds: string[] = [];
      // Add all subjects from all groups
      subjectGroups.forEach((group) => {
        allSubjectIds.push(...group.subjectIds);
      });
      // Add all ungrouped subjects
      availableSubjects.forEach((subject) => {
        allSubjectIds.push(subject.value);
      });
      // Remove duplicates
      const uniqueSubjectIds = Array.from(new Set(allSubjectIds));

      if (uniqueSubjectIds.length === 0) {
        isAutoSavingRef.current = false;
        return;
      }

      // Build submissions array with copy of each subject (same structure as final submit)
      // Use buildSubjectAnswers to create subject-specific copies, matching final submit structure
      const submissions = uniqueSubjectIds.map((subjectId) => {
        // Build filled form copy for this subject using buildSubjectAnswers (same as final submit)
        // buildSubjectAnswers creates a deep copy and preserves nodeGroupValues in the schema
        // It only sets the main 'value' attribute from nodeGroupValues for the specific subject
        const filledFormCopy = buildSubjectAnswers(
          cleanedSchema,
          subjectId,
          subjectGroups,
          availableSubjects
        );

        // CRITICAL: buildSubjectAnswers already preserves nodeGroupValues in the deep copy,
        // but we need to ensure nodeGroupApprovalStatus is also preserved from the original schema
        // Merge nodeGroupApprovalStatus from original schema to ensure approval statuses are preserved
        const mergeApprovalStatus = (
          sourceNode: JSONContent,
          targetNode: JSONContent
        ): void => {
          if (!sourceNode || !targetNode || !sourceNode.attrs || !targetNode.attrs) return;

          const sourceAttrs = sourceNode.attrs as any;
          const targetAttrs = targetNode.attrs as any;

          // Match nodes by ID (most reliable) or type + name
          const sourceId = sourceAttrs.id;
          const targetId = targetAttrs.id;
          const sourceName = sourceAttrs.name;
          const targetName = targetAttrs.name;

          const nodesMatch = 
            (sourceId && targetId && sourceId === targetId) ||
            (sourceNode.type === targetNode.type && sourceName && targetName && sourceName === targetName);

          if (nodesMatch && sourceAttrs.nodeGroupApprovalStatus) {
            // Preserve nodeGroupApprovalStatus from source
            if (!targetAttrs.nodeGroupApprovalStatus) {
              targetAttrs.nodeGroupApprovalStatus = {};
            }
            Object.keys(sourceAttrs.nodeGroupApprovalStatus).forEach((key) => {
              const status = sourceAttrs.nodeGroupApprovalStatus[key];
              if (status !== undefined) {
                targetAttrs.nodeGroupApprovalStatus[key] = status;
              }
            });
          }

          // Recursively process children
          if (Array.isArray(sourceNode.content) && Array.isArray(targetNode.content)) {
            sourceNode.content.forEach((sourceChild) => {
              const targetChild = targetNode.content?.find((tc: JSONContent) => {
                const tcAttrs = tc.attrs as any;
                const scAttrs = sourceChild.attrs as any;
                return (
                  (scAttrs?.id && tcAttrs?.id && scAttrs.id === tcAttrs.id) ||
                  (sourceChild.type === tc.type && scAttrs?.name && tcAttrs?.name && scAttrs.name === tcAttrs.name)
                );
              });
              if (targetChild) {
                mergeApprovalStatus(sourceChild, targetChild);
              }
            });
          }
        };

        // Merge approval statuses from original schema
        mergeApprovalStatus(cleanedSchema, filledFormCopy);


        // Normalize the form while preserving node IDs and ALL nodeGroupValues
        const normalizedForm = normalizeEditorContent(filledFormCopy);

        return {
          subjectId,
          answers: normalizedForm,
        };
      });

      // Build meta object with global grouping and ungrouped locked data
      const meta = {
        ...queue.submitMeta,
        globalGroups: subjectGroups.map((group) => ({
          id: group.id,
          name: group.name,
          subjectIds: group.subjectIds,
          locked: group.locked || isAllLocked,
        })),
        ungroupedSubjects: availableSubjects.map((subject) => ({
          id: subject.value,
          name: subject.label,
          locked: isAllLocked,
        })),
        isAllLocked,
      };

      // Submit using batch structure with submissions array (same structure as final submit)
      // Each submission in the array contains subject-specific answers built with buildSubjectAnswers
      const body = {
        assignmentId: id,
        data: {
          _id: id,
          assigneeId: selectedAssigneeId,
          targetStatus: 'submission_in_progress',
          validate: false,
          meta,
          submissions, // Array of { subjectId, answers } - same structure as final submit
        },
      };

      // Call auto-save API with batch structure
      await submitQueue(body as SubmitQueuePayload).unwrap();

      // Update last saved content after successful save
      lastSavedContentRef.current = currentContentString;
      setIsDirty(false);
    } catch (err: unknown) {
      // Silently fail for auto-save - don't show error messages to avoid interrupting user
      // But log for debugging
      console.error('Auto-save failed:', err);
    } finally {
      isAutoSavingRef.current = false;
    }
  }, [
    tiptap.editor,
    id,
    isAllLocked,
    subjectGroups,
    availableSubjects,
    submitQueue,
    submissionStatus,
    canSubmit,
    selectedAssigneeId,
  ]);

  // Store handleAutoSave in ref so it can be called from onUpdate
  useEffect(() => {
    handleAutoSaveRef.current = handleAutoSave;
  }, [handleAutoSave]);

  // Auto-save when subject groups change (only when locked)
  // Note: This will trigger auto-save when groups change, but the handleAutoSave function
  // will still check if content has actually changed before making the API call
  useEffect(() => {
    if (!isAllLocked || !handleAutoSaveRef.current || !tiptap.editor) return;

    // Check if content has changed before scheduling auto-save
    try {
      const currentContent = JSON.stringify(tiptap.getJSON());
      if (currentContent === lastSavedContentRef.current) {
        // No content changes, skip auto-save
        return;
      }
    } catch (err) {
      // If we can't get content, skip auto-save
      return;
    }

    // Debounce group changes
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      // Double-check content hasn't changed back before saving
      if (tiptap.editor && !isAutoSavingRef.current) {
        try {
          const contentAtSaveTime = JSON.stringify(tiptap.getJSON());
          if (contentAtSaveTime !== lastSavedContentRef.current) {
            handleAutoSaveRef.current?.();
          }
        } catch (err) {
          // Silently handle errors
          console.error(
            'Error checking content before auto-save on group change:',
            err
          );
        }
      }
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [subjectGroups, isAllLocked, tiptap.editor]);

  // Template/ConfigSet has approval enabled? (must be true for question-level approval to apply)
  const templateHasApproval = useMemo(() => {
    const q = queue as { hasApproval?: boolean; configSet?: { hasApproval?: boolean } } | undefined;
    return !!(q?.hasApproval || q?.configSet?.hasApproval);
  }, [queue]);

  // Store subjects and global groups in editor storage so nodes can access them
  React.useEffect(() => {
    if (tiptap.editor) {
      const storage = tiptap.editor.storage as any;
      storage.formBuilder = storage.formBuilder || {};
      storage.formBuilder.subjects = subjectsOptions;
      storage.formBuilder.subjectsProfiles = subjects; // Store full Profile objects
      storage.formBuilder.subjectMode = subjectMode;
      storage.formBuilder.globalGroups = subjectGroups; // Global/default groups
      storage.formBuilder.availableSubjects = availableSubjects; // Ungrouped subjects
      storage.formBuilder.isAllLocked = isAllLocked;
      // Store tags fetched by IDs for use in view components
      storage.formBuilder.tagsByIds = tagsByIds;
      // Template/ConfigSet has approval; question-level approval UI only when this is true
      storage.formBuilder.templateHasApproval = templateHasApproval;
      storage.formBuilder.canOpenApprovalDrawer = canOpenApprovalDrawer;

      // Add drawer opener function for question approval
      storage.formBuilder.openQuestionApprovalDrawer = (
        questionNode: QuestionNode,
        subjectContext: SubjectContext
      ) => {
        setSelectedQuestionNode(questionNode);
        setSelectedSubjectContext(subjectContext);
        setApprovalDrawerOpen(true);
      };
    }
  }, [
    tiptap.editor,
    subjectsOptions,
    subjects,
    subjectMode,
    subjectGroups,
    availableSubjects,
    isAllLocked,
    tagsByIds,
    templateHasApproval,
    canOpenApprovalDrawer,
  ]);

  // Get locked subject IDs from groups (when all is locked or individual groups are locked)
  const lockedSubjectIdsFromGroups = useMemo(() => {
    const locked = new Set<string>();
    if (isAllLocked) {
      // If all is locked, all subjects in all groups are locked
      subjectGroups.forEach((group) => {
        group.subjectIds.forEach((id) => locked.add(id));
      });
    } else {
      // Otherwise, only subjects in individually locked groups are locked
      subjectGroups.forEach((group) => {
        if (group.locked) {
          group.subjectIds.forEach((id) => locked.add(id));
        }
      });
    }
    return locked;
  }, [subjectGroups, isAllLocked]);

  // Get all selected subject IDs from selected groups
  const getAllSelectedSubjectIds = useMemo(() => {
    const selected: string[] = [];

    // Add subjects from selected groups
    subjectGroups.forEach((group) => {
      if (selectedGroupIds.has(group.id)) {
        selected.push(...group.subjectIds);
      }
    });

    return selected;
  }, [subjectGroups, selectedGroupIds]);

  // Group management functions - Global groups (default for all nodes)
  const handleCreateGroup = () => {
    if (submissionStatus === 'submission_complete') {
      message.warning('Submission is complete. No changes allowed.');
      return;
    }
    if (!canSubmit) {
      message.warning('You do not have permission to create groups.');
      return;
    }
    if (isAllLocked) {
      message.warning(
        'Cannot create groups when all is locked. Please unlock first.'
      );
      return;
    }
    setEditingGroup(null);
    groupForm.resetFields();
    setIsGroupModalVisible(true);
  };

  const handleEditGroup = (group: SubjectGroup) => {
    if (submissionStatus === 'submission_complete') {
      message.warning('Submission is complete. No changes allowed.');
      return;
    }
    if (!canSubmit) {
      message.warning('You do not have permission to edit groups.');
      return;
    }
    if (isAllLocked || group.locked) {
      message.warning('Cannot edit a locked group. Please unlock all first.');
      return;
    }
    setEditingGroup(group);
    groupForm.setFieldsValue({
      name: group.name,
      subjectIds: group.subjectIds,
    });
    setIsGroupModalVisible(true);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (submissionStatus === 'submission_complete') {
      message.warning('Submission is complete. No changes allowed.');
      return;
    }
    if (!canSubmit) {
      message.warning('You do not have permission to delete groups.');
      return;
    }
    if (isAllLocked) {
      message.warning(
        'Cannot delete groups when all is locked. Please unlock all first.'
      );
      return;
    }
    const group = subjectGroups.find((g) => g.id === groupId);
    if (group?.locked) {
      message.warning('Cannot delete a locked group. Please unlock it first.');
      return;
    }
    modal.confirm({
      title: 'Delete Group',
      content:
        'Are you sure you want to delete this group? Subjects will be available for other groups.',
      onOk: () => {
        setSubjectGroups((prev) => prev.filter((g) => g.id !== groupId));
        message.success('Group deleted successfully');
      },
    });
  };

  const handleSaveGroup = () => {
    groupForm.validateFields().then((values) => {
      if (editingGroup) {
        // Update existing group - remove subjects from other groups if they were moved
        const addedSubjectIds = values.subjectIds.filter(
          (id) => !editingGroup.subjectIds.includes(id)
        );

        // Update groups: remove subjects from other groups if they were added to this one
        setSubjectGroups((prev) => {
          const updated = prev.map((g) => {
            if (g.id === editingGroup.id) {
              return { ...g, name: values.name, subjectIds: values.subjectIds };
            }
            // Remove subjects from other groups if they were added to the edited group
            const filteredSubjectIds = g.subjectIds.filter(
              (id) => !addedSubjectIds.includes(id)
            );
            return { ...g, subjectIds: filteredSubjectIds };
          });
          return updated;
        });
        message.success('Group updated successfully');
      } else {
        // Create new group with stable UUID-based ID
        // Use crypto.randomUUID if available, otherwise fallback to timestamp-based ID
        const generateGroupId = () => {
          if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return `group-${crypto.randomUUID()}`;
          }
          // Fallback: use timestamp + random number for better uniqueness
          return `group-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        };
        const newGroup: SubjectGroup = {
          id: generateGroupId(),
          name: values.name,
          subjectIds: values.subjectIds,
        };
        setSubjectGroups((prev) => [...prev, newGroup]);
        message.success('Group created successfully');
      }
      setIsGroupModalVisible(false);
      groupForm.resetFields();
      setEditingGroup(null);
    });
  };

  const handleCancelGroup = () => {
    setIsGroupModalVisible(false);
    groupForm.resetFields();
    setEditingGroup(null);
  };

  // Toggle group selection
  const handleToggleGroup = (groupId: string) => {
    if (submissionStatus === 'submission_complete') return; // Don't allow selection if submission is complete
    if (!canSubmit) return; // Don't allow selection if user can't submit
    if (isAllLocked) return; // Don't allow selection when all is locked
    const group = subjectGroups.find((g) => g.id === groupId);
    if (group?.locked) return; // Don't allow selection of locked groups

    setSelectedGroupIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
    setIsDirty(true);
  };

  // Merge groups
  const handleMergeGroups = (sourceGroupId: string, targetGroupId: string) => {
    if (submissionStatus === 'submission_complete') {
      message.warning('Submission is complete. No changes allowed.');
      return;
    }
    if (!canSubmit) {
      message.warning('You do not have permission to merge groups.');
      return;
    }
    const sourceGroup = subjectGroups.find((g) => g.id === sourceGroupId);
    const targetGroup = subjectGroups.find((g) => g.id === targetGroupId);

    if (!sourceGroup || !targetGroup) return;

    modal.confirm({
      title: 'Merge Groups',
      content: `Are you sure you want to merge "${sourceGroup.name}" into "${targetGroup.name}"? All subjects from "${sourceGroup.name}" will be moved to "${targetGroup.name}" and "${sourceGroup.name}" will be deleted.`,
      okText: 'Merge',
      cancelText: 'Cancel',
      onOk: () => {
        setSubjectGroups((prev) => {
          const updated = prev.map((g) => {
            if (g.id === targetGroupId) {
              // Merge subjects (avoid duplicates)
              const mergedSubjectIds = Array.from(
                new Set([...g.subjectIds, ...sourceGroup.subjectIds])
              );
              return { ...g, subjectIds: mergedSubjectIds };
            }
            return g;
          });
          // Remove source group
          return updated.filter((g) => g.id !== sourceGroupId);
        });

        // Merge answers if they exist
        if (
          answersPerEntity[sourceGroupId] &&
          answersPerEntity[targetGroupId]
        ) {
          // Keep target group's answers, or you could merge them
          setAnswersPerEntity((prev) => {
            const updated = { ...prev };
            delete updated[sourceGroupId];
            return updated;
          });
        }

        message.success(
          `Groups merged successfully. "${sourceGroup.name}" has been merged into "${targetGroup.name}".`
        );
      },
    });
  };

  // Start submission - lock all groups and subjects
  const handleStartSubmission = () => {
    if (submissionStatus === 'submission_complete') {
      message.warning('Submission is complete. No changes allowed.');
      return;
    }
    if (!canSubmit) {
      message.warning('You do not have permission to start submission.');
      return;
    }
    if (subjectGroups.length === 0 && availableSubjects.length === 0) {
      message.warning(
        'Please create at least one group or ensure there are subjects available before starting submission.'
      );
      return;
    }

    // Log subject groups details before start submission
    console.log('=== SUBJECT GROUPS DETAILS (Before Start Submission) ===');
    console.log('Subject Groups:', JSON.stringify(subjectGroups, null, 2));
    subjectGroups.forEach((group, index) => {
      console.log(`Group ${index + 1}:`, {
        id: group.id,
        name: group.name,
        subjectIds: group.subjectIds,
        subjectNames: group.subjectIds.map((id) => {
          const subject = subjectsOptions.find((opt) => opt.value === id);
          return subject?.label || id;
        }),
        locked: group.locked || false,
      });
    });

    // Log ungrouped subjects details before start submission
    console.log('=== UNGROUPED SUBJECTS DETAILS (Before Start Submission) ===');
    console.log(
      'Ungrouped Subjects:',
      JSON.stringify(availableSubjects, null, 2)
    );
    availableSubjects.forEach((subject, index) => {
      console.log(`Ungrouped Subject ${index + 1}:`, {
        id: subject.value,
        name: subject.label,
      });
    });

    modal.confirm({
      title: 'Start Submission',
      content: (
        <div>
          <p>Are you ready to start submission?</p>
          <p style={{ marginTop: 8, color: token.colorWarning }}>
            <strong>This will lock all groups and ungrouped subjects.</strong>{' '}
            You will be able to fill forms for each group and subject
            separately.
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>All groups will be locked</li>
            <li>All ungrouped subjects will be locked</li>
            <li>You can fill forms for each group and subject individually</li>
            <li>You cannot create, edit, or delete groups</li>
            <li>
              Each field will show separate inputs for groups and ungrouped
              subjects
            </li>
          </ul>
        </div>
      ),
      okText: 'Start Submission',
      cancelText: 'Cancel',
      width: 500,
      onOk: () => {
        // Lock all groups
        setSubjectGroups((prev) => prev.map((g) => ({ ...g, locked: true })));
        setIsAllLocked(true);
        message.success(
          'Submission started. You can now fill forms for each group and subject.'
        );
      },
    });
  };

  // Handle subject form preview
  const handleViewSubjectForm = () => {
    if (!selectedSubjectForPreview) {
      message.warning('Please select a subject to preview');
      return;
    }

    const json = tiptap.getJSON();
    if (!json) {
      message.error('Cannot preview empty form');
      return;
    }

    const formData = getSubjectFormData(
      json,
      selectedSubjectForPreview,
      subjectGroups,
      availableSubjects,
      subjectsOptions
    );

    setSubjectFormData(formData);
    setSubjectFormPreviewOpen(true);
  };

  // Get all subjects (grouped + ungrouped) for the selector
  const allSubjects = useMemo(() => {
    const grouped = subjectGroups.flatMap((group) =>
      group.subjectIds.map((id) => {
        const subject = subjectsOptions.find((opt) => opt.value === id);
        return {
          label: `${subject?.label || id} (${group.name})`,
          value: id,
        };
      })
    );

    const ungrouped = availableSubjects.map((subject) => ({
      label: `${subject.label} (Ungrouped)`,
      value: subject.value,
    }));

    return [...grouped, ...ungrouped];
  }, [subjectGroups, availableSubjects, subjectsOptions]);

  // Question approver's pre-approval (independent of assignee grouping): resolve so we can show which assignee groups/ungrouped have pre-approval
  const { approvalQuestionKeys, preApprovalByQuestion } = useMemo(() => {
    const schemaDoc = schema?.content ? (schema as JSONContent) : null;
    const questions = schemaDoc ? getQuestionsRequiringApproval(schemaDoc) : [];
    const keys = questions.map(({ node, path }) => getQuestionKeyFromNode(node as QuestionNode, path));
    const raw = selectedAssigneeId && queue?.submitMeta?.preApprovalByAssignee?.[selectedAssigneeId]?.preApprovalByQuestion;
    const byQ = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, import('./questionApprovalUtils').PreApprovalQuestionEntry> : undefined;
    return { approvalQuestionKeys: keys, preApprovalByQuestion: byQ };
  }, [schema, selectedAssigneeId, queue?.submitMeta?.preApprovalByAssignee]);

  // Pre-approval for the drawer context (when drawer is open): one line if all match, else per-subject breakdown
  const drawerPreApproval = useMemo(() => {
    if (!selectedQuestionNode || !selectedSubjectContext || !preApprovalByQuestion) return undefined;
    const qKey = selectedQuestionNode.attrs?.id || selectedQuestionNode.attrs?.name;
    if (!qKey) return undefined;
    const ctx = selectedSubjectContext;
    return getPreApprovalForContext(
      qKey,
      { type: ctx.type, groupId: ctx.groupId, subjectId: ctx.subjectId, subjectName: ctx.subjectName },
      preApprovalByQuestion,
      subjectsOptions
    );
  }, [selectedQuestionNode, selectedSubjectContext, preApprovalByQuestion, subjectsOptions]);

  // console.log('selectedQuestionNode', selectedQuestionNode);
  return (
    <div
      style={{
        background: token.colorBgLayout,
        // minHeight: '100vh',
        paddingBottom: 48,
      }}
    >
      {contextHolder}

      {/* Navigation Confirmation Modal */}
      <Modal
        open={showNavigationConfirm}
        title="Unsaved Changes"
        onOk={() => handleNavigationConfirm(true)}
        onCancel={() => handleNavigationConfirm(false)}
        okText="Leave Page"
        cancelText="Stay on Page"
        okButtonProps={{ danger: true }}
      >
        <p>
          You have unsaved changes. Are you sure you want to leave this page?
        </p>
        <p style={{ marginTop: 8, color: token.colorWarning, fontSize: 12 }}>
          Your changes may be lost if you leave without saving.
        </p>
      </Modal>
      {/* ---------- HEADER ---------- */}
      <Affix offsetTop={65}>
        <div
          style={{
            background: token.colorBgContainer,
            boxShadow: token.boxShadowTertiary,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 12,
          }}
        >
          <Title
            level={4}
            style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <FormOutlined style={{ color: token.colorPrimary }} />
            Submit Queue
            {isDirty && canSubmit && (
              <Text type="warning" style={{ fontSize: 12 }}>
                • Unsaved changes
              </Text>
            )}
          </Title>

            <Space>
              {/* <Tooltip title="Preview JSON">
              <Button icon={<EyeOutlined />} onClick={handlePreview} />
            </Tooltip> */}

              {/* <Button
              key="versions"
              type="default"
              onClick={() => navigate(`/forms/templates/${id}/versions`)}
            >
              View Versions
            </Button> */}

              {/* <Tooltip title="Save draft only">
              <Button
                icon={<CodeOutlined />}
                loading={queueLoading}
                onClick={saveDraft}
                disabled={!isDirty}
              >
                Save Draft
                </Button>
                </Tooltip> */}

            {submissionStatus !== undefined && canSubmit && (
              <Tooltip
                title={
                  submissionStatus === 'submission_complete'
                    ? 'Submission is complete. No further changes allowed.'
                    : !canSubmit
                      ? 'You can only submit for your assigned queue. Please select the correct assignee.'
                      : isAllLocked
                        ? 'Submit Queue'
                        : 'Please start submission first to lock groups and subjects'
                }
              >
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={isSubmitting}
                  disabled={submissionStatus === 'submission_complete' || !isAllLocked || !canSubmit}
                  onClick={() => form.submit()}
                >
                  Submit
                </Button>
              </Tooltip>
            )}

              <Button
                variant="solid"
                color="green"
                icon={<EyeOutlined />}
                onClick={() => {
                  const firstSubjectId = getAllSelectedSubjectIds[0];
                  if (firstSubjectId) {
                    safeNavigate(
                      `/forms/queues/${id}/submissions?subjectId=${firstSubjectId}`
                    );
                  } else {
                    safeNavigate(`/forms/queues/${id}/submissions`);
                  }
                }}
              >
                Submissions
              </Button>

              {/* <Tooltip title="Save everything & lock (publish)">
              <Button
                type="primary"
                danger
                loading={metaSaving || draftLoading}
                onClick={saveAllAndLock}
                disabled={!isDirty && !form.isFieldsTouched()}
              >
                Publish
              </Button>
            </Tooltip> */}
            </Space>
        </div>
      </Affix>

      {/* ---------- FORM + EDITOR ---------- */}
      <Row justify="center" style={{ marginTop: 32 }}>
        <Col xs={24} xl={24}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: token.boxShadowSecondary,
              padding: 12,
            }}
            styles={{
              body: {
                padding: token.sizeXS,
              },
            }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmitQueue}
              initialValues={{
                subjectId: null,
                // hasApproval: false,
                // hasDisputes: false,
                // signatureRequired: false,
              }}
            >
              {(submissionStatus !== undefined || canSubmit) ? (
                <Row gutter={[24, 24]} style={{ width: '100%' }}>
                  {/* --- Global Subject Groups (Default for all nodes) --- */}
                  {subjectMode !== 'none' && (
                    <Col span={24}>
                      <Card
                        size="small"
                        style={{
                          marginBottom: 16,
                          background: token.colorFillAlter,
                        }}
                        title={
                          <Space>
                            <Text strong>Subject Groups</Text>
                            {submissionStatus === 'submission_complete' && (
                              <Tag color="success" icon={<LockOutlined />}>
                                Submission Complete
                              </Tag>
                            )}
                            {!isAllLocked && canSubmit && submissionStatus !== 'submission_complete' && (
                              <Button
                                type="primary"
                                size="small"
                                icon={<PlusOutlined />}
                                onClick={handleCreateGroup}
                              >
                                Create Group
                              </Button>
                            )}
                            {isAllLocked && submissionStatus !== 'submission_complete' && (
                              <Tag color="success" icon={<LockOutlined />}>
                                Submission Started - Groups Locked
                              </Tag>
                            )}
                          </Space>
                        }
                      >
                        {subjectGroups.length === 0 ? (
                          <Text type="secondary">
                            No groups created. Create a group to organize
                            subjects.
                          </Text>
                        ) : (
                          <Space wrap>
                            {subjectGroups.map((group) => {
                              const isSelected = selectedGroupIds.has(group.id);
                              const isLocked =
                                isAllLocked || group.locked || false;
                              return (
                                <Card
                                  key={group.id}
                                  size="small"
                                  hoverable={!isLocked && canSubmit && submissionStatus !== 'submission_complete'}
                                  onClick={() =>
                                    !isLocked && canSubmit && submissionStatus !== 'submission_complete' && handleToggleGroup(group.id)
                                  }
                                  style={{
                                    minWidth: 200,
                                    background: isSelected
                                      ? token.colorPrimaryBg
                                      : token.colorBgContainer,
                                    border: isSelected
                                      ? `2px solid ${token.colorPrimary}`
                                      : isLocked
                                        ? `2px solid ${token.colorWarning}`
                                        : `1px solid ${token.colorBorderSecondary}`,
                                    cursor: isLocked || !canSubmit || submissionStatus === 'submission_complete'
                                      ? 'not-allowed'
                                      : 'pointer',
                                    opacity: isLocked || !canSubmit || submissionStatus === 'submission_complete' ? 0.8 : 1,
                                  }}
                                  title={
                                    <Space>
                                      <Text strong>
                                        {group.name}
                                        {isLocked && (
                                          <LockOutlined
                                            style={{
                                              marginLeft: 4,
                                              color: token.colorWarning,
                                            }}
                                          />
                                        )}
                                      </Text>
                                      {isAssigneeGroupFullyPreApproved(group.subjectIds, preApprovalByQuestion, approvalQuestionKeys) && (
                                        <Tag color="success" icon={<CheckCircleOutlined />}>
                                          Pre-approved
                                        </Tag>
                                      )}
                                      {!isLocked && canSubmit && submissionStatus !== 'submission_complete' && (
                                        <>
                                          <Button
                                            type="text"
                                            size="small"
                                            icon={<EditOutlined />}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEditGroup(group);
                                            }}
                                          />
                                          {subjectGroups.length > 1 && (
                                            <Tooltip title="Merge this group into another">
                                              <Button
                                                type="text"
                                                size="small"
                                                icon={<MergeCellsOutlined />}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  // Show modal to select target group
                                                  const otherGroups =
                                                    subjectGroups.filter(
                                                      (g) => g.id !== group.id
                                                    );
                                                  if (
                                                    otherGroups.length === 0
                                                  ) {
                                                    message.warning(
                                                      'No other groups to merge with'
                                                    );
                                                    return;
                                                  }
                                                  let targetGroupId:
                                                    | string
                                                    | null = null;
                                                  Modal.confirm({
                                                    title: 'Merge Group',
                                                    content: (
                                                      <div>
                                                        <p
                                                          style={{
                                                            marginBottom: 8,
                                                          }}
                                                        >
                                                          Select the group to
                                                          merge "{group.name}"
                                                          into:
                                                        </p>
                                                        <Select
                                                          style={{
                                                            width: '100%',
                                                            marginTop: 8,
                                                          }}
                                                          placeholder="Select target group"
                                                          options={otherGroups.map(
                                                            (g) => ({
                                                              label: g.name,
                                                              value: g.id,
                                                            })
                                                          )}
                                                          onChange={(value) => {
                                                            targetGroupId =
                                                              value;
                                                          }}
                                                        />
                                                      </div>
                                                    ),
                                                    okText: 'Merge',
                                                    cancelText: 'Cancel',
                                                    onOk: () => {
                                                      if (targetGroupId) {
                                                        handleMergeGroups(
                                                          group.id,
                                                          targetGroupId
                                                        );
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
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteGroup(group.id);
                                            }}
                                          />
                                        </>
                                      )}
                                    </Space>
                                  }
                                >
                                  <Space wrap>
                                    {group.subjectIds.map((subjectId) => {
                                      const subject = subjectsOptions.find(
                                        (opt) => opt.value === subjectId
                                      );
                                      return (
                                        <Tag key={subjectId} color="blue">
                                          {subject?.label || subjectId}
                                        </Tag>
                                      );
                                    })}
                                    {group.subjectIds.length === 0 && (
                                      <Text
                                        type="secondary"
                                        style={{ fontSize: 12 }}
                                      >
                                        No subjects in this group
                                      </Text>
                                    )}
                                  </Space>
                                  {isSelected && !isLocked && (
                                    <div style={{ marginTop: 8 }}>
                                      <Tag color="success">Selected</Tag>
                                    </div>
                                  )}
                                  {isLocked && (
                                    <div style={{ marginTop: 8 }}>
                                      <Tag color="warning">Locked</Tag>
                                    </div>
                                  )}
                                </Card>
                              );
                            })}
                          </Space>
                        )}
                      </Card>
                    </Col>
                  )}
                  {/* --- Global Ungrouped Subjects (Default for all nodes) --- */}
                  {/* {subjectMode !== 'none' && ( */}
                  <Col span={24}>
                    <Card
                      size="small"
                      style={{
                        marginBottom: 16,
                        background: token.colorFillAlter,
                      }}
                      title={
                        <Text strong>
                          Ungrouped Subjects{' '}
                          {availableSubjects.length > 0 &&
                            `(${availableSubjects.length})`}
                        </Text>
                      }
                    >
                      {availableSubjects.length === 0 ? (
                        <Text type="secondary">
                          All subjects are organized into groups.
                        </Text>
                      ) : (
                        <Space wrap>
                          {availableSubjects.map((subject) => {
                            const isLocked = isAllLocked;
                            const isPreApproved = isSubjectPreApprovedForAllQuestions(
                              subject.value,
                              preApprovalByQuestion,
                              approvalQuestionKeys
                            );
                            return (
                              <Tag
                                key={subject.value}
                                color={isLocked ? 'warning' : 'default'}
                                style={{
                                  padding: '4px 12px',
                                  fontSize: 14,
                                  border: isLocked
                                    ? `2px solid ${token.colorWarning}`
                                    : `1px dashed ${token.colorBorderSecondary}`,
                                  cursor: 'default',
                                }}
                              >
                                {subject.label}
                                {isLocked && (
                                  <LockOutlined style={{ marginLeft: 4 }} />
                                )}
                                {isPreApproved && (
                                  <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginLeft: 4 }}>
                                    Pre-approved
                                  </Tag>
                                )}
                              </Tag>
                            );
                          })}
                        </Space>
                      )}
                    </Card>
                  </Col>
                  {/* )} */}
                  {/* --- Start Submission Button --- */}
                  {subjectMode !== 'none' && !isAllLocked && canSubmit && submissionStatus !== 'submission_complete' && (
                    <Col span={24}>
                      <Card
                        size="small"
                        style={{
                          marginBottom: 16,
                          background: token.colorFillAlter,
                          textAlign: 'center',
                          padding: '24px',
                        }}
                      >
                        <Space
                          direction="vertical"
                          size="middle"
                          style={{ width: '100%' }}
                        >
                          <Text
                            type="secondary"
                            style={{ fontSize: 16, display: 'block' }}
                          >
                            Configure groups and ungrouped subjects above, then
                            start submission
                          </Text>
                          <Button
                            type="primary"
                            size="large"
                            icon={<SaveOutlined />}
                            onClick={handleStartSubmission}
                            style={{
                              background: token.colorSuccess,
                              borderColor: token.colorSuccess,
                              height: 40,
                              fontSize: 16,
                              paddingLeft: 24,
                              paddingRight: 24,
                            }}
                          >
                            Start Submission
                          </Button>
                          <Text
                            type="secondary"
                            style={{ fontSize: 12, display: 'block' }}
                          >
                            This will lock all groups and ungrouped subjects.
                            You can then fill separate inputs for each group and
                            ungrouped subject in each field.
                          </Text>
                        </Space>
                      </Card>
                    </Col>
                  )}
                  
                  {/* --- Submission Complete Message --- */}
                  {submissionStatus === 'submission_complete' && (
                    <Col span={24}>
                      <Card
                        size="small"
                        style={{
                          marginBottom: 16,
                          background: token.colorSuccessBg,
                          textAlign: 'center',
                          padding: '24px',
                          border: `1px solid ${token.colorSuccess}`,
                        }}
                      >
                        <Space
                          direction="vertical"
                          size="middle"
                          style={{ width: '100%' }}
                        >
                          <Text
                            strong
                            style={{ fontSize: 16, color: token.colorSuccess }}
                          >
                            Submission Complete
                          </Text>
                          <Text
                            type="secondary"
                            style={{ fontSize: 14, display: 'block' }}
                          >
                            This submission has been completed. The form is now in read-only mode.
                            No further changes can be made.
                          </Text>
                        </Space>
                      </Card>
                    </Col>
                  )}

                  {/* --- View Subject Form Section --- */}
                  {false &&
                    subjectMode !== 'none' &&
                    allSubjects.length > 0 && (
                      <Col span={24}>
                        <Card
                          size="small"
                          style={{
                            marginBottom: 16,
                            background: token.colorFillAlter,
                            border: `1px solid ${token.colorPrimary}`,
                          }}
                          title={
                            <Space>
                              <EyeOutlined
                                style={{ color: token.colorPrimary }}
                              />
                              <Text strong>View Subject Form Status</Text>
                            </Space>
                          }
                        >
                          <Space
                            direction="vertical"
                            size="middle"
                            style={{ width: '100%' }}
                          >
                            <Text type="secondary">
                              Select any subject to view their complete form
                              with all answers
                            </Text>
                            <Space style={{ width: '100%' }} size="middle">
                              <Select
                                style={{ minWidth: 300, flex: 1 }}
                                placeholder="Select a subject to preview"
                                value={selectedSubjectForPreview}
                                onChange={setSelectedSubjectForPreview}
                                options={allSubjects}
                                showSearch
                                filterOption={(input, option) =>
                                  (option?.label ?? '')
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                                }
                              />
                              <Button
                                type="primary"
                                icon={<EyeOutlined />}
                                onClick={handleViewSubjectForm}
                                disabled={!selectedSubjectForPreview}
                              >
                                View Form
                              </Button>
                            </Space>
                          </Space>
                        </Card>
                      </Col>
                    )}

                  {/* <Col xs={24} md={8}>
                  <Form.Item
                    label="Name"
                    name="name"
                    rules={[{ required: true, message: 'Name is required' }]}
                  >
                    <Input disabled={metaSaving} size="large" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    label="Code"
                    name="code"
                    rules={[
                      { required: true, message: 'Code is required' },
                      {
                        pattern: /^[a-zA-Z0-9_-]+$/,
                        message: 'Only letters, numbers, _ and - are allowed',
                      },
                    ]}
                  >
                    <Input disabled={metaSaving} size="large" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item label="Description" name="description">
                    <Input
                      placeholder="Enter description"
                      disabled={metaSaving}
                      size="large"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    label="Approval Required"
                    name="hasApproval"
                    valuePropName="checked"
                    tooltip="Enable if this queue needs admin or manager approval before submission"
                  >
                    <Switch checkedChildren="Yes" unCheckedChildren="No" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    label="Dispute Required"
                    name="hasDisputes"
                    valuePropName="checked"
                    tooltip="Enable if this queue allows dispute or review workflow"
                  >
                    <Switch checkedChildren="Yes" unCheckedChildren="No" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    label="Signature Required"
                    name="signatureRequired"
                    valuePropName="checked"
                    tooltip="Enable if this form requires a digital signature field"
                  >
                    <Switch checkedChildren="Yes" unCheckedChildren="No" />
                  </Form.Item>
                </Col> */}

                  {/* Submission Status Message */}
                  {/* {submissionStatus === undefined && (
                    <Col span={24}>
                      <Alert
                        message="Submission is not started yet"
                        type="info"
                        showIcon
                        style={{
                          marginTop: 24,
                          borderRadius: 8,
                        }}
                      />
                    </Col>
                  )} */}
                </Row>
              ) : (
                <Row>
                  {/* <Col span={24}>
                    <Alert
                      message="Submission "
                      type="info"
                      showIcon
                      style={{
                        marginTop: 24,
                        borderRadius: 8,
                      }}
                    />
                  </Col> */}
                </Row>
              )}

              {/* <Divider>
                <Text type="secondary">Template Builder</Text>
              </Divider> */}

              {/* Form builder - grouping is now handled inside each node */}
              {(subjectMode === 'none' || isAllLocked) && (
                <Card
                  size="small"
                  variant='borderless'
                  style={{
                    borderRadius: 12,
                    background: token.colorFillAlter,
                    width: '100%',
                    marginTop: 24,
                    padding: 0,
                  }}
                  styles={{
                    body: {
                      padding: 0,
                    },
                  }}
                >
                  {tiptap.editor ? (
                    <TemplateEditor instance={tiptap} />
                  ) : (
                    <Spin tip="Editor initializing..." />
                  )}
                </Card>
              )}
            </Form>
          </Card>
        </Col>
      </Row>

      {/* Group Management Modal */}
      <Modal
        title={editingGroup ? 'Edit Group' : 'Create Group'}
        open={isGroupModalVisible}
        onOk={handleSaveGroup}
        onCancel={handleCancelGroup}
        okText={editingGroup ? 'Update' : 'Create'}
        cancelText="Cancel"
        width={600}
      >
        <Form
          form={groupForm}
          layout="vertical"
          initialValues={{
            name: '',
            subjectIds: [],
          }}
        >
          <Form.Item
            label="Group Name"
            name="name"
            rules={[
              { required: true, message: 'Please enter a group name' },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  const isDuplicate = subjectGroups.some(
                    (g) => g.name === value && g.id !== editingGroup?.id
                  );
                  if (isDuplicate) {
                    return Promise.reject(
                      new Error('Group name already exists')
                    );
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input placeholder="Enter group name" />
          </Form.Item>

          <Form.Item
            label="Subjects"
            name="subjectIds"
            rules={[
              { required: true, message: 'Please select at least one subject' },
            ]}
            tooltip="Select subjects for this group. Each subject can only be in one group. Locked subjects cannot be added."
          >
            <Select
              mode="multiple"
              placeholder="Select subjects"
              options={subjectsOptions.map((opt) => {
                const isLocked =
                  isAllLocked ||
                  (lockedSubjectIdsFromGroups &&
                    lockedSubjectIdsFromGroups.has(opt.value));
                // When editing, allow subjects in current group, but disable subjects in other groups
                if (editingGroup) {
                  const isInCurrentGroup = editingGroup.subjectIds.includes(
                    opt.value
                  );
                  const isInOtherGroup =
                    !isInCurrentGroup && usedSubjectIds.has(opt.value);
                  return {
                    label: `${opt.label}${isLocked ? ' (Locked)' : ''}`,
                    value: opt.value,
                    disabled: isInOtherGroup || isLocked,
                  };
                }
                // When creating, disable subjects already in any group or locked
                return {
                  label: `${opt.label}${isLocked ? ' (Locked)' : ''}`,
                  value: opt.value,
                  disabled: usedSubjectIds.has(opt.value) || isLocked,
                };
              })}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Question Approval Drawer */}
      {selectedQuestionNode && selectedSubjectContext && (
        <QuestionApprovalDrawer
          label={extractNodeLabel(selectedQuestionNode) || ''}
          open={approvalDrawerOpen}
          onClose={() => {
            setApprovalDrawerOpen(false);
            setSelectedQuestionNode(null);
            setSelectedSubjectContext(null);
          }}
          questionNode={selectedQuestionNode}
          subjectContext={selectedSubjectContext}
          formContext={{
            assignmentId: id!,
            formTemplateId: queue?.formTemplateSchema?._id || '',
            formName: queue?.formTemplate?.name || '',
            formApprovers: Array.isArray(queue?.approvers)
              ? queue.approvers.filter((approver): approver is Profile => typeof approver === 'object' && approver !== null && '_id' in approver)
              : [],
            questionApprovers: queue?.questionApprovers ? Array.isArray(queue?.questionApprovers)
              ? queue.questionApprovers.filter((approver): approver is Profile => typeof approver === 'object' && approver !== null && '_id' in approver)
              : [] : undefined,
            templateHasApproval: !!(queue?.hasApproval || (queue as any)?.configSet?.hasApproval),
            preApprovalForContext: drawerPreApproval,
            isPreApprovedForCurrentContext: drawerPreApproval?.allPreApproved ?? false,
          }}
          updateNodeAttributes={(attrs) => {
            // Update the node attributes in the editor using the utility function
            if (tiptap.editor && selectedQuestionNode) {
              const success = updateNodeAttributesInEditor(
                tiptap.editor,
                {
                  type: selectedQuestionNode.type,
                  attrs: selectedQuestionNode.attrs,
                },
                attrs
              );

              if (success) {
                // Update the selected node state to reflect changes
                // Get the updated node from the editor to sync state
                const updatedNode = tiptap.editor.getJSON();
                if (updatedNode) {
                  // Find the updated node in the JSON using the utility function
                  const found = findNodeInJSONContent(updatedNode, {
                    type: selectedQuestionNode.type,
                    attrs: selectedQuestionNode.attrs,
                  });
                  
                  if (found && found.node) {
                    setSelectedQuestionNode({
                      ...selectedQuestionNode,
                      attrs: found.node.attrs as any,
                    });
                  }
                }
                
                setIsDirty(true);
              } else {
                console.warn('[SubmitQueue] Failed to update node attributes:', {
                  type: selectedQuestionNode.type,
                  id: selectedQuestionNode.attrs?.id,
                  name: selectedQuestionNode.attrs?.name,
                });
              }
            }
          }}
          currentUser={
            selectedProfile
              ? {
                  _id: selectedProfile._id,
                  name: (selectedProfile.user as User)?.name ?? 'Unknown',
                  email: (selectedProfile.user as User)?.email ?? '',
                }
              : (queue as any)?.assignee?.user || {
                  _id: '',
                  name: 'Unknown',
                  email: '',
                }
          }
          channelAssigneeId={selectedAssigneeId}
        />
      )}

      {/* Subject Form Preview Modal */}
      <SubjectFormPreview
        open={subjectFormPreviewOpen}
        onClose={() => {
          setSubjectFormPreviewOpen(false);
          setSubjectFormData(null);
        }}
        subjectData={subjectFormData}
        formName={queue?.formTemplate?.name || 'Form'}
        assignmentId={id}
        onSave={async (subjectId, formData) => {
          console.log('formData', formData);
          // Save the filled form to backend
          await submitQueue({
            assignmentId: id!,
            data: {
              subjectId,
              assigneeId: selectedAssigneeId,
              answers: formData,
              targetStatus: 'submission_in_progress',
              validate: true,
            },
          }).unwrap();

          // Refetch queue data
          await refetchQueue();
        }}
      />
    </div>
  );
};
