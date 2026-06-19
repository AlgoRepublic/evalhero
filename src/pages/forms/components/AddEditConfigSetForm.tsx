import React, { useMemo, useEffect } from 'react';
import {
  Form,
  Input,
  Switch,
  Select,
  InputNumber,
  Row,
  Col,
  Divider,
  Button,
  Space,
  message,
  Affix,
  Tooltip,
  Typography,
  Grid,
  theme,
} from 'antd';
import { FormOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  ConfigSet,
  getConfigSetProfileIds,
  useCreateConfigSetMutation,
  useUpdateConfigSetMutation,
  type ConfigSetApprovalRule,
  type CreateConfigSetBody,
  type UpdateConfigSetBody,
} from '../../../services/configSetsApi';
import {
  useGetSubjectsQuery,
  useGetApproversQuery,
  useGetOmitSignatureApproversQuery,
} from '../../../services/assignmentsApi';
import { User } from '../../../features/auth/authSlice';
import { PATH_FORMS } from '../../../constants/routes';

const { Title } = Typography;
const { useBreakpoint } = Grid;

const APPROVAL_RULES: { value: ConfigSetApprovalRule; label: string }[] = [
  { value: 'NONE', label: 'None' },
  { value: 'ALL', label: 'All' },
  { value: 'ANY', label: 'Any' },
  { value: 'MIN', label: 'Minimum' },
];

export interface ConfigSetFormValues {
  name: string;
  hasApproval?: boolean;
  hasDisputes?: boolean;
  signatureRequired?: boolean;
  omitSignatureAllowed?: boolean;
  approvalRule?: ConfigSetApprovalRule;
  approvalMinCount?: number;
  approvers?: string[];
  questionApprovers?: string[];
  subjects?: string[];
  omitSignatureApprovers?: string[];
}

const defaultFormValues: ConfigSetFormValues = {
  name: '',
  hasApproval: false,
  hasDisputes: false,
  signatureRequired: false,
  omitSignatureAllowed: false,
  approvalRule: 'NONE',
  approvalMinCount: 0,
  approvers: [],
  questionApprovers: [],
  subjects: [],
  omitSignatureApprovers: [],
};

interface AddEditConfigSetFormProps {
  mode: 'add' | 'edit';
  configSet?: ConfigSet | null;
  onSuccess?: () => void;
}

const AddEditConfigSetForm: React.FC<AddEditConfigSetFormProps> = ({
  mode,
  configSet,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const [form] = Form.useForm<ConfigSetFormValues>();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { token } = theme.useToken();
  const headerPadding = isMobile ? token.paddingMD : token.paddingLG;
  const buttonSize = isMobile ? 'small' : 'middle';
  const pageMarginTop = isMobile ? token.marginMD : token.marginLG;

  const [createConfigSet, { isLoading: creating }] = useCreateConfigSetMutation();
  const [updateConfigSet, { isLoading: updating }] = useUpdateConfigSetMutation();

  const { data: subjectsRes } = useGetSubjectsQuery();
  const { data: approversRes } = useGetApproversQuery();
  const { data: omitSignatureApproversRes } = useGetOmitSignatureApproversQuery();

  const subjects = subjectsRes?.data || [];
  const approvers = approversRes?.data || [];
  const omitSignatureApprovers = omitSignatureApproversRes?.data || [];

  const subjectsOptions = useMemo(
    () =>
      subjects.map((p) => ({
        label: (p.user as User)?.name ?? p._id,
        value: p._id,
      })),
    [subjects]
  );
  const approversOptions = useMemo(
    () =>
      approvers.map((p) => ({
        label: (p.user as User)?.name ?? p._id,
        value: p._id,
      })),
    [approvers]
  );
  const omitSignatureApproversOptions = useMemo(
    () =>
      omitSignatureApprovers.map((p) => ({
        label: (p.user as User)?.name ?? p._id,
        value: p._id,
      })),
    [omitSignatureApprovers]
  );

  useEffect(() => {
    if (mode === 'edit' && configSet) {
      form.setFieldsValue({
        name: configSet.name,
        hasApproval: configSet.hasApproval ?? false,
        hasDisputes: configSet.hasDisputes ?? false,
        signatureRequired: configSet.signatureRequired ?? false,
        omitSignatureAllowed: configSet.omitSignatureAllowed ?? false,
        approvalRule: (configSet.approvalRule as ConfigSetApprovalRule) ?? 'NONE',
        approvalMinCount: configSet.approvalMinCount ?? 0,
        approvers: getConfigSetProfileIds(configSet.approvers),
        questionApprovers: getConfigSetProfileIds(configSet.questionApprovers),
        subjects: getConfigSetProfileIds(configSet.subjects),
        omitSignatureApprovers: getConfigSetProfileIds(configSet.omitSignatureApprovers),
      });
    } else if (mode === 'add') {
      form.setFieldsValue(defaultFormValues);
    }
  }, [mode, configSet, form]);

  const hasApproval = Form.useWatch('hasApproval', form);
  const hasDisputes = Form.useWatch('hasDisputes', form);
  const signatureRequired = Form.useWatch('signatureRequired', form);
  const omitSignatureAllowed = Form.useWatch('omitSignatureAllowed', form);
  const approvalRule = Form.useWatch('approvalRule', form);
  const approversWatch = Form.useWatch('approvers', form);

  const onFinish = async (values: ConfigSetFormValues) => {
    const body: CreateConfigSetBody = {
      name: values.name?.trim() ?? '',
      hasApproval: values.hasApproval,
      hasDisputes: values.hasDisputes,
      signatureRequired: values.signatureRequired,
      omitSignatureAllowed: values.omitSignatureAllowed,
      approvalRule: values.approvalRule ?? 'NONE',
      approvalMinCount: values.approvalMinCount ?? 0,
      approvers: values.approvers ?? [],
      questionApprovers: values.questionApprovers ?? [],
      subjects: values.subjects ?? [],
      omitSignatureApprovers: values.omitSignatureApprovers ?? [],
    };

    try {
      if (mode === 'edit' && configSet?._id) {
        await updateConfigSet({ id: configSet._id, body: body as UpdateConfigSetBody }).unwrap();
        message.success('Quick Setting updated');
      } else {
        await createConfigSet(body).unwrap();
        message.success('Quick Setting created');
      }
      onSuccess?.() ?? navigate(PATH_FORMS.configSets);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'data' in err) {
        const d = (err as { data?: { message?: string } }).data;
        message.error(d?.message ?? 'Request failed');
      } else {
        message.error('Request failed');
      }
    }
  };

  const loading = creating || updating;

  return (
    <div
      style={{
        backgroundColor: token.colorBgLayout,
        padding: `0 ${isMobile ? token.paddingSM : token.paddingLG} ${isMobile ? 32 : 48}px`,
      }}
    >
      <Affix offsetTop={isMobile ? 56 : 65}>
        <div
          style={{
            background: token.colorBgContainer,
            boxShadow: token.boxShadowTertiary,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            padding: headerPadding,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 100,
            borderRadius: isMobile ? token.borderRadius : 16,
          }}
        >
          <Title
            level={isMobile ? 5 : 4}
            style={{ margin: 0, display: 'flex', gap: 8, fontSize: isMobile ? 16 : undefined }}
          >
            <FormOutlined style={{ color: token.colorPrimary }} />
            {mode === 'add' ? 'Add Quick Setting' : 'Edit Quick Setting'}
          </Title>

          <Space size={isMobile ? 'small' : 'middle'}>
            <Tooltip title={mode === 'add' ? 'Create Quick Setting' : 'Update Quick Setting'}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size={buttonSize}
                loading={loading}
                onClick={() => form.submit()}
              >
                {mode === 'add' ? 'Create' : 'Update'}
              </Button>
            </Tooltip>
            <Button size={buttonSize} onClick={() => navigate(PATH_FORMS.configSets)}>
              Cancel
            </Button>
          </Space>
        </div>
      </Affix>

      <Form
        form={form}
        layout="vertical"
        initialValues={defaultFormValues}
        onFinish={onFinish}
        style={{ marginTop: pageMarginTop }}
      >
        {/* Name (only for standalone config set add/edit) */}
      <Form.Item
        name="name"
        label="Name"
        rules={[{ required: true, message: 'Name is required' }]}
        style={{ marginBottom: 0 }}
      >
        <Input placeholder="Quick set name" size="small" />
      </Form.Item>

      <Row gutter={[12, 12]}>
        {/* Row 1: Subjects */}
        <Col xs={24} sm={24} md={24} lg={24}>
          <Form.Item
            label="Subjects"
            name="subjects"
            tooltip="Select subjects for this config set"
            style={{ marginBottom: 0 }}
          >
            <Select
              mode="multiple"
              placeholder="Select subjects"
              options={subjectsOptions}
              size="small"
              maxTagCount="responsive"
            />
          </Form.Item>
        </Col>

        {/* Row 2: Approval Required | Approver(s) */}
        <Col xs={24} sm={24} md={8} lg={8} xl={6}>
          <Form.Item
            label="Approval Required"
            name="hasApproval"
            valuePropName="checked"
            tooltip="If enabled, submission first goes to Approvals chat channel"
            style={{ marginBottom: 0 }}
          >
            <Switch disabled={hasDisputes === true} />
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
              disabled={!hasApproval && !hasDisputes}
              size="small"
              maxTagCount="responsive"
            />
          </Form.Item>
        </Col>

        {/* Row 2b: Question Approvers */}
        <Col xs={24} sm={24} md={24} lg={24}>
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
              disabled={!hasApproval && !hasDisputes}
              size="small"
              maxTagCount="responsive"
            />
          </Form.Item>
        </Col>

        {/* Row 3: Approval Rule | Minimum approvals */}
        <Col xs={24} sm={12} md={12} lg={12}>
          <Form.Item
            label="Approval Rule"
            name="approvalRule"
            tooltip="ALL, ANY, or MIN (minimum any)"
            style={{ marginBottom: 0 }}
          >
            <Select
              placeholder="Select rule"
              disabled={!hasApproval && !hasDisputes}
              size="small"
              options={APPROVAL_RULES}
            />
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
                  const rule = getFieldValue('approvalRule');
                  const approversList = getFieldValue('approvers') ?? [];
                  const required = rule === 'MIN';
                  if (!required) return Promise.resolve();

                  if (typeof value !== 'number' || value < 1) {
                    return Promise.reject(new Error('Enter a number ≥ 1'));
                  }

                  const approversCount = Array.isArray(approversList) ? approversList.length : 0;
                  if (approversCount > 0 && value > approversCount) {
                    return Promise.reject(
                      new Error(
                        `Cannot exceed ${approversCount} approver${approversCount > 1 ? 's' : ''} selected`
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
              disabled={(!hasApproval && !hasDisputes) || approvalRule !== 'MIN'}
              size="small"
            />
          </Form.Item>
        </Col>

        {/* Divider before disputes section */}
        <Col xs={24}>
          <Divider style={{ margin: '12px 0' }} />
        </Col>

        {/* Row 4: Dispute Enabled | Signature Required | Omit Signature Allowed */}
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
            <Switch disabled={hasDisputes !== true} />
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
            <Switch disabled={!signatureRequired || hasDisputes !== true} />
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
              disabled={!omitSignatureAllowed || !signatureRequired || hasDisputes !== true}
              size="small"
              maxTagCount="responsive"
            />
          </Form.Item>
        </Col>
      </Row>
      </Form>
    </div>
  );
};

export default AddEditConfigSetForm;
