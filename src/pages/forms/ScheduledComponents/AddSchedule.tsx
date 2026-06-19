// src/pages/schedules/AddSchedule.tsx
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
  Typography,
  Divider,
  Grid,
} from 'antd';
import { Switch, InputNumber } from 'antd';
import { SaveOutlined, ScheduleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { theme } from 'antd';
import { useCreateAssignmentMutation, CreateAssignmentDto } from '../../../services/assignmentsApi';
import { useGetTemplatesQuery } from '../../../services/templatesAPI';
import { useListConfigSetsQuery } from '../../../services/configSetsApi';
import {
  buildConfigSetSelectGroupedOptions,
  getConfigSetFromValue,
  parseConfigSetValue,
} from '../utils/configSetSelectUtils';
import dayjs from 'dayjs';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
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
  formTemplateSchemaId: string;
  configSetId?: string; // Optional configSet selection
  assignees: string[];
  subjects?: string | string[]; // only if not 'none'
  subjectMode: 'single' | 'multiple' | 'none';
  type: 'one_time' | 'recurrence';
  startDate?: string; // ISO
  dueDate?: string | null; // only one_time
  endDate?: string | null; // only recurrence
  timezone: string;
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  // Approvals & disputes configuration (set at scheduling time)
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

const AddSchedule: React.FC = () => {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { selectedProfile } = useSelector(
    (state: RootState) => state.auth
  );

  const [createAssignment, { isLoading }] = useCreateAssignmentMutation();
  
  // Store base approvers/subjects/omitSignatureApprovers/questionApprovers from selected configSet (for reset functionality)
  const configSetBaseApproversRef = useRef<string[]>([]);
  const configSetBaseSubjectsRef = useRef<string[]>([]);
  const configSetBaseOmitSignatureApproversRef = useRef<string[]>([]);
  const configSetBaseQuestionApproversRef = useRef<string[]>([]);
  const configSetDataRef = useRef<any>(null); // Store full configSet for reset

  const { data: assigneesRes, isLoading: assigneesLoading } = useGetAssigneesQuery();
  const { data: subjectsRes, isLoading: subjectsLoading } = useGetSubjectsQuery();
  const { data: approversRes, isLoading: approversLoading } = useGetApproversQuery();
  const { data: omitSignatureApproversRes, isLoading: omitSignatureApproversLoading } = useGetOmitSignatureApproversQuery();

  const { data: templatesRes, isFetching } = useGetTemplatesQuery({
    page: 1,
    perPage: 1000,
  });

  const { data: globalConfigSetsData } = useListConfigSetsQuery({ page: 1, perPage: 200 });
  const globalConfigSets = (globalConfigSetsData?.data?.configSets?.records ?? []).filter(
    (r) => !r.deletedAt
  );

  const handleSubmit = async (values: ScheduleFormValues) => {
    try {
      const {
        assigner: valuesAssigner,
        subjects: valuesSubjects,
        startDate: valuesStartDate,
        dueDate: valuesDueDate,
        approvalMinCount,
        ...restValues
      } = values;

      const payload: Record<string, unknown> = {
        ...restValues,
        assigner: selectedProfile?._id || valuesAssigner || '',
        startDate: valuesStartDate
          ? dayjs(valuesStartDate).toISOString()
          : null,
        dueDate: valuesDueDate ? dayjs(valuesDueDate).toISOString() : null,
        endDate: values.endDate ? dayjs(values.endDate).toISOString() : null,
        subjects: Array.isArray(valuesSubjects)
          ? valuesSubjects
          : valuesSubjects
            ? [valuesSubjects]
            : [],
      };
      // Normalize approvals fields
      if (payload.hasApproval !== true) {
        payload.approvers = [];
        payload.questionApprovers = [];
        payload.approvalRule = undefined;
        payload['approvalMinCount'] = undefined;
      } else {
        payload.questionApprovers = values.questionApprovers || [];
        if (payload.approvalRule !== 'MIN') {
          payload['approvalMinCount'] = undefined;
        } else if (typeof approvalMinCount === 'number') {
          payload['approvalMinCount'] = approvalMinCount;
        }
      }

      // Clean up
      if (values.type === 'one_time') {
        // delete payload.endDate;
        delete payload.recurrence;
        // delete payload.paused;
        // delete payload.rrule;
      } else {
        // if (payload.dueDate !== null) {
        Reflect.deleteProperty(payload, 'dueDate');
        // }
        // delete payload.reminders;
      }

      if (values.subjectMode === 'none') {
        // keep an empty array for subjects so the payload matches CreateAssignmentDto (subjects: string[])
        payload.subjects = [];
      }

      // Ensure subjects is always an array to satisfy the expected CreateAssignmentDto type
      if (!Array.isArray(payload.subjects)) {
        payload.subjects = payload.subjects ? [payload.subjects] : [];
      }

      if (typeof values.passingScore === 'number') payload.passingScore = values.passingScore;
      if (typeof values.passingPassFailCount === 'number') payload.passingPassFailCount = values.passingPassFailCount;

      const rawConfigSetId = parseConfigSetValue(values.configSetId)?.id ?? values.configSetId;
      if (rawConfigSetId) payload.configSetId = rawConfigSetId;

      const res = await createAssignment(payload as unknown as CreateAssignmentDto).unwrap();
      message.success('Schedule created');
      navigate(`/forms/schedules/edit/${res.data.assignment._id}`);
    } catch (err) {
      message.error('Failed to create schedule');
    }
  };

  const type = Form.useWatch('type', form);
  const required = type === 'recurrence';
  const mode = Form.useWatch('subjectMode', form);
  // Keep all useWatch calls at the top-level to avoid changing hooks order
  const hasApprovalWatch = Form.useWatch('hasApproval', form);
  const approvalRuleWatch = Form.useWatch('approvalRule', form);
  const hasDisputesWatch = Form.useWatch('hasDisputes', form);
  const approversWatch = Form.useWatch('approvers', form);
  const approvalMinCountWatch = Form.useWatch('approvalMinCount', form);
  const signatureRequiredWatch = Form.useWatch('signatureRequired', form);
  const omitSignatureAllowedWatch = Form.useWatch('omitSignatureAllowed', form);
  const configSetId = Form.useWatch('configSetId', form);

  const prevApprovalRuleRef = useRef<string | undefined>(approvalRuleWatch);
  const isInitializedRef = useRef(false);

  // Initialize timezone with system timezone
  useEffect(() => {
    const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const currentTimezone = form.getFieldValue('timezone');
    if (!currentTimezone) {
      form.setFieldValue('timezone', systemTimezone);
    }
  }, [form]);

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
      formTemplateSchemaId: d?.currentFormTemplateSchema?._id,
      configSets: d.configSets || [],
    }));

  // Get selected template and its configSets
  const selectedTemplateId = Form.useWatch('formTemplateId', form);
  const selectedTemplate = templatesRes?.data?.records.find(
    (t) => t._id === selectedTemplateId
  );

  const configSetGroupedOptions = buildConfigSetSelectGroupedOptions(
    selectedTemplate?.configSets,
    globalConfigSets,
    selectedTemplate?.name
  );
  const hasConfigSetOptions = configSetGroupedOptions.some((g) => g.options.length > 0);

  // Scoring: from selected template schema (totalScore/totalPassFail) for max validation
  const schemaWithScoring = selectedTemplate?.currentFormTemplateSchema as { totalScore?: number; totalPassFail?: number } | undefined;
  const totalScore = schemaWithScoring?.totalScore ?? 0;
  const totalPassFail = schemaWithScoring?.totalPassFail ?? 0;

  // Handle configSet selection (value is t:id or g:id)
  const handleConfigSetChange = (value: string) => {
    const configSet = getConfigSetFromValue(
      value,
      selectedTemplate?.configSets,
      globalConfigSets
    );

    if (configSet) {
      const toId = (x: unknown) => (typeof x === 'string' ? x : (x as { _id: string })?._id);
      const approverIds = (configSet.approvers || []).map(toId).filter(Boolean) as string[];
      const subjectIds = (configSet.subjects || []).map(toId).filter(Boolean) as string[];
      const omitSignatureApproverIds = (configSet.omitSignatureApprovers || []).map(toId).filter(Boolean) as string[];
      const questionApproverIds = (configSet.questionApprovers || []).map(toId).filter(Boolean) as string[];

      // Store base values (for reset functionality)
      configSetBaseApproversRef.current = approverIds;
      configSetBaseSubjectsRef.current = subjectIds;
      configSetBaseOmitSignatureApproversRef.current = omitSignatureApproverIds;
      configSetBaseQuestionApproversRef.current = questionApproverIds;
      configSetDataRef.current = configSet;

      // Get current form values
      const currentApprovers = form.getFieldValue('approvers') || [];
      const currentSubjects = form.getFieldValue('subjects') || [];
      const currentOmitSignatureApprovers = form.getFieldValue('omitSignatureApprovers') || [];
      const currentQuestionApprovers = form.getFieldValue('questionApprovers') || [];

      // Merge: combine configSet values with existing values (no duplicates)
      const mergedApprovers = [
        ...new Set([...approverIds, ...(Array.isArray(currentApprovers) ? currentApprovers : [])]),
      ];

      const mergedSubjects = [
        ...new Set([...subjectIds, ...(Array.isArray(currentSubjects) ? currentSubjects : typeof currentSubjects === 'string' ? [currentSubjects] : [])]),
      ];

      const mergedOmitSignatureApprovers = [
        ...new Set([...omitSignatureApproverIds, ...(Array.isArray(currentOmitSignatureApprovers) ? currentOmitSignatureApprovers : [])]),
      ];

      const mergedQuestionApprovers = [
        ...new Set([...questionApproverIds, ...(Array.isArray(currentQuestionApprovers) ? currentQuestionApprovers : [])]),
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
        subjects: mergedSubjects.length > 0 ? mergedSubjects : form.getFieldValue('subjects'),
        omitSignatureAllowed: configSet.omitSignatureAllowed ?? form.getFieldValue('omitSignatureAllowed'),
        omitSignatureApprovers: mergedOmitSignatureApprovers.length > 0 ? mergedOmitSignatureApprovers : form.getFieldValue('omitSignatureApprovers'),
      });

      message.success(`Quick Setting "${configSet.name}" applied`);
    } else {
      // Clear configSet data when deselected
      configSetBaseApproversRef.current = [];
      configSetBaseSubjectsRef.current = [];
      configSetBaseOmitSignatureApproversRef.current = [];
      configSetBaseQuestionApproversRef.current = [];
      configSetDataRef.current = null;
    }
  };

  // Reset configSet data
  const handleResetConfigSet = () => {
    const configSet = configSetDataRef.current;
    if (!configSet) {
      message.warning('No quick setting selected');
      return;
    }

    const approverIds = configSetBaseApproversRef.current;
    const subjectIds = configSetBaseSubjectsRef.current;
    const omitSignatureApproverIds = configSetBaseOmitSignatureApproversRef.current;
    const questionApproverIds = configSetBaseQuestionApproversRef.current;

    // Reset form fields to configSet values
    form.setFieldsValue({
      hasApproval: configSet.hasApproval ?? false,
      hasDisputes: configSet.hasDisputes ?? false,
      signatureRequired: configSet.signatureRequired ?? false,
      approvalRule: configSet.approvalRule,
      approvalMinCount: configSet.approvalMinCount,
      approvers: approverIds,
      questionApprovers: questionApproverIds,
      subjects: mode === 'single' ? (subjectIds.length > 0 ? subjectIds[0] : undefined) : subjectIds,
      omitSignatureAllowed: configSet.omitSignatureAllowed ?? false,
      omitSignatureApprovers: omitSignatureApproverIds,
    });

    message.success(`Quick Setting "${configSet.name}" reset`);
  };

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
            Add Schedule
          </Title>
          <Tooltip title="Save">
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={isLoading}
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
                {/* <Col xs={24} md={12} lg={8}>
                  <Form.Item label="Assigner">
                    <Input
                      disabled
                      placeholder="Auto-filled"
                      value={user?.name}
                    />
                  </Form.Item>
                </Col> */}
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
                      options={templatesOptions}
                      onChange={(value, opt) => {
                        const option = Array.isArray(opt) ? opt[0] : opt;
                        if (option && 'formTemplateSchemaId' in option) {
                          const formTemplateSchemaId = (
                            option as unknown as {
                              formTemplateSchemaId?: string;
                            }
                          ).formTemplateSchemaId;

                          if (formTemplateSchemaId) {
                            form.setFieldValue(
                              'formTemplateSchemaId',
                              formTemplateSchemaId
                            );
                          }
                        }
                        // Pre-fill default passing score and pass/fail count from template
                        const selectedT = templatesRes?.data?.records?.find((t) => t._id === value);
                        if (selectedT) {
                          form.setFieldsValue({
                            passingScore: typeof selectedT.passingScore === 'number' ? selectedT.passingScore : undefined,
                            passingPassFailCount: typeof selectedT.passingPassFailCount === 'number' ? selectedT.passingPassFailCount : undefined,
                          });
                        }
                        // Clear configSet when template changes
                        form.setFieldValue('configSetId', undefined);
                        configSetBaseApproversRef.current = [];
                        configSetBaseSubjectsRef.current = [];
                        configSetBaseOmitSignatureApproversRef.current = [];
                        configSetDataRef.current = null;
                      }}
                    />
                  </Form.Item>
                  <Form.Item name="formTemplateSchemaId" hidden>
                    <Input />
                  </Form.Item>
                </Col>
                  <Col xs={24} md={12} lg={8}>
                    <Form.Item
                      label="Config Set (Optional)"
                      name="configSetId"
                      tooltip="Select a config set from the template or global list to pre-populate approval and dispute settings"
                    >
                      <div style={{ display: 'flex', gap: 8 }}>
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
                            if (value) {
                              handleConfigSetChange(value);
                            } else {
                              configSetBaseApproversRef.current = [];
                              configSetBaseSubjectsRef.current = [];
                              configSetBaseOmitSignatureApproversRef.current = [];
                              configSetDataRef.current = null;
                            }
                          }}
                          disabled={!hasConfigSetOptions}
                          options={configSetGroupedOptions}
                          style={{ flex: 1 }}
                        />
                        {configSetId && (
                          <Tooltip title="Reset to config set values">
                            <Button
                              icon={<ReloadOutlined />}
                              onClick={handleResetConfigSet}
                              size="small"
                            />
                          </Tooltip>
                        )}
                      </div>
                    </Form.Item>
                  </Col>

                <Col xs={24} md={12} lg={8}>
                  <Form.Item
                    label="Type"
                    name="type"
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="Select type">
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
                <Col xs={24} md={12} lg={8}>
                  <Form.Item
                    label="Timezone"
                    name="timezone"
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
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Assignees"
                    name="assignees"
                    rules={[{ required: true }]}
                  >
                    <Select
                      mode="multiple"
                      placeholder="Select assignees"
                      options={assigneesOptions}
                      loading={assigneesLoading}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Subject Mode"
                    name="subjectMode"
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="Select subject mode">
                      <Select.Option value="single">Single User</Select.Option>
                      <Select.Option value="multiple">
                        Multiple Users
                      </Select.Option>
                      <Select.Option value="none">Self</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                {mode !== 'none' && (
                  <Col xs={24}>
                    <Form.Item
                      label="Subjects"
                      name="subjects"
                    >
                      <Select
                        mode={mode === 'single' ? undefined : 'multiple'}
                        placeholder={`Select ${
                          mode === 'single' ? 'subject' : 'subjects'
                        }`}
                        options={subjectsOptions}
                        loading={subjectsLoading}
                        disabled={!mode}
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
                    <Switch />
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
  );
};

export default AddSchedule;
