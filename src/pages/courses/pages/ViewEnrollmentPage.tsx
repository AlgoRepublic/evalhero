import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../../components';
import { UserOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button,
  Tabs,
  Spin,
  Alert,
  Card,
  Grid,
} from 'antd';
import { PATH_COURSES } from '../../../constants/routes';
import {
  useGetCourseEnrollmentQuery,
  useGetCourseQuery,
} from '../../../services/coursesApi';
import { usePermission } from '../../../hooks/usePermission';
import EnrollmentOverviewTab from '../components/EnrollmentOverviewTab';
import EnrollmentProgressTab from '../components/EnrollmentProgressTab/index';


const { useBreakpoint } = Grid;

const ViewEnrollmentPage = () => {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [searchParams, setSearchParams] = useSearchParams();
  const hasEditPermission = usePermission('course::edit');
  
  // Get active tab from URL, default to 'overview'
  const activeTab = searchParams.get('tab') || 'overview';
  
  // Update URL when tab changes
  const handleTabChange = (key: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', key);
    // Clear page param when switching tabs
    if (key !== 'progress') {
      newSearchParams.delete('page');
    }
    setSearchParams(newSearchParams, { replace: true });
  };

  // Fetch enrollment - courseId is optional according to API docs
  const { data: enrollmentData, isLoading } = useGetCourseEnrollmentQuery(
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

  const course = courseData?.data?.course;

  if (isLoading) {
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
        <PageHeader title="View Enrollment" breadcrumbs={[]} />
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

  const tabItems = [
    {
      key: 'overview',
      label: 'Overview',
      children: enrollment ? (
        <EnrollmentOverviewTab
          enrollment={enrollment}
          courseTitle={course?.title}
          course={course}
        />
      ) : null,
    },
    {
      key: 'progress',
      label: 'Progress',
      children:
        enrollment && courseId ? (
          <EnrollmentProgressTab
            courseId={courseId}
            courseEnrolmentId={enrollment._id}
          />
        ) : null,
    },
  ];

  return (
    <div>
      <Helmet>
        <title>View Enrollment - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Course Enrollment Details"
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
            title: 'Enrollment Details',
          },
        ]}
      />
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
        {hasEditPermission && (
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() =>
              navigate(PATH_COURSES.enrollmentEdit(enrollmentId!))
            }
            style={{ width: isMobile ? '100%' : undefined }}
          >
            Edit Enrollment
          </Button>
        )}
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        size={isMobile ? 'middle' : 'large'}
      />
    </div>
  );
};

export default ViewEnrollmentPage;
