import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { BookOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { PATH_COURSES } from '../../constants/routes';
import CourseForm from './components/CourseForm';

const AddCoursePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const folderId = (location.state as { folderId?: string | null } | null)?.folderId ?? undefined;

  return (
    <div>
      <Helmet>
        <title>Create Course - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Create Course"
        breadcrumbs={[
          {
            title: (
              <>
                <BookOutlined />
                <span>Courses</span>
              </>
            ),
          },
          {
            title: 'Courses',
            path: PATH_COURSES.courses,
          },
          {
            title: 'Create',
          },
        ]}
      />
      <CourseForm
        folderId={folderId}
        onSuccess={(courseId) => {
          navigate(PATH_COURSES.detail(courseId));
        }}
        onCancel={() => {
          navigate(PATH_COURSES.courses);
        }}
      />
    </div>
  );
};

export { AddCoursePage };
