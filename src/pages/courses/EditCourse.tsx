import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { Spin, Alert, Button } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetCourseQuery } from '../../services/coursesApi';
import CourseForm from './components/CourseForm';
import { RootState } from '../../store';
import { usePermission } from '../../hooks/usePermission';
import { PATH_COURSES } from '../../constants/routes';

const EditCoursePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useGetCourseQuery(id!);
  const { selectedProfile } = useSelector((state: RootState) => state.auth);
  const hasEditPermission = usePermission('course::edit');

  if (isLoading) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Loading course..." />
      </div>
    );
  }

  if (!data?.data?.course) {
    return <div>Course not found</div>;
  }

  const course = data.data.course;
  
  // Check if user is the creator and has edit permission
  const canEditCourse = course.createdBy === selectedProfile?._id && hasEditPermission;

  if (!canEditCourse) {
    return (
      <div>
        <Helmet>
          <title>Access Denied - Eval Hero</title>
        </Helmet>
        <PageHeader
          title="Access Denied"
          breadcrumbs={[
            {
              title: (
                <>
                  <BookOutlined />
                  <span>Courses</span>
                </>
              ),
              path: PATH_COURSES.courses,
            },
            {
              title: course.title,
              path: PATH_COURSES.detail(id!),
            },
            {
              title: 'Edit',
            },
          ]}
        />
        <Alert
          type="error"
          message="Access Denied"
          description="You can only edit courses that you created and have edit permissions for."
          action={
            <Button onClick={() => navigate(PATH_COURSES.detail(id!))}>
              Go Back
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <Helmet>
        <title>Edit Course - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Edit Course"
        breadcrumbs={[
          {
            title: (
              <>
                <BookOutlined />
                <span>Courses</span>
              </>
            ),
            path: PATH_COURSES.courses,
          },
          {
            title: course.title,
            path: PATH_COURSES.detail(id!),
          },
          {
            title: 'Edit',
          },
        ]}
      />
      <CourseForm
        course={course}
        onSuccess={(courseId) => {
          navigate(PATH_COURSES.detail(courseId));
        }}
        onCancel={() => {
          navigate(PATH_COURSES.detail(id!));
        }}
      />
    </div>
  );
};

export { EditCoursePage };
