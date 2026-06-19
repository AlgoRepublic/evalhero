import React, { useState } from 'react';
import { Modal, Form, Input, message } from 'antd';
import {
  useCreateFormTemplateFolderMutation,
  type FormTemplateFolder,
} from '../../../services/templatesAPI';

export interface CreateFormTemplateFolderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (folder: { _id: string; name: string }) => void;
  parentId?: string | null;
}

const CreateFormTemplateFolderModal: React.FC<CreateFormTemplateFolderModalProps> = ({
  open,
  onClose,
  onSuccess,
  parentId,
}) => {
  const [form] = Form.useForm();
  const [createFolder, { isLoading }] = useCreateFormTemplateFolderMutation();
  const [submitting, setSubmitting] = useState(false);

  const handleOk = async () => {
    try {
      const { name } = await form.validateFields();
      setSubmitting(true);
      const result = await createFolder({
        name,
        parent: parentId || undefined,
      }).unwrap();
      const folder: FormTemplateFolder | undefined = result?.data?.folder;
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
      destroyOnClose
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

export default CreateFormTemplateFolderModal;
