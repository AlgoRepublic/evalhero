import { Helmet } from 'react-helmet-async';
import { PageHeader, ProtectedComponent } from '../../../components';
import { UserOutlined } from '@ant-design/icons';
import { Button, Grid } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PATH_COURSES } from '../../../constants/routes';
import EnrollmentsTable from '../components/EnrollmentsTable';

const { useBreakpoint } = Grid;

const EnrollmentsListPage = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  return (
    <div style={{ padding: isMobile ? 0 : undefined }}>
      <Helmet>
        <title>Course Enrollments - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Course Enrollments"
        breadcrumbs={[
          {
            title: (
              <>
                <UserOutlined />
                <span>Enrollments</span>
              </>
            ),
          },
          {
            title: 'All Enrollments',
          },
        ]}
      />
      <div>
        <ProtectedComponent permission="course::edit">
          <Button
            onClick={() => navigate(PATH_COURSES.enrollmentAdd)}
            type="primary"
            style={{ marginBottom: 16, width: isMobile ? '100%' : undefined }}
          >
            Create Enrollment
          </Button>
        </ProtectedComponent>
        <EnrollmentsTable showCourseFilter={true} />
      </div>
    </div>
  );
};

export default EnrollmentsListPage;
