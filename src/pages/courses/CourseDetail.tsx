import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { BookOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { Tabs, Spin, Alert, Button, Grid } from 'antd';
import { useSelector } from 'react-redux';
import { useGetCourseQuery } from '../../services/coursesApi';
import { RootState } from '../../store';
import { usePermission } from '../../hooks/usePermission';
import { PATH_COURSES } from '../../constants/routes';
import CourseOverviewTab from './components/CourseOverviewTab';
import CoursePagesTab from './components/CoursePagesTab';
// import CourseMembersTab from './components/CourseMembersTab';
// import CourseCohortsTab from './components/CourseCohortsTab';
// import CourseRolesTab from './components/CourseRolesTab';
// import CourseProgressTab from './components/CourseProgressTab';
// import CourseStatsTab from './components/CourseStatsTab';
// import CertificatesTab from './components/CertificatesTab';
// import BadgesTab from './components/BadgesTab';

const { useBreakpoint } = Grid;

const CourseDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [activeTab, setActiveTab] = useState('overview');
  const { data, isLoading, error, refetch } = useGetCourseQuery(id!);
  const { selectedProfile } = useSelector((state: RootState) => state.auth);
  const hasEditPermission = usePermission('course::edit');

  // Check if user can edit this course
  // User can edit if: course.createdBy === selectedProfile._id AND user has the permission
  const canEditCourse = useMemo(() => {
    if (!data?.data?.course) return false;
    const course = data.data.course;
    return course.createdBy === selectedProfile?._id && hasEditPermission;
  }, [data?.data?.course, hasEditPermission, selectedProfile?._id]);

  if (isLoading) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Loading course..." />
      </div>
    );
  }

  if (error || !data?.data?.course) {
    return (
      <Alert
        type="error"
        message="Failed to load course"
        action={<Button onClick={refetch}>Retry</Button>}
      />
    );
  }

  const course = data.data.course;

  const tabItems = [
    {
      key: 'overview',
      label: 'Overview',
      children: <CourseOverviewTab course={course} />,
    },
    {
      key: 'pages',
      label: `Pages (${course.pages?.length || 0})`,
      children: <CoursePagesTab courseId={id!} />,
    },
    // {
    //   key: 'members',
    //   label: `Members (${course.members?.length || 0})`,
    //   children: <CourseMembersTab courseId={id!} />,
    // },
    // {
    //   key: 'cohorts',
    //   label: `Cohorts (${course.cohorts?.length || 0})`,
    //   children: <CourseCohortsTab courseId={id!} />,
    // },
    // {
    //   key: 'roles',
    //   label: `Roles (${course.roles?.length || 0})`,
    //   children: <CourseRolesTab courseId={id!} />,
    // },
    // {
    //   key: 'progress',
    //   label: 'Progress',
    //   children: <CourseProgressTab courseId={id!} />,
    // },
    // {
    //   key: 'stats',
    //   label: 'Statistics',
    //   children: <CourseStatsTab courseId={id!} />,
    // },
    // {
    //   key: 'certificates',
    //   label: 'Certificates',
    //   children: <CertificatesTab courseId={id!} />,
    // },
    // {
    //   key: 'badges',
    //   label: 'Badges',
    //   children: <BadgesTab courseId={id!} />,
    // },
  ];

  return (
    <div>
      <Helmet>
        <title>{course.title} - Eval Hero</title>
      </Helmet>
      <PageHeader
        title={course.title}
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
          },
        ]}
      />
      {canEditCourse && (
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            justifyContent: isMobile ? 'stretch' : 'flex-end',
          }}
        >
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(PATH_COURSES.edit(id!))}
            style={{ width: isMobile ? '100%' : undefined }}
          >
            Edit Course
          </Button>
        </div>
      )}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size={isMobile ? 'middle' : 'large'}
      />
    </div>
  );
};

export { CourseDetailPage };
