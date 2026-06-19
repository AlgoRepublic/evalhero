import React from 'react';
import { Button, Flex, Space, Typography, Input, theme } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;
const { TextArea } = Input;

interface ActionInputsProps {
  // Approval inputs
  showApprovalInput: boolean;
  approvalMessage: string;
  onApprovalMessageChange: (value: string) => void;
  onApprovalClose: () => void;
  onApprovalSend: () => void;
  
  // Reject inputs
  showRejectInput: boolean;
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
  onRejectClose: () => void;
  onRejectSend: () => void;
  
  // Dispute inputs
  showDisputeInput: boolean;
  disputeReason: string;
  onDisputeReasonChange: (value: string) => void;
  onDisputeClose: () => void;
  onDisputeSend: () => void;
  
  // Omit Signature Request inputs
  showOmitSignatureRequestInput: boolean;
  omitSignatureRequestReason: string;
  onOmitSignatureRequestReasonChange: (value: string) => void;
  onOmitSignatureRequestClose: () => void;
  onOmitSignatureRequestSend: () => void;
  
  // Omit Signature Approve inputs
  showOmitSignatureApproveInput: boolean;
  omitSignatureApproveReason: string;
  onOmitSignatureApproveReasonChange: (value: string) => void;
  onOmitSignatureApproveClose: () => void;
  onOmitSignatureApproveSend: () => void;
  
  // Omit Signature Reject inputs
  showOmitSignatureRejectInput: boolean;
  omitSignatureRejectReason: string;
  onOmitSignatureRejectReasonChange: (value: string) => void;
  onOmitSignatureRejectClose: () => void;
  onOmitSignatureRejectSend: () => void;
  
  // Common props
  hasApproval: boolean;
  hasDisputes: boolean;
  isSending: boolean;
  isDark: boolean;
  token: ReturnType<typeof theme.useToken>['token'];
  isApprover: boolean;
  isAssignee: boolean;
  isSubject: boolean;
  isOmitSignatureApprover: boolean
}

export const ActionInputs: React.FC<ActionInputsProps> = ({
  showApprovalInput,
  approvalMessage,
  onApprovalMessageChange,
  onApprovalClose,
  onApprovalSend,
  showRejectInput,
  rejectReason,
  onRejectReasonChange,
  onRejectClose,
  onRejectSend,
  showDisputeInput,
  disputeReason,
  onDisputeReasonChange,
  onDisputeClose,
  onDisputeSend,
  showOmitSignatureRequestInput,
  omitSignatureRequestReason,
  onOmitSignatureRequestReasonChange,
  onOmitSignatureRequestClose,
  onOmitSignatureRequestSend,
  showOmitSignatureApproveInput,
  omitSignatureApproveReason,
  onOmitSignatureApproveReasonChange,
  onOmitSignatureApproveClose,
  onOmitSignatureApproveSend,
  showOmitSignatureRejectInput,
  omitSignatureRejectReason,
  onOmitSignatureRejectReasonChange,
  onOmitSignatureRejectClose,
  onOmitSignatureRejectSend,
  hasApproval,
  hasDisputes,
  isSending,
  isDark,
  token,
  // isApprover,
  // isAssignee,
  // isSubject,
  // isOmitSignatureApprover
}) => {
  return (
    <>
      {/* Approval Input */}
      {showApprovalInput && hasApproval && (
        <div
          style={{
            marginBottom: 6,
            padding: isDark ? '10px 12px' : '12px 14px',
            background: isDark ? token.colorFillTertiary : token.colorFillAlter,
            borderRadius: 6,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Flex align="center" justify="space-between">
              <Text strong style={{ fontSize: 12, color: token.colorText }}>
                Approve Submission
              </Text>
              <Button
                type="text"
                size="small"
                onClick={onApprovalClose}
                style={{ height: 20, padding: '0 4px', fontSize: 16 }}
              >
                ×
              </Button>
            </Flex>
            
            <TextArea
              rows={3}
              placeholder="Enter approval message (optional)..."
              value={approvalMessage}
              onChange={(e) => onApprovalMessageChange(e.target.value)}
              style={{
                borderRadius: 6,
                fontSize: 13,
              }}
            />
            
            <Flex align="center" justify="flex-end" gap={6}>
              <Button
                size="small"
                onClick={onApprovalClose}
              >
                Cancel
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={onApprovalSend}
                loading={isSending}
                disabled={isSending}
              >
                Approve
              </Button>
            </Flex>
          </Space>
        </div>
      )}

      {/* Reject Input */}
      {showRejectInput && hasApproval && (
        <div
          style={{
            marginBottom: 6,
            padding: isDark ? '10px 12px' : '12px 14px',
            background: isDark ? token.colorFillTertiary : token.colorFillAlter,
            borderRadius: 6,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Flex align="center" justify="space-between">
              <Text strong style={{ fontSize: 12, color: token.colorText }}>
                Reject Submission
              </Text>
              <Button
                type="text"
                size="small"
                onClick={onRejectClose}
                style={{ height: 20, padding: '0 4px', fontSize: 16 }}
              >
                ×
              </Button>
            </Flex>
            
            <TextArea
              rows={3}
              placeholder="Enter rejection reason (required)..."
              value={rejectReason}
              onChange={(e) => onRejectReasonChange(e.target.value)}
              style={{
                borderRadius: 6,
                fontSize: 13,
              }}
            />
            
            <Flex align="center" justify="flex-end" gap={6}>
              <Button
                size="small"
                onClick={onRejectClose}
              >
                Cancel
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<CloseCircleOutlined />}
                onClick={onRejectSend}
                loading={isSending}
                disabled={isSending || !rejectReason.trim()}
              >
                Reject
              </Button>
            </Flex>
          </Space>
        </div>
      )}

      {/* Dispute Input */}
      {showDisputeInput && hasDisputes && (
        <div
          style={{
            marginBottom: 6,
            padding: isDark ? '10px 12px' : '12px 14px',
            background: isDark ? token.colorFillTertiary : token.colorFillAlter,
            borderRadius: 6,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Flex align="center" justify="space-between">
              <Text strong style={{ fontSize: 12, color: token.colorText }}>
                Add Dispute Reason
              </Text>
              <Button
                type="text"
                size="small"
                onClick={onDisputeClose}
                style={{ height: 20, padding: '0 4px', fontSize: 16 }}
              >
                ×
              </Button>
            </Flex>
            
            <TextArea
              rows={3}
              placeholder="Enter your dispute reason..."
              value={disputeReason}
              onChange={(e) => onDisputeReasonChange(e.target.value)}
              style={{
                borderRadius: 6,
                fontSize: 13,
              }}
            />
            
            <Flex align="center" justify="flex-end" gap={6}>
              <Button
                size="small"
                onClick={onDisputeClose}
              >
                Cancel
              </Button>
              <Button
                size="small"
                type="primary"
                onClick={onDisputeSend}
                loading={isSending}
                disabled={isSending || !disputeReason.trim()}
              >
                Send Dispute
              </Button>
            </Flex>
          </Space>
        </div>
      )}

      {/* Omit Signature Request Input */}
      {showOmitSignatureRequestInput && hasDisputes && (
        <div
          style={{
            marginBottom: 6,
            padding: isDark ? '10px 12px' : '12px 14px',
            background: isDark ? token.colorFillTertiary : token.colorFillAlter,
            borderRadius: 6,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Flex align="center" justify="space-between">
              <Text strong style={{ fontSize: 12, color: token.colorText }}>
                Omit Signature Request
              </Text>
              <Button
                type="text"
                size="small"
                onClick={onOmitSignatureRequestClose}
                style={{ height: 20, padding: '0 4px', fontSize: 16 }}
              >
                ×
              </Button>
            </Flex>
            
            <TextArea
              rows={3}
              placeholder="Enter reason for omitting signature request..."
              value={omitSignatureRequestReason}
              onChange={(e) => onOmitSignatureRequestReasonChange(e.target.value)}
              style={{
                borderRadius: 6,
                fontSize: 13,
              }}
            />
            
            <Flex align="center" justify="flex-end" gap={6}>
              <Button
                size="small"
                onClick={onOmitSignatureRequestClose}
              >
                Cancel
              </Button>
              <Button
                size="small"
                type="primary"
                onClick={onOmitSignatureRequestSend}
                loading={isSending}
                disabled={isSending || !omitSignatureRequestReason.trim()}
              >
                Send Request
              </Button>
            </Flex>
          </Space>
        </div>
      )}

      {/* Omit Signature Approve Input */}
      {showOmitSignatureApproveInput && hasDisputes && (
        <div
          style={{
            marginBottom: 6,
            padding: isDark ? '10px 12px' : '12px 14px',
            background: isDark ? token.colorFillTertiary : token.colorFillAlter,
            borderRadius: 6,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Flex align="center" justify="space-between">
              <Text strong style={{ fontSize: 12, color: token.colorText }}>
                Approve Omit Signature Request
              </Text>
              <Button
                type="text"
                size="small"
                onClick={onOmitSignatureApproveClose}
                style={{ height: 20, padding: '0 4px', fontSize: 16 }}
              >
                ×
              </Button>
            </Flex>
            
            <TextArea
              rows={3}
              placeholder="Enter reason for approving omit signature request..."
              value={omitSignatureApproveReason}
              onChange={(e) => onOmitSignatureApproveReasonChange(e.target.value)}
              style={{
                borderRadius: 6,
                fontSize: 13,
              }}
            />
            
            <Flex align="center" justify="flex-end" gap={6}>
              <Button
                size="small"
                onClick={onOmitSignatureApproveClose}
              >
                Cancel
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={onOmitSignatureApproveSend}
                loading={isSending}
                disabled={isSending || !omitSignatureApproveReason.trim()}
              >
                Approve
              </Button>
            </Flex>
          </Space>
        </div>
      )}

      {/* Omit Signature Reject Input */}
      {showOmitSignatureRejectInput && hasDisputes && (
        <div
          style={{
            marginBottom: 6,
            padding: isDark ? '10px 12px' : '12px 14px',
            background: isDark ? token.colorFillTertiary : token.colorFillAlter,
            borderRadius: 6,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Flex align="center" justify="space-between">
              <Text strong style={{ fontSize: 12, color: token.colorText }}>
                Reject Omit Signature Request
              </Text>
              <Button
                type="text"
                size="small"
                onClick={onOmitSignatureRejectClose}
                style={{ height: 20, padding: '0 4px', fontSize: 16 }}
              >
                ×
              </Button>
            </Flex>
            
            <TextArea
              rows={3}
              placeholder="Enter reason for rejecting omit signature request..."
              value={omitSignatureRejectReason}
              onChange={(e) => onOmitSignatureRejectReasonChange(e.target.value)}
              style={{
                borderRadius: 6,
                fontSize: 13,
              }}
            />
            
            <Flex align="center" justify="flex-end" gap={6}>
              <Button
                size="small"
                onClick={onOmitSignatureRejectClose}
              >
                Cancel
              </Button>
              <Button
                size="small"
                type="primary"
                danger
                icon={<CloseCircleOutlined />}
                onClick={onOmitSignatureRejectSend}
                loading={isSending}
                disabled={isSending || !omitSignatureRejectReason.trim()}
              >
                Reject
              </Button>
            </Flex>
          </Space>
        </div>
      )}
    </>
  );
};

