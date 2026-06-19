import { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../../components';
import { BookOutlined, SaveOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Form, Input, Button, message, Space, InputNumber, Switch, Divider, Affix, Tooltip, Typography, theme, Row, Col, Grid, Select } from 'antd';
import { PATH_COURSES } from '../../../constants/routes';
import {
  useCreateCoursePageMutation,
  useGetCourseQuery,
} from '../../../services/coursesApi';
import { useTiptapInstance } from '../../../hooks/useTiptapInstance';
import { extensions } from '../../../pages/CanvasBuilderPage/Editor/extensions';
import { TemplateEditor } from '../../../pages/CanvasBuilderPage';
import InlineFormBlockEditor from '../components/InlineFormBlockEditor';
import DocumentUploader from '../components/DocumentUploader';
import CoursePageDocumentViewer from '../components/CoursePageDocumentViewer';
import { InlineFormBlock } from '../../../types/course';
import type { CoursePageType } from '../../../types/course';

const { Title } = Typography;
const { useBreakpoint } = Grid;

const AddCoursePagePage = () => {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { data: courseData } = useGetCourseQuery(courseId!);
  const [createPage, { isLoading }] = useCreateCoursePageMutation();

  const [inlineForms, setInlineForms] = useState<InlineFormBlock[]>([]);
  const [pageType, setPageType] = useState<CoursePageType>('builder');
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  // Memoize the onUpdate callback to prevent it from being recreated on every render
  // We don't need to store content in state - we'll get it from instance when submitting
  const handleEditorUpdate = useCallback(() => {
    // No-op: We'll get content from instance.getJSON() when submitting
  }, []);

  const instance = useTiptapInstance({
    extensions,
    initialContent: '',
    mode: 'edit',
    onUpdate: handleEditorUpdate,
  });

  const handleSubmit = async (values: any) => {
    try {
      const currentPages = courseData?.data?.course?.pages || [];
      const orderIndex = currentPages.length;

      if (pageType === 'document') {
        if (!documentFile) {
          message.error('Please select a file to upload');
          return;
        }
        await createPage({
          courseId: courseId!,
          title: values.title,
          orderIndex,
          pageType: 'document',
          document: documentFile,
          inlineForms: [],
          completionCriteria: {
            required: values.required === true,
            minScore: values.minScore,
            requireAllInlineForms: values.requireAllInlineForms === true,
          },
        }).unwrap();
        message.success('Page created successfully');
        navigate(PATH_COURSES.detail(courseId!));
        return;
      }

      // Builder: get content from editor instance
      const canvasContent = instance.getJSON();
      if (!canvasContent) {
        message.error('Please add content to the page');
        return;
      }

      // Normalize inline forms for API
      const normalizedInlineForms = inlineForms.map((block) => {
        const configSet = block.configSet?.hasApproval
          ? {
              name: block.configSet.name ?? 'Form Approval Config',
              hasApproval: true,
              hasDisputes: block.configSet.hasDisputes ?? false,
              signatureRequired: block.configSet.signatureRequired ?? false,
              omitSignatureAllowed: block.configSet.omitSignatureAllowed ?? false,
              omitSignatureApprovers: Array.isArray(block.configSet.omitSignatureApprovers)
                ? (block.configSet.omitSignatureApprovers as (string | { _id: string })[]).map((a) =>
                    typeof a === 'string' ? a : a._id
                  )
                : [],
              approvalRule: block.configSet.approvalRule ?? 'ALL',
              approvalMinCount: block.configSet.approvalMinCount ?? 0,
              approvers: Array.isArray(block.configSet.approvers)
                ? (block.configSet.approvers as (string | { _id: string })[]).map((a) =>
                    typeof a === 'string' ? a : a._id
                  )
                : [],
              questionApprovers: Array.isArray(block.configSet.questionApprovers)
                ? (block.configSet.questionApprovers as (string | { _id: string })[]).map((a) =>
                    typeof a === 'string' ? a : a._id
                  )
                : [],
            }
          : null;

        return {
          formBlockId: block.formBlockId,
          formTemplate: block.formTemplate,
          formTemplateSchema: block.formTemplateSchema,
          ...(configSet && { configSet }),
          // Hidden schedule defaults (same layout as AddSchedule, values fixed for course inline forms)
          type: 'one_time' as const,
          startDate: new Date().toISOString(),
          timezone: 'UTC' as const,
          subjectMode: 'single' as const,
          subjects: [] as string[],
        };
      });

      await createPage({
        courseId: courseId!,
        title: values.title,
        orderIndex,
        pageType: 'builder',
        canvasSchema: canvasContent,
        inlineForms: normalizedInlineForms,
        completionCriteria: {
          required: values.required === true,
          minScore: values.minScore,
          requireAllInlineForms: values.requireAllInlineForms === true,
        },
      }).unwrap();

      message.success('Page created successfully');
      navigate(PATH_COURSES.detail(courseId!));
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to create page');
    }
  };

  return (
    <div>
      <Helmet>
        <title>Add Page - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Add Course Page"
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
            title: 'Add Page',
          },
        ]}
      />
      <div style={{ backgroundColor: token.colorBgLayout, paddingBottom: isMobile ? token.paddingLG : 48 }}>
        {/* Header */}
        <Affix offsetTop={isMobile ? 56 : 65}>
          <div
            style={{
              background: token.colorBgContainer,
              boxShadow: token.boxShadowTertiary,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              padding: isMobile ? token.paddingSM : 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              zIndex: 100,
              borderRadius: isMobile ? token.borderRadius : 16,
            }}
          >
            <Title level={isMobile ? 5 : 4} style={{ margin: 0, display: 'flex', gap: 8, fontSize: isMobile ? 16 : undefined }}>
              <FileTextOutlined style={{ color: token.colorPrimary }} />
              Add Course Page
            </Title>

            <Space size={isMobile ? 'small' : 'middle'}>
              <Tooltip title="Create Page">
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  size={isMobile ? 'small' : 'middle'}
                  loading={isLoading}
                  onClick={() => form.submit()}
                >
                  Create
                </Button>
              </Tooltip>
              <Button size={isMobile ? 'small' : 'middle'} onClick={() => navigate(PATH_COURSES.detail(courseId!))}>
                Cancel
              </Button>
            </Space>
          </div>
        </Affix>

        {/* Form */}
        <Row justify="center" style={{ marginTop: isMobile ? token.marginMD : 32 }}>
          <Col xs={24}>
            <Card
              style={{
                borderRadius: isMobile ? token.borderRadiusLG : 16,
                boxShadow: token.boxShadowSecondary,
                background: token.colorBgContainer,
              }}
              styles={{ body: {
                padding: isMobile ? token.paddingMD : '16px',
              } }}
            >
              <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <Form.Item
                  name="title"
                  label="Page Title"
                  rules={[{ required: true, message: 'Please enter page title' }]}
                >
                  <Input placeholder="Enter page title" />
                </Form.Item>

                <Form.Item label="Page Type">
                  <Select
                    value={pageType}
                    onChange={setPageType}
                    options={[
                      { value: 'builder', label: 'Rich Text Editor' },
                      { value: 'document', label: 'Upload Document' },
                    ]}
                    style={{ width: 220 }}
                  />
                </Form.Item>

                {pageType === 'builder' && (
                  <Form.Item label="Page Content">
                    <TemplateEditor instance={instance} />
                  </Form.Item>
                )}

                {pageType === 'document' && (
                  <>
                    <Form.Item
                      label="Document"
                      required
                      help="Video, audio, PDF, documents (Word, Excel, PowerPoint), or images."
                    >
                      <DocumentUploader
                        value={documentFile}
                        onChange={setDocumentFile}
                      />
                    </Form.Item>
                    {documentFile && (
                      <Form.Item label="Preview">
                        <CoursePageDocumentViewer
                          file={documentFile}
                          title="Preview"
                        />
                      </Form.Item>
                    )}
                  </>
                )}

                <Divider />

                <Form.Item label="Inline Forms">
                  <InlineFormBlockEditor
                    value={inlineForms}
                    onChange={setInlineForms}
                    courseId={courseId}
                  />
                </Form.Item>

                <Divider />

                <Form.Item label="Completion Criteria">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Form.Item
                      name="required"
                      valuePropName="checked"
                      style={{ marginBottom: 0 }}
                    >
                      <Switch /> Required to complete
                    </Form.Item>
                    <Form.Item name="minScore" style={{ marginBottom: 0 }}>
                      <InputNumber
                        placeholder="Minimum score (optional)"
                        min={0}
                        max={100}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                    <Form.Item
                      name="requireAllInlineForms"
                      valuePropName="checked"
                      style={{ marginBottom: 0 }}
                    >
                      <Switch /> Require all inline forms
                    </Form.Item>
                  </Space>
                </Form.Item>
              </Form>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default AddCoursePagePage;
