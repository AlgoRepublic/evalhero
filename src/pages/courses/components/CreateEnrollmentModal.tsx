import React from 'react';
import {
  Modal,
  Form,
  Select,
  DatePicker,
  Input,
  message,
  Row,
  Col,
} from 'antd';
import {
  useCreateCourseEnrollmentMutation,
  useGetEligibleProfilesForEnrolmentQuery,
} from '../../../services/coursesApi';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface CreateEnrollmentModalProps {
  courseId: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateEnrollmentModal: React.FC<CreateEnrollmentModalProps> = ({
  courseId,
  open,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [createEnrollment, { isLoading }] = useCreateCourseEnrollmentMutation();
  const { data: eligibleProfilesData, isLoading: loadingEligibleProfiles } = 
    useGetEligibleProfilesForEnrolmentQuery(courseId);

  const eligibleProfiles = eligibleProfilesData?.data?.profiles || [];

  const handleSubmit = async (values: any) => {
    try {
      const payload: any = {
        courseId,
        enrollees: values.enrollees, // Array of enrollee IDs
      };

      // Convert Dayjs objects to ISO strings
      if (values.startDate) {
        payload.startDate = (values.startDate as Dayjs).toISOString();
      }
      if (values.dueDate) {
        payload.dueDate = (values.dueDate as Dayjs).toISOString();
      }
      if (values.endDate) {
        payload.endDate = (values.endDate as Dayjs).toISOString();
      }

      if (values.instructions) {
        payload.instructions = values.instructions;
      }
      if (values.notes) {
        payload.notes = values.notes;
      }

      const result = await createEnrollment(payload).unwrap();
      // Handle both array response (create) and paginated response (list)
      const enrolments = Array.isArray(result.data?.enrolments) 
        ? result.data.enrolments 
        : result.data?.enrolments?.records || [];
      const createdCount = enrolments.length;
      message.success(
        createdCount > 0
          ? `Successfully created ${createdCount} enrolment(s)`
          : 'Enrollment created successfully'
      );
      form.resetFields();
      onClose();
      onSuccess?.();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to create enrollment');
    }
  };

  return (
    <Modal
      title="Create Course Enrollment"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={isLoading}
      width={700}
      okText="Create"
      cancelText="Cancel"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="enrollees"
          label="Enrollees"
          rules={[
            { required: true, message: 'Please select at least one enrollee' },
            {
              type: 'array',
              min: 1,
              message: 'Please select at least one enrollee',
            },
          ]}
        >
          <Select
            mode="multiple"
            placeholder={loadingEligibleProfiles ? 'Loading eligible profiles...' : 'Select enrollees'}
            loading={loadingEligibleProfiles}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '')
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            options={eligibleProfiles.map((profile: any) => {
              const userName =
                profile.user?.name ||
                `${profile.firstName || ''} ${profile.lastName || ''}`.trim() ||
                profile.email ||
                profile._id;
              return {
                value: profile._id,
                label: userName,
              };
            })}
            notFoundContent={!loadingEligibleProfiles ? 'No eligible profiles found' : null}
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
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="instructions" label="Instructions">
          <TextArea
            rows={3}
            placeholder="Instructions for the enrollees"
          />
        </Form.Item>

        <Form.Item name="notes" label="Internal Notes">
          <TextArea
            rows={2}
            placeholder="Internal notes about this enrollment"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateEnrollmentModal;
