import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../../components';
import { UserOutlined, SaveOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Form,
  Select,
  DatePicker,
  Input,
  Button,
  message,
  Space,
  Row,
  Col,
  Typography,
  theme,
  Spin,
  Alert,
  Affix,
  Grid,
} from 'antd';
import { PATH_COURSES } from '../../../constants/routes';
import {
  useUpdateCourseEnrollmentMutation,
  useGetCourseEnrollmentQuery,
  useGetCourseQuery,
} from '../../../services/coursesApi';
import { useGetProfilesQuery } from '../../../services/profilesAPI';
import dayjs, { Dayjs } from 'dayjs';
import { Profile } from '../../../features/auth/authSlice';
import type { UpdateEnrollmentDto } from '../../../types/course';

const { TextArea } = Input;
const { Title } = Typography;
const { useBreakpoint } = Grid;

const EditEnrollmentPage = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { token } = theme.useToken();
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // Fetch enrollment - courseId is optional according to API docs
  const { data: enrollmentData, isLoading: loadingEnrollment } =
    useGetCourseEnrollmentQuery(
      {
        enrollmentId: enrollmentId!,
      },
      { skip: !enrollmentId }
    );

  const enrollment = enrollmentData?.data?.enrolment;
  const courseId = typeof enrollment?.course === 'string' 
    ? enrollment.course 
    : enrollment?.course?._id;

  // Fetch course data if we have courseId
  const { data: courseData } = useGetCourseQuery(courseId!, {
    skip: !courseId,
  });

  const [updateEnrollment, { isLoading }] = useUpdateCourseEnrollmentMutation();
  const { data: profilesData } = useGetProfilesQuery({ page: 1, perPage: 1000 });

  const profiles = profilesData?.data?.profiles?.records || [];
  const course = courseData?.data?.course;

  // Check if enrollment status is 'pending' to enable field editing
  const isPendingStatus = enrollment?.status === 'pending';
  const canEditFields = isPendingStatus;

  useEffect(() => {
    if (enrollment && !loadingEnrollment) {
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
    }
  }, [enrollment, loadingEnrollment, form]);

  interface FormValues {
    enrollee?: string;
    startDate?: Dayjs;
    dueDate?: Dayjs;
    endDate?: Dayjs;
    instructions?: string;
    notes?: string;
  }

  const handleSubmit = async (values: FormValues) => {
    if (!enrollment || !courseId) return;

    try {
      const payload: UpdateEnrollmentDto = {};

      // Only include fields that are provided
      if (values.enrollee) {
        payload.enrollee = values.enrollee; // Single enrollee, not array
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
        enrollmentId: enrollmentId!,
        courseId,
        data: payload,
      }).unwrap();
      message.success('Enrollment updated successfully');
      navigate(PATH_COURSES.enrollmentView(enrollmentId!));
    } catch (err: unknown) {
      const error = err as { data?: { message?: string } };
      message.error(error?.data?.message || 'Failed to update enrollment');
    }
  };

  if (loadingEnrollment) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Loading enrollment..." />
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div>
        <Helmet>
          <title>Enrollment Not Found - Eval Hero</title>
        </Helmet>
        <PageHeader title="Edit Enrollment" breadcrumbs={[]} />
        <Card>
          <Alert
            type="error"
            message="Enrollment Not Found"
            description="The enrollment you are looking for does not exist or you don't have access to it."
            action={
              <Button onClick={() => navigate(PATH_COURSES.enrollments)}>
                Go Back
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Helmet>
        <title>Edit Enrollment - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Edit Course Enrollment"
        breadcrumbs={[
          {
            title: (
              <>
                <UserOutlined />
                <span>Enrollments</span>
              </>
            ),
            path: PATH_COURSES.enrollments,
          },
          {
            title: course?.title || 'Course',
            path: courseId ? PATH_COURSES.detail(courseId) : undefined,
          },
          {
            title: 'Edit Enrollment',
            path: PATH_COURSES.enrollmentView(enrollmentId!),
          },
          {
            title: 'Edit',
          },
        ]}
      />
      <div
        style={{
          backgroundColor: token.colorBgLayout,
          padding: `0 ${isMobile ? token.paddingSM : token.paddingLG} ${isMobile ? 32 : 48}px`,
        }}
      >
        {/* Header */}
        <Affix offsetTop={isMobile ? 56 : 65}>
          <div
            style={{
              background: token.colorBgContainer,
              boxShadow: token.boxShadowTertiary,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              padding: isMobile ? token.paddingSM : token.paddingMD,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 100,
              borderRadius: isMobile ? token.borderRadius : 16,
            }}
          >
            <Title
              level={isMobile ? 5 : 4}
              style={{ margin: 0, display: 'flex', gap: 8, fontSize: isMobile ? 16 : undefined }}
            >
              <EditOutlined />
              Edit Course Enrollment
            </Title>

            <Space size={isMobile ? 'small' : 'middle'}>
              {!canEditFields && (
                <Alert
                  message="Fields can only be updated when enrollment status is 'pending'"
                  type="info"
                  showIcon
                  style={{ marginRight: 16 }}
                />
              )}
              {canEditFields && (
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  size={isMobile ? 'small' : 'middle'}
                  loading={isLoading}
                  onClick={() => form.submit()}
                  disabled={!canEditFields}
                >
                  Update
                </Button>
              )}
            </Space>
          </div>
        </Affix>

        {/* Form */}
        <Row justify="center" style={{ marginTop: isMobile ? token.marginMD : token.marginLG }}>
          <Col xs={24} lg={24} xl={18}>
            <Card
              style={{
                borderRadius: isMobile ? token.borderRadiusLG : 16,
                boxShadow: token.boxShadowSecondary,
                background: token.colorBgContainer,
              }}
              styles={{ body: {
                padding: isMobile ? token.paddingMD : '24px',
              } }}
            >
              {!canEditFields && (
                <Alert
                  message="Fields can only be updated when enrollment status is 'pending'"
                  description={`Current status: ${enrollment?.status?.replace('_', ' ').toUpperCase() || 'Unknown'}`}
                  type="warning"
                  showIcon
                  style={{ marginBottom: 24 }}
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
                      disabled
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
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default EditEnrollmentPage;
