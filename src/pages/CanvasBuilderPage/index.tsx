import React, { useEffect } from 'react';
import { EditorContent } from '@tiptap/react';
import { Form, Spin } from 'antd';
import DragHandle from '@tiptap/extension-drag-handle-react';
import { EditingNodePayload } from '../../types/template';
import './Editor/tittap.css';
import { normalizeFormValues } from './utils';
import { MenuBar } from './Editor/MenuBar';
import type { TiptapInstance } from '../../hooks/useTiptapInstance';

interface TemplateEditorProps {
  instance: TiptapInstance;
  readOnly?: boolean;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({
  instance,
  // readOnly = false,
}) => {
  const { editor } = instance;

  const mode = (editor?.storage as any).formBuilder?.mode || 'readonly';

  // const IsSubmitMode = mode === 'submit';
  // const isReadonlyMode = mode === 'readonly';
  const isEditMode = mode === 'edit';

  const [form] = Form.useForm();

  // Set up editing node callback
  useEffect(() => {
    if (editor) {
      (editor as any).options = {
        ...(editor as any).options,
        onSetEditingNode: (payload: EditingNodePayload) => {
          // setEditingNode(payload);
          // Populate form with current node values
          const initialValues = normalizeFormValues(
            payload.attrs,
            payload.type
          );
          form.setFieldsValue(initialValues);
        },
      };
    }
  }, [editor, form]);

  if (!editor) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin tip="Loading editor..." />
      </div>
    );
  }

  editor.setEditable(isEditMode);

  // const handleSaveNode = useCallback(async () => {
  //   if (!editingNode || !editor) return;

  //   try {
  //     const values = await form.validateFields();
  //     const normalized = normalizeNodeAttributes(values, editingNode.type);

  //     editingNode.updateAttributes(normalized);
  //     setEditingNode(null);
  //     form.resetFields();
  //     message.success('Field updated successfully');
  //   } catch (error) {
  //     console.error('Error saving node:', error);
  //     message.error('Failed to update field');
  //   }
  // }, [editingNode, form, editor]);

  // const handleCancel = () => {
  //   setEditingNode(null);
  //   form.resetFields();
  // };

  // if (!editor) {
  //   return (
  //     <div style={{ padding: 32, textAlign: 'center' }}>Loading editor...</div>
  //   );
  // }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {isEditMode && <MenuBar editor={editor} />}
        <div style={{ position: 'relative' }}>
          <EditorContent
            editor={editor}
            style={{
              border: '1px solid #d9d9d9',
              borderRadius: 8,
              // minHeight: 400,
              padding: '16px 4px',
            }}
            className="form-editor"
          />
          <DragHandle editor={editor}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              style={{ width: 16, height: 16, cursor: 'move' }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 9h16.5m-16.5 6.75h16.5"
              />
            </svg>
          </DragHandle>
        </div>
      </div>
    </>
  );
};

export { TemplateEditor };
