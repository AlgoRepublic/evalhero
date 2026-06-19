/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useEffect, useCallback, useState, useRef } from 'react';
import { Button, Affix, Space, Typography, Tag, theme, message, Grid } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTiptapInstance } from '../../../hooks/useTiptapInstance';
import { extensions } from '../../CanvasBuilderPage/Editor/extensions';
import { TemplateEditor } from '../../CanvasBuilderPage';
import type { JSONContent } from '@tiptap/core';
import { parseSchemaDocument } from '../../CanvasBuilderPage/Editor/utils';
import { findNodeInJSONContent, updateNodeAttributesInEditor } from '../../forms/QueuesComponents/nodeUpdateUtils';
import { CourseQuestionApprovalDrawer } from './CourseQuestionApprovalDrawer';

export interface CoursePageFormEditorStoreParams {
  courseId: string;
  pageId: string;
  formBlockId: string;
  courseEnrolmentId: string;
  formTemplateId: string | null;
  formTemplateSchemaId: string;
}

function validateRequiredFieldsCourse(doc: JSONContent): { ok: boolean; message?: string } {
  if (!doc?.content) return { ok: true };

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

  const walk = (node: JSONContent): boolean => {
    const attrs = (node as any).attrs || {};
    const required = attrs.required === true || attrs.required === 'true';
    const type = (node as any).type;

    if (required) {
      if (type === 'shortText' || type === 'longText' || type === 'richText') {
        if (!hasAnyText(node)) return true;
      }
      if (type === 'singleChoice') {
        const v = attrs.value;
        if (v === undefined || v === null || v === '') return true;
        if (v === '__other__' && !hasAnyText(node)) return true;
      }
      if (type === 'multipleChoice') {
        const v = attrs.value;
        if (!Array.isArray(v) || v.length === 0) return true;
        if (v.includes('__other__') && !hasAnyText(node)) return true;
      }
      if (type === 'numberField' || type === 'ratingField' || type === 'sliderField') {
        const v = attrs.value;
        if (v === undefined || v === null || v === '') return true;
      }
      if (type === 'dateField' || type === 'dateTimeField') {
        const v = attrs.value;
        if (v === undefined || v === null || v === '') return true;
      }
      if (type === 'addressField') {
        const v = attrs.formatted;
        if (!v || (typeof v === 'string' && !v.trim())) return true;
      }
      if (type === 'matrixField') {
        const cells = attrs.cells;
        if (!cells || typeof cells !== 'object') return true;
      }
    }

    if (Array.isArray((node as any).content)) {
      for (const child of (node as any).content) {
        if (walk(child)) return true;
      }
    }
    return false;
  };

  for (const node of doc.content || []) {
    if (walk(node)) {
      return { ok: false, message: 'Please fill in all required fields.' };
    }
  }
  return { ok: true };
}

function normalizeEditorContent(doc: JSONContent): JSONContent {
  if (!doc?.content) return doc;
  const filtered = doc.content.filter(
    (node: JSONContent) => !(node.type === 'paragraph' && !node.content)
  );
  return { ...doc, content: filtered };
}

/** Normalize node content to array (handles JSON array or ProseMirror Fragment from view) */
function contentToArray(content: any): any[] {
  if (!content) return [];
  if (Array.isArray(content)) return content;
  if (content?.content && Array.isArray(content.content)) return content.content;
  if (typeof content[Symbol.iterator] === 'function') return Array.from(content);
  return [];
}

/** Extract question label from node content (first paragraph/heading text) for drawer title and meta. Handles both JSON and ProseMirror node shapes. */
function extractQuestionLabelFromNode(node: { content?: any; attrs?: Record<string, any> }): string {
  const arr = contentToArray(node.content);
  if (!arr.length) return node.attrs?.label || node.attrs?.name || node.attrs?.id || 'Question';
  const extractText = (n: any): string => {
    if (!n) return '';
    // ProseMirror nodes expose text via .textContent
    if (typeof n.textContent === 'string' && n.textContent.trim()) return n.textContent.trim();
    // JSON text node
    const typeName = n?.type?.name ?? n?.type;
    if (typeName === 'text' && typeof n.text === 'string') return n.text;
    const inner = contentToArray(n.content);
    if (inner.length) return inner.map(extractText).join('');
    return '';
  };
  for (const child of arr) {
    const type = child?.type?.name ?? child?.type;
    if (type === 'paragraph' || type === 'heading') {
      const text = extractText(child)?.trim();
      if (text) return text;
    }
  }
  return node.attrs?.label || node.attrs?.name || node.attrs?.id || 'Question';
}

const AUTO_SAVE_DEBOUNCE_MS = 3000;

export interface CoursePageFormEditorProps {
  schema: JSONContent;
  initialContent: JSONContent;
  mode: 'readonly' | 'submit';
  storeParams: CoursePageFormEditorStoreParams;
  onStore: (answers: { type: string; content?: unknown }) => Promise<void>;
  onSubmitRecord: () => Promise<void>;
  onSuccess: () => void;
  pageTitle: string;
  formTitle: string;
  progressUrl: string;
  /** When true, auto-save (store) is not called on editor changes. */
  disableAutoSave?: boolean;
  /** When false, template/form has approval disabled; question-level approval is not used. From form block configSet. */
  templateHasApproval?: boolean;
  /** Approvers from configSet (for question approval drawer). */
  approvers?: Array<{ _id: string; name: string }>;
}

interface SelectedQuestionForApproval {
  questionKey: string;
  questionLabel: string;
  questionNode: { type: string; attrs: Record<string, any>; content?: any };
}

const CoursePageFormEditor: React.FC<CoursePageFormEditorProps> = ({
  schema,
  initialContent,
  mode,
  storeParams,
  onStore,
  onSubmitRecord,
  onSuccess,
  pageTitle,
  formTitle,
  progressUrl,
  disableAutoSave = false,
  templateHasApproval = false,
  approvers,
}) => {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.xs === true;

  const goToProgress = useCallback(() => {
    navigate(progressUrl);
  }, [navigate, progressUrl]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSaveError, setLastAutoSaveError] = useState<string | null>(null);
  const [courseApprovalDrawerOpen, setCourseApprovalDrawerOpen] = useState(false);
  const [selectedQuestionForApproval, setSelectedQuestionForApproval] = useState<SelectedQuestionForApproval | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string | null>(null);
  const performAutoSaveRef = useRef<() => Promise<void>>(() => Promise.resolve());
  /** Sync initial content only once to avoid loop: store → refetch → initialContent change → setJSON → onUpdate → save again */
  const hasInitialSyncRef = useRef(false);

  const submitExtensions = useMemo(
    () => (extensions || []).filter((ext: any) => ext?.name !== 'slashCommand'),
    []
  );

  const tiptap = useTiptapInstance({
    extensions: submitExtensions,
    onUpdate: () => {
      if (mode !== 'submit' || disableAutoSave) return;
      try {
        const currentContent = JSON.stringify(tiptap.getJSON() || {});
        if (currentContent === lastSavedContentRef.current) return;
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        autoSaveTimeoutRef.current = setTimeout(() => {
          if (tiptap.editor) {
            const contentAtSave = JSON.stringify(tiptap.getJSON() || {});
            if (contentAtSave !== lastSavedContentRef.current) {
              performAutoSaveRef.current();
            }
          }
          autoSaveTimeoutRef.current = null;
        }, AUTO_SAVE_DEBOUNCE_MS);
      } catch {
        // ignore
      }
    },
    initialContent,
    mode,
  });

  const performAutoSave = useCallback(async () => {
    if (mode !== 'submit') return;
    const json = tiptap.getJSON();
    if (!json) return;
    const cleaned = normalizeEditorContent(json);
    const contentStr = JSON.stringify(cleaned);
    if (contentStr === lastSavedContentRef.current) return;

    setIsAutoSaving(true);
    setLastAutoSaveError(null);
    try {
      await onStore(cleaned as { type: string; content?: unknown });
      lastSavedContentRef.current = contentStr;
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Auto-save failed';
      setLastAutoSaveError(msg);
    } finally {
      setIsAutoSaving(false);
    }
  }, [mode, onStore, tiptap]);

  performAutoSaveRef.current = performAutoSave;

  useEffect(() => {
    if (!tiptap.editor || !schema || hasInitialSyncRef.current) return;
    hasInitialSyncRef.current = true;
    try {
      const parsedDoc = parseSchemaDocument(initialContent);
      tiptap.setJSON(parsedDoc);
      lastSavedContentRef.current = JSON.stringify(normalizeEditorContent(parsedDoc));
    } catch {
      tiptap.setJSON(schema);
      lastSavedContentRef.current = JSON.stringify(normalizeEditorContent(schema));
    }
  }, [schema, initialContent, tiptap.editor]);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!tiptap.editor || !storeParams) return;
    const storage = tiptap.editor.storage as any;
    storage.formBuilder = storage.formBuilder ?? {};
    storage.formBuilder.templateHasApproval = templateHasApproval;
    storage.formBuilder.openQuestionApprovalDrawer = (
      questionNode: { type: string; attrs: Record<string, any>; content?: any },
      _subjectContext: unknown // passed by view; kept for API compatibility
    ) => {
      void _subjectContext;
      const questionKey =
        questionNode.attrs?.id || questionNode.attrs?.name || questionNode.attrs?.label || questionNode.type;
      const questionLabel = extractQuestionLabelFromNode(questionNode);
      setSelectedQuestionForApproval({
        questionKey: String(questionKey),
        questionLabel,
        questionNode: {
          type: questionNode.type,
          attrs: { ...questionNode.attrs },
          content: questionNode.content,
        },
      });
      setCourseApprovalDrawerOpen(true);
    };
  }, [tiptap.editor, storeParams, templateHasApproval]);

  const handleSubmit = useCallback(async () => {
    const json = tiptap.getJSON();
    if (!json) return;
    const cleaned = normalizeEditorContent(json);
    const validation = validateRequiredFieldsCourse(cleaned);
    if (!validation.ok) {
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
      throw new Error(validation.message);
    }

    setIsSubmitting(true);
    try {
      await onStore(cleaned as { type: string; content?: unknown });
      await onSubmitRecord();
      onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  }, [tiptap, onStore, onSubmitRecord, onSuccess]);

  const handleSubmitClick = useCallback(async () => {
    try {
      await handleSubmit();
    } catch (err: any) {
      const msg = err?.message || err?.data?.message || 'Failed to submit form. Please try again.';
      message.error(msg);
    }
  }, [handleSubmit]);

  return (
    <>
      <Affix offsetTop={isMobile ? 56 : 64}>
        <div
          style={{
            background: token.colorBgContainer,
            boxShadow: token.boxShadowTertiary,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            padding: isMobile ? 12 : 16,
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: isMobile ? 12 : 0,
            zIndex: 100,
            borderRadius: isMobile ? 12 : 16,
          }}
        >
          <Space size={8} align="center" style={{ flex: isMobile ? undefined : '1 1 auto', minWidth: 0 }}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={goToProgress}
              size={isMobile ? 'small' : 'middle'}
              style={{ flexShrink: 0 }}
            />
            <Typography.Title
              level={isMobile ? 5 : 4}
              style={{
                margin: 0,
                flex: '1 1 auto',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: isMobile ? 'normal' : 'nowrap',
              }}
            >
              {pageTitle}: {formTitle}
            </Typography.Title>
            {mode === 'readonly' && (
              <Tag color="success" style={{ flexShrink: 0 }}>
                Submitted.
              </Tag>
            )}
          </Space>

          <Space
            wrap
            size={isMobile ? 8 : undefined}
            style={{
              flex: isMobile ? undefined : '0 0 auto',
              width: isMobile ? '100%' : undefined,
              justifyContent: isMobile ? 'flex-end' : undefined,
            }}
          >
            {mode === 'submit' && !disableAutoSave && (
              <span style={{ color: token.colorTextSecondary, fontSize: isMobile ? 12 : 13 }}>
                {isAutoSaving ? 'Saving...' : lastAutoSaveError ? 'Save failed' : 'Auto-saved'}
              </span>
            )}
            {mode === 'submit' && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={isSubmitting}
                onClick={handleSubmitClick}
                size={isMobile ? 'small' : 'middle'}
                style={isMobile ? { flex: 1, minWidth: 0 } : undefined}
              >
                Submit form
              </Button>
            )}
          </Space>
        </div>
      </Affix>

      <div style={{ marginTop: 24 }}>
        <TemplateEditor instance={tiptap} />
      </div>

      {storeParams && selectedQuestionForApproval && (
        <CourseQuestionApprovalDrawer
          open={courseApprovalDrawerOpen}
          onClose={() => {
            setCourseApprovalDrawerOpen(false);
            setSelectedQuestionForApproval(null);
          }}
          courseId={storeParams.courseId}
          pageId={storeParams.pageId}
          formBlockId={storeParams.formBlockId}
          questionKey={selectedQuestionForApproval.questionKey}
          courseEnrolmentId={storeParams.courseEnrolmentId}
          questionLabel={selectedQuestionForApproval.questionLabel}
          questionNode={selectedQuestionForApproval.questionNode}
          questionRequired={selectedQuestionForApproval.questionNode?.attrs?.required === true || selectedQuestionForApproval.questionNode?.attrs?.required === 'true'}
          courseOrFormContext={formTitle}
          templateHasApproval={templateHasApproval}
          approvers={approvers}
          updateNodeAttributes={(attrs) => {
            if (tiptap.editor && selectedQuestionForApproval) {
              const success = updateNodeAttributesInEditor(
                tiptap.editor,
                {
                  type: selectedQuestionForApproval.questionNode.type,
                  attrs: selectedQuestionForApproval.questionNode.attrs,
                },
                attrs
              );
              if (success) {
                const updatedNode = tiptap.editor.getJSON();
                if (updatedNode) {
                  const found = findNodeInJSONContent(updatedNode, {
                    type: selectedQuestionForApproval.questionNode.type,
                    attrs: selectedQuestionForApproval.questionNode.attrs,
                  });
                  if (found?.node) {
                    setSelectedQuestionForApproval((prev) =>
                      prev
                        ? {
                            ...prev,
                            questionNode: {
                              ...prev.questionNode,
                              attrs: found.node.attrs as Record<string, any>,
                            },
                          }
                        : null
                    );
                  }
                }
                // Persist approval status: trigger store so updated node attrs (approvalStatus) are saved
                if (mode === 'submit' && !disableAutoSave) {
                  performAutoSaveRef.current();
                }
              }
            }
          }}
        />
      )}
    </>
  );
};

export default CoursePageFormEditor;
