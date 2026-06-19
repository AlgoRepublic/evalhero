import { Modal, Form, Input, Select, DatePicker, message } from 'antd';
import { PROFILE_DOCUMENT_TYPE_LABELS, PROFILE_DOCUMENT_ACCEPT } from '../../../constants/profileDocument';
import {
  useUpdateProfileDocumentMutation,
  type ProfileDocumentRecord,
  type ProfileDocumentType,
} from '../../../services/profileDocumentsApi';
import { DocumentFileUpload } from './DocumentFileUpload';
import dayjs from 'dayjs';
import { useEffect } from 'react';

export interface EditDocumentModalProps {
  open: boolean;
  profileId: string;
  document: ProfileDocumentRecord | null;
  onCancel: () => void;
  onSuccess: () => void;
}

export function EditDocumentModal({
  open,
  profileId,
  document,
  onCancel,
  onSuccess,
}: EditDocumentModalProps) {
  const [form] = Form.useForm();
  const [updateDocument, { isLoading: isUpdating }] = useUpdateProfileDocumentMutation();

  useEffect(() => {
    if (open && document) {
      form.setFieldsValue({
        documentType: document.documentType,
        title: document.title,
        description: document.description ?? undefined,
        expirationDate: document.expirationDate ? dayjs(document.expirationDate) : undefined,
      });
    }
  }, [open, document, form]);

  const handleOk = async () => {
    if (!document) return;
    try {
      const values = await form.validateFields();
      const fileList = values.file;
      const first = Array.isArray(fileList) ? fileList[0] : fileList?.fileList?.[0];
      const fileObj =
        first instanceof File ? first : (first?.originFileObj instanceof File ? first.originFileObj : undefined);
      
      await updateDocument({
        id: document._id,
        profileId,
        documentType: values.documentType as ProfileDocumentType,
        title: values.title,
        description: values.description || undefined,
        expirationDate: values.expirationDate ? dayjs(values.expirationDate).toISOString() : undefined,
        ...(fileObj && { file: fileObj }),
      }).unwrap();
      message.success('Document updated.');
      onSuccess();
      form.resetFields();
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string };
      message.error(err?.data?.message || err?.message || 'Update failed.');
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  if (!document) return null;

  return (
    <Modal
      title="Edit document"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={isUpdating}
      okText="Update"
      destroyOnHidden
      width={480}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="documentType"
          label="Document type"
          rules={[{ required: true }]}
        >
          <Select
            options={Object.entries(PROFILE_DOCUMENT_TYPE_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </Form.Item>
        <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Required' }]}>
          <Input placeholder="e.g. Safety Training Certificate" />
        </Form.Item>
        <Form.Item name="description" label="Description (optional)">
          <Input.TextArea rows={2} placeholder="Optional notes" />
        </Form.Item>
        <Form.Item
          name="expirationDate"
          label="Expiration date (optional)"
          rules={[
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve();
                const date = dayjs(value);
                if (!date.isValid()) return Promise.reject(new Error('Enter a valid date'));
                return Promise.resolve();
              },
            },
          ]}
        >
          <DatePicker
            style={{ width: '100%' }}
            disabledDate={(current) => current && current.isBefore(dayjs(), 'day')}
          />
        </Form.Item>
        <Form.Item
          name="file"
          label="Replace file (optional)"
          valuePropName="fileList"
          getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList ?? [])}
        >
          <DocumentFileUpload accept={PROFILE_DOCUMENT_ACCEPT} maxSizeMB={50} />
        </Form.Item>
        {document?.file?.fileName && (
          <Form.Item label="Current file">
            <Input value={document.file.fileName} disabled />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
