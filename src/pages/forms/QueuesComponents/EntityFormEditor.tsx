import React from 'react';
import { Card, Spin } from 'antd';
import { TemplateEditor } from '../../CanvasBuilderPage';
import { useTiptapInstance } from '../../../hooks/useTiptapInstance';
import { extensions } from '../../CanvasBuilderPage/Editor/extensions';
import { JSONContent } from '@tiptap/core';

// Utility function to normalize editor content
const normalizeEditorContent = (doc: JSONContent | null) => {
  if (!doc?.content) return doc;
  const filtered = doc.content.filter(
    (node: JSONContent) => !(node.type === 'paragraph' && !node.content)
  );
  return { ...doc, content: filtered };
};

interface EntityFormEditorProps {
  entityId: string;
  entityName: string;
  schema: JSONContent | null;
  initialAnswers?: JSONContent;
  onUpdate: (entityId: string, answers: JSONContent) => void;
}

export const EntityFormEditor: React.FC<EntityFormEditorProps> = ({
  entityId,
  entityName,
  schema,
  initialAnswers,
  onUpdate,
}) => {
  const submitExtensions = React.useMemo(() => {
    try {
      return (extensions || []).filter((ext: any) => ext?.name !== 'slashCommand');
    } catch {
      return extensions;
    }
  }, []);

  // Use ref to store the callback to avoid stale closures
  const onUpdateRef = React.useRef(onUpdate);
  const entityIdRef = React.useRef(entityId);
  
  React.useEffect(() => {
    onUpdateRef.current = onUpdate;
    entityIdRef.current = entityId;
  }, [onUpdate, entityId]);

  // Track if we've initialized to prevent infinite loops
  const initializedRef = React.useRef(false);
  const lastSchemaRef = React.useRef<string | null>(null);
  const updateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isSettingContentRef = React.useRef(false);
  
  const tiptap = useTiptapInstance({
    extensions: submitExtensions,
    onUpdate: (editor) => {
      // Don't trigger updates while we're setting content or before initialization
      if (!editor || !initializedRef.current || isSettingContentRef.current) {
        return;
      }
      
      // Clear any pending updates
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // Debounce the update to prevent rapid-fire updates
      updateTimeoutRef.current = setTimeout(() => {
        if (isSettingContentRef.current) return; // Still setting content, skip
        try {
          const json = editor.getJSON();
          if (json) {
            onUpdateRef.current(entityIdRef.current, json);
          }
        } catch (error) {
          console.error('Error getting JSON from editor:', error);
        }
      }, 300); // 300ms debounce
    },
    initialContent: initialAnswers || schema || '',
    mode: 'submit',
  });

  // Initialize editor content once
  React.useEffect(() => {
    if (!tiptap.editor || initializedRef.current) return;
    
    // Only initialize once per schema change
    const schemaStr = schema ? JSON.stringify(schema) : null;
    if (lastSchemaRef.current === schemaStr) {
      return; // Already initialized with this schema
    }
    
    if (schema) {
      isSettingContentRef.current = true;
      const sanitized = normalizeEditorContent(schema);
      // If we have initial answers, use those; otherwise use schema
      if (initialAnswers) {
        tiptap.setJSON(initialAnswers);
      } else {
        tiptap.setJSON(sanitized ?? '');
      }
      initializedRef.current = true;
      lastSchemaRef.current = schemaStr;
      
      // Allow updates after a short delay
      setTimeout(() => {
        isSettingContentRef.current = false;
      }, 500);
    }
  }, [schema, tiptap.editor]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);


  return (
    <Card
      size="small"
      title={entityName}
      style={{
        borderRadius: 12,
        background: 'transparent',
        width: '100%',
        marginBottom: 16,
      }}
    >
      {tiptap.editor ? (
        <TemplateEditor instance={tiptap} />
      ) : (
        <Spin tip="Editor initializing..." />
      )}
    </Card>
  );
};

