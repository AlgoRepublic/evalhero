import React from 'react';
import { Modal, Form, Input, Select, message, Upload, Space, Typography } from 'antd';
import { InboxOutlined, PlusOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import {
  useCreateKnowledgeBaseDocumentMutation,
  useGetKnowledgeBaseFoldersQuery,
} from '../../services/knowledgeBaseApi';
import { useGetTagsQuery } from '../../services/tagsApi';
import { usePermission } from '../../hooks/usePermission';

const { Dragger } = Upload;
const { Text } = Typography;

export interface AddDocumentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currentFolderId?: string | null; // Pre-select folder based on current view
  onCreateFolder?: () => void; // Callback to open create folder modal
}

const AddDocumentModal: React.FC<AddDocumentModalProps> = ({
  open,
  onClose,
  onSuccess,
  currentFolderId,
  onCreateFolder,
}) => {
  const [form] = Form.useForm();
  const [createDocument, { isLoading }] = useCreateKnowledgeBaseDocumentMutation();
  const canCreateFolder = usePermission('knowledgebase::create');

  // Fetch all folders for dropdown
  const { data: foldersData } = useGetKnowledgeBaseFoldersQuery({
    page: 1,
    perPage: 500,
    sortBy: 'name',
    order: 'asc',
  });
  const folders = foldersData?.data?.records ?? [];
  const folderOptions = folders.map((f) => {
    const pathParts = f.parents?.map((p) => p.name) || [];
    pathParts.push(f.name);
    return { label: pathParts.join(' / '), value: f._id };
  });

  // Fetch tags for dropdown
  const { data: tagsData } = useGetTagsQuery({ page: 1, perPage: 500, sortBy: 'name', order: 'asc' });
  const tags = tagsData?.data?.tags?.records ?? [];
  const tagOptions = tags.map((t) => ({ label: t.name, value: t._id }));

  // Set default folder when modal opens
  React.useEffect(() => {
    if (open && currentFolderId) {
      form.setFieldValue('folder', currentFolderId);
    }
  }, [open, currentFolderId, form]);

  const handleSubmit = async (values: {
    title: string;
    folder?: string;
    tags?: string[];
    file?: { originFileObj?: File }[];
  }) => {
    const list = values.file;
    const file = Array.isArray(list) && list[0]?.originFileObj ? list[0].originFileObj : undefined;
    if (!file) {
      message.error('Please select a file');
      return;
    }
    try {
      await createDocument({
        file,
        title: values.title,
        folder: values.folder || undefined,
        tags: values.tags,
      }).unwrap();
      message.success('Document uploaded');
      form.resetFields();
      onSuccess?.();
      onClose();
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      message.error(err?.data?.message || 'Failed to upload document');
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    maxCount: 1,
    beforeUpload: () => false,
    accept: '.pdf,.doc,.docx,.txt',
  };

  return (
    <Modal
      title="Upload Document"
      open={open}
      onOk={() => form.submit()}
      onCancel={handleCancel}
      confirmLoading={isLoading}
      destroyOnHidden
      okText="Upload"
      width={600}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label="Title"
          name="title"
          rules={[{ required: true, message: 'Enter document title' }]}
        >
          <Input placeholder="Document title" disabled={isLoading} />
        </Form.Item>

        <Form.Item label="Folder" name="folder">
          <Select
            placeholder="Select folder (optional)"
            options={folderOptions}
            allowClear
            showSearch
            optionFilterProp="label"
            disabled={isLoading}
            dropdownRender={
              canCreateFolder && onCreateFolder
                ? (menu) => (
                    <>
                      {menu}
                      <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0' }}>
                        <Space
                          style={{ cursor: 'pointer', color: '#1890ff' }}
                          onClick={() => {
                            onCreateFolder();
                          }}
                        >
                          <PlusOutlined />
                          <Text style={{ color: '#1890ff' }}>Create new folder</Text>
                        </Space>
                      </div>
                    </>
                  )
                : undefined
            }
          />
        </Form.Item>

        <Form.Item label="Tags" name="tags">
          <Select
            mode="multiple"
            placeholder="Select tags (optional)"
            options={tagOptions}
            allowClear
            showSearch
            optionFilterProp="label"
            maxTagCount="responsive"
            disabled={isLoading}
          />
        </Form.Item>

        <Form.Item
          label="File"
          name="file"
          valuePropName="fileList"
          getValueFromEvent={(e) => (e?.fileList ? e.fileList.slice(-1) : [])}
          rules={[
            {
              validator: (_, v) =>
                Array.isArray(v) && v.length > 0
                  ? Promise.resolve()
                  : Promise.reject(new Error('Please select a file')),
            },
          ]}
        >
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            </p>
            <p className="ant-upload-text">Click or drag a file (PDF, DOC, DOCX, TXT)</p>
          </Dragger>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddDocumentModal;
