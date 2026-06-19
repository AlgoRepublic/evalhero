import { useState, useRef } from 'react';
import { Input, Button, Space, theme, Grid } from 'antd';
import type { InputRef } from 'antd';
import {
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  // ClockCircleOutlined,
} from '@ant-design/icons';

const { useBreakpoint } = Grid;

interface MessageInputProps {
  onSend: (content: string, attachments?: File[]) => void;
  onApprove?: (comment?: string) => void;
  onReject?: (comment: string) => void;
  onRequestApproval?: (comment?: string) => void;
  isApprover?: boolean;
  sending?: boolean;
  approving?: boolean;
  rejecting?: boolean;
  requesting?: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  placeholder?: string;
  selectedQuestionApprovalStatus?: 'pending' | 'requested' | 'approved' | 'rejected';
}

export const MessageInput = ({ 
  onSend, 
  onApprove, 
  onReject,
  // onRequestApproval,
  isApprover = false,
  sending = false,
  approving = false,
  rejecting = false,
  requesting = false,
  approvalStatus,
  selectedQuestionApprovalStatus,
  placeholder = 'Type a message...',
}: MessageInputProps) => {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isMd = screens.md || screens.lg || screens.xl || screens.xxl;
  const [message, setMessage] = useState('');
  const inputRef = useRef<InputRef>(null);

  const handleSend = () => {
    if (message.trim()) {
      onSend(message);
      setMessage('');
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const handleApprove = () => {
    if (onApprove) {
      onApprove(message.trim() || undefined);
      setMessage('');
    }
  };

  const handleReject = () => {
    if (onReject) {
      if (!message.trim()) {
        // Show warning if no rejection reason provided
        return;
      }
      onReject(message.trim());
      setMessage('');
    }
  };

  // const handleRequestApprovalClick = () => {
  //   if (onRequestApproval) {
  //     onRequestApproval(message.trim() || undefined);
  //     setMessage('');
  //   }
  // };

  // console.log("isApprover", isApprover)

  return (
    <div>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          ref={inputRef}
          placeholder={isApprover ? "Type a message or rejection reason..." : placeholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={sending || approving || rejecting || requesting}
          size={isMd ? 'middle' : 'small'}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={sending}
          disabled={!message.trim() || sending || approving || rejecting || requesting}
          size={isMd ? 'middle' : 'small'}
        >
          {isMd ? 'Send' : ''}
        </Button>
      </Space.Compact>

      {/* Request Approval Button - Show for non-approvers */}
      {/* {!isApprover && onRequestApproval && (
        <div style={{ marginTop: '12px' }}>
          <Button
            type="default"
            icon={<ClockCircleOutlined />}
            onClick={handleRequestApprovalClick}
            loading={requesting}
            block
            size={isMd ? 'middle' : 'small'}
            style={{
              borderColor: token.colorWarning,
              color: token.colorWarning,
            }}
          >
            {approvalStatus === 'rejected' ? 'Re-request Approval' : 'Request Approval'}
            {message.trim() && isMd && (
              <span style={{ marginLeft: 4, fontSize: 12, opacity: 0.8 }}>
                (with comment)
              </span>
            )}
          </Button>
        </div>
      )} */}

      {/* Approver Action Buttons - Show based on selectedQuestionApprovalStatus or approvalStatus */}
      {isApprover && (onApprove || onReject) && (
        <div style={{ marginTop: '12px' }}>
          <Space wrap style={{ width: '100%' }}>
            {/* Show Approve button when selectedQuestionApprovalStatus is 'requested' or 'rejected' */}
            {onApprove && selectedQuestionApprovalStatus && (selectedQuestionApprovalStatus === 'requested' || selectedQuestionApprovalStatus === 'rejected') && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleApprove}
                loading={approving}
                disabled={sending || rejecting}
                size={isMd ? 'middle' : 'small'}
                style={{ 
                  background: token.colorSuccess, 
                  borderColor: token.colorSuccess,
                  flex: isMd ? 'none' : 1,
                }}
              >
                Approve
              </Button>
            )}
            {/* Show Reject button when selectedQuestionApprovalStatus is 'requested' */}
            {onReject && selectedQuestionApprovalStatus && selectedQuestionApprovalStatus === 'requested' && (
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={handleReject}
                loading={rejecting}
                disabled={!message.trim() || sending || approving}
                size={isMd ? 'middle' : 'small'}
                style={{ flex: isMd ? 'none' : 1 }}
              >
                {isMd ? 'Reject with Message' : 'Reject'}
              </Button>
            )}
            {/* Fallback: Show buttons based on approvalStatus if selectedQuestionApprovalStatus is not provided */}
            {!selectedQuestionApprovalStatus && approvalStatus !== 'approved' && approvalStatus !== 'rejected' && (
              <>
                {onApprove && (
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={handleApprove}
                    loading={approving}
                    disabled={sending || rejecting}
                    size={isMd ? 'middle' : 'small'}
                    style={{ 
                      background: token.colorSuccess, 
                      borderColor: token.colorSuccess,
                      flex: isMd ? 'none' : 1,
                    }}
                  >
                    Approve
                  </Button>
                )}
                {onReject && (
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={handleReject}
                    loading={rejecting}
                    disabled={!message.trim() || sending || approving}
                    size={isMd ? 'middle' : 'small'}
                    style={{ flex: isMd ? 'none' : 1 }}
                  >
                    {isMd ? 'Reject with Message' : 'Reject'}
                  </Button>
                )}
              </>
            )}
          </Space>
        </div>
      )}
    </div>
  );
};

