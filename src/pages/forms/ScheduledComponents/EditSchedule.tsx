/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/schedules/EditSchedule.tsx
import React, { useEffect, useRef } from 'react';
import {
  Form,
  Input,
  Button,
  Card,
  Row,
  Col,
  Select,
  DatePicker,
  message,
  Affix,
  Tooltip,
  Spin,
  Typography,
  Alert,
  Divider,
  Switch,
  InputNumber,
  Grid,
} from 'antd';
import { SaveOutlined, ScheduleOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { theme } from 'antd';
import {
  useGetAssignmentQuery,
  useUpdateAssignmentMutation,
  UpdateAssignmentDto,
} from '../../../services/assignmentsApi';
import { useGetTemplatesQuery } from '../../../services/templatesAPI';
import { useListConfigSetsQuery } from '../../../services/configSetsApi';
import {
  buildConfigSetSelectGroupedOptions,
  getConfigSetFromValue,
  normalizeConfigSetValue,
} from '../utils/configSetSelectUtils';

import dayjs from 'dayjs';
import { 
  useGetAssigneesQuery,
  useGetSubjectsQuery,
  useGetApproversQuery,
  useGetOmitSignatureApproversQuery,
} from '../../../services/assignmentsApi';
import { User } from '../../../features/auth/authSlice';

const { Title } = Typography;
const { useBreakpoint } = Grid;

interface ScheduleFormValues {
  assigner: string;
  formTemplateId: string;
  formVersionTemplateId: string;
  configSetId?: string; // Optional configSet selection
  assignees: string[];
  subjects?: string | string[]; // only if not 'none'
  subjectMode: 'single' | 'multiple' | 'none';
  type: 'one_time' | 'recurrence';
  startDate?: string | null; // ISO
  dueDate: string | null; // only one_time
  endDate?: string | null; // only recurrence
  timezone: string;
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  // reminders?: number[]; // only one_time
  //   paused?: boolean; // only recurrence
  // Approvals & disputes configuration
  hasApproval?: boolean;
  hasDisputes?: boolean;
  signatureRequired?: boolean;
  approvers?: string[];
  questionApprovers?: string[];
  approvalRule?: 'ALL' | 'ANY' | 'MIN';
  approvalMinCount?: number;
  omitSignatureAllowed?: boolean;
  omitSignatureApprovers?: string[];
  passingScore?: number;
  passingPassFailCount?: number;
}

const EditScheduleComponent: React.FC = () => {
  const { token } = theme.useToken();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // Store base approvers/subjects/omitSignatureApprovers/questionApprovers from selected configSet
  const configSetBaseApproversRef = useRef<string[]>([]);
  const configSetBaseSubjectsRef = useRef<string[]>([]);
  const configSetBaseOmitSignatureApproversRef = useRef<string[]>([]);
  const configSetBaseQuestionApproversRef = useRef<string[]>([]);
  const configSetDataRef = useRef<any>(null);

  // All hooks must be called before any conditional returns
  const type = Form.useWatch('type', form);
  const required = type === 'recurrence';
  const mode = Form.useWatch('subjectMode', form);
  const hasApprovalWatch = Form.useWatch('hasApproval', form);
  const approvalRuleWatch = Form.useWatch('approvalRule', form);
  const hasDisputesWatch = Form.useWatch('hasDisputes', form);
  const approversWatch = Form.useWatch('approvers', form);
  const approvalMinCountWatch = Form.useWatch('approvalMinCount', form);
  const signatureRequiredWatch = Form.useWatch('signatureRequired', form);
  const omitSignatureAllowedWatch = Form.useWatch('omitSignatureAllowed', form);
  const configSetId = Form.useWatch('configSetId', form);
  const selectedTemplateId = Form.useWatch('formTemplateId', form);

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

  const { data, isLoading, error: scheduleError } = useGetAssignmentQuery(id!);
  const [updateSchedule, { isLoading: isSaving }] =
    useUpdateAssignmentMutation();

  const { data: templatesRes, isFetching } = useGetTemplatesQuery({
    page: 1,
    perPage: 1000,
  });

  const { data: globalConfigSetsData } = useListConfigSetsQuery({ page: 1, perPage: 200 });
  const globalConfigSets = (globalConfigSetsData?.data?.configSets?.records ?? []).filter(
    (r) => !r.deletedAt
  );

  const { data: assigneesRes, isLoading: assigneesLoading } = useGetAssigneesQuery();
  const { data: subjectsRes, isLoading: subjectsLoading } = useGetSubjectsQuery();
  const { data: approversRes, isLoading: approversLoading } = useGetApproversQuery();
  const { data: omitSignatureApproversRes, isLoading: omitSignatureApproversLoading } = useGetOmitSignatureApproversQuery();

  useEffect(() => {
    if (data?.data.assignment && templatesRes?.data?.records) {
      const a = data.data.assignment;
      const templateFromAssignment = templatesRes.data.records.find(
        (t) => t._id === (a.formTemplate as { _id?: string })?._id
      );
      const normalizedConfigSetId = normalizeConfigSetValue(
        (a.configSet as { _id?: string })?._id,
        templateFromAssignment?.configSets,
        globalConfigSets
      );

      // If configSet exists, extract and store base approvers/subjects/omitSignatureApprovers
      if (a.configSet) {
        // configSet.approvers and configSet.subjects can be Profile objects or string arrays
        const approverIds = (a.configSet.approvers || [])
          .map((approver) => (typeof approver === 'string' ? approver : approver._id))
          .filter(Boolean) as string[];
        
        const subjectIds = (a.configSet.subjects || [])
          .map((subject) => (typeof subject === 'string' ? subject : subject._id))
          .filter(Boolean) as string[];
        
        const omitSignatureApproverIds = (a.configSet.omitSignatureApprovers || [])
          .map((item) => (typeof item === 'string' ? item : item._id))
          .filter(Boolean) as string[];

        const questionApproverIds = (a.configSet.questionApprovers || [])
          .map((item) => (typeof item === 'string' ? item : item._id))
          .filter(Boolean) as string[];

        configSetBaseApproversRef.current = approverIds;
        configSetBaseSubjectsRef.current = subjectIds;
        configSetBaseOmitSignatureApproversRef.current = omitSignatureApproverIds;
        configSetBaseQuestionApproversRef.current = questionApproverIds;
        configSetDataRef.current = a.configSet;
      } else {
        configSetBaseApproversRef.current = [];
        configSetBaseSubjectsRef.current = [];
        configSetBaseOmitSignatureApproversRef.current = [];
        configSetBaseQuestionApproversRef.current = [];
        configSetDataRef.current = null;
      }
      
      // Set omitSignatureApprovers from assignment or configSet
      // Handle both Profile objects and string arrays
      let omitSignatureApproversValue: string[] = [];
      if (a.omitSignatureApprovers && Array.isArray(a.omitSignatureApprovers)) {
        omitSignatureApproversValue = a.omitSignatureApprovers
          .map((item) => (typeof item === 'string' ? item : (item as { _id: string })._id))
          .filter(Boolean) as string[];
      } else if (a.configSet?.omitSignatureApprovers && Array.isArray(a.configSet.omitSignatureApprovers)) {
        omitSignatureApproversValue = a.configSet.omitSignatureApprovers
          .map((item) => (typeof item === 'string' ? item : item._id))
          .filter(Boolean) as string[];
      }
      
      // questionApprovers: direct assignment override takes priority over configSet
      let questionApproversValue: string[] = [];
      if (a.questionApprovers && Array.isArray(a.questionApprovers)) {
        questionApproversValue = a.questionApprovers
          .map((item) => (typeof item === 'string' ? item : (item as { _id: string })._id))
          .filter(Boolean) as string[];
      } else if (a.configSet?.questionApprovers && Array.isArray(a.configSet.questionApprovers)) {
        questionApproversValue = a.configSet.questionApprovers
          .map((item) => (typeof item === 'string' ? item : item._id))
          .filter(Boolean) as string[];
      }

      form.setFieldsValue({
        startDate: a.startDate ? dayjs(a.startDate) : null,
        endDate: a.endDate ? dayjs(a.endDate) : null,
        dueDate: a.dueDate ? dayjs(a.dueDate) : null,
        assigner: a.assigner?._id,
        formTemplateId: a.formTemplate?._id,
        formVersionTemplateId: a.formTemplateSchema?._id,
        configSetId: normalizedConfigSetId ?? (a.configSet as { _id?: string })?._id,
        assignees: a.assignees?.map((assignee) => assignee._id),
        subjects: a.subjects?.map((subject) => subject._id),
        subjectMode: a.subjectMode,
        type: a.type,
        timezone: a.timezone,
        recurrence: a.recurrence || null,
        hasApproval: a?.hasApproval ?? false,
        hasDisputes: a?.hasDisputes ?? false,
        signatureRequired: a?.signatureRequired ?? false,
        approvers: a.approvers?.map((approver) => typeof approver === 'string' ? approver : approver._id) || [],
        questionApprovers: questionApproversValue,
        approvalRule: a.approvalRule,
        approvalMinCount: a.approvalMinCount,
        omitSignatureAllowed: a.omitSignatureAllowed ?? false,
        omitSignatureApprovers: omitSignatureApproversValue,
        passingScore: a.passingScore ?? 0,
        passingPassFailCount: a.passingPassFailCount ?? 0,
      });
    }
  }, [data?.data.assignment, form, templatesRes?.data?.records, globalConfigSets]);

  const handleSubmit = async (values: ScheduleFormValues) => {
    try {
      const payload: Record<string, any> = {
        id: id!,
        startDate: values.startDate
          ? dayjs(values.startDate).toISOString()
          : null,
        dueDate: values.dueDate ? dayjs(values.dueDate).toISOString() : null,
        endDate: values.endDate ? dayjs(values.endDate).toISOString() : null,
        recurrence: values.recurrence ?? null,
        timezone: values.timezone ?? null,
        hasApproval: values.hasApproval === true,
        hasDisputes: values.hasDisputes === true,
        signatureRequired: values.signatureRequired === true,
        approvers: values.approvers || [],
        questionApprovers: values.questionApprovers || [],
        approvalRule: values.approvalRule,
        omitSignatureAllowed: values.omitSignatureAllowed === true,
        omitSignatureApprovers: values.omitSignatureApprovers || [],
        passingScore: values.passingScore,
        passingPassFailCount: values.passingPassFailCount,
      };
      if (payload.hasApproval !== true) {
        payload.approvers = [];
        payload.approvalRule = undefined;
        payload['approvalMinCount'] = undefined;
      } else {
        if (payload.approvalRule !== 'MIN') {
          payload['approvalMinCount'] = undefined;
        } else if (typeof values.approvalMinCount === 'number') {
          payload['approvalMinCount'] = values.approvalMinCount;
        }
      }

      await updateSchedule(payload as unknown as UpdateAssignmentDto).unwrap();
      message.success('Schedule updated');
      navigate('/forms/schedules');
    } catch {
      message.error('Failed to update');
    }
  };

  if (isLoading) {
    return (
      <Row justify="center" align="middle" style={{ minHeight: '20vh' }}>
        <Col>
          <Spin size="large" />
        </Col>
      </Row>
    );
  }

  if (scheduleError) {
    if (
      'data' in scheduleError &&
      scheduleError.data &&
      typeof scheduleError.data === 'object' &&
      'message' in scheduleError.data
    ) {
      return (
        <Alert
          message="Error"
          description={
            String((scheduleError.data as { message?: string }).message) ||
            'Unable to load schedule.'
          }
          type="error"
          showIcon
        />
      );
    }

    // fallback for other error shapes (SerializedError, etc.)
    return (
      <Alert
        message="Error"
        description={
          String((scheduleError as { message?: string }).message) ||
          'Unable to load schedule.'
        }
        type="error"
        showIcon
      />
    );
  }

  const assignees = assigneesRes?.data || [];
  const subjects = subjectsRes?.data || [];
  const approvers = approversRes?.data || [];
  const omitSignatureApprovers = omitSignatureApproversRes?.data || [];

  const assigneesOptions = assignees.map((profile) => ({
    label: (profile.user as User)?.name,
    value: profile._id,
  }));

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

  const templatesOptions = templatesRes?.data?.records
    .filter((t) => !!t.currentFormTemplateSchema)
    .map((d) => ({
      label: d.name,
      value: d._id,
      formVersionTemplateId: d?.currentFormTemplateSchema?._id,
      configSets: d.configSets || [],
    }));

  // Get selected template and its configSets
  const selectedTemplate = templatesRes?.data?.records.find(
    (t) => t._id === selectedTemplateId
  );

  const configSetGroupedOptions = buildConfigSetSelectGroupedOptions(
    selectedTemplate?.configSets,
    globalConfigSets,
    selectedTemplate?.name
  );
  const hasConfigSetOptions = configSetGroupedOptions.some((g) => g.options.length > 0);

  // Handle configSet selection (value is t:id or g:id) - apply to form
  const handleConfigSetChange = (value: string) => {
    const configSet = getConfigSetFromValue(
      value,
      selectedTemplate?.configSets,
      globalConfigSets
    );
    if (!configSet) return;
    const approverIds = (configSet.approvers || [])
      .map((a) => (typeof a === 'string' ? a : (a as { _id: string })._id))
      .filter(Boolean) as string[];
    const subjectIds = (configSet.subjects || [])
      .map((s) => (typeof s === 'string' ? s : (s as { _id: string })._id))
      .filter(Boolean) as string[];
    const omitSignatureApproverIds = (configSet.omitSignatureApprovers || [])
      .map((a) => (typeof a === 'string' ? a : (a as { _id: string })._id))
      .filter(Boolean) as string[];
    const questionApproverIds = (configSet.questionApprovers || [])
      .map((a) => (typeof a === 'string' ? a : (a as { _id: string })._id))
      .filter(Boolean) as string[];
    configSetBaseApproversRef.current = approverIds;
    configSetBaseSubjectsRef.current = subjectIds;
    configSetBaseOmitSignatureApproversRef.current = omitSignatureApproverIds;
    configSetBaseQuestionApproversRef.current = questionApproverIds;
    configSetDataRef.current = configSet;
    const currentApprovers = form.getFieldValue('approvers') || [];
    const currentSubjects = form.getFieldValue('subjects') || [];
    const currentOmit = form.getFieldValue('omitSignatureApprovers') || [];
    const currentQ = form.getFieldValue('questionApprovers') || [];
    form.setFieldsValue({
      hasApproval: configSet.hasApproval ?? form.getFieldValue('hasApproval'),
      hasDisputes: configSet.hasDisputes ?? form.getFieldValue('hasDisputes'),
      signatureRequired: configSet.signatureRequired ?? form.getFieldValue('signatureRequired'),
      approvalRule: configSet.approvalRule ?? form.getFieldValue('approvalRule'),
      approvalMinCount: configSet.approvalMinCount ?? form.getFieldValue('approvalMinCount'),
      approvers: [...new Set([...approverIds, ...(Array.isArray(currentApprovers) ? currentApprovers : [])])],
      subjects: [...new Set([...subjectIds, ...(Array.isArray(currentSubjects) ? currentSubjects : [])])],
      omitSignatureAllowed: configSet.omitSignatureAllowed ?? form.getFieldValue('omitSignatureAllowed'),
      omitSignatureApprovers: [...new Set([...omitSignatureApproverIds, ...(Array.isArray(currentOmit) ? currentOmit : [])])],
      questionApprovers: [...new Set([...questionApproverIds, ...(Array.isArray(currentQ) ? currentQ : [])])],
    });
    message.success(`Quick Setting "${configSet.name}" applied`);
  };

  // Scoring: from selected template schema (totalScore/totalPassFail) for max validation
  const schemaWithScoring = selectedTemplate?.currentFormTemplateSchema as { totalScore?: number; totalPassFail?: number } | undefined;
  const totalScore = schemaWithScoring?.totalScore ?? 0;
  const totalPassFail = schemaWithScoring?.totalPassFail ?? 0;

  return (
    <div style={{ background: token.colorBgLayout, paddingBottom: 48 }}>
      <Affix offsetTop={65}>
        <div
          style={{
            background: token.colorBgContainer,
            boxShadow: token.boxShadowTertiary,
            padding: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 16,
          }}
        >
          <Title level={4} style={{ margin: 0, display: 'flex', gap: 8 }}>
            <ScheduleOutlined style={{ color: token.colorPrimary }} />
            Edit Schedule
          </Title>
          <Tooltip title="Save">
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={isSaving}
              onClick={() => form.submit()}
            >
              Save
            </Button>
          </Tooltip>
        </div>
      </Affix>

      <Row justify="center" style={{ marginTop: 32 }}>
        <Col xs={24} xl={24}>
          <Card
            style={{ borderRadius: 12, boxShadow: token.boxShadowSecondary }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              onValuesChange={() => {
                // Effects are handled by useEffect hooks above
              }}
              size={isMobile ? 'small' : 'middle'}
            >
              {/* Basics */}
              <Divider style={{ marginTop: 0 }}>Basics</Divider>
              <Row gutter={[16, 16]}>
                {/* --- Template --- */}
                <Col xs={24} md={12} lg={8}>
                  <Form.Item
                    label="Template"
                    name="formTemplateId"
                    rules={[{ required: true }]}
                  >
                    <Select
                      showSearch
                      loading={isFetching}
                      placeholder="Select template"
                      optionFilterProp="label"
                      filterSort={(a, b) =>
                        (a?.label ?? '')
                          .toLowerCase()
                          .localeCompare((b?.label ?? '').toLowerCase())
                      }
                      disabled
                      options={templatesOptions}
                      onChange={(_, opt) => {
                        const option = Array.isArray(opt) ? opt[0] : opt;
                        if (option && 'formVersionTemplateId' in option) {
                          const formVersionTemplateId = (
                            option as unknown as {
                              formVersionTemplateId?: string;
                            }
                          ).formVersionTemplateId;

                          if (formVersionTemplateId) {
                            form.setFieldValue(
                              'formVersionTemplateId',
                              formVersionTemplateId
                            );
                          }
                        }
                      }}
                    />
                  </Form.Item>
                  {/* Hidden input to store formVersionTemplateId */}
                  <Form.Item name="formVersionTemplateId" hidden>
                    <Input />
                  </Form.Item>
                </Col>
                {/* --- Config Set --- */}
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
                      value={configSetId}
                      onChange={(value) => {
                        form.setFieldValue('configSetId', value);
                        if (value) handleConfigSetChange(value);
                        else {
                          configSetBaseApproversRef.current = [];
                          configSetBaseSubjectsRef.current = [];
                          configSetBaseOmitSignatureApproversRef.current = [];
                          configSetBaseQuestionApproversRef.current = [];
                          configSetDataRef.current = null;
                        }
                      }}
                      disabled={!hasConfigSetOptions}
                      options={configSetGroupedOptions}
                    />
                  </Form.Item>
                </Col>
                {/* --- Type --- */}
                <Col xs={24} md={12} lg={8}>
                  <Form.Item
                    label="Type"
                    name="type"
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="Select type" disabled>
                      <Select.Option value="one_time">One Time</Select.Option>
                      <Select.Option value="recurrence">
                        Recurring
                      </Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              {/* Scoring: Total score, Total pass/fail, Passing score, Passing pass/fail count */}
              {selectedTemplateId && (
                <>
                  <Divider>Scoring</Divider>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <div style={{ marginBottom: 8 }}>
                        <Typography.Text type="secondary">Total score (from form)</Typography.Text>
                        <div style={{ fontSize: 16, fontWeight: 500 }}>{totalScore}</div>
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <div style={{ marginBottom: 8 }}>
                        <Typography.Text type="secondary">Total pass/fail count (from form)</Typography.Text>
                        <div style={{ fontSize: 16, fontWeight: 500 }}>{totalPassFail}</div>
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Passing score"
                        name="passingScore"
                        tooltip="Minimum score required to pass (max is total score above)"
                        rules={[
                          { type: 'number', min: 0, message: 'Must be ≥ 0' },
                          { type: 'number', max: totalScore, message: `Cannot exceed total score (${totalScore})` },
                        ]}
                      >
                        <InputNumber min={0} max={totalScore} style={{ width: '100%' }} placeholder="0" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Passing pass/fail count"
                        name="passingPassFailCount"
                        tooltip="Minimum number of pass items required (max is total pass/fail count above)"
                        rules={[
                          { type: 'number', min: 0, message: 'Must be ≥ 0' },
                          { type: 'number', max: totalPassFail, message: `Cannot exceed total pass/fail count (${totalPassFail})` },
                        ]}
                      >
                        <InputNumber min={0} max={totalPassFail} style={{ width: '100%' }} placeholder="0" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )}

              {/* Timing */}
              <Divider>Timing</Divider>
              <Row gutter={[16, 16]}>
                {/* --- Start Date (Required for Recurring, Optional for one_time) --- */}
                <Col xs={24} md={12} lg={8}>
                  <Form.Item
                    label="Start Date"
                    name="startDate"
                    rules={[
                      {
                        required,
                        message: 'Start date is required for recurring',
                      },
                    ]}
                  >
                    <DatePicker
                      showTime
                      style={{ width: '100%' }}
                      placeholder="Select start date"
                    />
                  </Form.Item>
                </Col>
                {/* --- Due Date (one_time only) --- */}
                {type === 'one_time' && (
                  <Col xs={24} md={12} lg={8}>
                    <Form.Item
                      label="Due Date"
                      name="dueDate"
                      rules={[{ required: true }]}
                    >
                      <DatePicker
                        showTime
                        style={{ width: '100%' }}
                        placeholder="Select due date"
                      />
                    </Form.Item>
                  </Col>
                )}

                {/* --- End Date (Recurring only) --- */}
                {type === 'recurrence' && (
                  <Col xs={24} md={12} lg={8}>
                    <Form.Item label="End Date" name="endDate">
                      <DatePicker
                        showTime
                        style={{ width: '100%' }}
                        placeholder="Select end date"
                      />
                    </Form.Item>
                  </Col>
                )}

                {/* --- Recurrence (Recurring only) --- */}
                {type === 'recurrence' && (
                  <Col xs={24} md={12} lg={8}>
                    <Form.Item
                      label="Recurrence"
                      name="recurrence"
                      rules={[{ required: true }]}
                    >
                      <Select placeholder="Select recurrence">
                        <Select.Option value="daily">Daily</Select.Option>
                        <Select.Option value="weekly">Weekly</Select.Option>
                        <Select.Option value="monthly">Monthly</Select.Option>
                        <Select.Option value="quarterly">
                          Quarterly
                        </Select.Option>
                        <Select.Option value="yearly">Yearly</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                )}
                {/* --- Timezone --- */}
                <Col xs={24} md={12} lg={8}>
                  <Form.Item
                    label="Timezone"
                    name="timezone"
                    rules={[{ required: true }]}
                  >
                    <Select showSearch placeholder="Select timezone">
                      {(() => {
                        const timeZones =
                          (
                            Intl as unknown as {
                              supportedValuesOf?: (arg: string) => string[];
                            }
                          )?.supportedValuesOf?.('timeZone') ?? [];
                        return timeZones.map((tz: string) => (
                          <Select.Option key={tz} value={tz}>
                            {tz}
                          </Select.Option>
                        ));
                      })()}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              {/* Participants */}
              <Divider>Participants</Divider>
              <Row gutter={[16, 16]}>
                {/* --- Assignees --- */}
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Assignees"
                    name="assignees"
                    rules={[{ required: true }]}
                  >
                    <Select
                      mode="multiple"
                      placeholder="Select assignees"
                      disabled
                      options={assigneesOptions}
                      loading={assigneesLoading}
                    />
                  </Form.Item>
                </Col>
                {/* --- Subject Mode --- */}
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Subject Mode"
                    name="subjectMode"
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="Select subject mode" disabled>
                      <Select.Option value="single">Single User</Select.Option>
                      <Select.Option value="multiple">
                        Multiple Users
                      </Select.Option>
                      <Select.Option value="none">Self</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>

                {/* --- Subjects (Conditional) --- */}
                {mode !== 'none' && (
                  <Col xs={24}>
                    <Form.Item
                      label="Subjects"
                      name="subjects"
                      rules={[{ required: true }]}
                    >
                      <Select
                        mode={mode === 'single' ? undefined : 'multiple'}
                        placeholder={`Select ${
                          mode === 'single' ? 'subject' : 'subjects'
                        }`}
                        options={subjectsOptions}
                        loading={subjectsLoading}
                        disabled={!mode || true}
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
                <Col xs={24} sm={24} md={16} lg={16} xl={18}>
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
                    dependencies={['hasApproval', 'approvalRule', 'hasDisputes']}
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
                <Col xs={24} sm={12} md={8} lg={8}>
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
                <Col xs={24} sm={12} md={8} lg={8}>
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
                <Col xs={24} sm={12} md={8} lg={8}>
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
                <Col xs={24}>
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

                {/* --- Reminders / Paused --- */}
                {/* {
                  type === 'one_time' ? (
                    <Col span={12}>
                      <Form.Item
                        label="Reminders (min before)"
                        name="reminders"
                      >
                        <Select mode="multiple" disabled>
                          <Select.Option value={15}>15 min</Select.Option>
                          <Select.Option value={60}>1 hour</Select.Option>
                          <Select.Option value={1440}>1 day</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  ) : (
                    <Col span={12}>
                      <Form.Item name="paused" valuePropName="checked">
                        <Switch
                          checkedChildren="Paused"
                          unCheckedChildren="Active"
                        />
                      </Form.Item>
                    </Col>
                )
                } */}
              </Row>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default EditScheduleComponent;
