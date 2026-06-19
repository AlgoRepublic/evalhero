import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, message, Spin, Typography, Space } from 'antd';
import { FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import {
  useGetKnowledgeBaseDocumentQuery,
  useUpdateKnowledgeBaseDocumentMutation,
  useGetKnowledgeBaseFoldersQuery,
} from '../../services/knowledgeBaseApi';
import { useGetTagsQuery } from '../../services/tagsApi';
import { usePermission } from '../../hooks/usePermission';

const { Text } = Typography;

export interface EditDocumentModalProps {
  open: boolean;
  documentId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
  onCreateFolder?: () => void;
}

const EditDocumentModal: React.FC<EditDocumentModalProps> = ({
  open,
  documentId,
  onClose,
  onSuccess,
  onCreateFolder,
}) => {
  const [form] = Form.useForm();
  const canCreateFolder = usePermission('knowledgebase::create');

  const { data, isLoading: loadingDoc } = useGetKnowledgeBaseDocumentQuery(documentId!, {
    skip: !documentId || !open,
  });
  const [updateDocument, { isLoading: saving }] = useUpdateKnowledgeBaseDocumentMutation();

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

  const document = data?.data?.document;

  useEffect(() => {
    if (document && open) {
      form.setFieldsValue({
        title: document.title,
        folder: document.folder?._id || undefined,
        tags: document.tags?.map((t) => t._id) ?? [],
      });
    }
  }, [document, form, open]);

  const handleSubmit = async (values: { title: string; folder?: string; tags?: string[] }) => {
    if (!documentId) return;
    try {
      await updateDocument({
        id: documentId,
        body: {
          title: values.title,
          folder: values.folder || null,
          tags: values.tags,
        },
      }).unwrap();
      message.success('Document updated');
      form.resetFields();
      onSuccess?.();
      onClose();
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      message.error(err?.data?.message || 'Failed to update document');
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={<><FileTextOutlined /> Edit Document</>}
      open={open}
      onOk={() => form.submit()}
      onCancel={handleCancel}
      confirmLoading={saving}
      destroyOnHidden
      okText="Save"
      width={600}
    >
      {loadingDoc && !document ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin tip="Loading..." />
        </div>
      ) : !document ? (
        <Text type="secondary">Document not found</Text>
      ) : (
        <>
          {/* Read-only file info */}
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 6,
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              File: {document.filePath?.split('/').pop() || document.title} 
              <br /> Re-upload not
              supported; you can change title, folder, and tags.
            </Text>
          </div>

          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              label="Title"
              name="title"
              rules={[{ required: true, message: 'Enter document title' }]}
            >
              <Input placeholder="Document title" disabled={saving} />
            </Form.Item>

            <Form.Item label="Folder" name="folder">
              <Select
                placeholder="Select folder (optional)"
                options={folderOptions}
                allowClear
                showSearch
                optionFilterProp="label"
                disabled={saving}
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
                disabled={saving}
              />
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  );
};

export default EditDocumentModal;
