import { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../../components';
import { BookOutlined, SaveOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Card, Form, Input, Button, message, Space, InputNumber, Spin, Switch, Divider, Affix, Tooltip, Typography, theme, Row, Col, Alert, Grid, Select } from 'antd';
import { PATH_COURSES } from '../../../constants/routes';
import {
  useGetCoursePageQuery,
  useUpdateCoursePageMutation,
  useGetCourseQuery,
} from '../../../services/coursesApi';
import { RootState } from '../../../store';
import { usePermission } from '../../../hooks/usePermission';
import { useTiptapInstance } from '../../../hooks/useTiptapInstance';
import { extensions } from '../../../pages/CanvasBuilderPage/Editor/extensions';
import { TemplateEditor } from '../../../pages/CanvasBuilderPage';
import { JSONContent } from '@tiptap/core';
import InlineFormBlockEditor from '../components/InlineFormBlockEditor';
import DocumentUploader from '../components/DocumentUploader';
import CoursePageDocumentViewer from '../components/CoursePageDocumentViewer';
import { InlineFormBlock } from '../../../types/course';
import type { CoursePageType } from '../../../types/course';

const { Title } = Typography;
const { useBreakpoint } = Grid;

const EditCoursePagePage = () => {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { courseId, pageId } = useParams<{ courseId: string; pageId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { data: courseData } = useGetCourseQuery(courseId!);
  const { data: pageData, isLoading: loadingPage } = useGetCoursePageQuery({
    courseId: courseId!,
    pageId: pageId!,
  });
  const [updatePage, { isLoading }] = useUpdateCoursePageMutation();
  const { selectedProfile } = useSelector((state: RootState) => state.auth);
  const hasEditPermission = usePermission('course::edit');

  // Check if user can edit this page (must be course creator and have permission)
  const canEditPage = useMemo(() => {
    return courseData?.data?.course?.createdBy === selectedProfile?._id && hasEditPermission;
  }, [courseData?.data?.course?.createdBy, selectedProfile?._id, hasEditPermission]);

  const [inlineForms, setInlineForms] = useState<InlineFormBlock[]>([]);
  const [pageType, setPageType] = useState<CoursePageType>('builder');
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  // Memoize the onUpdate callback to prevent it from being recreated on every render
  const handleEditorUpdate = useCallback(() => {
    // Don't update state during render - we'll get content from instance when submitting
  }, []);

  const instance = useTiptapInstance({
    extensions,
    initialContent: '',
    mode: 'edit',
    onUpdate: handleEditorUpdate,
  });

  useEffect(() => {
    if (pageData?.data?.page) {
      const page = pageData.data.page;
      const currentType = (page.pageType ?? 'builder') as CoursePageType;
      setPageType(currentType);
      setDocumentFile(null);

      const formValues = {
        title: page.title,
        required: Boolean(page.completionCriteria?.required),
        minScore: page.completionCriteria?.minScore,
        requireAllInlineForms: Boolean(page.completionCriteria?.requireAllInlineForms),
      };
      
      form.setFieldsValue(formValues);

      // Load inline forms (API returns formTemplate/formTemplateSchema as populated objects, configSet with populated approvers/omitSignatureApprovers)
      if (page.inlineForms) {
        const normalizedForms = page.inlineForms.map((formItem) => {
          const formTemplate =
            typeof formItem.formTemplate === 'string'
              ? formItem.formTemplate
              : (formItem.formTemplate as { _id?: string; name?: string; configSets?: Array<{ _id?: string; name?: string }>; currentFormTemplateSchema?: string }) ?? undefined;
          const formTemplateSchemaId =
            typeof formItem.formTemplateSchema === 'object' && formItem.formTemplateSchema !== null && '_id' in formItem.formTemplateSchema
              ? (formItem.formTemplateSchema as { _id: string })._id
              : typeof formItem.formTemplateSchema === 'string'
                ? formItem.formTemplateSchema
                : typeof formTemplate === 'object' && formTemplate?.currentFormTemplateSchema
                  ? formTemplate.currentFormTemplateSchema
                  : undefined;

          const formAny = formItem as InlineFormBlock & { options?: { proctorOrApprovalRequired?: { type?: string; ids?: string[] } } };
          let configSet: InlineFormBlock['configSet'] = formItem.configSet ?? undefined;
          if (!configSet && formAny.options?.proctorOrApprovalRequired?.ids?.length) {
            configSet = {
              hasApproval: true,
              approvers: formAny.options.proctorOrApprovalRequired.ids,
              approvalRule: 'ALL',
              approvalMinCount: 1,
            };
          } else if (configSet && typeof configSet === 'object') {
            // Normalize approvers, questionApprovers, and omitSignatureApprovers to IDs (API may return populated Profile objects)
            configSet = {
              ...configSet,
              approvers: (configSet.approvers ?? []).map((a) => (typeof a === 'string' ? a : (a as { _id: string })._id)),
              questionApprovers: (configSet.questionApprovers ?? []).map((a) =>
                typeof a === 'string' ? a : (a as { _id: string })._id
              ),
              omitSignatureApprovers: (configSet.omitSignatureApprovers ?? []).map((a) =>
                typeof a === 'string' ? a : (a as { _id: string })._id
              ),
            };
          }

          return {
            _id: formItem._id,
            formBlockId: formItem.formBlockId,
            formTemplate: formTemplate as InlineFormBlock['formTemplate'],
            formTemplateSchema: formTemplateSchemaId,
            configSet,
          } as InlineFormBlock;
        });
        setInlineForms(normalizedForms);
      }

      // Load canvas content (builder pages only)
      if (currentType === 'builder' && page.canvasDocId) {
        try {
          let content: JSONContent;
          if (typeof page.canvasDocId === 'string') {
            content = JSON.parse(page.canvasDocId);
          } else if (typeof page.canvasDocId === 'object' && 'canvasSchema' in page.canvasDocId) {
            content = (page.canvasDocId as any).canvasSchema;
          } else {
            content = page.canvasDocId as any;
          }
          instance.setJSON(content);
        } catch (err) {
          console.error('Failed to parse canvas content:', err);
        }
      }
    }
  }, [pageData, form]);

  const page = pageData?.data?.page;
  const currentPageType = (page?.pageType ?? 'builder') as CoursePageType;

  const handleSubmit = async (values: any) => {
    if (!canEditPage) {
      message.error('You can only edit pages for courses that you created');
      return;
    }

    try {
      const completionCriteria = {
        required: values.required === true,
        minScore: values.minScore,
        requireAllInlineForms: values.requireAllInlineForms === true,
      };

      // —— Document page update or convert to document ——
      if (pageType === 'document') {
        const convertingFromBuilder = currentPageType === 'builder';
        if (convertingFromBuilder && !documentFile) {
          message.error('Please select a file to convert this page to a document page');
          return;
        }
        await updatePage({
          courseId: courseId!,
          pageId: pageId!,
          data: {
            title: values.title,
            pageType: 'document',
            ...(documentFile && { document: documentFile }),
            completionCriteria,
          },
        }).unwrap();
        message.success('Page updated successfully');
        navigate(PATH_COURSES.detail(courseId!));
        return;
      }

      // —— Builder page update or convert to builder ——
      const canvasContent = instance.getJSON();
      if (currentPageType === 'builder' && !canvasContent) {
        message.error('Please add content to the page');
        return;
      }
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
          : undefined;
        const formTemplateId =
          typeof block.formTemplate === 'string'
            ? block.formTemplate
            : block.formTemplate != null && typeof block.formTemplate === 'object'
              ? (block.formTemplate as { _id?: string })._id
              : undefined;
        const formTemplateSchemaId =
          typeof block.formTemplateSchema === 'string'
            ? block.formTemplateSchema
            : block.formTemplateSchema != null && typeof block.formTemplateSchema === 'object'
              ? (block.formTemplateSchema as { _id?: string })._id
              : undefined;
        return {
          formBlockId: block.formBlockId,
          formTemplate: formTemplateId,
          formTemplateSchema: formTemplateSchemaId,
          ...(configSet && { configSet }),
        };
      });

      const isConvertingToBuilder = currentPageType === 'document';
      const schemaToSend = canvasContent || (isConvertingToBuilder ? { type: 'doc', content: [] } : undefined);
      await updatePage({
        courseId: courseId!,
        pageId: pageId!,
        data: {
          title: values.title,
          ...(isConvertingToBuilder && { pageType: 'builder' }),
          ...(schemaToSend && { canvasSchema: schemaToSend }),
          inlineForms: normalizedInlineForms,
          completionCriteria,
        },
      }).unwrap();

      message.success('Page updated successfully');
      navigate(PATH_COURSES.detail(courseId!));
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to update page');
    }
  };

  if (loadingPage) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Loading page..." />
      </div>
    );
  }

  // Check access before rendering edit form
  if (!canEditPage) {
    return (
      <div>
        <Helmet>
          <title>Access Denied - Eval Hero</title>
        </Helmet>
        <PageHeader
          title="Edit Course Page"
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
              title: pageData?.data?.page?.title || 'Page',
              path: PATH_COURSES.pageView(courseId!, pageId!),
            },
            {
              title: 'Edit',
            },
          ]}
        />
        <Card>
          <Alert
            type="error"
            message="Access Denied"
            description="You can only edit pages for courses that you created and have edit permissions for."
            action={
              <Button onClick={() => navigate(PATH_COURSES.detail(courseId!))}>
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
        <title>Edit Page - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Edit Course Page"
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
            title: pageData?.data?.page?.title || 'Page',
            path: PATH_COURSES.pageView(courseId!, pageId!),
          },
          {
            title: 'Edit',
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
              Edit Course Page
            </Title>

            <Space size={isMobile ? 'small' : 'middle'}>
              <Tooltip title="Update Page">
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  size={isMobile ? 'small' : 'middle'}
                  loading={isLoading}
                  onClick={() => form.submit()}
                >
                  Update
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
              <Form 
                form={form} 
                layout="vertical" 
                onFinish={handleSubmit}
                onValuesChange={(changedValues, allValues) => {
                  console.log('Form values changed:', changedValues);
                  console.log('All form values:', allValues);
                }}
              >
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
                    {currentPageType === 'document' && page?.document?.url != null && (
                      <Form.Item label="Current document">
                        <CoursePageDocumentViewer
                          document={page.document ?? undefined}
                          title="Current document"
                        />
                      </Form.Item>
                    )}
                    {documentFile != null ? (
                      <Form.Item label="New document preview">
                        <CoursePageDocumentViewer
                          file={documentFile}
                          title="Preview (will replace current)"
                        />
                      </Form.Item>
                    ) : null}
                    <Form.Item
                      label={currentPageType === 'document' ? 'Replace document' : 'Document'}
                      help={
                        currentPageType === 'builder'
                          ? 'Select a file to convert this page to a document page.'
                          : 'Optionally select a new file to replace the current document.'
                      }
                    >
                      <DocumentUploader
                        value={documentFile}
                        onChange={setDocumentFile}
                      />
                    </Form.Item>
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

                <Typography.Title level={5}>Completion Criteria</Typography.Title>
                <Form.Item
                  name="required"
                  valuePropName="checked"
                  getValueProps={(value) => {
                    console.log('getValueProps - required value:', value, 'type:', typeof value);
                    return { checked: Boolean(value) };
                  }}
                  getValueFromEvent={(checked) => {
                    console.log('getValueFromEvent - required:', checked);
                    return checked;
                  }}
                >
                  <Switch /> Required to complete
                </Form.Item>
                <Form.Item name="minScore">
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
                  getValueProps={(value) => {
                    console.log('getValueProps - requireAllInlineForms value:', value, 'type:', typeof value);
                    return { checked: Boolean(value) };
                  }}
                  getValueFromEvent={(checked) => {
                    console.log('getValueFromEvent - requireAllInlineForms:', checked);
                    return checked;
                  }}
                >
                  <Switch /> Require all inline forms
                </Form.Item>
              </Form>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default EditCoursePagePage;
