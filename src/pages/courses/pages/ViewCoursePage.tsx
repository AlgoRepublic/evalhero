import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../../components';
import { BookOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, Button, Grid } from 'antd';
import { PATH_COURSES } from '../../../constants/routes';
import {
  useGetCoursePageQuery,
  useGetCourseQuery,
} from '../../../services/coursesApi';
import { useTiptapInstance } from '../../../hooks/useTiptapInstance';
import { extensions } from '../../../pages/CanvasBuilderPage/Editor/extensions';
import { TemplateEditor } from '../../../pages/CanvasBuilderPage';
import { EditOutlined } from '@ant-design/icons';
import { JSONContent } from '@tiptap/core';
import CoursePageDocumentViewer from '../components/CoursePageDocumentViewer';

const { useBreakpoint } = Grid;

const ViewCoursePagePage = () => {
  const { courseId, pageId } = useParams<{ courseId: string; pageId: string }>();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { data: courseData } = useGetCourseQuery(courseId!);
  const { data: pageData, isLoading } = useGetCoursePageQuery({
    courseId: courseId!,
    pageId: pageId!,
  });

  const instance = useTiptapInstance({
    extensions,
    initialContent: '',
    mode: 'readonly',
  });

  useEffect(() => {
    const page = pageData?.data?.page;
    if (!page || page.pageType === 'document') return;
    if (page.canvasDocId) {
      try {
        let content: JSONContent;
        const canvasDocId = page.canvasDocId;
        if (typeof canvasDocId === 'string') {
          content = JSON.parse(canvasDocId);
        } else if (typeof canvasDocId === 'object' && 'canvasSchema' in canvasDocId) {
          content = (canvasDocId as any).canvasSchema;
        } else {
          content = canvasDocId as any;
        }
        instance.setJSON(content);
      } catch (err) {
        console.error('Failed to parse canvas content:', err);
      }
    }
  }, [pageData]);

  if (isLoading) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Loading page..." />
      </div>
    );
  }

  const page = pageData?.data?.page;

  return (
    <div>
      <Helmet>
        <title>{page?.title || 'Page'} - Eval Hero</title>
      </Helmet>
      <PageHeader
        title={page?.title || 'Course Page'}
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
            title: courseData?.data?.course?.title || 'Course',
            path: PATH_COURSES.detail(courseId!),
          },
          {
            title: page?.title || 'Page',
          },
        ]}
      />
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
        <Button
          icon={<EditOutlined />}
          onClick={() => navigate(PATH_COURSES.pageEdit(courseId!, pageId!))}
          style={{ width: isMobile ? '100%' : undefined }}
          type="primary"
        >
          Edit Page
        </Button>
      </div>
      <div style={{ marginTop: 12 }}>
        {page?.pageType === 'document' && page.document?.url ? (
          <CoursePageDocumentViewer document={page.document} />
        ) : (
          <TemplateEditor instance={instance} />
        )}
      </div>
    </div>
  );
};

export default ViewCoursePagePage;
