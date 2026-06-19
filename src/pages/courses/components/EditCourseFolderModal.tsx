import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, message, Spin, Typography } from 'antd';
import {
  useGetCourseFolderQuery,
  useUpdateCourseFolderMutation,
  useGetCourseFoldersQuery,
} from '../../../services/coursesApi';

const { Text } = Typography;

export interface EditCourseFolderModalProps {
  open: boolean;
  folderId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditCourseFolderModal: React.FC<EditCourseFolderModalProps> = ({
  open,
  folderId,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading: loadingFolder } = useGetCourseFolderQuery(folderId!, {
    skip: !folderId || !open,
  });
  const [updateFolder] = useUpdateCourseFolderMutation();
  const { data: foldersData } = useGetCourseFoldersQuery({
    page: 1,
    perPage: 500,
    sortBy: 'name',
    order: 'asc',
  });
  const allFolders = foldersData?.data?.records ?? [];
  const folder = data?.data?.folder;

  const parentOptions = allFolders
    .filter((f) => {
      if (f._id === folderId) return false;
      if (f.parents?.some((p) => p._id === folderId)) return false;
      return true;
    })
    .map((f) => {
      const pathParts = f.parents?.map((p) => p.name) || [];
      pathParts.push(f.name);
      return { label: pathParts.join(' / '), value: f._id };
    });

  useEffect(() => {
    if (folder && open) {
      form.setFieldsValue({
        name: folder.name,
        parent: folder.parent?._id || undefined,
      });
    }
  }, [folder, form, open]);

  const handleSubmit = async (values: { name: string; parent?: string }) => {
    if (!folderId) return;
    try {
      setSubmitting(true);
      await updateFolder({
        id: folderId,
        body: { name: values.name, parent: values.parent || null },
      }).unwrap();
      message.success('Folder updated');
      form.resetFields();
      onSuccess?.();
      onClose();
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      message.error(err?.data?.message || 'Failed to update folder');
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
      title="Edit Folder"
      open={open}
      onOk={() => form.submit()}
      onCancel={handleCancel}
      confirmLoading={submitting}
      destroyOnClose
      okText="Save"
      width={500}
    >
      {loadingFolder && !folder ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin tip="Loading..." />
        </div>
      ) : !folder ? (
        <Text type="secondary">Folder not found</Text>
      ) : (
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Folder Name"
            name="name"
            rules={[{ required: true, message: 'Enter folder name' }]}
          >
            <Input placeholder="e.g. Onboarding" disabled={submitting} />
          </Form.Item>
          <Form.Item
            label="Parent Folder"
            name="parent"
            help="Select a parent folder or leave empty for root level"
          >
            <Select
              placeholder="Root (no parent)"
              options={parentOptions}
              allowClear
              showSearch
              optionFilterProp="label"
              disabled={submitting}
            />
          </Form.Item>
          {folder.parents && folder.parents.length > 0 && (
            <div
              style={{
                marginTop: 8,
                padding: 12,
                background: '#fafafa',
                borderRadius: 6,
                border: '1px solid #f0f0f0',
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                Current path:{' '}
                <Text strong style={{ fontSize: 12 }}>
                  {folder.parents.map((p) => p.name).join(' / ')} / {folder.name}
                </Text>
              </Text>
            </div>
          )}
        </Form>
      )}
    </Modal>
  );
};

export default EditCourseFolderModal;
