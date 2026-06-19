import React from 'react';
import {
  Modal,
  Form,
  Select,
  message,
} from 'antd';
import {
  useEnrollMemberMutation,
  useGetCourseRolesQuery,
  useGetCourseCohortsQuery,
} from '../../../services/coursesApi';
import { useGetProfilesQuery } from '../../../services/profilesAPI';

interface EnrollMemberModalProps {
  courseId: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const EnrollMemberModal: React.FC<EnrollMemberModalProps> = ({
  courseId,
  open,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [enrollMember, { isLoading }] = useEnrollMemberMutation();
  const { data: rolesData } = useGetCourseRolesQuery(courseId);
  const { data: cohortsData } = useGetCourseCohortsQuery(courseId);
  const { data: profilesData } = useGetProfilesQuery({ page: 1, perPage: 100 });

  const roles = rolesData?.data?.roles || [];
  const cohorts = cohortsData?.data?.cohorts || [];
  const profiles = profilesData?.data?.profiles?.records || [];

  const handleSubmit = async (values: any) => {
    try {
      await enrollMember({
        courseId,
        userId: values.userId,
        roles: values.roles || [],
        cohorts: values.cohorts || [],
      }).unwrap();
      message.success('Member enrolled successfully');
      form.resetFields();
      onClose();
      onSuccess?.();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to enroll member');
    }
  };

  return (
    <Modal
      title="Enroll Member"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={isLoading}
      width={600}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="userId"
          label="User"
          rules={[{ required: true, message: 'Please select a user' }]}
        >
          <Select
            placeholder="Select a user"
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={profiles.map((profile: any) => ({
              value: profile._id,
              label: profile.user?.name || profile._id,
            }))}
          />
        </Form.Item>

        <Form.Item name="roles" label="Roles">
          <Select
            mode="multiple"
            placeholder="Select roles (optional)"
            options={roles.map((role) => ({
              value: role._id,
              label: role.name,
            }))}
          />
        </Form.Item>

        <Form.Item name="cohorts" label="Cohorts">
          <Select
            mode="multiple"
            placeholder="Select cohorts (optional)"
            options={cohorts.map((cohort) => ({
              value: cohort._id,
              label: cohort.name,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EnrollMemberModal;
