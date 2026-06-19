import { Modal, Form, Input, Select, DatePicker, message } from 'antd';
import { PROFILE_DOCUMENT_TYPE_LABELS, PROFILE_DOCUMENT_ACCEPT } from '../../../constants/profileDocument';
import {
  useCreateProfileDocumentMutation,
  type ProfileDocumentType,
} from '../../../services/profileDocumentsApi';
import { DocumentFileUpload } from './DocumentFileUpload';
import dayjs from 'dayjs';

export interface UploadDocumentModalProps {
  open: boolean;
  profileId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export function UploadDocumentModal({ open, profileId, onCancel, onSuccess }: UploadDocumentModalProps) {
  const [form] = Form.useForm();
  const [createDocument, { isLoading: isCreating }] = useCreateProfileDocumentMutation();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const rawFile = values.file?.fileList?.[0]?.originFileObj ?? values.file?.[0]?.originFileObj ?? values.file;
      const fileObj = rawFile instanceof File ? rawFile : undefined;
      if (!fileObj) {
        message.error('Please select a file.');
        return;
      }
      await createDocument({
        profileId,
        documentType: values.documentType as ProfileDocumentType,
        title: values.title,
        description: values.description || undefined,
        expirationDate: values.expirationDate ? dayjs(values.expirationDate).toISOString() : undefined,
        file: fileObj,
      }).unwrap();
      message.success('Document uploaded.');
      onSuccess();
      form.resetFields();
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string };
      message.error(err?.data?.message || err?.message || 'Upload failed.');
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="Upload document"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={isCreating}
      okText="Upload"
      destroyOnHidden
      width={480}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="documentType"
          label="Document type"
          rules={[{ required: true }]}
          initialValue="certificate"
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
                const startOfToday = dayjs().startOf('day');
                if (date.isBefore(startOfToday)) {
                  return Promise.reject(new Error('Expiration date cannot be in the past'));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <DatePicker
            style={{ width: '100%' }}
            disabledDate={(current) => current && current.isBefore(dayjs())}
          />
        </Form.Item>
        <Form.Item
          name="file"
          label="File"
          valuePropName="fileList"
          getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList ?? [])}
          rules={[
            {
              validator: (_, fileList) => {
                const hasFile =
                  Array.isArray(fileList) &&
                  fileList.length > 0 &&
                  fileList[0]?.originFileObj instanceof File;
                return hasFile ? Promise.resolve() : Promise.reject(new Error('Please select a file'));
              },
            },
          ]}
        >
          <DocumentFileUpload accept={PROFILE_DOCUMENT_ACCEPT} maxSizeMB={50} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
