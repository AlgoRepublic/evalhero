import React from 'react';
import { Button, Flex, Space, Typography, theme } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface SuggestedActionsProps {
  hasApproval: boolean;
  hasDisputes: boolean;
  omitSignatureAllowed: boolean;
  signatureRequired: boolean;
  showApprovalInput: boolean;
  showRejectInput: boolean;
  showDisputeInput: boolean;
  showSignaturePad: boolean;
  showOmitSignatureRequestInput: boolean;
  showOmitSignatureApproveInput: boolean;
  showOmitSignatureRejectInput: boolean;
  onToggleApproval: () => void;
  onToggleReject: () => void;
  onToggleDispute: () => void;
  onToggleSignature: () => void;
  onToggleOmitSignatureRequest: () => void;
  onToggleOmitSignatureApprove: () => void;
  onToggleOmitSignatureReject: () => void;
  isDark: boolean;
  token: ReturnType<typeof theme.useToken>['token'];
  isApprover: boolean;
  isAssignee: boolean;
  isSubject: boolean;
  isOmitSignatureApprover: boolean;
  submissionStatus?: string;
  /** When set, assignee can request approval when status is 'pending'; approver can approve/reject when status is 'requested' */
  approvalStatus?: 'pending' | 'requested' | 'approved' | 'rejected';
  onRequestApproval?: () => void;
}

export const SuggestedActions: React.FC<SuggestedActionsProps> = ({
  hasApproval,
  hasDisputes,
  omitSignatureAllowed,
  signatureRequired,
  showApprovalInput,
  showRejectInput,
  showDisputeInput,
  showSignaturePad,
  showOmitSignatureRequestInput,
  showOmitSignatureApproveInput,
  showOmitSignatureRejectInput,
  onToggleApproval,
  onToggleReject,
  onToggleDispute,
  onToggleSignature,
  onToggleOmitSignatureRequest,
  onToggleOmitSignatureApprove,
  onToggleOmitSignatureReject,
  isDark,
  token,
  isApprover,
  isAssignee,
  isSubject,
  isOmitSignatureApprover,
  submissionStatus,
  approvalStatus,
  onRequestApproval,
}) => {
  const hasAnyAction = hasApproval || hasDisputes || signatureRequired;

  if (!hasAnyAction) return null;

  // Dispute-related actions (dispute, signature, omit signature) can only be shown 
  // when submission status is "approval_completed" or "dispute_in_progress"
  const canShowActions = submissionStatus === 'approval_completed' || submissionStatus === 'dispute_in_progress';

  // Assignee can request approval only when status is 'pending'
  const assigneeCanRequest = hasApproval && isAssignee && ['pending', 'rejected'].includes(approvalStatus ?? '') && onRequestApproval;
  // Approver can approve/reject only when status is 'requested'
  const approverCanAct = hasApproval && isApprover && approvalStatus === 'requested';

  return (
    <div
      style={{
        padding: isDark ? '8px 12px' : '10px 14px',
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: isDark ? token.colorFillTertiary : token.colorFillAlter,
      }}
    >
      <Flex align="center" gap={8} wrap>
        <Text
          type="secondary"
          style={{ fontSize: 10, opacity: 0.7, flexShrink: 0 }}
        >
          Suggested actions:
        </Text>
        <Space size={6} wrap>
          {assigneeCanRequest && (
            <Button
              size="small"
              icon={<SendOutlined />}
              onClick={onRequestApproval}
              style={{
                borderRadius: 16,
                height: 28,
                fontSize: 11,
                padding: '0 12px',
              }}
            >
              Request approval
            </Button>
          )}

          {approverCanAct && (
            <>
              <Button
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={onToggleApproval}
                style={{
                  borderRadius: 16,
                  height: 28,
                  fontSize: 11,
                  padding: '0 12px',
                }}
              >
                {showApprovalInput ? 'Hide' : 'Approve'}
              </Button>
              <Button
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={onToggleReject}
                style={{
                  borderRadius: 16,
                  height: 28,
                  fontSize: 11,
                  padding: '0 12px',
                }}
              >
                {showRejectInput ? 'Hide' : 'Reject'}
              </Button>
            </>
          )}

          {hasDisputes && canShowActions && isSubject && (
            <Button
              size="small"
              icon={<ExclamationCircleOutlined />}
              onClick={onToggleDispute}
              style={{
                borderRadius: 16,
                height: 28,
                fontSize: 11,
                padding: '0 12px',
              }}
            >
              {showDisputeInput ? 'Hide' : 'Dispute'}
            </Button>
          )}

          {omitSignatureAllowed && canShowActions && (
            <>
              {isAssignee && (
                <Button
                  size="small"
                  icon={<ExclamationCircleOutlined />}
                  onClick={onToggleOmitSignatureRequest}
                  style={{
                    borderRadius: 16,
                    height: 28,
                    fontSize: 11,
                    padding: '0 12px',
                  }}
                >
                  {showOmitSignatureRequestInput
                    ? 'Hide'
                    : 'Omit Signature Request'}
                </Button>
              )}
              {isOmitSignatureApprover && (
                <>
                  <Button
                    size="small"
                    icon={<CheckCircleOutlined />}
                    onClick={onToggleOmitSignatureApprove}
                    style={{
                      borderRadius: 16,
                      height: 28,
                      fontSize: 11,
                      padding: '0 12px',
                    }}
                  >
                    {showOmitSignatureApproveInput ? 'Hide' : 'Approve Omit'}
                  </Button>
                  <Button
                    size="small"
                    icon={<CloseCircleOutlined />}
                    onClick={onToggleOmitSignatureReject}
                    style={{
                      borderRadius: 16,
                      height: 28,
                      fontSize: 11,
                      padding: '0 12px',
                    }}
                  >
                    {showOmitSignatureRejectInput ? 'Hide' : 'Reject Omit'}
                  </Button>
                </>
              )}
            </>
          )}

          {signatureRequired && canShowActions && (isSubject || isOmitSignatureApprover) && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={onToggleSignature}
              style={{
                borderRadius: 16,
                height: 28,
                fontSize: 11,
                padding: '0 12px',
              }}
            >
              {showSignaturePad ? 'Hide' : 'Signature'}
            </Button>
          )}
        </Space>
      </Flex>
    </div>
  );
};
