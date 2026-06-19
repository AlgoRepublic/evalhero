import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../../components';
import { UserOutlined, SaveOutlined, UserAddOutlined } from '@ant-design/icons';
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
  Affix,
  Grid,
} from 'antd';
import { PATH_COURSES } from '../../../constants/routes';
import {
  useCreateCourseEnrollmentMutation,
  useGetCourseQuery,
  useGetCoursesQuery,
  useGetEligibleProfilesForEnrolmentQuery,
} from '../../../services/coursesApi';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Title } = Typography;
const { useBreakpoint } = Grid;

const AddEnrollmentPage = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { token } = theme.useToken();
  const { courseId: urlCourseId } = useParams<{ courseId?: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(urlCourseId);
  
  const { data: courseData } = useGetCourseQuery(selectedCourseId!, {
    skip: !selectedCourseId,
  });
  const { data: coursesData } = useGetCoursesQuery({
    page: 1,
    perPage: 100,
  });
  const [createEnrollment, { isLoading }] = useCreateCourseEnrollmentMutation();
  
  // Get eligible profiles for the selected course
  const { data: eligibleProfilesData, isLoading: loadingEligibleProfiles } = 
    useGetEligibleProfilesForEnrolmentQuery(selectedCourseId || '', {
      skip: !selectedCourseId,
    });

  const eligibleProfiles = eligibleProfilesData?.data?.profiles || [];
  const courses = coursesData?.data?.records || [];
  const course = courseData?.data?.course;
  const effectiveCourseId = selectedCourseId || urlCourseId;

  const handleSubmit = async (values: any) => {
    if (!effectiveCourseId) {
      message.error('Please select a course');
      return;
    }

    try {
      const payload: any = {
        courseId: effectiveCourseId,
        enrollees: values.enrollees, // Array of enrollee IDs
        // status: values.status || 'pending',
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
      const createdCount = result.data?.enrolments?.records?.length || 0;
      message.success(`Successfully created ${createdCount} enrolment(s)`);
      navigate(PATH_COURSES.enrollments);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to create enrollment');
    }
  };

  return (
    <div>
      <Helmet>
        <title>Create Enrollment - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Create Course Enrollment"
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
          ...(effectiveCourseId && course
            ? [
                {
                  title: course.title,
                  path: PATH_COURSES.detail(effectiveCourseId),
                },
              ]
            : []),
          {
            title: 'Create Enrollment',
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
              <UserAddOutlined />
              Add Course Enrollment
            </Title>

            <Space size={isMobile ? 'small' : 'middle'}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size={isMobile ? 'small' : 'middle'}
                loading={isLoading}
                onClick={() => form.submit()}
              >
                Create
              </Button>
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
              <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSubmit}
                >
                  {!urlCourseId && (
                    <Form.Item
                      label="Course"
                      rules={[{ required: true, message: 'Please select a course' }]}
                    >
                      <Select
                        placeholder="Select a course"
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label ?? '')
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                        value={selectedCourseId}
                        onChange={setSelectedCourseId}
                        options={courses.map((c) => ({
                          value: c._id,
                          label: c.title,
                        }))}
                      />
                    </Form.Item>
                  )}
                  <Form.Item
                    name="enrollees"
                    label="Enrollees"
                    rules={[
                      {
                        required: true,
                        message: 'Please select at least one enrollee',
                      },
                      {
                        type: 'array',
                        min: 1,
                        message: 'Please select at least one enrollee',
                      },
                    ]}
                  >
                    <Select
                      mode="multiple"
                      placeholder={
                        effectiveCourseId
                          ? loadingEligibleProfiles
                            ? 'Loading eligible profiles...'
                            : 'Select enrollees'
                          : 'Select a course first'
                      }
                      disabled={!effectiveCourseId || loadingEligibleProfiles}
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
                      notFoundContent={
                        effectiveCourseId && !loadingEligibleProfiles
                          ? 'No eligible profiles found'
                          : null
                      }
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
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default AddEnrollmentPage;
