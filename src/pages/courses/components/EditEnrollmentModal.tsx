import React, { useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  DatePicker,
  Input,
  message,
  Row,
  Col,
  Alert,
} from 'antd';
import {
  useUpdateCourseEnrollmentMutation,
} from '../../../services/coursesApi';
import { useGetProfilesQuery } from '../../../services/profilesAPI';
import type { CourseEnrollment, UpdateEnrollmentDto } from '../../../types/course';
import dayjs, { Dayjs } from 'dayjs';
import { Profile } from '../../../features/auth/authSlice';

const { TextArea } = Input;

interface EditEnrollmentModalProps {
  courseId: string;
  enrollment: CourseEnrollment | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditEnrollmentModal: React.FC<EditEnrollmentModalProps> = ({
  courseId,
  enrollment,
  open,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [updateEnrollment, { isLoading }] = useUpdateCourseEnrollmentMutation();
  const { data: profilesData } = useGetProfilesQuery({ page: 1, perPage: 1000 });

  const profiles = profilesData?.data?.profiles?.records || [];

  // Check if enrollment status is 'pending' to enable field editing
  const isPendingStatus = enrollment?.status === 'pending';
  const canEditFields = isPendingStatus;

  useEffect(() => {
    if (enrollment && open) {
      // Extract enrollee ID (single enrollee, not array)
      const enrolleeId =
        typeof enrollment.enrollee === 'string'
          ? enrollment.enrollee
          : (enrollment.enrollee as Profile)?._id || '';

      form.setFieldsValue({
        enrollee: enrolleeId,
        startDate: enrollment.startDate
          ? dayjs(enrollment.startDate)
          : undefined,
        dueDate: enrollment.dueDate ? dayjs(enrollment.dueDate) : undefined,
        endDate: enrollment.endDate ? dayjs(enrollment.endDate) : undefined,
        instructions: enrollment.instructions || '',
        notes: enrollment.notes || '',
      });
    } else if (!open) {
      form.resetFields();
    }
  }, [enrollment, open, form]);

  interface FormValues {
    enrollee?: string;
    startDate?: Dayjs;
    dueDate?: Dayjs;
    endDate?: Dayjs;
    instructions?: string;
    notes?: string;
  }

  const handleSubmit = async (values: FormValues) => {
    if (!enrollment) return;

    try {
      const payload: UpdateEnrollmentDto = {};

      // Only include fields that are provided
      if (values.enrollee) {
        payload.enrollee = values.enrollee;
      }

      if (values.startDate) {
        payload.startDate = (values.startDate as Dayjs).toISOString();
      }
      if (values.dueDate) {
        payload.dueDate = (values.dueDate as Dayjs).toISOString();
      }
      if (values.endDate) {
        payload.endDate = (values.endDate as Dayjs).toISOString();
      }

      if (values.instructions !== undefined) {
        payload.instructions = values.instructions || undefined;
      }
      if (values.notes !== undefined) {
        payload.notes = values.notes || undefined;
      }

      await updateEnrollment({
        enrollmentId: enrollment._id,
        courseId,
        data: payload,
      }).unwrap();
      message.success('Enrollment updated successfully');
      form.resetFields();
      onClose();
      onSuccess?.();
    } catch (err: unknown) {
      const error = err as { data?: { message?: string } };
      message.error(error?.data?.message || 'Failed to update enrollment');
    }
  };

  return (
    <Modal
      title="Edit Course Enrollment"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={isLoading}
      width={700}
      okText="Update"
      cancelText="Cancel"
      okButtonProps={{ disabled: !canEditFields }}
    >
      {!canEditFields && (
        <Alert
          message="Fields can only be updated when enrollment status is 'pending'"
          description={enrollment ? `Current status: ${enrollment.status.replace('_', ' ').toUpperCase()}` : 'Unknown status'}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="enrollee"
          label="Enrollee"
          rules={[
            {
              required: true,
              message: 'Please select an enrollee',
            },
          ]}
        >
          <Select
            placeholder="Select enrollee"
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '')
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            options={profiles.map((profile: Profile & { firstName?: string; lastName?: string; email?: string }) => {
              const user = typeof profile.user === 'object' ? profile.user : null;
              const userName =
                user?.name ||
                `${profile.firstName || ''} ${profile.lastName || ''}`.trim() ||
                profile.email ||
                profile._id;
              return {
                value: profile._id,
                label: userName,
              };
            })}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item
              name="startDate"
              label="Start Date"
              rules={[
                {
                  validator: (_rule, value) => {
                    if (!value) return Promise.resolve();
                    const formValues = form.getFieldsValue();
                    if (formValues.endDate && dayjs(value).isAfter(dayjs(formValues.endDate))) {
                      return Promise.reject(new Error('Start date must be before or equal to end date'));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
              dependencies={['endDate']}
            >
              <DatePicker
                style={{ width: '100%' }}
                showTime
                format="YYYY-MM-DD HH:mm"
                disabled={!canEditFields}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="dueDate"
              label="Due Date"
              rules={[
                {
                  validator: (_rule, value) => {
                    if (!value) return Promise.resolve();
                    const formValues = form.getFieldsValue();
                    if (formValues.startDate && dayjs(value).isBefore(dayjs(formValues.startDate))) {
                      return Promise.reject(new Error('Due date must be after or equal to start date'));
                    }
                    if (formValues.endDate && dayjs(value).isAfter(dayjs(formValues.endDate))) {
                      return Promise.reject(new Error('Due date must be before or equal to end date'));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
              dependencies={['startDate', 'endDate']}
            >
              <DatePicker
                style={{ width: '100%' }}
                showTime
                format="YYYY-MM-DD HH:mm"
                disabled={!canEditFields}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="endDate"
              label="End Date"
              rules={[
                {
                  validator: (_rule, value) => {
                    if (!value) return Promise.resolve();
                    const formValues = form.getFieldsValue();
                    if (formValues.startDate && dayjs(value).isBefore(dayjs(formValues.startDate))) {
                      return Promise.reject(new Error('End date must be after or equal to start date'));
                    }
                    if (formValues.dueDate && dayjs(value).isBefore(dayjs(formValues.dueDate))) {
                      return Promise.reject(new Error('End date must be after or equal to due date'));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
              dependencies={['startDate', 'dueDate']}
            >
              <DatePicker
                style={{ width: '100%' }}
                showTime
                format="YYYY-MM-DD HH:mm"
                disabled={!canEditFields}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="instructions" label="Instructions">
          <TextArea 
            rows={3} 
            placeholder="Instructions for the enrollee"
            disabled={!canEditFields}
          />
        </Form.Item>

        <Form.Item name="notes" label="Internal Notes">
          <TextArea
            rows={2}
            placeholder="Internal notes about this enrollment"
            disabled={!canEditFields}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditEnrollmentModal;
