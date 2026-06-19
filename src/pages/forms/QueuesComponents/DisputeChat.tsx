/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect } from 'react';
import { Button, Typography, theme, message, Affix } from 'antd';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { ChatMessage } from './types';
import { useDisputeMessages } from './useDisputeMessages';
import { useSocket } from '../../../context/SocketContext';
import { SOCKET_EVENTS } from '../../../services/socketEvents';
import { uploadFile } from '../../../utils/uploadApi';
import { ChatHeader } from './ChatHeader';
import { ChatMessagesList } from './ChatMessagesList';
import { SuggestedActions } from './SuggestedActions';
import { ActionInputs } from './ActionInputs';
import { SignaturePadComponent } from './SignaturePadComponent';
import { ChatInputArea } from './ChatInputArea';
import { Profile } from '../../../features/auth/authSlice';

const { Text } = Typography;

interface DisputeChatProps {
  submissionId: string;
  assignmentId: string;
  currentUserId: string;
  currentUserName: string;
  otherUserName: string;
  isActive: boolean;
  assignment: any;
  disputeChannelId: string | null;
  omitSignatureAllowed: boolean;
  signatureRequired: boolean;
  formName?: string;
  submissionTitle?: string;
  submissionStatus?: string;
}

export const DisputeChat: React.FC<DisputeChatProps> = ({
  submissionId,
  assignmentId,
  currentUserId,
  currentUserName,
  otherUserName,
  isActive,
  assignment,
  disputeChannelId,
  omitSignatureAllowed,
  signatureRequired,
  formName,
  submissionTitle,
  submissionStatus,
}) => {
  const { token } = theme.useToken();
  const { mytheme } = useSelector((state: RootState) => state.theme);
  const isDark = mytheme === 'dark';

  // Use dispute messages hook
  const {
    messages,
    setMessages,
    optimisticMessagesRef,
    isLoadingMessages,
    socketChannel,
  } = useDisputeMessages({
    assignmentId,
    submissionId,
    isActive,
    disputeChannelId,
  });

  // UI State
  const [inputValue, setInputValue] = useState('');
  const [showDisputeInput, setShowDisputeInput] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showOmitSignatureRequestInput, setShowOmitSignatureRequestInput] =
    useState(false);
  const [omitSignatureRequestReason, setOmitSignatureRequestReason] =
    useState('');
  const [showOmitSignatureApproveInput, setShowOmitSignatureApproveInput] =
    useState(false);
  const [omitSignatureApproveReason, setOmitSignatureApproveReason] =
    useState('');
  const [showOmitSignatureRejectInput, setShowOmitSignatureRejectInput] =
    useState(false);
  const [omitSignatureRejectReason, setOmitSignatureRejectReason] =
    useState('');
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
  const isOmitSignatureApprover = assignment?.omitSignatureApprovers?.some(
    (approver: string) => approver === selectedProfile?._id
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
  const pendingMessagesRef = useRef<Map<string, string>>(new Map());

  // Listen for DISPUTE MESSAGE_SENT events to confirm message delivery and receive new messages
  useEffect(() => {
    if (!disputeChannelId || !socket.isConnected || !isActive) {
      return;
    }

    const handleDisputeMessageSent = (data: any) => {
      console.log(
        '[DisputeChat] Dispute message sent confirmation via Socket.IO:',
        data
      );
      if (data.channelId !== disputeChannelId) {
        return;
      }

      // Handle UI state updates for specific actions
      if (data.message?.action === 'dispute:open') {
        setDisputeReason('');
        setShowDisputeInput(false);
        // message.success('Dispute sent successfully');
      } else if (data.message?.action === 'submission:signature') {
        setShowSignaturePad(false);
        // message.success('Signature sent successfully');
      } else if (data.message?.action === 'omit-signature:requested') {
        setOmitSignatureRequestReason('');
        setShowOmitSignatureRequestInput(false);
        // message.success('Omit signature request sent successfully');
      } else if (data.message?.action === 'omit-signature:approved') {
        setOmitSignatureApproveReason('');
        setShowOmitSignatureApproveInput(false);
        // message.success('Omit signature request approved successfully');
      } else if (data.message?.action === 'omit-signature:rejected') {
        setOmitSignatureRejectReason('');
        setShowOmitSignatureRejectInput(false);
        // message.success('Omit signature request rejected successfully');
      } else if (data.message?.action === 'message') {
        setShowDisputeInput(false);
        setShowSignaturePad(false);
        setShowOmitSignatureRequestInput(false);
        setShowOmitSignatureApproveInput(false);
        setShowOmitSignatureRejectInput(false);
      }

      // Remove optimistic message if this is a confirmation for a message we sent
      if (data.localId && pendingMessagesRef.current.has(data.localId)) {
        const tempMessageId = pendingMessagesRef.current.get(data.localId);
        if (tempMessageId) {
          optimisticMessagesRef.current.delete(tempMessageId);
          pendingMessagesRef.current.delete(data.localId);
          setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
        }
      }

      // Note: The refetch is handled by useSocketChannel's onMessage callback in useDisputeMessages
      // This listener is primarily for handling UI state updates and optimistic message cleanup
      console.log(
        '[DisputeChat] Message received via Socket.IO, refetch should be triggered by useSocketChannel'
      );
    };

    socket.on(SOCKET_EVENTS.DISPUTE.MESSAGE_SENT, handleDisputeMessageSent);

    return () => {
      socket.off(SOCKET_EVENTS.DISPUTE.MESSAGE_SENT, handleDisputeMessageSent);
    };
  }, [
    disputeChannelId,
    socket.isConnected,
    socket,
    isActive,
    setMessages,
    socketChannel,
    optimisticMessagesRef,
  ]);

  // Scroll management (same as ApprovalChat)
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

    // Only allow sending messages when submission status is "approval_completed" or "dispute_in_progress"
    if (
      submissionStatus !== 'approval_completed' &&
      submissionStatus !== 'dispute_in_progress'
    ) {
      message.warning(
        'Messages can only be sent when submission status is "approval_completed" or "dispute_in_progress"'
      );
      return;
    }

    if (!inputValue.trim()) {
      message.warning('Please enter a message');
      return;
    }

    if (!disputeChannelId) {
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
        disputeChannelId,
        messageText,
        {
          action: 'message',
          actionData: { text: messageText },
          localId,
        },
        'dispute'
      );

      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn(
            '[DisputeChat] No confirmation received for message after 5s:',
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

  const handleSendDispute = async () => {
    if (isSendingMessage) return;

    // Only allow sending dispute when submission status is "approval_completed" or "dispute_in_progress"
    if (
      submissionStatus !== 'approval_completed' &&
      submissionStatus !== 'dispute_in_progress'
    ) {
      message.warning(
        'Dispute can only be sent when submission status is "approval_completed" or "dispute_in_progress"'
      );
      return;
    }

    if (!disputeReason.trim()) {
      message.warning('Please enter a dispute reason');
      return;
    }

    if (!disputeChannelId) {
      message.error('Channel not available. Please refresh the page.');
      return;
    }

    if (!socket.isConnected) {
      message.error('Not connected to server. Please wait and try again.');
      return;
    }

    setIsSendingMessage(true);

    try {
      const reasonToSend = disputeReason.trim();
      const tempDisputeMessageId = `temp-dispute-${Date.now()}`;
      const tempDisputeMessage: ChatMessage = {
        id: tempDisputeMessageId,
        text: reasonToSend || '',
        senderId: currentUserId,
        senderName: currentUserName,
        timestamp: new Date(),
        actionType: 'dispute',
      };

      optimisticMessagesRef.current.add(tempDisputeMessageId);
      setMessages((prev) => [...prev, tempDisputeMessage]);

      const localId = tempDisputeMessageId;
      pendingMessagesRef.current.set(localId, tempDisputeMessageId);

      socket.sendMessage(
        disputeChannelId,
        '',
        {
          action: 'dispute:open',
          actionData: { text: reasonToSend },
          localId,
        },
        'dispute'
      );

      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn(
            '[DisputeChat] No confirmation received for dispute after 5s:',
            localId
          );
          pendingMessagesRef.current.delete(localId);
        }
      }, 5000);

      setDisputeReason('');
      setShowDisputeInput(false);
      setIsSendingMessage(false);
    } catch (error: any) {
      console.error('Error sending dispute:', error);
      message.error(error?.message || 'Failed to send dispute');
      setIsSendingMessage(false);
    }
  };

  const handleSendOmitSignatureRequest = async () => {
    if (isSendingMessage) return;

    // Only allow sending omit signature request when submission status is "approval_completed" or "dispute_in_progress"
    if (
      submissionStatus !== 'approval_completed' &&
      submissionStatus !== 'dispute_in_progress'
    ) {
      message.warning(
        'Omit signature request can only be sent when submission status is "approval_completed" or "dispute_in_progress"'
      );
      return;
    }

    if (!omitSignatureRequestReason.trim()) {
      message.warning('Please enter a reason for omitting signature request');
      return;
    }

    if (!disputeChannelId) {
      message.error('Channel not available. Please refresh the page.');
      return;
    }

    if (!socket.isConnected) {
      message.error('Not connected to server. Please wait and try again.');
      return;
    }

    setIsSendingMessage(true);

    try {
      const reasonToSend = omitSignatureRequestReason.trim();
      const tempMessageId = `temp-omit-signature-request-${Date.now()}`;
      const tempMessage: ChatMessage = {
        id: tempMessageId,
        text: reasonToSend || '',
        senderId: currentUserId,
        senderName: currentUserName,
        timestamp: new Date(),
        actionType: 'omit-signature-request',
      };

      optimisticMessagesRef.current.add(tempMessageId);
      setMessages((prev) => [...prev, tempMessage]);

      const localId = tempMessageId;
      pendingMessagesRef.current.set(localId, tempMessageId);

      socket.sendMessage(
        disputeChannelId,
        '',
        {
          action: 'omit-signature:requested',
          actionData: { text: reasonToSend },
          localId,
        },
        'dispute'
      );

      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn(
            '[DisputeChat] No confirmation received for omit signature request after 5s:',
            localId
          );
          pendingMessagesRef.current.delete(localId);
        }
      }, 5000);

      setOmitSignatureRequestReason('');
      setShowOmitSignatureRequestInput(false);
      setIsSendingMessage(false);
    } catch (error: any) {
      console.error('Error sending omit signature request:', error);
      message.error(error?.message || 'Failed to send omit signature request');
      setIsSendingMessage(false);
    }
  };

  const handleSendOmitSignatureApprove = async () => {
    if (isSendingMessage) return;

    // Only allow sending omit signature approve when submission status is "approval_completed" or "dispute_in_progress"
    if (
      submissionStatus !== 'approval_completed' &&
      submissionStatus !== 'dispute_in_progress'
    ) {
      message.warning(
        'Omit signature approval can only be sent when submission status is "approval_completed" or "dispute_in_progress"'
      );
      return;
    }

    if (!omitSignatureApproveReason.trim()) {
      message.warning(
        'Please enter a reason for approving omit signature request'
      );
      return;
    }

    if (!disputeChannelId) {
      message.error('Channel not available. Please refresh the page.');
      return;
    }

    if (!socket.isConnected) {
      message.error('Not connected to server. Please wait and try again.');
      return;
    }

    setIsSendingMessage(true);

    try {
      const reasonToSend = omitSignatureApproveReason.trim();
      const tempMessageId = `temp-omit-signature-approve-${Date.now()}`;
      const tempMessage: ChatMessage = {
        id: tempMessageId,
        text: reasonToSend || '',
        senderId: currentUserId,
        senderName: currentUserName,
        timestamp: new Date(),
        actionType: 'omit-signature-request-approve',
      };

      optimisticMessagesRef.current.add(tempMessageId);
      setMessages((prev) => [...prev, tempMessage]);

      const localId = tempMessageId;
      pendingMessagesRef.current.set(localId, tempMessageId);

      socket.sendMessage(
        disputeChannelId,
        '',
        {
          action: 'omit-signature:approved',
          actionData: { text: reasonToSend },
          localId,
        },
        'dispute'
      );

      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn(
            '[DisputeChat] No confirmation received for omit signature approve after 5s:',
            localId
          );
          pendingMessagesRef.current.delete(localId);
        }
      }, 5000);

      setOmitSignatureApproveReason('');
      setShowOmitSignatureApproveInput(false);
      setIsSendingMessage(false);
    } catch (error: any) {
      console.error('Error approving omit signature request:', error);
      message.error(
        error?.message || 'Failed to approve omit signature request'
      );
      setIsSendingMessage(false);
    }
  };

  const handleSendOmitSignatureReject = async () => {
    if (isSendingMessage) return;

    // Only allow sending omit signature reject when submission status is "approval_completed" or "dispute_in_progress"
    if (
      submissionStatus !== 'approval_completed' &&
      submissionStatus !== 'dispute_in_progress'
    ) {
      message.warning(
        'Omit signature rejection can only be sent when submission status is "approval_completed" or "dispute_in_progress"'
      );
      return;
    }

    if (!omitSignatureRejectReason.trim()) {
      message.warning(
        'Please enter a reason for rejecting omit signature request'
      );
      return;
    }

    if (!disputeChannelId) {
      message.error('Channel not available. Please refresh the page.');
      return;
    }

    if (!socket.isConnected) {
      message.error('Not connected to server. Please wait and try again.');
      return;
    }

    setIsSendingMessage(true);

    try {
      const reasonToSend = omitSignatureRejectReason.trim();
      const tempMessageId = `temp-omit-signature-reject-${Date.now()}`;
      const tempMessage: ChatMessage = {
        id: tempMessageId,
        text: reasonToSend || '',
        senderId: currentUserId,
        senderName: currentUserName,
        timestamp: new Date(),
        actionType: 'omit-signature-request-reject',
      };

      optimisticMessagesRef.current.add(tempMessageId);
      setMessages((prev) => [...prev, tempMessage]);

      const localId = tempMessageId;
      pendingMessagesRef.current.set(localId, tempMessageId);

      socket.sendMessage(
        disputeChannelId,
        '',
        {
          action: 'omit-signature:rejected',
          actionData: { text: reasonToSend },
          localId,
        },
        'dispute'
      );

      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn(
            '[DisputeChat] No confirmation received for omit signature reject after 5s:',
            localId
          );
          pendingMessagesRef.current.delete(localId);
        }
      }, 5000);

      setOmitSignatureRejectReason('');
      setShowOmitSignatureRejectInput(false);
      setIsSendingMessage(false);
    } catch (error: any) {
      console.error('Error rejecting omit signature request:', error);
      message.error(
        error?.message || 'Failed to reject omit signature request'
      );
      setIsSendingMessage(false);
    }
  };

  const handleSignatureSend = async (signatureDataUrl: string) => {
    if (isSendingMessage) return;

    // Only allow sending signature when submission status is "approval_completed" or "dispute_in_progress"
    if (
      submissionStatus !== 'approval_completed' &&
      submissionStatus !== 'dispute_in_progress'
    ) {
      message.warning(
        'Signature can only be sent when submission status is "approval_completed" or "dispute_in_progress"'
      );
      return;
    }

    if (!disputeChannelId) {
      message.error('Channel not available. Please refresh the page.');
      return;
    }

    if (!socket.isConnected) {
      message.error('Not connected to server. Please wait and try again.');
      return;
    }

    setIsSendingMessage(true);
    setError(null);

    const tempMessageId = `temp-signature-${Date.now()}`;

    try {
      const tempMessage: ChatMessage = {
        id: tempMessageId,
        text: '',
        senderId: currentUserId,
        senderName: currentUserName,
        timestamp: new Date(),
        actionType: 'signature',
        signature: {
          dataUrl: signatureDataUrl,
          timestamp: new Date(),
        },
      };

      optimisticMessagesRef.current.add(tempMessageId);
      setMessages((prev) => [...prev, tempMessage]);
      setShowSignaturePad(false);

      // Upload signature file and get the URL
      const uploadedFileUrl = await uploadFile(signatureDataUrl);
      console.log('[DisputeChat] Signature uploaded, URL:', uploadedFileUrl);

      if (!uploadedFileUrl) {
        throw new Error('Failed to get file URL from upload response');
      }

      const localId = tempMessageId;
      pendingMessagesRef.current.set(localId, tempMessageId);

      // Send signature via Socket.IO with the uploaded file URL
      socket.sendMessage(
        disputeChannelId,
        '',
        {
          action: 'submission:signature',
          actionData: { file: uploadedFileUrl },
          localId,
        },
        'dispute'
      );

      console.log(
        '[DisputeChat] Signature sent via Socket.IO with URL:',
        uploadedFileUrl
      );

      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn(
            '[DisputeChat] No confirmation received for signature after 5s:',
            localId
          );
          pendingMessagesRef.current.delete(localId);
        }
      }, 5000);

      setIsSendingMessage(false);
    } catch (error: any) {
      console.error('Error sending signature:', error);
      optimisticMessagesRef.current.delete(tempMessageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
      const errorMessage =
        error?.data?.message || error?.message || 'Failed to send signature';
      setError(errorMessage);
      message.error(errorMessage);
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
          hasApproval={false}
          hasDisputes={true}
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
        {(submissionStatus === 'approval_completed' ||
          submissionStatus === 'dispute_in_progress') && (
          <Affix offsetBottom={0}>
            <div style={{ background: token.colorBgContainer, zIndex: 10 }}>
              <SuggestedActions
                hasApproval={false}
                hasDisputes={true}
                omitSignatureAllowed={omitSignatureAllowed}
                signatureRequired={signatureRequired}
                showApprovalInput={false}
                showRejectInput={false}
                showDisputeInput={showDisputeInput}
                showSignaturePad={showSignaturePad}
                showOmitSignatureRequestInput={showOmitSignatureRequestInput}
                showOmitSignatureApproveInput={showOmitSignatureApproveInput}
                showOmitSignatureRejectInput={showOmitSignatureRejectInput}
                onToggleApproval={() => {}}
                onToggleReject={() => {}}
                onToggleDispute={() => {
                  setShowDisputeInput(!showDisputeInput);
                }}
                onToggleSignature={() => {
                  setShowSignaturePad(!showSignaturePad);
                }}
                onToggleOmitSignatureRequest={() => {
                  setShowOmitSignatureRequestInput(
                    !showOmitSignatureRequestInput
                  );
                  setShowOmitSignatureApproveInput(false);
                  setShowOmitSignatureRejectInput(false);
                }}
                onToggleOmitSignatureApprove={() => {
                  setShowOmitSignatureApproveInput(
                    !showOmitSignatureApproveInput
                  );
                  setShowOmitSignatureRequestInput(false);
                  setShowOmitSignatureRejectInput(false);
                }}
                onToggleOmitSignatureReject={() => {
                  setShowOmitSignatureRejectInput(
                    !showOmitSignatureRejectInput
                  );
                  setShowOmitSignatureRequestInput(false);
                  setShowOmitSignatureApproveInput(false);
                }}
                isDark={isDark}
                token={token}
                isApprover={isApprover || false}
                isAssignee={isAssignee || false}
                isSubject={isSubject || false}
                isOmitSignatureApprover={isOmitSignatureApprover || false}
                submissionStatus={submissionStatus}
              />

              <ActionInputs
                showApprovalInput={false}
                approvalMessage=""
                onApprovalMessageChange={() => {}}
                onApprovalClose={() => {}}
                onApprovalSend={() => {}}
                showRejectInput={false}
                rejectReason=""
                onRejectReasonChange={() => {}}
                onRejectClose={() => {}}
                onRejectSend={() => {}}
                showDisputeInput={showDisputeInput}
                disputeReason={disputeReason}
                onDisputeReasonChange={setDisputeReason}
                onDisputeClose={() => {
                  setShowDisputeInput(false);
                  setDisputeReason('');
                }}
                onDisputeSend={handleSendDispute}
                showOmitSignatureRequestInput={showOmitSignatureRequestInput}
                omitSignatureRequestReason={omitSignatureRequestReason}
                onOmitSignatureRequestReasonChange={
                  setOmitSignatureRequestReason
                }
                onOmitSignatureRequestClose={() => {
                  setShowOmitSignatureRequestInput(false);
                  setOmitSignatureRequestReason('');
                }}
                onOmitSignatureRequestSend={handleSendOmitSignatureRequest}
                showOmitSignatureApproveInput={showOmitSignatureApproveInput}
                omitSignatureApproveReason={omitSignatureApproveReason}
                onOmitSignatureApproveReasonChange={
                  setOmitSignatureApproveReason
                }
                onOmitSignatureApproveClose={() => {
                  setShowOmitSignatureApproveInput(false);
                  setOmitSignatureApproveReason('');
                }}
                onOmitSignatureApproveSend={handleSendOmitSignatureApprove}
                showOmitSignatureRejectInput={showOmitSignatureRejectInput}
                omitSignatureRejectReason={omitSignatureRejectReason}
                onOmitSignatureRejectReasonChange={setOmitSignatureRejectReason}
                onOmitSignatureRejectClose={() => {
                  setShowOmitSignatureRejectInput(false);
                  setOmitSignatureRejectReason('');
                }}
                onOmitSignatureRejectSend={handleSendOmitSignatureReject}
                hasApproval={false}
                hasDisputes={true}
                isSending={isSendingMessage}
                isDark={isDark}
                token={token}
                isApprover={isApprover || false}
                isAssignee={isAssignee || false}
                isSubject={isSubject || false}
                isOmitSignatureApprover={isOmitSignatureApprover || false}
              />

              <SignaturePadComponent
                visible={showSignaturePad && signatureRequired}
                onClose={() => setShowSignaturePad(false)}
                onSend={handleSignatureSend}
                isSending={isSendingMessage}
                isDark={isDark}
                token={token}
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
                hasApproval={false}
                hasDisputes={true}
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
