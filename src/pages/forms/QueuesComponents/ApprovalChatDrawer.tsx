/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect } from 'react';
import {
  Drawer,
  Button,
  Typography,
  Input,
  Space,
  message,
  theme,
  Tag,
  Divider,
  Spin,
  Empty,
} from 'antd';
import {
  MessageOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import {
  useGetUnifiedChatMessagesQuery,
  useQuestionApprovalChatMutation,
  useApprovalChatMutation,
  // useDisputeChatMutation,
  UnifiedChatMessage,
} from '../../../services/queueApi';
import { ChatMessage } from './types';

const { Text } = Typography;
const { TextArea } = Input;

export interface ApprovalChatDrawerProps {
  open: boolean;
  onClose: () => void;
  assignmentId: string;
  submissionId: string;
  currentUserId: string;
  currentUserName: string;
  questionName?: string; // Filter to specific question
  questionNumber?: number;
  formName?: string;
  mode?: 'all' | 'question' | 'approval' | 'dispute';
}

export const ApprovalChatDrawer: React.FC<ApprovalChatDrawerProps> = ({
  open,
  onClose,
  assignmentId,
  submissionId,
  currentUserId,
  // currentUserName,
  questionName,
  questionNumber,
  formName,
  mode = 'all',
}) => {
  const { token } = theme.useToken();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [showApprovalInput, setShowApprovalInput] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showQuestionApprovalInput, setShowQuestionApprovalInput] = useState(false);
  const [questionApprovalMessage, setQuestionApprovalMessage] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);

  // API hooks
  const {
    data: unifiedChatData,
    isLoading: isLoadingMessages,
    isFetching: isFetchingMessages,
  } = useGetUnifiedChatMessagesQuery(
    {
      assignmentId,
      submissionId: submissionId || '',
      questionName: questionName || undefined,
    },
    {
      skip: !open || !assignmentId || !submissionId,
      pollingInterval: open && submissionId ? 10000 : 0,
      refetchOnMountOrArgChange: true,
    }
  );

  const [questionApprovalChat] = useQuestionApprovalChatMutation();
  const [approvalChat] = useApprovalChatMutation();
  // const [disputeChat] = useDisputeChatMutation();

  // Convert unified chat messages to ChatMessage format
  useEffect(() => {
    if (unifiedChatData?.data?.messages) {
      const formattedMessages: ChatMessage[] = unifiedChatData.data.messages
        .filter((msg: UnifiedChatMessage) => {
          // Filter by mode
          if (mode === 'question' && msg.type !== 'question-approval') return false;
          if (mode === 'approval' && msg.type !== 'approval') return false;
          if (mode === 'dispute' && msg.type !== 'dispute') return false;
          // Filter by question if specified
          if (questionName && msg.questionName !== questionName) return false;
          return true;
        })
        .map((msg: UnifiedChatMessage) => {
          const senderId = msg.sentBy?.user?._id || msg.sentBy?._id || '';
          const senderName = msg.sentBy?.user?.name || msg.sentBy?.user?.email || 'Unknown User';
          const timestamp = msg.createdAt || msg.updatedAt || msg.timestamp || new Date().toISOString();

          let actionType: 'approval' | 'dispute' | 'signature' | 'question-approval-request' | 'question-approval-approved' | 'question-approval-rejected' | undefined;
          let approvalStatus: 'approved' | 'rejected' | undefined;
          let text = '';

          if (msg.type === 'question-approval') {
            if (msg.action === 'request') {
              actionType = 'question-approval-request';
              text = msg.actionData?.comment || `Requesting approval for Question ${msg.questionNumber || ''}`;
            } else if (msg.action === 'approve') {
              actionType = 'question-approval-approved';
              approvalStatus = 'approved';
              text = msg.actionData?.comment || '';
            } else if (msg.action === 'reject') {
              actionType = 'question-approval-rejected';
              approvalStatus = 'rejected';
              text = msg.actionData?.comment || '';
            } else {
              text = msg.actionData?.text || msg.text || '';
            }
          } else if (msg.type === 'approval') {
            if (msg.action === 'approval:approve' || msg.action === 'approve') {
              actionType = 'approval';
              approvalStatus = 'approved';
              text = msg.actionData?.comment || '';
            } else if (msg.action === 'approval:reject' || msg.action === 'reject') {
              actionType = 'approval';
              approvalStatus = 'rejected';
              text = msg.actionData?.comment || '';
            } else {
              text = msg.actionData?.text || msg.text || '';
            }
          } else if (msg.type === 'dispute') {
            actionType = 'dispute';
            text = msg.actionData?.comment || msg.actionData?.text || msg.text || '';
          }

          return {
            id: msg._id || Date.now().toString(),
            text,
            senderId,
            senderName,
            timestamp: new Date(timestamp),
            attachments: [],
            actionType,
            approvalStatus,
            meta: (msg as any).meta, // Preserve meta/questionData for answer display
            questionContext: msg.questionName ? {
              questionId: msg.questionId || '',
              questionName: msg.questionName || '',
              questionType: msg.questionType || '',
            } : undefined,
          };
        })
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      setMessages(formattedMessages);
    } else if (!isLoadingMessages && !isFetchingMessages) {
      setMessages([]);
    }
  }, [unifiedChatData, isLoadingMessages, isFetchingMessages, mode, questionName]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current && chatContainerRef.current) {
      const container = chatContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages.length]);

  // Focus input when drawer opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const handleSendMessage = async () => {
    if (isSendingMessage || !inputValue.trim() || !submissionId) {
      if (!submissionId) {
        message.warning('Please start submission first');
      }
      return;
    }

    const messageText = inputValue.trim();
    setInputValue('');
    setIsSendingMessage(true);

    try {
      // For question-specific chat, use question approval chat
      if (questionName && questionNumber) {
        await questionApprovalChat({
          assignmentId,
          submissionId,
          questionName,
          questionNumber,
          action: 'request',
          comment: messageText,
        }).unwrap();
      } else {
        // Use regular approval chat
        await approvalChat({
          assignmentId,
          submissionId,
          action: 'message',
          text: messageText,
        }).unwrap();
      }
      message.success('Message sent');
    } catch (error: any) {
      message.error(error?.data?.message || 'Failed to send message');
      setInputValue(messageText);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleApproveQuestion = async () => {
    if (!questionName || !questionNumber || !submissionId) {
      message.error('Question information or submission ID missing');
      return;
    }

    setIsSendingMessage(true);
    try {
      await questionApprovalChat({
        assignmentId,
        submissionId,
        questionName,
        questionNumber,
        action: 'approve',
        comment: questionApprovalMessage.trim() || undefined,
      }).unwrap();
      message.success('Question approved');
      setQuestionApprovalMessage('');
      setShowQuestionApprovalInput(false);
    } catch (error: any) {
      message.error(error?.data?.message || 'Failed to approve question');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleRejectQuestion = async () => {
    if (!questionName || !questionNumber || !submissionId) {
      message.error('Question information or submission ID missing');
      return;
    }

    if (!rejectReason.trim()) {
      message.warning('Please enter a rejection reason');
      return;
    }

    setIsSendingMessage(true);
    try {
      await questionApprovalChat({
        assignmentId,
        submissionId,
        questionName,
        questionNumber,
        action: 'reject',
        comment: rejectReason.trim(),
      }).unwrap();
      message.success('Question rejected');
      setRejectReason('');
      setShowRejectInput(false);
    } catch (error: any) {
      message.error(error?.data?.message || 'Failed to reject question');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleApproveForm = async () => {
    if (!submissionId) {
      message.warning('Submission ID missing');
      return;
    }

    setIsSendingMessage(true);
    try {
      await approvalChat({
        assignmentId,
        submissionId,
        action: 'approve',
        comment: approvalMessage.trim() || undefined,
      }).unwrap();
      message.success('Form approved');
      setApprovalMessage('');
      setShowApprovalInput(false);
    } catch (error: any) {
      message.error(error?.data?.message || 'Failed to approve form');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleRejectForm = async () => {
    if (!submissionId) {
      message.warning('Submission ID missing');
      return;
    }

    if (!rejectReason.trim()) {
      message.warning('Please enter a rejection reason');
      return;
    }

    setIsSendingMessage(true);
    try {
      await approvalChat({
        assignmentId,
        submissionId,
        action: 'reject',
        comment: rejectReason.trim(),
      }).unwrap();
      message.success('Form rejected');
      setRejectReason('');
      setShowRejectInput(false);
    } catch (error: any) {
      message.error(error?.data?.message || 'Failed to reject form');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const getDrawerTitle = () => {
    if (questionName && questionNumber) {
      return `Question ${questionNumber} Approval`;
    }
    if (mode === 'approval') return 'Approval Chat';
    if (mode === 'dispute') return 'Dispute Chat';
    return 'Chat';
  };

  const canApprove = () => {
    // Check if current user can approve (this would need to be passed as prop or checked via API)
    return true; // Simplified for now
  };

  return (
    <Drawer
      title={
        <Space>
          <MessageOutlined />
          <Text strong>{getDrawerTitle()}</Text>
          {questionName && questionNumber && (
            <Tag color="blue">Question {questionNumber}</Tag>
          )}
        </Space>
      }
      placement="right"
      onClose={onClose}
      open={open}
      width={500}
      styles={{
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        },
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: token.colorBgContainer,
        }}
      >
        {/* Question Context */}
        {questionName && questionNumber && (
          <div
            style={{
              padding: 12,
              background: token.colorFillAlter,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Space>
              <QuestionCircleOutlined />
              <Text type="secondary">
                {formName && `${formName} - `}Question {questionNumber}
              </Text>
            </Space>
          </div>
        )}

        {/* Messages List */}
        <div
          ref={chatContainerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {!submissionId ? (
            <Empty
              description="Please start submission to view chat messages"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ marginTop: 48 }}
            />
          ) : isLoadingMessages ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin tip="Loading messages..." />
            </div>
          ) : messages.length === 0 ? (
            <Empty
              description="No messages yet"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ marginTop: 48 }}
            />
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.senderId === currentUserId ? 'flex-end' : 'flex-start',
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    maxWidth: '75%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background:
                      msg.senderId === currentUserId
                        ? token.colorPrimary
                        : token.colorFillAlter,
                    color:
                      msg.senderId === currentUserId
                        ? '#fff'
                        : token.colorText,
                  }}
                >
                  {msg.actionType === 'approval' && (
                    <Space style={{ marginBottom: 4 }}>
                      {msg.approvalStatus === 'approved' ? (
                        <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                      ) : (
                        <CloseCircleOutlined style={{ color: token.colorError }} />
                      )}
                      <Text
                        strong
                        style={{
                          color:
                            msg.senderId === currentUserId
                              ? '#fff'
                              : token.colorText,
                          fontSize: 12,
                        }}
                      >
                        {msg.approvalStatus === 'approved' ? 'Approved' : 'Rejected'}
                      </Text>
                    </Space>
                  )}
                  <Text
                    style={{
                      color:
                        msg.senderId === currentUserId
                          ? '#fff'
                          : token.colorText,
                    }}
                  >
                    {msg.text}
                  </Text>
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.7,
                      marginTop: 4,
                      color:
                        msg.senderId === currentUserId
                          ? '#fff'
                          : token.colorTextSecondary,
                    }}
                  >
                    {msg.senderName} • {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <Divider style={{ margin: 0 }} />

        {/* Action Buttons (for approvers) */}
        {canApprove() && (
          <div style={{ padding: 12, background: token.colorFillAlter }}>
            {questionName && questionNumber ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                {!showQuestionApprovalInput && !showRejectInput && (
                  <Space>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => setShowQuestionApprovalInput(true)}
                      disabled={isSendingMessage}
                    >
                      Approve Question
                    </Button>
                    <Button
                      danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => setShowRejectInput(true)}
                      disabled={isSendingMessage}
                    >
                      Reject Question
                    </Button>
                  </Space>
                )}
                {showQuestionApprovalInput && (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <TextArea
                      placeholder="Optional comment..."
                      value={questionApprovalMessage}
                      onChange={(e) => setQuestionApprovalMessage(e.target.value)}
                      rows={2}
                    />
                    <Space>
                      <Button
                        type="primary"
                        onClick={handleApproveQuestion}
                        loading={isSendingMessage}
                      >
                        Confirm Approve
                      </Button>
                      <Button onClick={() => {
                        setShowQuestionApprovalInput(false);
                        setQuestionApprovalMessage('');
                      }}>
                        Cancel
                      </Button>
                    </Space>
                  </Space>
                )}
                {showRejectInput && (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <TextArea
                      placeholder="Rejection reason (required)..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      required
                    />
                    <Space>
                      <Button
                        danger
                        onClick={handleRejectQuestion}
                        loading={isSendingMessage}
                        disabled={!rejectReason.trim()}
                      >
                        Confirm Reject
                      </Button>
                      <Button onClick={() => {
                        setShowRejectInput(false);
                        setRejectReason('');
                      }}>
                        Cancel
                      </Button>
                    </Space>
                  </Space>
                )}
              </Space>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                {!showApprovalInput && !showRejectInput && (
                  <Space>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => setShowApprovalInput(true)}
                      disabled={isSendingMessage}
                    >
                      Approve Form
                    </Button>
                    <Button
                      danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => setShowRejectInput(true)}
                      disabled={isSendingMessage}
                    >
                      Reject Form
                    </Button>
                  </Space>
                )}
                {showApprovalInput && (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <TextArea
                      placeholder="Optional comment..."
                      value={approvalMessage}
                      onChange={(e) => setApprovalMessage(e.target.value)}
                      rows={2}
                    />
                    <Space>
                      <Button
                        type="primary"
                        onClick={handleApproveForm}
                        loading={isSendingMessage}
                      >
                        Confirm Approve
                      </Button>
                      <Button onClick={() => {
                        setShowApprovalInput(false);
                        setApprovalMessage('');
                      }}>
                        Cancel
                      </Button>
                    </Space>
                  </Space>
                )}
                {showRejectInput && (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <TextArea
                      placeholder="Rejection reason (required)..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      required
                    />
                    <Space>
                      <Button
                        danger
                        onClick={handleRejectForm}
                        loading={isSendingMessage}
                        disabled={!rejectReason.trim()}
                      >
                        Confirm Reject
                      </Button>
                      <Button onClick={() => {
                        setShowRejectInput(false);
                        setRejectReason('');
                      }}>
                        Cancel
                      </Button>
                    </Space>
                  </Space>
                )}
              </Space>
            )}
          </div>
        )}

        {/* Message Input */}
        {(!showApprovalInput && !showRejectInput && !showQuestionApprovalInput) && (
          <div style={{ padding: 12, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                ref={inputRef}
                placeholder="Type a message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isSendingMessage}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendMessage}
                loading={isSendingMessage}
                disabled={!inputValue.trim()}
              >
                Send
              </Button>
            </Space.Compact>
          </div>
        )}
      </div>
    </Drawer>
  );
};




