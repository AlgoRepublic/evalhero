import React, { useEffect, useRef } from 'react';
import { Form, Row, Col, Switch, Select, InputNumber, Divider, FormInstance } from 'antd';
// import { ConfigSet } from '../../../services/templatesAPI';

interface ConfigSetFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: FormInstance<any>;
  index: number;
  subjectsOptions: Array<{ label: string; value: string }>;
  approversOptions: Array<{ label: string; value: string }>;
  questionApproversOptions: Array<{ label: string; value: string }>;
  omitSignatureApproversOptions: Array<{ label: string; value: string }>;
  subjectsLoading: boolean;
  approversLoading: boolean;
  questionApproversLoading: boolean;
  omitSignatureApproversLoading: boolean;
}

const ConfigSetForm: React.FC<ConfigSetFormProps> = ({
  form,
  index,
  subjectsOptions,
  approversOptions,
  questionApproversOptions,
  omitSignatureApproversOptions,
  subjectsLoading,
  approversLoading,
  questionApproversLoading,
  omitSignatureApproversLoading,
}) => {
  const hasApprovalWatch = Form.useWatch(
    ['configSets', index, 'hasApproval'],
    form
  );
  const approvalRuleWatch = Form.useWatch(
    ['configSets', index, 'approvalRule'],
    form
  );
  const hasDisputesWatch = Form.useWatch(
    ['configSets', index, 'hasDisputes'],
    form
  );
  const approversWatch = Form.useWatch(
    ['configSets', index, 'approvers'],
    form
  );
  const approvalMinCountWatch = Form.useWatch(
    ['configSets', index, 'approvalMinCount'],
    form
  );
  const signatureRequiredWatch = Form.useWatch(
    ['configSets', index, 'signatureRequired'],
    form
  );
  const omitSignatureAllowedWatch = Form.useWatch(
    ['configSets', index, 'omitSignatureAllowed'],
    form
  );

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
      form.setFieldValue(['configSets', index, 'hasApproval'], true);
    }

    if (hasDisputesWatch === false) {
      form.setFieldValue(['configSets', index, 'signatureRequired'], false);
      form.setFieldValue(['configSets', index, 'omitSignatureAllowed'], false);
      form.setFieldValue(['configSets', index, 'omitSignatureApprovers'], []);
    }

    if (signatureRequiredWatch === false) {
      form.setFieldValue(['configSets', index, 'omitSignatureAllowed'], false);
      form.setFieldValue(['configSets', index, 'omitSignatureApprovers'], []);
    }

    if (omitSignatureAllowedWatch === false) {
      form.setFieldValue(['configSets', index, 'omitSignatureApprovers'], []);
    }

  }, [hasDisputesWatch, hasApprovalWatch, form, index, signatureRequiredWatch, omitSignatureAllowedWatch]);

  // Turn off Signature Required, Omit Signature Allowed, and clear Omit Signature Approvers when disputes are disabled
  useEffect(() => {
    if (!isInitializedRef.current) return;
    // When disputes is switched off, turn off signature required and related fields
    if (hasDisputesWatch === false) {
      form.setFieldValue(['configSets', index, 'signatureRequired'], false);
      form.setFieldValue(['configSets', index, 'omitSignatureAllowed'], false);
      form.setFieldValue(['configSets', index, 'omitSignatureApprovers'], []);
    }

  }, [hasDisputesWatch, form, index]);

  // Clear omitSignatureApprovers when signatureRequired or omitSignatureAllowed is unchecked
  // Only clear if explicitly false (not undefined, which happens during initialization)
  // And only after initialization is complete
  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (signatureRequiredWatch === false) {
      form.setFieldValue(['configSets', index, 'omitSignatureAllowed'], false);
      form.setFieldValue(['configSets', index, 'omitSignatureApprovers'], []);
    }
  }, [signatureRequiredWatch, form, index]);

  useEffect(() => {
    // Only clear if explicitly false (not undefined, which happens during initialization)
    // And only after initialization is complete
    if (!isInitializedRef.current) return;
    if (omitSignatureAllowedWatch === false) {
      form.setFieldValue(['configSets', index, 'omitSignatureApprovers'], []);
    }
  }, [omitSignatureAllowedWatch, form, index]);

  // Note: Omit Signature Approvers now shows all profiles, not just selected approvers
  // Removed the useEffect that filtered omitSignatureApprovers based on approvers

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
      form.setFieldValue(['configSets', index, 'approvalMinCount'], undefined);
    }

    // Update ref for next comparison
    prevApprovalRuleRef.current = currentRule;
  }, [approvalRuleWatch, form, index]);

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
        form.setFieldValue(
          ['configSets', index, 'approvalMinCount'],
          approversCount
        );
      } else if (approversCount === 0 && currentMinCount) {
        // If no approvers selected, clear minimum approvals
        form.setFieldValue(
          ['configSets', index, 'approvalMinCount'],
          undefined
        );
      }
    }
  }, [
    approversWatch,
    approvalRuleWatch,
    hasApprovalWatch,
    approvalMinCountWatch,
    form,
    index,
  ]);

  return (
    <Row gutter={[12, 12]}>
      {/* Row 1: Subjects (moved to top, right after name field) */}
      <Col xs={24} sm={24} md={24} lg={24}>
        <Form.Item
          label="Subjects"
          name={[index, 'subjects']}
          tooltip="Select subjects for this config set"
          style={{ marginBottom: 0 }}
        >
          <Select
            mode="multiple"
            placeholder="Select subjects"
            options={subjectsOptions}
            loading={subjectsLoading}
            size="small"
            maxTagCount="responsive"
          />
        </Form.Item>
      </Col>

      {/* Row 2: Approval Required | Approver(s) */}
      <Col xs={24} sm={24} md={8} lg={8} xl={6}>
        <Form.Item
          label="Approval Required"
          name={[index, 'hasApproval']}
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
          name={[index, 'approvers']}
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

      {/* Row 2b: Question Approvers (who can approve individual questions) */}
      <Col xs={24} sm={24} md={24} lg={24}>
        <Form.Item
          label="Question Approvers"
          name={[index, 'questionApprovers']}
          tooltip="Who can approve individual questions (optional; if empty, form approvers are used)"
          style={{ marginBottom: 0 }}
        >
          <Select
            mode="multiple"
            placeholder="Select question approvers (optional)"
            options={questionApproversOptions}
            loading={questionApproversLoading}
            disabled={!hasApprovalWatch && !hasDisputesWatch}
            size="small"
            maxTagCount="responsive"
          />
        </Form.Item>
      </Col>

      {/* Row 3: Approval Rule, Minimum approvals */}
      <Col xs={24} sm={12} md={12} lg={12}>
        <Form.Item
          label="Approval Rule"
          name={[index, 'approvalRule']}
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
          name={[index, 'approvalMinCount']}
          tooltip="Required when rule = Minimum. Cannot exceed number of approvers selected."
          style={{ marginBottom: 0 }}
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                const configSets = getFieldValue('configSets') || [];
                const currentSet = configSets[index];
                const required =
                  currentSet?.hasApproval && currentSet?.approvalRule === 'MIN';
                if (!required) return Promise.resolve();

                if (typeof value !== 'number' || value < 1) {
                  return Promise.reject(new Error('Enter a number ≥ 1'));
                }

                // Check if value exceeds number of approvers
                const approvers = currentSet?.approvers || [];
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
          name={[index, 'hasDisputes']}
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
          name={[index, 'signatureRequired']}
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
          name={[index, 'omitSignatureAllowed']}
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
          name={[index, 'omitSignatureApprovers']}
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
  );
};

export default ConfigSetForm;
