import React, { useEffect, useState } from 'react';
import { Modal, Form, Select, message } from 'antd';

/** Use empty string for Uncategorized in options; modal passes null to onMove for that. */
export const UNCATEGORIZED_VALUE = '';

export interface MoveToFolderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Modal title, e.g. "Move template" */
  title: string;
  /** Name of the item being moved (for confirmation message) */
  itemName: string;
  /** Options: include { label: 'Uncategorized', value: UNCATEGORIZED_VALUE } plus folder list */
  folderOptions: Array<{ label: string; value: string }>;
  /** Current folder id of the item (null/empty = uncategorized) */
  currentFolderId: string | null;
  /** Called when user confirms; receives target folder id or null for uncategorized */
  onMove: (folderId: string | null) => Promise<void>;
  /** Loading state while move request is in progress */
  loading?: boolean;
}

export const MoveToFolderModal: React.FC<MoveToFolderModalProps> = ({
  open,
  onClose,
  onSuccess,
  title,
  itemName,
  folderOptions,
  currentFolderId,
  onMove,
  loading = false,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      // Set initial value - always initialize with a valid value
      const initialValue = currentFolderId === null || currentFolderId === undefined ? UNCATEGORIZED_VALUE : currentFolderId;
      form.setFieldsValue({ folder: initialValue });
    }
  }, [open, currentFolderId, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      // Convert form value to null for Uncategorized (empty string) or undefined
      const folderId = !values.folder || values.folder === UNCATEGORIZED_VALUE ? null : values.folder;
      await onMove(folderId);
      message.success('Moved successfully');
      form.resetFields();
      onClose();
      onSuccess?.();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        // validation error – Form handles it
        return;
      }
      message.error('Failed to move');
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
      title={title}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={submitting || loading}
      destroyOnHidden
      okText="Move"
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="Destination folder"
          name="folder"
          rules={[
            {
              validator: (_rule, value) => {
                // Allow empty string (Uncategorized) or any non-empty string (folder ID)
                if (value === '' || (typeof value === 'string' && value.length > 0)) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('Select a destination'));
              },
            },
          ]}
        >
          <Select
            placeholder="Select folder or Uncategorized"
            showSearch
            optionFilterProp="label"
            options={folderOptions}
          />
        </Form.Item>
      </Form>
      <span style={{ color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>
        Moving &quot;{itemName}&quot;
      </span>
    </Modal>
  );
};

export default MoveToFolderModal;
