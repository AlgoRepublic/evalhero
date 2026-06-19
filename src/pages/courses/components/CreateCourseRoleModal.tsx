import React from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  message,
  Checkbox,
  Space,
  Typography,
} from 'antd';
import {
  useCreateCourseRoleMutation,
  useGetCourseRolesQuery,
} from '../../../services/coursesApi';
import type { CourseRolePermissions } from '../../../types/course';

const { Text } = Typography;

interface CreateCourseRoleModalProps {
  courseId: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateCourseRoleModal: React.FC<CreateCourseRoleModalProps> = ({
  courseId,
  open,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [createRole, { isLoading }] = useCreateCourseRoleMutation();
  const { data: rolesData } = useGetCourseRolesQuery(courseId);
  const roles = rolesData?.data?.roles || [];

  const handleSubmit = async (values: any) => {
    try {
      const permissions: CourseRolePermissions = {
        manageCourse: values.manageCourse || false,
        manageMembers: values.manageMembers || false,
        manageCohorts: values.manageCohorts || false,
        manageChat: values.manageChat || false,
        gradeApprove: values.gradeApprove || false,
        viewAllSubmissions: values.viewAllSubmissions || false,
        viewCohortOnly: values.viewCohortOnly || false,
        issueCertificates: values.issueCertificates || false,
        issueBadges: values.issueBadges || false,
      };

      await createRole({
        courseId,
        name: values.name,
        parentRoleId: values.parentRoleId,
        permissions,
      }).unwrap();
      message.success('Role created successfully');
      form.resetFields();
      onClose();
      onSuccess?.();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to create role');
    }
  };

  return (
    <Modal
      title="Create Course Role"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={isLoading}
      width={700}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="name"
          label="Role Name"
          rules={[{ required: true, message: 'Please enter role name' }]}
        >
          <Input placeholder="e.g., Instructor, TA, Student" />
        </Form.Item>

        <Form.Item name="parentRoleId" label="Parent Role (Optional)">
          <Select placeholder="Select parent role" allowClear>
            {roles.map((role) => (
              <Select.Option key={role._id} value={role._id}>
                {role.name}
              </Select.Option>
            ))}
          </Select>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Sub-roles inherit permissions from parent role
          </Text>
        </Form.Item>

        <Form.Item label="Permissions">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Form.Item name="manageCourse" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>Manage Course (settings/pages/roles)</Checkbox>
            </Form.Item>
            <Form.Item name="manageMembers" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>Manage Members (enroll/invite/assign roles)</Checkbox>
            </Form.Item>
            <Form.Item name="manageCohorts" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>Manage Cohorts</Checkbox>
            </Form.Item>
            <Form.Item name="manageChat" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>Manage Chat (create threads, assign)</Checkbox>
            </Form.Item>
            <Form.Item name="gradeApprove" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>Grade/Approve (forms & gates)</Checkbox>
            </Form.Item>
            <Form.Item name="viewAllSubmissions" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>View All Submissions</Checkbox>
            </Form.Item>
            <Form.Item name="viewCohortOnly" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>View Cohort Only</Checkbox>
            </Form.Item>
            <Form.Item name="issueCertificates" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>Issue Certificates</Checkbox>
            </Form.Item>
            <Form.Item name="issueBadges" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>Issue Badges</Checkbox>
            </Form.Item>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateCourseRoleModal;
