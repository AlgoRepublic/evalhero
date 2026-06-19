/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect } from 'react';
import { Button, Typography, theme, message, Affix } from 'antd';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../../store';
import { ChatMessage } from './types';
import { useApprovalMessages } from './useApprovalMessages';
import { useSocket } from '../../../context/SocketContext';
import { SOCKET_EVENTS } from '../../../services/socketEvents';
import { ChatHeader } from './ChatHeader';
import { ChatMessagesList } from './ChatMessagesList';
import { SuggestedActions } from './SuggestedActions';
import { ActionInputs } from './ActionInputs';
import { ChatInputArea } from './ChatInputArea';
import { Profile } from '../../../features/auth/authSlice';
import { queueApi } from '../../../services/queueApi';

const { Text } = Typography;

interface ApprovalChatProps {
  submissionId: string;
  assignmentId: string;
  currentUserId: string;
  currentUserName: string;
  otherUserName: string;
  isActive: boolean;
  assignment: any;
  approvalChannelId: string | null;
  formName?: string;
  submissionTitle?: string;
  approvalStatus: 'pending' | 'requested' | 'approved' | 'rejected';
  refetchSubmissions?: () => void | Promise<any>;
  refetchChannel?: () => void | Promise<any>;
}

export const ApprovalChat: React.FC<ApprovalChatProps> = ({
  submissionId,
  assignmentId,
  currentUserId,
  currentUserName,
  otherUserName,
  isActive,
  assignment,
  approvalChannelId,
  formName,
  submissionTitle,
  approvalStatus,
  refetchSubmissions,
  refetchChannel,
}) => {
  const { token } = theme.useToken();
  const { mytheme } = useSelector((state: RootState) => state.theme);
  const isDark = mytheme === 'dark';
  const dispatch = useDispatch<AppDispatch>();

  // Use approval messages hook
  const { messages, setMessages, optimisticMessagesRef, isLoadingMessages } =
    useApprovalMessages({
      assignmentId,
      submissionId,
      isActive,
      approvalChannelId,
    });

  // UI State
  const [inputValue, setInputValue] = useState('');
  const [showApprovalInput, setShowApprovalInput] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { selectedProfile } = useSelector((state: RootState) => state.auth);
  const isApprover = assignment?.approvers?.some(
    (approver: Profile) => approver._id === selectedProfile?._id
  );
  const isAssignee = assignment?.assignees?.some(
    (assignee: Profile) => assignee._id === selectedProfile?._id
  );
  const isSubject = assignment?.subjects?.some(
    (subject: Profile) => subject._id === selectedProfile?._id
  );

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  const prevMessagesLengthRef = useRef(0);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);

  // Socket.IO
  const socket = useSocket();

  // Track pending messages by localId to handle MESSAGE_SENT confirmations
  const pendingMessagesRef = useRef<Map<string, string>>(new Map()); // localId -> tempMessageId
  
  // Store refetch function in ref to avoid stale closures
  const refetchSubmissionsRef = useRef<(() => void) | null>(null);
  const refetchChannelRef = useRef<(() => void) | null>(null);
  
  // Update refetch refs when functions change
  useEffect(() => {
    refetchSubmissionsRef.current = refetchSubmissions || null;
    console.log('[ApprovalChat] refetchSubmissions updated:', !!refetchSubmissions);
  }, [refetchSubmissions]);

  useEffect(() => {
    refetchChannelRef.current = refetchChannel || null;
    console.log('[ApprovalChat] refetchChannel updated:', !!refetchChannel);
  }, [refetchChannel]);

  // Listen for APPROVAL MESSAGE_SENT events to confirm message delivery
  useEffect(() => {
    if (!approvalChannelId || !socket.isConnected || !isActive) {
      return;
    }

    const handleApprovalMessageSent = (data: any) => {
      console.log(
        '[ApprovalChat] Approval message sent confirmation via Socket.IO:',
        data
      );
      if (data.channelId !== approvalChannelId) {
        return;
      }

      if (data.message?.action === 'approval:approved') {
        setApprovalMessage('');
        setShowApprovalInput(false);
        // message.success('Submission approved successfully');
        
        console.log('[ApprovalChat] Approval confirmed, invalidating cache and refetching...');
        
        // Invalidate cache and immediately refetch submissions with updated approval status
        dispatch(
          queueApi.util.invalidateTags([
            { type: 'Queue', id: assignmentId },
          ])
        );
        
        // Immediately refetch submissions and channel to get updated data
        // Use a small delay to ensure server has processed the update
        // setTimeout(() => {
        //   if (refetchSubmissionsRef.current) {
        //     console.log('[ApprovalChat] Calling refetchSubmissions...');
        //     try {
        //       refetchSubmissionsRef.current();
        //     } catch (error) {
        //       console.error('[ApprovalChat] Error calling refetchSubmissions:', error);
        //     }
        //   } else {
        //     console.warn('[ApprovalChat] refetchSubmissionsRef.current is null, cannot refetch');
        //   }
          
        //   // Also refetch channel to get updated approval status
        //   if (refetchChannelRef.current) {
        //     console.log('[ApprovalChat] Calling refetchChannel...');
        //     try {
        //       refetchChannelRef.current();
        //     } catch (error) {
        //       console.error('[ApprovalChat] Error calling refetchChannel:', error);
        //     }
        //   } else {
        //     console.warn('[ApprovalChat] refetchChannelRef.current is null, cannot refetch channel');
        //   }
        // }, 500);
      } else if (data.message?.action === 'approval:rejected') {
        setRejectReason('');
        setShowRejectInput(false);
        // message.success('Submission rejected successfully');
        
        console.log('[ApprovalChat] Rejection confirmed, invalidating cache and refetching...');
        
        // Invalidate cache and immediately refetch submissions with updated approval status
        dispatch(
          queueApi.util.invalidateTags([
            { type: 'Queue', id: assignmentId },
          ])
        );
        
        // Immediately refetch submissions and channel to get updated data
        // Use a small delay to ensure server has processed the update
        // setTimeout(() => {
        //   if (refetchSubmissionsRef.current) {
        //     console.log('[ApprovalChat] Calling refetchSubmissions...');
        //     try {
        //       refetchSubmissionsRef.current();
        //     } catch (error) {
        //       console.error('[ApprovalChat] Error calling refetchSubmissions:', error);
        //     }
        //   } else {
        //     console.warn('[ApprovalChat] refetchSubmissionsRef.current is null, cannot refetch');
        //   }
          
        //   // Also refetch channel to get updated approval status
        //   if (refetchChannelRef.current) {
        //     console.log('[ApprovalChat] Calling refetchChannel...');
        //     try {
        //       refetchChannelRef.current();
        //     } catch (error) {
        //       console.error('[ApprovalChat] Error calling refetchChannel:', error);
        //     }
        //   } else {
        //     console.warn('[ApprovalChat] refetchChannelRef.current is null, cannot refetch channel');
        //   }
        // }, 500);
      } else if (data.message?.action === 'approval:requested') {
        // message.success('Approval requested successfully');
        dispatch(
          queueApi.util.invalidateTags([
            { type: 'Queue', id: assignmentId },
          ])
        );
        if (refetchChannelRef.current) {
          refetchChannelRef.current();
        }
      } else if (data.action === 'message') {
        setShowApprovalInput(false);
        setShowRejectInput(false);
      }

      if (data.localId && pendingMessagesRef.current.has(data.localId)) {
        const tempMessageId = pendingMessagesRef.current.get(data.localId);
        if (tempMessageId) {
          optimisticMessagesRef.current.delete(tempMessageId);
          pendingMessagesRef.current.delete(data.localId);
          setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
        }
      }
    };

    socket.on(SOCKET_EVENTS.APPROVAL.MESSAGE_SENT, handleApprovalMessageSent);

    return () => {
      socket.off(
        SOCKET_EVENTS.APPROVAL.MESSAGE_SENT,
        handleApprovalMessageSent
      );
    };
  }, [approvalChannelId, socket.isConnected, socket, isActive, setMessages, assignmentId, dispatch]);

  // Scroll management
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setIsUserScrolledUp(!isNearBottom);
      }, 100);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      if (!isUserScrolledUp || prevMessagesLengthRef.current === 0) {
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
      prevMessagesLengthRef.current = messages.length;
    }
  }, [messages.length, isUserScrolledUp]);

  const scrollToBottom = (smooth = true) => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      if (smooth) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      } else {
        container.scrollTop = container.scrollHeight;
      }
      setIsUserScrolledUp(false);
    } else {
      messagesEndRef.current?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  // Message sending handlers
  const handleSend = async () => {
    if (isSendingMessage) return;

    if (!inputValue.trim()) {
      message.warning('Please enter a message');
      return;
    }

    if (!approvalChannelId) {
      message.error('Channel not available. Please refresh the page.');
      return;
    }

    if (!socket.isConnected) {
      message.error('Not connected to server. Please wait and try again.');
      return;
    }

    const messageText = inputValue.trim();
    const tempMessageId = `temp-${Date.now()}`;
    const tempMessage: ChatMessage = {
      id: tempMessageId,
      text: messageText,
      senderId: currentUserId,
      senderName: currentUserName,
      timestamp: new Date(),
    };

    optimisticMessagesRef.current.add(tempMessageId);
    setMessages((prev) => [...prev, tempMessage]);
    setInputValue('');
    setIsSendingMessage(true);

    try {
      const localId = tempMessageId;
      pendingMessagesRef.current.set(localId, tempMessageId);

      socket.sendMessage(
        approvalChannelId,
        messageText,
        {
          action: 'message',
          actionData: { text: messageText },
          localId,
        },
        'approval'
      );

      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn(
            '[ApprovalChat] No confirmation received for message after 5s:',
            localId
          );
          pendingMessagesRef.current.delete(localId);
        }
      }, 5000);

      setIsSendingMessage(false);
    } catch (error: any) {
      console.error('Error sending message:', error);
      optimisticMessagesRef.current.delete(tempMessageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
      const errorMessage =
        error?.data?.message || error?.message || 'Failed to send message';
      setError(errorMessage);
      message.error(errorMessage);
      setInputValue(messageText);
      setIsSendingMessage(false);
    }
  };

  const handleSendApproval = async () => {
    if (isSendingMessage) return;

    if (!approvalChannelId) {
      message.error('Channel not available. Please refresh the page.');
      return;
    }

    if (!socket.isConnected) {
      message.error('Not connected to server. Please wait and try again.');
      return;
    }

    setIsSendingMessage(true);

    try {
      const tempApprovalMessageId = `temp-approval-${Date.now()}`;
      const tempApprovalMessage: ChatMessage = {
        id: tempApprovalMessageId,
        text: approvalMessage.trim() || '',
        senderId: currentUserId,
        senderName: currentUserName,
        timestamp: new Date(),
        actionType: 'approval',
        approvalStatus: 'approved',
      };

      optimisticMessagesRef.current.add(tempApprovalMessageId);
      setMessages((prev) => [...prev, tempApprovalMessage]);

      const localId = tempApprovalMessageId;
      pendingMessagesRef.current.set(localId, tempApprovalMessageId);

      socket.sendMessage(
        approvalChannelId,
        '',
        {
          action: 'approval:approved',
          actionData: { text: approvalMessage.trim() || undefined },
          localId,
        },
        'approval'
      );

      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn(
            '[ApprovalChat] No confirmation received for approval after 5s:',
            localId
          );
          pendingMessagesRef.current.delete(localId);
        }
      }, 5000);

      setApprovalMessage('');
      setShowApprovalInput(false);
      setIsSendingMessage(false);
    } catch (error: any) {
      console.error('Error sending approval:', error);
      message.error(error?.message || 'Failed to approve submission');
      setIsSendingMessage(false);
    }
  };

  const handleSendReject = async () => {
    if (isSendingMessage) return;

    if (!rejectReason.trim()) {
      message.warning('Please enter a rejection reason');
      return;
    }

    if (!approvalChannelId) {
      message.error('Channel not available. Please refresh the page.');
      return;
    }

    if (!socket.isConnected) {
      message.error('Not connected to server. Please wait and try again.');
      return;
    }

    setIsSendingMessage(true);

    try {
      const tempRejectionMessageId = `temp-rejection-${Date.now()}`;
      const tempRejectionMessage: ChatMessage = {
        id: tempRejectionMessageId,
        text: rejectReason.trim() || '',
        senderId: currentUserId,
        senderName: currentUserName,
        timestamp: new Date(),
        actionType: 'approval',
        approvalStatus: 'rejected',
      };

      optimisticMessagesRef.current.add(tempRejectionMessageId);
      setMessages((prev) => [...prev, tempRejectionMessage]);

      const localId = tempRejectionMessageId;
      pendingMessagesRef.current.set(localId, tempRejectionMessageId);

      socket.sendMessage(
        approvalChannelId,
        '',
        {
          action: 'approval:rejected',
          actionData: { text: rejectReason.trim() || undefined },
          localId,
        },
        'approval'
      );

      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn(
            '[ApprovalChat] No confirmation received for rejection after 5s:',
            localId
          );
          pendingMessagesRef.current.delete(localId);
        }
      }, 5000);

      setRejectReason('');
      setShowRejectInput(false);
      setIsSendingMessage(false);
    } catch (error: any) {
      console.error('Error sending rejection:', error);
      message.error(error?.message || 'Failed to reject submission');
      setIsSendingMessage(false);
    }
  };

  const handleRequestApproval = async () => {
    if (isSendingMessage) return;

    if (!approvalChannelId) {
      message.error('Channel not available. Please refresh the page.');
      return;
    }

    if (!socket.isConnected) {
      message.error('Not connected to server. Please wait and try again.');
      return;
    }

    setIsSendingMessage(true);

    try {
      const tempRequestMessageId = `temp-request-${Date.now()}`;
      const tempRequestMessage: ChatMessage = {
        id: tempRequestMessageId,
        text: 'Requested approval',
        senderId: currentUserId,
        senderName: currentUserName,
        timestamp: new Date(),
      };

      optimisticMessagesRef.current.add(tempRequestMessageId);
      setMessages((prev) => [...prev, tempRequestMessage]);

      const localId = tempRequestMessageId;
      pendingMessagesRef.current.set(localId, tempRequestMessageId);

      socket.sendMessage(
        approvalChannelId,
        '',
        {
          action: 'approval:requested',
          actionData: {},
          localId,
        },
        'approval'
      );

      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn(
            '[ApprovalChat] No confirmation received for approval request after 5s:',
            localId
          );
          pendingMessagesRef.current.delete(localId);
        }
      }, 5000);

      setIsSendingMessage(false);
    } catch (error: any) {
      console.error('Error sending approval request:', error);
      message.error(error?.message || 'Failed to request approval');
      setIsSendingMessage(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isSendingMessage) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (isActive && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isActive]);

  const scrollbarThumbColor = token.colorBorderSecondary;
  const scrollbarThumbHoverColor = token.colorBorder;
  const scrollbarStyles = `.chat-messages-container::-webkit-scrollbar {
    width: 8px;
  }
  .chat-messages-container::-webkit-scrollbar-track {
    background: transparent;
  }
  .chat-messages-container::-webkit-scrollbar-thumb {
    background: ${scrollbarThumbColor};
    border-radius: 4px;
  }
  .chat-messages-container::-webkit-scrollbar-thumb:hover {
    background: ${scrollbarThumbHoverColor};
  }`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '700px',
          maxHeight: '100vh',
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <ChatHeader
          otherUserName={otherUserName}
          hasApproval={true}
          hasDisputes={false}
          formName={formName}
          submissionTitle={submissionTitle}
          isDark={isDark}
          token={token}
        />

        <div
          ref={chatContainerRef}
          className="chat-messages-container"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 0,
            minHeight: 0,
            background: token.colorBgContainer,
            scrollBehavior: 'smooth',
            scrollbarWidth: 'thin',
            scrollbarColor: `${token.colorBorderSecondary} transparent`,
            position: 'relative',
          }}
        >
          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: '#fff1f0',
                border: '1px solid #ffccc7',
                borderRadius: '8px',
                marginBottom: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text type="danger" style={{ fontSize: 12 }}>
                {error}
              </Text>
              <Button
                type="text"
                size="small"
                onClick={() => setError(null)}
                style={{ color: '#cf1322' }}
              >
                Dismiss
              </Button>
            </div>
          )}

          <ChatMessagesList
            messages={messages}
            currentUserId={currentUserId}
            isLoading={isLoadingMessages}
            isDark={isDark}
            token={token}
            chatContainerRef={chatContainerRef}
            messagesEndRef={messagesEndRef}
          />
        </div>

        {approvalStatus !== 'approved' && (
          <Affix offsetBottom={0}>
            <div style={{ background: token.colorBgContainer, zIndex: 10 }}>
              <SuggestedActions
                hasApproval={true}
                hasDisputes={false}
                omitSignatureAllowed={false}
                signatureRequired={false}
                showApprovalInput={showApprovalInput}
                showRejectInput={showRejectInput}
                showDisputeInput={false}
                showSignaturePad={false}
                showOmitSignatureRequestInput={false}
                showOmitSignatureApproveInput={false}
                showOmitSignatureRejectInput={false}
                onToggleApproval={() => {
                  setShowApprovalInput(!showApprovalInput);
                  setShowRejectInput(false);
                }}
                onToggleReject={() => {
                  setShowRejectInput(!showRejectInput);
                  setShowApprovalInput(false);
                }}
                onToggleDispute={() => {}}
                onToggleSignature={() => {}}
                onToggleOmitSignatureRequest={() => {}}
                onToggleOmitSignatureApprove={() => {}}
                onToggleOmitSignatureReject={() => {}}
                isDark={isDark}
                token={token}
                isApprover={isApprover || false}
                isAssignee={isAssignee || false}
                isSubject={isSubject || false}
                isOmitSignatureApprover={false}
                approvalStatus={approvalStatus}
                onRequestApproval={handleRequestApproval}
              />

              <ActionInputs
                showApprovalInput={showApprovalInput}
                approvalMessage={approvalMessage}
                onApprovalMessageChange={setApprovalMessage}
                onApprovalClose={() => {
                  setShowApprovalInput(false);
                  setApprovalMessage('');
                }}
                onApprovalSend={handleSendApproval}
                showRejectInput={showRejectInput}
                rejectReason={rejectReason}
                onRejectReasonChange={setRejectReason}
                onRejectClose={() => {
                  setShowRejectInput(false);
                  setRejectReason('');
                }}
                onRejectSend={handleSendReject}
                showDisputeInput={false}
                disputeReason=""
                onDisputeReasonChange={() => {}}
                onDisputeClose={() => {}}
                onDisputeSend={() => {}}
                showOmitSignatureRequestInput={false}
                omitSignatureRequestReason=""
                onOmitSignatureRequestReasonChange={() => {}}
                onOmitSignatureRequestClose={() => {}}
                onOmitSignatureRequestSend={() => {}}
                showOmitSignatureApproveInput={false}
                omitSignatureApproveReason=""
                onOmitSignatureApproveReasonChange={() => {}}
                onOmitSignatureApproveClose={() => {}}
                onOmitSignatureApproveSend={() => {}}
                showOmitSignatureRejectInput={false}
                omitSignatureRejectReason=""
                onOmitSignatureRejectReasonChange={() => {}}
                onOmitSignatureRejectClose={() => {}}
                onOmitSignatureRejectSend={() => {}}
                hasApproval={true}
                hasDisputes={false}
                isSending={isSendingMessage}
                isDark={isDark}
                token={token}
                isApprover={isApprover || false}
                isAssignee={isAssignee || false}
                isSubject={isSubject || false}
                isOmitSignatureApprover={false}
              />

              <ChatInputArea
                inputValue={inputValue}
                onInputChange={(value) => {
                  setInputValue(value);
                  setError(null);
                }}
                onSend={handleSend}
                fileList={[]}
                onRemoveFile={() => {}}
                hasApproval={true}
                hasDisputes={false}
                isSending={isSendingMessage}
                isDark={isDark}
                token={token}
                inputRef={inputRef}
                onKeyPress={handleKeyPress}
              />
            </div>
          </Affix>
        )}
      </div>
    </>
  );
};
