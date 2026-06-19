import { Form, Input, InputNumber, Modal, Select, Switch } from 'antd';
import { useEffect } from 'react';
// import TagSelector from '../../components/TagSelector';

interface FileEditModalProps {
  open: boolean;
  onClose: () => void;
  nodeAttrs: {
    label?: string;
    allowedTypes?: string[];
    maxSizeBytes?: number;
    maxCount?: number;
    required?: boolean;
    uploadEndpoint?: string;
    deleteEndpoint?: string;
    [key: string]: unknown;
  };
  onSave: (values: {
    allowedTypes?: string[];
    maxSizeBytes?: number;
    maxCount?: number;
    required?: boolean;
    uploadEndpoint?: string;
    deleteEndpoint?: string;
  }) => void;
}

const COMMON_FILE_TYPES = [
  { label: 'PDF Documents', value: 'application/pdf' },
  { label: 'Images (JPEG)', value: 'image/jpeg' },
  { label: 'Images (PNG)', value: 'image/png' },
  { label: 'Images (JPG)', value: 'image/jpg' },
  { label: 'Images (All)', value: 'image/*' },
  { label: 'Documents (DOCX)', value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { label: 'Documents (DOC)', value: 'application/msword' },
  { label: 'Spreadsheets (XLSX)', value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { label: 'Text Files', value: 'text/plain' },
];

const FileEditModal = ({ open, onClose, nodeAttrs, onSave }: FileEditModalProps) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      // Convert maxSizeBytes to MB for display
      const maxSizeMB = nodeAttrs.maxSizeBytes
        ? Math.round((nodeAttrs.maxSizeBytes / (1024 * 1024)) * 100) / 100
        : 10;

      form.setFieldsValue({
        allowedTypes: nodeAttrs.allowedTypes || ['application/pdf', 'image/jpeg', 'image/png'],
        maxSizeMB,
        maxCount: nodeAttrs.maxCount || 5,
        required: nodeAttrs.required || false,
        uploadEndpoint: nodeAttrs.uploadEndpoint || '/api/uploads',
        deleteEndpoint: nodeAttrs.deleteEndpoint || '/api/files',
      });
    }
  }, [open, nodeAttrs, form]);

  const handleSubmit = () => {
    form
      .validateFields()
      .then((values) => {
        // Convert MB back to bytes
        const maxSizeBytes = values.maxSizeMB
          ? Math.round(values.maxSizeMB * 1024 * 1024)
          : 10 * 1024 * 1024;

        onSave({
          allowedTypes: values.allowedTypes,
          maxSizeBytes,
          maxCount: values.maxCount,
          required: values.required,
          uploadEndpoint: values.uploadEndpoint,
          deleteEndpoint: values.deleteEndpoint,
        });
      })
      .catch((info) => {
        console.error('Validation failed:', info);
      });
  };

  return (
    <Modal
      open={open}
      title="Edit File Field Settings"
      onCancel={onClose}
      onOk={handleSubmit}
      destroyOnHidden
      maskClosable={false}
      width={520}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
          maxSizeMB: 10,
          maxCount: 5,
          required: false,
          uploadEndpoint: '/api/uploads',
          deleteEndpoint: '/api/files',
        }}
      >
        <Form.Item
          name="allowedTypes"
          label="Allowed File Types"
          tooltip="Select file types that can be uploaded. Supports MIME types and file extensions (e.g., .pdf, .jpg)"
          rules={[
            {
              required: true,
              message: 'Please select at least one file type',
            },
          ]}
        >
          <Select
            mode="tags"
            placeholder="Select or type file types (e.g., application/pdf, image/jpeg, .pdf)"
            options={COMMON_FILE_TYPES}
            tokenSeparators={[',']}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          name="maxSizeMB"
          label="Maximum File Size (MB)"
          tooltip="Maximum size for each uploaded file in megabytes"
          rules={[
            {
              required: true,
              message: 'Please specify maximum file size',
            },
            {
              type: 'number',
              min: 0.1,
              max: 1000,
              message: 'File size must be between 0.1 MB and 1000 MB',
            },
          ]}
        >
          <InputNumber
            min={0.1}
            max={1000}
            step={0.1}
            precision={1}
            style={{ width: '100%' }}
            addonAfter="MB"
          />
        </Form.Item>

        <Form.Item
          name="maxCount"
          label="Maximum Number of Files"
          tooltip="Maximum number of files that can be uploaded"
          rules={[
            {
              required: true,
              message: 'Please specify maximum file count',
            },
            {
              type: 'number',
              min: 1,
              max: 50,
              message: 'File count must be between 1 and 50',
            },
          ]}
        >
          <InputNumber
            min={1}
            max={50}
            style={{ width: '100%' }}
            addonAfter="files"
          />
        </Form.Item>

        <Form.Item
          name="required"
          label="Required Field"
          tooltip="Whether at least one file must be uploaded"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="uploadEndpoint"
          label="Upload Endpoint"
          tooltip="API endpoint for file uploads"
          rules={[
            {
              required: true,
              message: 'Please specify upload endpoint',
            },
          ]}
        >
          <Input placeholder="/api/uploads" />
        </Form.Item>

        <Form.Item
          name="deleteEndpoint"
          label="Delete Endpoint"
          tooltip="API endpoint for file deletion (optional)"
        >
          <Input placeholder="/api/files" />
        </Form.Item>

        {/* <Form.Item name="tags" label="Tags">
          <TagSelector placeholder="Select tags for this field" />
        </Form.Item> */}
      </Form>
    </Modal>
  );
};

export default FileEditModal;
