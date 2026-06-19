import React from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  message,
} from 'antd';
import { useCreateCohortMutation } from '../../../services/coursesApi';

interface CreateCohortModalProps {
  courseId: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateCohortModal: React.FC<CreateCohortModalProps> = ({
  courseId,
  open,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [createCohort, { isLoading }] = useCreateCohortMutation();

  const handleSubmit = async (values: any) => {
    try {
      await createCohort({
        courseId,
        name: values.name,
        visibility: values.visibility || 'private',
        defaultThreadAssignments: values.defaultThreadAssignments || [],
        defaultModulePacing: values.defaultModulePacing
          ? {
              startDate: values.defaultModulePacing.startDate,
              endDate: values.defaultModulePacing.endDate,
            }
          : undefined,
      }).unwrap();
      message.success('Cohort created successfully');
      form.resetFields();
      onClose();
      onSuccess?.();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to create cohort');
    }
  };

  return (
    <Modal
      title="Create Cohort"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={isLoading}
      width={600}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="name"
          label="Cohort Name"
          rules={[{ required: true, message: 'Please enter cohort name' }]}
        >
          <Input placeholder="e.g., Class of 2025" />
        </Form.Item>

        <Form.Item
          name="visibility"
          label="Visibility"
          initialValue="private"
        >
          <Select>
            <Select.Option value="private">Private</Select.Option>
            <Select.Option value="public">Public</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateCohortModal;
