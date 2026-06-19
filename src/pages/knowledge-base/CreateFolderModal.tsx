import React, { useState } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { useCreateKnowledgeBaseFolderMutation } from '../../services/knowledgeBaseApi';
import type { KnowledgeBaseFolder } from '../../services/knowledgeBaseApi';

export interface CreateFolderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (folder: { _id: string; name: string }) => void;
  parentId?: string | null; // Parent folder ID for nested folder creation
}

const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  open,
  onClose,
  onSuccess,
  parentId,
}) => {
  const [form] = Form.useForm();
  const [createFolder, { isLoading }] = useCreateKnowledgeBaseFolderMutation();
  const [submitting, setSubmitting] = useState(false);

  const handleOk = async () => {
    try {
      const { name } = await form.validateFields();
      setSubmitting(true);

      // Create folder with optional parent for nesting
      const result = await createFolder({
        name,
        parent: parentId || undefined,
      }).unwrap();

      const folder: KnowledgeBaseFolder | undefined = result?.data?.folder;
      message.success('Folder created');
      if (folder?._id) onSuccess?.({ _id: folder._id, name: folder.name || name });
      form.resetFields();
      onClose();
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      message.error(err?.data?.message || 'Failed to create folder');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={parentId ? 'Create subfolder' : 'Create folder'}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={isLoading || submitting}
      destroyOnHidden
      okText="Create"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="Folder name"
          rules={[{ required: true, message: 'Enter folder name' }]}
        >
          <Input placeholder="e.g. Onboarding" autoFocus />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateFolderModal;
