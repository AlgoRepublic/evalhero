import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import type { JSONContent } from '@tiptap/core';

interface RichTextRendererProps {
  content: string | JSONContent | null | undefined;
  className?: string;
}

/**
 * RichTextRenderer - A readonly Tiptap editor instance for rendering JSONContent
 * 
 * This component uses Tiptap's readonly mode to properly render rich text content
 * that was stored as JSONContent, ensuring all formatting, marks, and structure
 * are correctly displayed.
 */
export const RichTextRenderer: React.FC<RichTextRendererProps> = ({
  content,
  className = '',
}) => {
  // Parse content: handle string (JSON string or HTML), JSONContent object, or null/undefined
  const parseContent = (val: string | JSONContent | null | undefined): JSONContent | string => {
    if (!val || val === '' || val === '<p></p>') {
      return { type: 'doc', content: [{ type: 'paragraph' }] };
    }

    // If it's already a JSONContent object
    if (typeof val === 'object' && val !== null && (val as any).type === 'doc') {
      return val as JSONContent;
    }

    // If it's a string, try to parse as JSON first
    if (typeof val === 'string') {
      const trimmed = val.trim();
      
      // Strategy 1: Direct JSON parse if it starts with {
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(val);
          if (parsed && parsed.type === 'doc') {
            return parsed;
          }
        } catch {
          // Not valid JSON, continue
        }
      }

      // Strategy 2: If it's a quoted JSON string, unquote first
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        try {
          const unquoted = JSON.parse(val);
          if (typeof unquoted === 'string' && unquoted.trim().startsWith('{')) {
            const parsed = JSON.parse(unquoted);
            if (parsed && parsed.type === 'doc') {
              return parsed;
            }
          }
        } catch {
          // Not valid, continue
        }
      }

      // Strategy 3: Try unescaping if it contains escaped quotes
      if (val.includes('\\"') || val.includes('\\{')) {
        try {
          const parsedString = JSON.parse(val);
          if (typeof parsedString === 'string' && parsedString.trim().startsWith('{')) {
            const parsed = JSON.parse(parsedString);
            if (parsed && parsed.type === 'doc') {
              return parsed;
            }
          }
        } catch {
          // Try manual unescaping
          try {
            const unescaped = val
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\')
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\r/g, '\r');
            
            if (unescaped.trim().startsWith('{')) {
              const parsed = JSON.parse(unescaped);
              if (parsed && parsed.type === 'doc') {
                return parsed;
              }
            }
          } catch {
            // Not valid JSON after unescaping
          }
        }
      }

      // If all JSON parsing fails, treat as HTML string
      return val;
    }

    return { type: 'doc', content: [{ type: 'paragraph' }] };
  };

  const parsedContent = parseContent(content);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyleKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
    ],
    content: parsedContent,
    editable: false, // Readonly mode
    editorProps: {
      attributes: {
        class: `rich-text-renderer ${className}`,
        spellcheck: 'false',
      },
    },
  });

  // Update content when it changes
  useEffect(() => {
    if (!editor) return;
    const newContent = parseContent(content);
    const currentContent = editor.getJSON();
    
    // Only update if content actually changed
    if (JSON.stringify(currentContent) !== JSON.stringify(newContent)) {
      if (typeof newContent === 'object' && newContent.type === 'doc') {
        editor.commands.setContent(newContent);
      } else if (typeof newContent === 'string') {
        editor.commands.setContent(newContent);
      }
    }
  }, [editor, content]);

  if (!editor) {
    return null;
  }

  return (
    <div className={`rich-text-renderer-wrapper ${className}`}>
      <EditorContent editor={editor} />
    </div>
  );
};
