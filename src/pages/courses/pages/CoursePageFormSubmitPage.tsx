/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useCallback, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../../components';
import { BookOutlined } from '@ant-design/icons';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { skipToken } from '@reduxjs/toolkit/query';
import { Card, Spin, Alert, Button, message, Tag, Input, List, Typography, Space } from 'antd';
import { PATH_COURSES } from '../../../constants/routes';
import {
  useStoreFormSubmissionMutation,
  useSubmitFormMutation,
  useGetFormSubmissionQuery,
  useGetCourseFormApprovalMessagesQuery,
  useSendCourseFormApprovalActionMutation,
} from '../../../services/coursesApi';
import type { JSONContent } from '@tiptap/core';
import type { CourseFormSubmissionRecord, FormSubmissionFormTemplateSchemaRef, CourseFormApprovalMessage, ApprovalStatus } from '../../../types/course';
import CoursePageFormEditor, {
  type CoursePageFormEditorStoreParams,
} from './CoursePageFormEditor';

function isPopulatedSchema(
  v: string | FormSubmissionFormTemplateSchemaRef
): v is FormSubmissionFormTemplateSchemaRef {
  return typeof v === 'object' && v !== null && 'formSchema' in v;
}

function isPopulatedTemplate(
  v: string | { _id: string; name?: string }
): v is { _id: string; name?: string } {
  return typeof v === 'object' && v !== null && '_id' in v;
}

/** True when answers is an empty doc: { type: "doc", content: [] } */
function isEmptyDoc(answers: unknown): boolean {
  if (!answers || typeof answers !== 'object') return true;
  const a = answers as { type?: string; content?: unknown[] };
  if (a.type !== 'doc') return false;
  return !a.content || a.content.length === 0;
}

function getFormTemplateId(formTemplate: CourseFormSubmissionRecord['formTemplate']): string {
  if (!formTemplate) return '';
  return typeof formTemplate === 'string' ? formTemplate : formTemplate._id ?? '';
}

function getFormTemplateSchemaId(
  formTemplateSchema: CourseFormSubmissionRecord['formTemplateSchema']
): string {
  if (!formTemplateSchema) return '';
  return typeof formTemplateSchema === 'string' ? formTemplateSchema : formTemplateSchema._id ?? '';
}

/** Apply question-level approval status from submission into the doc so approval status persists on load */
function applyQuestionApprovalsToContent(
  doc: JSONContent,
  questionApprovals: Array<{ questionKey: string; approvalStatus: ApprovalStatus }>
): JSONContent {
  if (!doc?.content || !Array.isArray(questionApprovals) || questionApprovals.length === 0) return doc;
  const byKey = new Map(questionApprovals.map((q) => [q.questionKey, q.approvalStatus]));
  const walk = (node: JSONContent): void => {
    if (!node) return;
    const attrs = node.attrs as Record<string, unknown> | undefined;
    if (attrs && typeof attrs === 'object') {
      const key = (attrs.id ?? attrs.name ?? attrs.label) as string | undefined;
      if (key && byKey.has(key)) {
        node.attrs = { ...attrs, approvalStatus: byKey.get(key) };
      }
    }
    if (Array.isArray(node.content)) {
      node.content.forEach((child) => walk(child as JSONContent));
    }
  };
  const cloned = JSON.parse(JSON.stringify(doc)) as JSONContent;
  walk(cloned);
  return cloned;
}

const CoursePageFormSubmitPage: React.FC = () => {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pageId = searchParams.get('pageId') || '';
  const formBlockId = searchParams.get('formBlockId') || '';
  const courseId = searchParams.get('courseId') || '';

  const courseEnrolmentId = enrollmentId ?? '';

  const { data: submissionData, isLoading: loadingSubmission } = useGetFormSubmissionQuery(
    {
      courseId,
      courseEnrolmentId,
      pageId,
      formBlockId,
    },
    { skip: !courseId || !courseEnrolmentId || !pageId || !formBlockId }
  );

  const submission = submissionData?.data?.submission;
  const inlineFormData = submission?.inlineFormData;

  const schemaFromSubmission = useMemo((): JSONContent | null => {
    const schemaRef = inlineFormData?.formTemplateSchema ?? submission?.formTemplateSchema;
    if (!schemaRef || !isPopulatedSchema(schemaRef)) return null;
    const fs = schemaRef.formSchema;
    return fs && typeof fs === 'object' && 'type' in fs ? (fs as JSONContent) : null;
  }, [inlineFormData?.formTemplateSchema, submission?.formTemplateSchema]);

  const initialContent = useMemo((): JSONContent => {
    if (!submission) return { type: 'doc', content: [] };
    const answers = submission.answers;
    let base: JSONContent;
    if (isEmptyDoc(answers) && schemaFromSubmission) {
      base = schemaFromSubmission;
    } else if (answers && typeof answers === 'object' && 'type' in answers) {
      base = submission.answers as JSONContent;
    } else {
      base = schemaFromSubmission ?? { type: 'doc', content: [] };
    }
    if (submission.questionApprovals?.length) {
      return applyQuestionApprovalsToContent(base, submission.questionApprovals);
    }
    return base;
  }, [submission, schemaFromSubmission]);

  const schema = schemaFromSubmission;

  const editorMode = inlineFormData?.isFilled === true ? 'readonly' : 'submit';

  const storeParams: CoursePageFormEditorStoreParams | null = useMemo(() => {
    if (!submission) return null;
    const cId = typeof submission.course === 'string' ? submission.course : submission.course?._id;
    const eId =
      typeof submission.courseEnrolment === 'string'
        ? submission.courseEnrolment
        : (submission.courseEnrolment as any)?._id;
    const pId =
      typeof submission.coursePage === 'string' ? submission.coursePage : (submission.coursePage as any)?._id;
    const formTemplate = inlineFormData?.formTemplate ?? submission.formTemplate;
    const formTemplateSchema = inlineFormData?.formTemplateSchema ?? submission.formTemplateSchema;
    if (!cId || !eId || !pId || !submission.formBlockId) return null;
    return {
      courseId: cId,
      courseEnrolmentId: eId,
      pageId: pId,
      formBlockId: submission.formBlockId,
      formTemplateId: getFormTemplateId(formTemplate),
      formTemplateSchemaId: getFormTemplateSchemaId(formTemplateSchema),
    };
  }, [submission, inlineFormData]);

  const [storeFormSubmission] = useStoreFormSubmissionMutation();
  const [submitForm] = useSubmitFormMutation();

  const handleStore = useCallback(
    async (answers: { type: string; content?: unknown }) => {
      if (!storeParams) return;
      await storeFormSubmission({ ...storeParams, answers }).unwrap();
    },
    [storeParams, storeFormSubmission]
  );

  const handleSubmitRecord = useCallback(async () => {
    if (!storeParams) return;
    const approvalRequired = inlineFormData?.approvalRequired ?? false;
    await submitForm({
      courseId: storeParams.courseId,
      pageId: storeParams.pageId,
      formBlockId: storeParams.formBlockId,
      courseEnrolmentId: storeParams.courseEnrolmentId,
      isFilled: true,
      approvalStatus: approvalRequired ? 'pending' : 'not-required',
      approvalRequired,
    }).unwrap();
  }, [storeParams, submitForm, inlineFormData?.approvalRequired]);

  const handleSuccess = useCallback(() => {
    const approvalRequired = inlineFormData?.approvalRequired ?? false;
    if (approvalRequired) {
      message.success('Form submitted. Pending approval.');
      // Stay on page to show approval chat
    } else {
      message.success('Form submitted successfully.');
      const progressUrl =
        PATH_COURSES.enrollmentView(enrollmentId!) + '?tab=progress' + '&page=' + pageId;
      navigate(progressUrl);
    }
  }, [enrollmentId, pageId, navigate, inlineFormData?.approvalRequired]);

  const templateHasApproval = inlineFormData?.configSet?.hasApproval ?? inlineFormData?.approvalRequired ?? false;
  const approvalRequired = inlineFormData?.approvalRequired ?? templateHasApproval;
  const showApprovalQuery = !!storeParams && approvalRequired;

  const approversForDrawer = useMemo((): Array<{ _id: string; name: string }> => {
    // For question approval use questionApprovers when set, else form approvers
    const questionApprovers = inlineFormData?.configSet?.questionApprovers;
    const approvers = inlineFormData?.configSet?.approvers;
    const list = (Array.isArray(questionApprovers) && questionApprovers.length > 0 ? questionApprovers : approvers) ?? [];
    if (!Array.isArray(list)) return [];
    return list.map((a) => {
      if (typeof a === 'string') return { _id: a, name: a };
      const p = a as { _id: string; user?: { name?: string; firstName?: string; lastName?: string } };
      const user = p.user;
      const name =
        typeof user === 'object' && user?.name
          ? user.name
          : typeof user === 'object' && (user?.firstName != null || user?.lastName != null)
            ? [user?.firstName, user?.lastName].filter(Boolean).join(' ')
            : p._id;
      return { _id: p._id, name: name || p._id };
    });
  }, [inlineFormData?.configSet?.questionApprovers, inlineFormData?.configSet?.approvers]);
  const { data: approvalData, refetch: refetchApprovalMessages } = useGetCourseFormApprovalMessagesQuery(
    showApprovalQuery && storeParams
      ? { courseId: storeParams.courseId, pageId: storeParams.pageId, formBlockId: storeParams.formBlockId, courseEnrolmentId: storeParams.courseEnrolmentId }
      : skipToken
  );
  const [sendApprovalAction, { isLoading: isSendingApproval }] = useSendCourseFormApprovalActionMutation();
  const [approvalMessageText, setApprovalMessageText] = useState('');

  const handleSendApprovalMessage = useCallback(async () => {
    if (!storeParams || !approvalMessageText.trim()) return;
    try {
      await sendApprovalAction({
        courseId: storeParams.courseId,
        pageId: storeParams.pageId,
        formBlockId: storeParams.formBlockId,
        courseEnrolmentId: storeParams.courseEnrolmentId,
        body: { action: 'message', actionData: { text: approvalMessageText.trim() } },
      }).unwrap();
      setApprovalMessageText('');
      refetchApprovalMessages();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to send message');
    }
  }, [storeParams, approvalMessageText, sendApprovalAction, refetchApprovalMessages]);

  if (!enrollmentId || !pageId || !formBlockId) {
    return (
      <>
        <PageHeader title="Course form" breadcrumbs={[]} />
        <Card>
          <Alert
            type="warning"
            message="Missing parameters"
            description="Please open this form from the course progress page (use View/Submit on an inline form)."
          />
          <Button type="primary" onClick={() => navigate(PATH_COURSES.enrollments)} style={{ marginTop: 16 }}>
            Back to enrollments
          </Button>
        </Card>
      </>
    );
  }

  if (!courseId) {
    return (
      <>
        <PageHeader title="Course form" breadcrumbs={[]} />
        <Card>
          <Alert
            type="warning"
            message="Missing course"
            description="This form must be opened from the course progress page (use View/Submit on an inline form)."
          />
          <Button type="primary" onClick={() => navigate(PATH_COURSES.enrollments)} style={{ marginTop: 16 }}>
            Back to enrollments
          </Button>
        </Card>
      </>
    );
  }

  if (loadingSubmission) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Loading form..." />
      </div>
    );
  }

  if (!submission) {
    return (
      <>
        <PageHeader title="Course form" breadcrumbs={[]} />
        <Card>
          <Alert type="error" message="Form not found" description="This submission or form could not be loaded." />
          <Button
            type="primary"
            onClick={() => navigate(PATH_COURSES.enrollmentView(enrollmentId))}
            style={{ marginTop: 16 }}
          >
            Back to enrollment
          </Button>
        </Card>
      </>
    );
  }

  if (!schema || !storeParams) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Preparing form..." />
      </div>
    );
  }

  const courseTitle =
    typeof submission.course === 'object' && submission.course?.title
      ? submission.course.title
      : 'Course';
  const pageTitle =
    typeof submission.coursePage === 'object' && (submission.coursePage as any)?.title
      ? (submission.coursePage as any).title
      : 'Page';
  const templateRef = inlineFormData?.formTemplate ?? submission.formTemplate;
  const formTitle = isPopulatedTemplate(templateRef)
    ? templateRef.name ?? templateRef._id
    : getFormTemplateId(templateRef) || formBlockId;
  const progressUrl = PATH_COURSES.enrollmentView(enrollmentId) + '?tab=progress' + '&page=' + pageId;

  const approvalStatus = submission?.approvalStatus ?? inlineFormData?.approvalStatus;
  const showApprovalPanel = approvalRequired && storeParams && (approvalStatus === 'pending' || approvalStatus === 'requested' || submission?.status === 'approval_in_progress' || approvalStatus === 'approved' || approvalStatus === 'rejected');

  const approvalMessages = approvalData?.data?.messages ?? [];
  const formatMessage = (msg: CourseFormApprovalMessage) => {
    const senderName = typeof msg.sentBy === 'object' && msg.sentBy?.user ? (msg.sentBy as any).user?.firstName || (msg.sentBy as any).user?.email : 'Someone';
    if (msg.action === 'message') return { text: msg.actionData?.text ?? '', sender: senderName };
    if (msg.action === 'approval:approved') return { text: `Approved${msg.actionData?.comment ? `: ${msg.actionData.comment}` : ''}`, sender: senderName };
    if (msg.action === 'approval:rejected') return { text: `Rejected${msg.actionData?.comment ? `: ${msg.actionData.comment}` : ''}`, sender: senderName };
    if (msg.action === 'approval:requested') return { text: 'Requested approval', sender: senderName };
    return { text: msg.action ?? '', sender: senderName };
  };

  return (
    <>
      <Helmet>
        <title>
          {formTitle} - {courseTitle} - Eval Hero
        </title>
      </Helmet>
      <PageHeader
        title={`${pageTitle}: ${formTitle}`}
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
          { title: courseTitle, path: PATH_COURSES.detail(storeParams.courseId) },
          { title: 'Enrollment', path: PATH_COURSES.enrollmentView(enrollmentId) },
          { title: 'Progress', path: progressUrl },
          { title: formTitle },
        ]}
      />
      <div style={{ paddingBottom: 48 }}>
        {approvalRequired && approvalStatus && (
          <div style={{ marginBottom: 16 }}>
            <Typography.Text strong>Approval status: </Typography.Text>
            <Tag color={approvalStatus === 'approved' ? 'green' : approvalStatus === 'rejected' ? 'red' : 'orange'}>
              {approvalStatus === 'approved' ? 'Approved' : approvalStatus === 'rejected' ? 'Rejected' : 'Pending'}
            </Tag>
          </div>
        )}
        <CoursePageFormEditor
          schema={schema}
          initialContent={initialContent}
          mode={editorMode}
          storeParams={storeParams}
          onStore={handleStore}
          onSubmitRecord={handleSubmitRecord}
          onSuccess={handleSuccess}
          pageTitle={pageTitle}
          formTitle={formTitle}
          progressUrl={progressUrl}
          disableAutoSave={false}
          templateHasApproval={templateHasApproval}
          approvers={approversForDrawer}
        />
        {showApprovalPanel && (
          <Card title="Approval conversation" style={{ marginTop: 24 }}>
            <List
              size="small"
              dataSource={approvalMessages}
              renderItem={(msg) => {
                const { text, sender } = formatMessage(msg);
                return (
                  <List.Item>
                    <Typography.Text type="secondary">{sender}: </Typography.Text>
                    {text}
                  </List.Item>
                );
              }}
              style={{ maxHeight: 200, overflow: 'auto', marginBottom: 16 }}
            />
            {(approvalStatus === 'pending' || approvalStatus === 'requested' || submission?.status === 'approval_in_progress') && (
              <Space.Compact>
                <Input
                  placeholder="Type a message..."
                  value={approvalMessageText}
                  onChange={(e) => setApprovalMessageText(e.target.value)}
                  onPressEnter={handleSendApprovalMessage}
                  disabled={isSendingApproval}
                />
                <Button type="primary" onClick={handleSendApprovalMessage} loading={isSendingApproval}>
                  Send
                </Button>
              </Space.Compact>
            )}
          </Card>
        )}
      </div>
    </>
  );
};

export default CoursePageFormSubmitPage;
