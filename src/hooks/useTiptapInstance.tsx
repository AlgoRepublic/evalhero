/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEditor, Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { message } from 'antd';
import { parseSchemaDocument } from '../pages/CanvasBuilderPage/Editor/utils';

export interface TiptapInstance {
  editor: Editor | null;
  getJSON: () => JSONContent | null;
  setJSON: (json: JSONContent | string) => void;
  destroy: () => void;
}

interface UseTiptapInstanceParams {
  extensions: any[];
  initialContent?: JSONContent | string;
  onUpdate?: (editor: Editor) => void;
  mode: 'edit' | 'readonly' | 'submit';
}

export function useTiptapInstance({
  extensions,
  initialContent = '',
  onUpdate,
  mode,
}: UseTiptapInstanceParams): TiptapInstance {
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor(
    {
      extensions,
      content: initialContent,
      editorProps: {
        attributes: {
          spellcheck: 'false',
          class: 'form-editor prose max-w-none',
        },
        handleKeyDown: (view, event) => {
          // const currentMode = (view.state as any)?.storedMarks
          //   ? (view as any).someRandom // force types to not complain
          //   : (view as any);
          const storageMode = (view as any)?.props?.editor?.storage?.formBuilder?.mode;
          const effectiveMode = storageMode ?? mode;
          if (effectiveMode === 'submit') {
            const target = event.target as HTMLElement | null;
            const inNested = !!target?.closest?.(
              '.nested-rich-editor, input, textarea, [contenteditable="true"], .ant-input, .ant-select-selector, .ant-picker-input input'
            );
            if (!inNested) {
              event.preventDefault();
              event.stopPropagation();
              return true;
            }
          }
          return false;
        },
        handlePaste: (view, event) => {
          const storageMode = (view as any)?.props?.editor?.storage?.formBuilder?.mode;
          const effectiveMode = storageMode ?? mode;
          if (effectiveMode !== 'submit') return false;
          const target = (event as ClipboardEvent).target as HTMLElement | null;
          const inNested = !!target?.closest?.('.nested-rich-editor');
          return inNested ? false : true;
        },
        handleDrop: (view, event) => {
          const storageMode = (view as any)?.props?.editor?.storage?.formBuilder?.mode;
          const effectiveMode = storageMode ?? mode;
          if (effectiveMode !== 'submit') return false;
          const target = (event as DragEvent).target as HTMLElement | null;
          const inNested = !!target?.closest?.('.nested-rich-editor');
          return inNested ? false : true;
        },
        handleDOMEvents: {
          dragstart: (view, event) => {
            const storageMode = (view as any)?.props?.editor?.storage?.formBuilder?.mode;
            const effectiveMode = storageMode ?? mode;
            if (effectiveMode === 'submit') {
              const target = event.target as HTMLElement | null;
              const inNested = !!target?.closest?.('.nested-rich-editor');
              if (!inNested) {
                event.preventDefault();
                event.stopPropagation();
                return true;
              }
            }
            return false;
          },
        },
      },
      onCreate: ({ editor }) => {
        editorRef.current = editor;
      },
      onUpdate: ({ editor }) => {
        onUpdate?.(editor);
      },
      onDestroy: () => {
        editorRef.current = null;
      },
      onMount: ({ editor }) => {
        // ensure formBuilder storage exists and set mode (use any to avoid TS error)
        const storage = editor.storage as any;
        storage.formBuilder = storage.formBuilder ?? {};
        false &&console.log('storage.formBuilder', storage.formBuilder);
        if (!storage.formBuilder.mode) {
          storage.formBuilder.mode = mode;
        }
        if (typeof storage.formBuilder.submitted !== 'boolean') {
          storage.formBuilder.submitted = false;
        }
        false && console.log('mode', mode);
        editor.setEditable(mode === 'submit' || mode === 'edit');
      },
    },
    [extensions]
  );

  const getJSON = useCallback((): JSONContent | null => {
    try {
      return editor?.getJSON() ?? null;
    } catch (error) {
      console.error('Failed to get editor JSON:', error);
      return null;
    }
  }, [editor]);

  const setJSON = useCallback(
    (json: JSONContent | string) => {
      if (!editor) return;
      try {
        let content = typeof json === 'string' ? JSON.parse(json) : json;
        
        // Parse schema to convert string booleans/numbers to proper types
        // This is needed because FormData converts everything to strings
        content = parseSchemaDocument(content);
        
        editor.commands.setContent(content, {
          emitUpdate: false,
        });
      } catch (err) {
        console.error('Invalid editor content:', err);
        message.error('Invalid JSON content');
      }
    },
    [editor]
  );

  const destroy = useCallback(() => {
    editor?.destroy();
  }, [editor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
      }
    };
  }, []);

  // Sync external mode prop into editor storage and editability
  useEffect(() => {
    if (!editor) return;
    const storage = editor.storage as any;
    storage.formBuilder = storage.formBuilder ?? {};
    storage.formBuilder.mode = mode;
    editor.setEditable(mode === 'submit' || mode === 'edit');
  }, [editor, mode]);

  return useMemo(
    () => ({
      editor,
      getJSON,
      setJSON,
      destroy,
    }),
    [editor, getJSON, setJSON, destroy]
  );
}
