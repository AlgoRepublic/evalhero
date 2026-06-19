/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef } from 'react';
import {
  Affix,
  Alert,
  Button,
  Card,
  Col,
  Form,
  Grid,
  Row,
  Select,
  Space,
  Spin,
  Tooltip,
  Typography,
  message,
  Divider,
  Switch,
  InputNumber,
} from 'antd';
import { SaveOutlined, FormOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { theme } from 'antd';
import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import dayjs from 'dayjs';

import { useCreateAssignmentMutation, CreateAssignmentDto } from '../../services/assignmentsApi';
import { useGetTemplateQuery } from '../../services/templatesAPI';
import { useListConfigSetsQuery } from '../../services/configSetsApi';
import {
  buildConfigSetSelectGroupedOptions,
  getConfigSetFromValue,
  parseConfigSetValue,
} from './utils/configSetSelectUtils';
import { User } from '../../features/auth/authSlice';
import { 
  useGetSubjectsQuery,
  useGetApproversQuery,
  useGetOmitSignatureApproversQuery,
} from '../../services/assignmentsApi';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

const { Title } = Typography;
const { useBreakpoint } = Grid;

interface FormValues {
  subjectMode: 'single' | 'multiple' | 'none';
  subjects?: string | string[];
  configSetId?: string;
  hasApproval?: boolean;
  hasDisputes?: boolean;
  signatureRequired?: boolean;
  approvers?: string[];
  questionApprovers?: string[];
  approvalRule?: 'ALL' | 'ANY' | 'MIN';
  approvalMinCount?: number;
  omitSignatureAllowed?: boolean;
  omitSignatureApprovers?: string[];
}


const QuickSubmissionPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId: string }>();
  const [form] = Form.useForm<FormValues>();

  // Responsive: header (aligned with AddTemplate/EditTemplate)
  const isXS = !screens.sm;
  const headerPadding = isMobile ? token.paddingMD : token.paddingLG;
  const buttonSize = isMobile ? 'small' : 'middle';

  // Store base approvers/subjects/omitSignatureApprovers/questionApprovers from selected configSet
  const configSetBaseApproversRef = useRef<string[]>([]);
  const configSetBaseSubjectsRef = useRef<string[]>([]);
  const configSetBaseOmitSignatureApproversRef = useRef<string[]>([]);
  const configSetBaseQuestionApproversRef = useRef<string[]>([]);

  const { selectedProfile } = useSelector(
    (state: RootState) => state.auth
  );

  /* ------------------- DATA FETCHING ------------------- */
  // Only fetch template if templateId is provided
  const { data: templateRes, isFetching: templateLoading, error: templateError } = useGetTemplateQuery(templateId!, { skip: !templateId });

  const { data: subjectsRes, isLoading: subjectsLoading } = useGetSubjectsQuery();
  const { data: approversRes, isLoading: approversLoading } = useGetApproversQuery();
  const { data: omitSignatureApproversRes, isLoading: omitSignatureApproversLoading } = useGetOmitSignatureApproversQuery();

  const [createAssignment, { isLoading: isSubmitting }] = useCreateAssignmentMutation();

  /* ------------------- DETERMINE DATA SOURCE ------------------- */
  const template = templateRes?.data?.formTemplate;

  const { data: globalConfigSetsData } = useListConfigSetsQuery({ page: 1, perPage: 200 });
  const globalConfigSets = (globalConfigSetsData?.data?.configSets?.records ?? []).filter(
    (r) => !r.deletedAt
  );

  // Watch form values
  const subjectModeWatch = Form.useWatch('subjectMode', form);
  const hasApprovalWatch = Form.useWatch('hasApproval', form);
  const approvalRuleWatch = Form.useWatch('approvalRule', form);
  const hasDisputesWatch = Form.useWatch('hasDisputes', form);
  const approversWatch = Form.useWatch('approvers', form);
  const approvalMinCountWatch = Form.useWatch('approvalMinCount', form);
  const signatureRequiredWatch = Form.useWatch('signatureRequired', form);
  const omitSignatureAllowedWatch = Form.useWatch('omitSignatureAllowed', form);

  const prevApprovalRuleRef = useRef<string | undefined>(approvalRuleWatch);
  const isInitializedRef = useRef(false);

  // Track when form values are initialized (approversWatch becomes available)
  useEffect(() => {
    if (approversWatch !== undefined && !isInitializedRef.current) {
      // Wait a bit to ensure all form values are set
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 200);
    }
  }, [approversWatch]);

  // Ensure approval is enabled when disputes are enabled
  useEffect(() => {
    if (hasDisputesWatch === true && hasApprovalWatch !== true) {
      form.setFieldValue('hasApproval', true);
    }

    if (hasDisputesWatch === false) {
      form.setFieldValue('signatureRequired', false);
      form.setFieldValue('omitSignatureAllowed', false);
      form.setFieldValue('omitSignatureApprovers', []);
    }

    if (signatureRequiredWatch === false) {
      form.setFieldValue('omitSignatureAllowed', false);
      form.setFieldValue('omitSignatureApprovers', []);
    }

    if (omitSignatureAllowedWatch === false) {
      form.setFieldValue('omitSignatureApprovers', []);
    }
  }, [hasDisputesWatch, hasApprovalWatch, form, signatureRequiredWatch, omitSignatureAllowedWatch]);

  // Turn off Signature Required, Omit Signature Allowed, and clear Omit Signature Approvers when disputes are disabled
  useEffect(() => {
    if (!isInitializedRef.current) return;
    // When disputes is switched off, turn off signature required and related fields
    if (hasDisputesWatch === false) {
      form.setFieldValue('signatureRequired', false);
      form.setFieldValue('omitSignatureAllowed', false);
      form.setFieldValue('omitSignatureApprovers', []);
    }
  }, [hasDisputesWatch, form]);

  // Clear omitSignatureApprovers when signatureRequired or omitSignatureAllowed is unchecked
  // Only clear if explicitly false (not undefined, which happens during initialization)
  // And only after initialization is complete
  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (signatureRequiredWatch === false) {
      form.setFieldValue('omitSignatureAllowed', false);
      form.setFieldValue('omitSignatureApprovers', []);
    }
  }, [signatureRequiredWatch, form]);

  useEffect(() => {
    // Only clear if explicitly false (not undefined, which happens during initialization)
    // And only after initialization is complete
    if (!isInitializedRef.current) return;
    if (omitSignatureAllowedWatch === false) {
      form.setFieldValue('omitSignatureApprovers', []);
    }
  }, [omitSignatureAllowedWatch, form]);

  // Reset minimum approvals when approval rule changes from MIN to any other value
  useEffect(() => {
    const prevRule = prevApprovalRuleRef.current;
    const currentRule = approvalRuleWatch;

    // If rule changed from MIN to something else, reset approvalMinCount
    if (
      prevRule === 'MIN' &&
      currentRule !== 'MIN' &&
      currentRule !== undefined
    ) {
      form.setFieldValue('approvalMinCount', undefined);
    }

    // Update ref for next comparison
    prevApprovalRuleRef.current = currentRule;
  }, [approvalRuleWatch, form]);

  // Update minimum approvals when approvers are unselected
  useEffect(() => {
    if (
      approvalRuleWatch === 'MIN' &&
      hasApprovalWatch &&
      approversWatch &&
      Array.isArray(approversWatch)
    ) {
      const approversCount = approversWatch.length;
      const currentMinCount = approvalMinCountWatch;

      // If minimum approvals is greater than available approvers, adjust it
      if (
        typeof currentMinCount === 'number' &&
        currentMinCount > approversCount &&
        approversCount > 0
      ) {
        form.setFieldValue('approvalMinCount', approversCount);
      } else if (approversCount === 0 && currentMinCount) {
        // If no approvers selected, clear minimum approvals
        form.setFieldValue('approvalMinCount', undefined);
      }
    }
  }, [
    approversWatch,
    approvalRuleWatch,
    hasApprovalWatch,
    approvalMinCountWatch,
    form,
  ]);

  const subjects = subjectsRes?.data || [];
  const approvers = approversRes?.data || [];
  const omitSignatureApprovers = omitSignatureApproversRes?.data || [];

  const subjectsOptions = subjects.map((profile) => ({
    label: (profile.user as User)?.name,
    value: profile._id,
  }));

  const approversOptions = approvers.map((profile) => ({
    label: (profile.user as User)?.name,
    value: profile._id,
  }));

  const omitSignatureApproversOptions = omitSignatureApprovers.map((profile) => ({
    label: (profile.user as User)?.name,
    value: profile._id,
  }));

  // Grouped options: from template (top) + global config sets (searchable)
  const configSetGroupedOptions = buildConfigSetSelectGroupedOptions(
    template?.configSets,
    globalConfigSets,
    template?.name
  );
  const hasConfigSetOptions = configSetGroupedOptions.some((g) => g.options.length > 0);

  // Handle configSet selection (value is t:id or g:id)
  const handleConfigSetChange = (value: string) => {
    const configSet = getConfigSetFromValue(
      value,
      template?.configSets,
      globalConfigSets
    );

    if (configSet) {
      const toId = (x: unknown) => (typeof x === 'string' ? x : (x as { _id: string })?._id);
      const approverIds = (configSet.approvers || []).map(toId).filter(Boolean) as string[];
      const omitSignatureApproverIds = (configSet.omitSignatureApprovers || []).map(toId).filter(Boolean) as string[];
      const questionApproverIds = (configSet.questionApprovers || []).map(toId).filter(Boolean) as string[];
      const subjectIds = (configSet.subjects || []).map(toId).filter(Boolean) as string[];

      // Store base values (cannot be removed)
      configSetBaseApproversRef.current = approverIds;
      configSetBaseOmitSignatureApproversRef.current = omitSignatureApproverIds;
      configSetBaseQuestionApproversRef.current = questionApproverIds;
      configSetBaseSubjectsRef.current = subjectIds;

      // Get current form values
      const currentApprovers = form.getFieldValue('approvers') || [];
      const currentOmitSignatureApprovers = form.getFieldValue('omitSignatureApprovers') || [];
      const currentQuestionApprovers = form.getFieldValue('questionApprovers') || [];
      const currentSubjects = form.getFieldValue('subjects') || [];

      // Merge: combine configSet values with existing values (no duplicates)
      const mergedApprovers = [
        ...new Set([...approverIds, ...(Array.isArray(currentApprovers) ? currentApprovers : [])]),
      ];

      const mergedOmitSignatureApprovers = [
        ...new Set([...omitSignatureApproverIds, ...(Array.isArray(currentOmitSignatureApprovers) ? currentOmitSignatureApprovers : [])]),
      ];

      const mergedQuestionApprovers = [
        ...new Set([...questionApproverIds, ...(Array.isArray(currentQuestionApprovers) ? currentQuestionApprovers : [])]),
      ];

      const mergedSubjects = [
        ...new Set([...subjectIds, ...(Array.isArray(currentSubjects) ? currentSubjects : typeof currentSubjects === 'string' ? [currentSubjects] : [])]),
      ];

      // Populate form fields with configSet data
      form.setFieldsValue({
        hasApproval: configSet.hasApproval ?? form.getFieldValue('hasApproval'),
        hasDisputes: configSet.hasDisputes ?? form.getFieldValue('hasDisputes'),
        signatureRequired: configSet.signatureRequired ?? form.getFieldValue('signatureRequired'),
        approvalRule: configSet.approvalRule ?? form.getFieldValue('approvalRule'),
        approvalMinCount: configSet.approvalMinCount ?? form.getFieldValue('approvalMinCount'),
        approvers: mergedApprovers,
        questionApprovers: mergedQuestionApprovers.length > 0 ? mergedQuestionApprovers : form.getFieldValue('questionApprovers'),
        subjects: subjectModeWatch === 'single' ? (mergedSubjects.length > 0 ? mergedSubjects[0] : form.getFieldValue('subjects')) : mergedSubjects.length > 0 ? mergedSubjects : form.getFieldValue('subjects'),
        omitSignatureAllowed: configSet.omitSignatureAllowed ?? form.getFieldValue('omitSignatureAllowed'),
        omitSignatureApprovers: mergedOmitSignatureApprovers.length > 0 ? mergedOmitSignatureApprovers : form.getFieldValue('omitSignatureApprovers'),
      });

      message.success(`Quick Setting "${configSet.name}" applied`);
    } else {
      // Clear configSet base values when deselected
      configSetBaseApproversRef.current = [];
      configSetBaseSubjectsRef.current = [];
      configSetBaseOmitSignatureApproversRef.current = [];
      configSetBaseQuestionApproversRef.current = [];
    }
  };


  /* ------------------- SUBMIT HANDLER ------------------- */
  const handleSubmit = async (values: FormValues) => {
    if (!templateId || !template) {
      message.error('Missing required parameters');
      return;
    }

    // Get formTemplateSchemaId from template
    const formTemplateSchemaId = 
      template.currentFormTemplateSchema?._id || 
      (typeof template.currentFormTemplateSchema === 'string' 
        ? template.currentFormTemplateSchema 
        : null);

    if (!formTemplateSchemaId) {
      message.error('Template schema ID is missing');
      return;
    }

    // Get user timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Get current date and time
    const startDate = dayjs().toISOString();

    // Prepare subjects array
    let subjectsArray: string[] = [];
    if (values.subjectMode === 'none') {
      subjectsArray = [];
    } else if (values.subjectMode === 'single') {
      subjectsArray = values.subjects ? (typeof values.subjects === 'string' ? [values.subjects] : []) : [];
    } else {
      subjectsArray = Array.isArray(values.subjects) ? values.subjects : [];
    }

    // Validate subjects based on mode
    if (values.subjectMode !== 'none' && subjectsArray.length === 0) {
      message.error('Please select at least one subject');
      return;
    }

    try {
      const payload: Record<string, any> = {
        assigner: selectedProfile?._id || '',
        formTemplateId: templateId,
        formVersionTemplateId: formTemplateSchemaId,
        formTemplateSchemaId: templateRes.data.formTemplate.currentFormTemplateSchema?._id,
        assignees: [selectedProfile?._id || ''],
        subjects: subjectsArray,
        subjectMode: values.subjectMode,
        type: 'one_time',
        startDate: startDate,
        dueDate: null,
        timezone: userTimezone,
        configSetId: parseConfigSetValue(values.configSetId)?.id ?? values.configSetId,
        hasApproval: values.hasApproval,
        hasDisputes: values.hasDisputes,
        signatureRequired: values.signatureRequired,
        approvers: values.approvers || [],
        questionApprovers: values.questionApprovers || [],
        approvalRule: values.approvalRule,
        approvalMinCount: values.approvalMinCount,
        omitSignatureAllowed: values.omitSignatureAllowed,
        omitSignatureApprovers: values.omitSignatureApprovers || [],
      };

      // Send template default passing score and pass/fail count (no UI for quick submit)
      if (typeof template.passingScore === 'number') payload.passingScore = template.passingScore;
      if (typeof template.passingPassFailCount === 'number') payload.passingPassFailCount = template.passingPassFailCount;

      // Normalize approvals fields
      if (payload.hasApproval !== true) {
        payload.approvers = [];
        payload.questionApprovers = [];
        payload.approvalRule = undefined;
        payload.approvalMinCount = undefined;
      } else {
        if (payload.approvalRule !== 'MIN') {
          payload.approvalMinCount = undefined;
        }
      }

      const res = await createAssignment(payload as unknown as CreateAssignmentDto).unwrap();
      message.success('Queue scheduled successfully');
      
      // Redirect to submission page
      const queueId = res.data.assignment._id;
      navigate(`/forms/queues/${queueId}/submit`);
    } catch (err: unknown) {
      const safeErr =
        typeof err === 'object' && err !== null
          ? (err as { data?: { message?: string }; message?: string })
          : undefined;

      const errMsg =
        safeErr?.data?.message ?? safeErr?.message ?? 'Failed to schedule queue';

      message.error(errMsg);
    }
  };

  /* ------------------- LOADING & ERROR STATES ------------------- */
  const error = templateError;

  if (templateLoading) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Loading form..." />
      </div>
    );
  }

  if (error || (!template)) {
    return (
      <Alert
        type="error"
        message="Failed to load form data"
        description={
          !templateId
            ? 'Please provide templateId in query parameters'
            : 'Unable to load the requested template or schedule'
        }
        action={
          <Button onClick={() => navigate('/forms/templates')}>
            Go to Templates
          </Button>
        }
      />
    );
  }

  // Determine display information
  const templateName = template?.name || 'Unknown Template';

  return (
    <div>
      <Helmet>
        <title>Quick Submission - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Quick Submission"
        breadcrumbs={[
          {
            title: (
              <>
                <FormOutlined />
                <span>Forms</span>
              </>
            ),
          },
          {
            title: 'Templates',
            path: '/forms/templates',
          },
          {
            title: 'Quick Submit',
          },
        ]}
      />
      <div
        style={{
          background: token.colorBgLayout,
          paddingBottom: 48,
        }}
      >
        {/* ---------- HEADER ---------- */}
        <Affix offsetTop={isMobile ? 56 : 65}>
          <div
            style={{
              background: token.colorBgContainer,
              boxShadow: token.boxShadowTertiary,
              padding: headerPadding,
              display: 'flex',
              flexDirection: isXS ? 'column' : 'row',
              alignItems: isXS ? 'stretch' : 'center',
              justifyContent: isXS ? 'flex-start' : 'space-between',
              gap: isXS ? 12 : 0,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: isMobile ? token.borderRadius : 12,
            }}
          >
            <Title
              level={isMobile ? 5 : 4}
              style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? 16 : undefined }}
            >
              <FormOutlined style={{ color: token.colorPrimary }} />
              Schedule Queue: {templateName}
            </Title>

            <Space size={isMobile ? 'small' : 'middle'} style={isXS ? { width: '100%' } : undefined}>
              <Tooltip title="Schedule Queue">
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  size={buttonSize}
                  block={isXS}
                  loading={isSubmitting}
                  onClick={() => form.submit()}
                >
                  Schedule & Submit
                </Button>
              </Tooltip>
            </Space>
          </div>
        </Affix>

        {/* ---------- FORM ---------- */}
        <Row justify="center" style={{ marginTop: 16 }}>
          <Col xs={24} xl={24}>
            <Card
              style={{
                borderRadius: 12,
                boxShadow: token.boxShadowSecondary,
                padding: 24,
              }}
            >
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{
                  subjectMode: 'single',
                  type: 'one_time',
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  assignees: selectedProfile?._id ? [selectedProfile._id] : [],
                }}
              >
                {/* Hidden fields */}
                <Form.Item name="type" hidden>
                  <input type="hidden" />
                </Form.Item>
                <Form.Item name="timezone" hidden>
                  <input type="hidden" />
                </Form.Item>
                <Form.Item name="assignees" hidden>
                  <input type="hidden" />
                </Form.Item>

                {/* Basics */}
                <Divider style={{ marginTop: 0 }}>Basics</Divider>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12} lg={8}>
                    <Form.Item
                      label="Config Set (Optional)"
                      name="configSetId"
                      tooltip="Select a config set from the template or global list to pre-populate approval and dispute settings"
                    >
                      <Select
                        placeholder="Select config set (optional)"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        filterOption={(input, opt) =>
                          (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                        }
                        onChange={(value) => {
                          if (value) {
                            handleConfigSetChange(value);
                          } else {
                            configSetBaseApproversRef.current = [];
                            configSetBaseSubjectsRef.current = [];
                            configSetBaseOmitSignatureApproversRef.current = [];
                            configSetBaseQuestionApproversRef.current = [];
                          }
                        }}
                        disabled={!hasConfigSetOptions}
                        options={configSetGroupedOptions}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {/* Participants */}
                <Divider>Participants</Divider>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={6}>
                    <Form.Item
                      label="Subject Mode"
                      name="subjectMode"
                      rules={[{ required: true, message: 'Please select subject mode' }]}
                    >
                      <Select placeholder="Select subject mode">
                        <Select.Option value="single">Single User</Select.Option>
                        <Select.Option value="multiple">Multiple Users</Select.Option>
                        <Select.Option value="none">Self</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  {subjectModeWatch !== 'none' && (
                    <Col xs={24} md={18}>
                      <Form.Item
                        label="Subjects"
                        name="subjects"
                        rules={[
                          {
                            required: true,
                            message: 'Please select at least one subject',
                          },
                        ]}
                      >
                        <Select
                          mode={subjectModeWatch === 'single' ? undefined : 'multiple'}
                          placeholder={`Select ${
                            subjectModeWatch === 'single' ? 'subject' : 'subjects'
                          }`}
                          options={subjectsOptions}
                          loading={subjectsLoading}
                          disabled={!subjectModeWatch}
                        />
                      </Form.Item>
                    </Col>
                  )}
                </Row>

                {/* Approvals & Disputes */}
                <Divider>Approvals & Disputes</Divider>
                <Row gutter={[12, 12]}>
                  {/* Row 1: Approval Required | Approver(s) */}
                  <Col xs={24} sm={12} md={8} lg={8} xl={6}>
                    <Form.Item
                      label="Approval Required"
                      name="hasApproval"
                      valuePropName="checked"
                      tooltip="If enabled, submission first goes to Approvals chat channel"
                      style={{ marginBottom: 0 }}
                    >
                      <Switch disabled={hasDisputesWatch === true} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={16} lg={16} xl={18}>
                    <Form.Item
                      label="Approver(s)"
                      name="approvers"
                      tooltip="Who can approve the form submission; select one or more profiles"
                      style={{ marginBottom: 0 }}
                    >
                      <Select
                        mode="multiple"
                        placeholder="Select approvers"
                        options={approversOptions}
                        loading={approversLoading}
                        disabled={!hasApprovalWatch && !hasDisputesWatch}
                        size="small"
                        maxTagCount="responsive"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item
                      label="Question Approvers"
                      name="questionApprovers"
                      tooltip="Who can approve individual questions (optional; if empty, form approvers are used)"
                      style={{ marginBottom: 0 }}
                    >
                      <Select
                        mode="multiple"
                        placeholder="Select question approvers (optional)"
                        options={approversOptions}
                        loading={approversLoading}
                        disabled={!hasApprovalWatch && !hasDisputesWatch}
                        size="small"
                        maxTagCount="responsive"
                      />
                    </Form.Item>
                  </Col>

                  {/* Row 2: Approval Rule, Minimum approvals */}
                  <Col xs={24} sm={12} md={12} lg={12}>
                    <Form.Item
                      label="Approval Rule"
                      name="approvalRule"
                      tooltip="ALL, ANY, or MIN (minimum any)"
                      style={{ marginBottom: 0 }}
                    >
                      <Select
                        placeholder="Select rule"
                        disabled={!hasApprovalWatch && !hasDisputesWatch}
                        size="small"
                      >
                        <Select.Option value="ALL">All</Select.Option>
                        <Select.Option value="ANY">Any</Select.Option>
                        <Select.Option value="MIN">Minimum</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={12} lg={12}>
                    <Form.Item
                      label="Minimum approvals"
                      name="approvalMinCount"
                      tooltip="Required when rule = Minimum. Cannot exceed number of approvers selected."
                      style={{ marginBottom: 0 }}
                      rules={[
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            const required =
                              (getFieldValue('hasApproval') || getFieldValue('hasDisputes')) &&
                              getFieldValue('approvalRule') === 'MIN';
                            if (!required) return Promise.resolve();
                            if (typeof value !== 'number' || value < 1) {
                              return Promise.reject(new Error('Enter a number ≥ 1'));
                            }

                            // Check if value exceeds number of approvers
                            const approvers = getFieldValue('approvers') || [];
                            const approversCount = Array.isArray(approvers)
                              ? approvers.length
                              : 0;

                            if (approversCount > 0 && value > approversCount) {
                              return Promise.reject(
                                new Error(
                                  `Cannot exceed ${approversCount} approver${
                                    approversCount > 1 ? 's' : ''
                                  } selected`
                                )
                              );
                            }

                            return Promise.resolve();
                          },
                        }),
                      ]}
                    >
                      <InputNumber
                        min={1}
                        max={
                          approversWatch && Array.isArray(approversWatch)
                            ? approversWatch.length
                            : undefined
                        }
                        style={{ width: '100%' }}
                        disabled={(!hasApprovalWatch && !hasDisputesWatch) || approvalRuleWatch !== 'MIN'}
                        size="small"
                      />
                    </Form.Item>
                  </Col>

                  {/* Divider before disputes enabled section */}
                  <Col xs={24}>
                    <Divider style={{ margin: '12px 0' }} />
                  </Col>

                  {/* Row 4: Dispute Enabled, Signature Required, Omit Signature Allowed */}
                  <Col xs={24} sm={10} md={7} lg={7} xl={8}>
                    <Form.Item
                      label="Dispute Enabled"
                      name="hasDisputes"
                      valuePropName="checked"
                      tooltip="Enable dispute clarification chat channel"
                      style={{ marginBottom: 0 }}
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                <Col xs={24} sm={14} md={8} lg={8} xl={8}>
                  <Form.Item
                    label="Signature Required"
                    name="signatureRequired"
                    valuePropName="checked"
                    tooltip="Require evaluee signature to close dispute or finalize"
                    style={{ marginBottom: 0 }}
                  >
                    <Switch disabled={hasDisputesWatch !== true} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={24} md={9} lg={9} xl={8}>
                  <Form.Item
                    label="Omit Signature Allowed"
                    name="omitSignatureAllowed"
                    valuePropName="checked"
                    tooltip="Allow selected approvers to omit signature requirement"
                    style={{ marginBottom: 0 }}
                  >
                    <Switch disabled={!signatureRequiredWatch || hasDisputesWatch !== true} />
                  </Form.Item>
                </Col>

                {/* Row 5: Omit Signature Approvers */}
                <Col xs={24} sm={24} md={24} lg={24}>
                  <Form.Item
                    label="Omit Signature Approvers"
                    name="omitSignatureApprovers"
                    tooltip="Select approvers who can omit signature requirement"
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      mode="multiple"
                      placeholder="Select approvers (optional)"
                      options={omitSignatureApproversOptions}
                      loading={omitSignatureApproversLoading}
                      disabled={!omitSignatureAllowedWatch || !signatureRequiredWatch || hasDisputesWatch !== true}
                      size="small"
                      maxTagCount="responsive"
                    />
                  </Form.Item>
                </Col>
                </Row>

              </Form>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export { QuickSubmissionPage };

