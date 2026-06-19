/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect } from 'react';
import { Button, Typography, theme, message, Affix } from 'antd';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import type { UploadFile } from 'antd';
import {
  useGetConversationMutation,
  ChatMessage as APIChatMessage,
} from '../../../services/queueApi';
import { ChatMessage, SubmissionChatProps } from './types';
import { useChatMessages } from './useChatMessages';
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

export const SubmissionChat: React.FC<SubmissionChatProps> = ({
  submissionId,
  assignmentId,
  currentUserId,
  currentUserName,
  otherUserName,
  hasApproval = false,
  hasDisputes = false,
  omitSignatureAllowed = false,
  signatureRequired = false,
  formName,
  submissionTitle,
  isActive = true,
  assignment,
  approvalChannelId,
  disputeChannelId,
}) => {
  const { token } = theme.useToken();
  const { mytheme } = useSelector((state: RootState) => state.theme);
  const isDark = mytheme === 'dark';

  // Use custom hook for message syncing with Socket.IO integration
  const {
    messages,
    setMessages,
    optimisticMessagesRef,
    isLoadingMessages,
  } = useChatMessages({
    assignmentId,
    submissionId,
    hasApproval,
    hasDisputes,
    isActive,
    approvalChannelId,
    disputeChannelId,
  });

  // UI State
  const [inputValue, setInputValue] = useState('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showDisputeInput, setShowDisputeInput] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [showApprovalInput, setShowApprovalInput] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showOmitSignatureRequestInput, setShowOmitSignatureRequestInput] = useState(false);
  const [omitSignatureRequestReason, setOmitSignatureRequestReason] = useState('');
  const [showOmitSignatureApproveInput, setShowOmitSignatureApproveInput] = useState(false);
  const [omitSignatureApproveReason, setOmitSignatureApproveReason] = useState('');
  const [showOmitSignatureRejectInput, setShowOmitSignatureRejectInput] = useState(false);
  const [omitSignatureRejectReason, setOmitSignatureRejectReason] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const { selectedProfile } = useSelector((state: RootState) => state.auth);
  const isApprover = assignment?.approvers?.some((approver) => {
    if (typeof approver === 'string') {
      return approver === selectedProfile?._id;
    }
    return approver._id === selectedProfile?._id;
  });
  const isAssignee = assignment?.assignees?.some((assignee: Profile) => assignee._id === selectedProfile?._id);
  const isSubject = assignment?.subjects?.some((subject: Profile) => subject._id === selectedProfile?._id);
  const isOmitSignatureApprover = assignment?.omitSignatureApprovers?.some((approver: string) => approver === selectedProfile?._id);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  const prevMessagesLengthRef = useRef(0);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);

  // API hooks (only for non-approval/dispute channels - legacy support)
  const [getConversation] = useGetConversationMutation();

  // Socket.IO for approval channel
  const socket = useSocket();

  // Track pending messages by localId to handle MESSAGE_SENT confirmations
  const pendingMessagesRef = useRef<Map<string, string>>(new Map()); // localId -> tempMessageId

  // Listen for APPROVAL MESSAGE_SENT events to confirm message delivery
  useEffect(() => {
    if (!hasApproval || !approvalChannelId || !socket.isConnected) {
      return;
    }

    const handleApprovalMessageSent = (data: any) => {
      console.log('[SubmissionChat] Approval message sent confirmation via Socket.IO:', data);
      // Only process messages for this channel
      if (data.channelId !== approvalChannelId) {
        return;
      }
      
      // Handle UI updates for approval/rejection actions
      // Check by action type to ensure inputs are hidden even if localId doesn't match
      if (data.action === 'approval:approved') {
        // Clear approval input if this was an approval action
        setApprovalMessage('');
        setShowApprovalInput(false);
        // message.success('Submission approved successfully');
      } else if (data.action === 'approval:rejected') {
        // Clear reject input if this was a rejection action
        setRejectReason('');
        setShowRejectInput(false);
        // message.success('Submission rejected successfully');
      } else if (data.action === 'message') {
        // For regular messages, just clear any open input fields
        setShowApprovalInput(false);
        setShowRejectInput(false);
      }
      
      // If we have a localId, remove the optimistic message
      if (data.localId && pendingMessagesRef.current.has(data.localId)) {
        const tempMessageId = pendingMessagesRef.current.get(data.localId);
        if (tempMessageId) {
          optimisticMessagesRef.current.delete(tempMessageId);
          pendingMessagesRef.current.delete(data.localId);
          
          // Remove optimistic message from UI
          setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
          
          // The useChatMessages hook will refetch and update with the real message from server
        }
      }
    };

    socket.on(SOCKET_EVENTS.APPROVAL.MESSAGE_SENT, handleApprovalMessageSent);

    return () => {
      socket.off(SOCKET_EVENTS.APPROVAL.MESSAGE_SENT, handleApprovalMessageSent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasApproval, approvalChannelId, socket.isConnected, socket]);

  // Listen for DISPUTE MESSAGE_SENT events to confirm message delivery
  useEffect(() => {
    if (!hasDisputes || !disputeChannelId || !socket.isConnected) {
      return;
    }

    const handleDisputeMessageSent = (data: any) => {
      console.log('[SubmissionChat] Dispute message sent confirmation via Socket.IO:', data);
      // Only process messages for this channel
      if (data.channelId !== disputeChannelId) {
        return;
      }
      
      // Handle UI updates for dispute/signature actions
      if (data.action === 'dispute:open') {
        setDisputeReason('');
        setShowDisputeInput(false);
        // message.success('Dispute sent successfully');
      } else if (data.action === 'submission:signature') {
        setShowSignaturePad(false);
        // message.success('Signature sent successfully');
      } else if (data.action === 'omit-signature:requested') {
        setOmitSignatureRequestReason('');
        setShowOmitSignatureRequestInput(false);
        // message.success('Omit signature request sent successfully');
      } else if (data.action === 'omit-signature:approved') {
        setOmitSignatureApproveReason('');
        setShowOmitSignatureApproveInput(false);
        // message.success('Omit signature request approved successfully');
      } else if (data.action === 'omit-signature:rejected') {
        setOmitSignatureRejectReason('');
        setShowOmitSignatureRejectInput(false);
        // message.success('Omit signature request rejected successfully');
      } else if (data.action === 'message') {
        // For regular messages, just clear any open input fields
        setShowDisputeInput(false);
        setShowSignaturePad(false);
        setShowOmitSignatureRequestInput(false);
        setShowOmitSignatureApproveInput(false);
        setShowOmitSignatureRejectInput(false);
      }
      
      // If we have a localId, remove the optimistic message
      if (data.localId && pendingMessagesRef.current.has(data.localId)) {
        const tempMessageId = pendingMessagesRef.current.get(data.localId);
        if (tempMessageId) {
          optimisticMessagesRef.current.delete(tempMessageId);
          pendingMessagesRef.current.delete(data.localId);
          
          // Remove optimistic message from UI
          setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
          
          // The useChatMessages hook will refetch and update with the real message from server
        }
      }
    };

    socket.on(SOCKET_EVENTS.DISPUTE.MESSAGE_SENT, handleDisputeMessageSent);

    return () => {
      socket.off(SOCKET_EVENTS.DISPUTE.MESSAGE_SENT, handleDisputeMessageSent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDisputes, disputeChannelId, socket.isConnected, socket]);

  // Load conversation for non-approval/dispute chats
  useEffect(() => {
    const loadConversation = async () => {
      if (!assignmentId || !submissionId || !isActive) return;
      if (hasApproval || hasDisputes) return; // Handled by useChatMessages hook

      try {
        const convResult = await getConversation({
          assignmentId,
          submissionId,
        }).unwrap();

        const conversation = convResult?.data?.conversation;
        const apiMessages = convResult?.data?.messages || conversation?.messages || [];

        if (apiMessages.length > 0) {
          const formattedMessages: ChatMessage[] = apiMessages.map((msg: APIChatMessage) => {
            const senderId = msg.sentBy?.user?._id || msg.senderId || '';
            const senderName = msg.sentBy?.user?.name || msg.sentBy?.user?.email || msg.senderName || '';
            const timestamp = msg.createdAt || msg.timestamp || new Date().toISOString();
            
            return {
              id: msg._id || Date.now().toString(),
              text: msg.text || '',
              senderId,
              senderName,
              timestamp: new Date(timestamp),
              attachments: msg.attachments?.map((att) => ({
                name: att.filename || 'Unknown',
                url: att.url || att.path || '',
                type: att.mimetype || 'application/octet-stream',
                size: att.size || 0,
              })),
              actionType: msg.actionType,
              signature: msg.signature
                ? {
                    dataUrl: msg.signature.dataUrl || '',
                    timestamp: msg.signature.timestamp ? new Date(msg.signature.timestamp) : new Date(),
                  }
                : undefined,
            };
          });
          setMessages(formattedMessages);
        } else {
          setMessages([]);
        }
      } catch (error: any) {
        console.error('Error loading conversation:', error);
        if (error?.status !== 404) {
          const errorMessage = error?.data?.message || error?.message || 'Failed to load chat messages';
          setError(errorMessage);
          message.error(errorMessage);
        }
        setMessages([]);
      }
    };

    loadConversation();
  }, [assignmentId, submissionId, isActive, hasApproval, hasDisputes, getConversation, setMessages]);

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
    const handleResize = () => {
      if (chatContainerRef.current && !isUserScrolledUp) {
        setTimeout(() => {
          scrollToBottom(false);
        }, 100);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isUserScrolledUp]);

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
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  // Message sending handlers
  const handleSend = async () => {
    console.log('[SubmissionChat] handleSend called');
    if (isSendingMessage) return;
    
    if (!inputValue.trim() && fileList.length === 0) {
      message.warning('Please enter a message or attach a file');
      return;
    }
    
    if (!assignmentId || !submissionId) {
      message.error('Missing required information. Please refresh the page.');
      return;
    }

    const messageText = inputValue.trim();
    if (messageText.length > 5000) {
      message.warning('Message is too long. Please keep it under 5000 characters.');
      return;
    }

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
    setFileList([]);
    setIsSendingMessage(true);

    try {
      // Determine which channel to use based on available channels
      let channelId: string | null = null;
      let channelType: 'approval' | 'dispute' = 'approval';

      if (hasApproval && approvalChannelId) {
        channelId = approvalChannelId;
        channelType = 'approval';
      } else if (hasDisputes && disputeChannelId) {
        channelId = disputeChannelId;
        channelType = 'dispute';
      }

      // Use Socket.IO if channel is available
      if (channelId) {
        if (!socket.isConnected) {
          message.error('Not connected to server. Please wait and try again.');
          optimisticMessagesRef.current.delete(tempMessageId);
          setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
          setInputValue(messageText);
          setIsSendingMessage(false);
          return;
        }

        // Send via Socket.IO
        const localId = tempMessageId;
        pendingMessagesRef.current.set(localId, tempMessageId);
        
        socket.sendMessage(
          channelId,
          messageText,
          {
            action: 'message',
            actionData: { text: messageText },
            localId,
          },
          channelType
        );

        // Set timeout fallback in case MESSAGE_SENT event doesn't arrive
        // This handles cases where socket connection is lost or server doesn't respond
        setTimeout(() => {
          if (pendingMessagesRef.current.has(localId)) {
            console.warn('[SubmissionChat] No confirmation received for message after 5s:', localId);
            // Keep optimistic message - server might still process it
            // The useChatMessages hook will refetch and update
            pendingMessagesRef.current.delete(localId);
          }
        }, 5000);

        setIsSendingMessage(false);
      } else {
        // No channel available - show error
        message.error('Channel not available. Please refresh the page.');
        optimisticMessagesRef.current.delete(tempMessageId);
        setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
        setInputValue(messageText);
        setIsSendingMessage(false);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      optimisticMessagesRef.current.delete(tempMessageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
      const errorMessage = error?.data?.message || error?.message || 'Failed to send message';
      setError(errorMessage);
      message.error(errorMessage);
      setInputValue(messageText);
    } finally {
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

  // Action handlers
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
        text: approvalMessage.trim() || '', // Use comment directly without prefix
        senderId: currentUserId,
        senderName: currentUserName,
        timestamp: new Date(),
        actionType: 'approval',
        approvalStatus: 'approved',
      };
      
      optimisticMessagesRef.current.add(tempApprovalMessageId);
      setMessages((prev) => [...prev, tempApprovalMessage]);

      // Send via Socket.IO
      const localId = tempApprovalMessageId;
      pendingMessagesRef.current.set(localId, tempApprovalMessageId);

      socket.sendMessage(
        approvalChannelId,
        '', // No text for approval action
        {
          action: 'approval:approved',
          actionData: { text: approvalMessage.trim() || undefined },
          localId,
        },
        'approval'
      );

      // Set timeout fallback in case MESSAGE_SENT event doesn't arrive
      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn('[SubmissionChat] No confirmation received for approval after 5s:', localId);
          pendingMessagesRef.current.delete(localId);
        }
      }, 5000);

      // Clear input immediately after sending
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

    if (rejectReason.trim().length > 1000) {
      message.warning('Rejection reason is too long. Please keep it under 1000 characters.');
      return;
    }

    setIsSendingMessage(true);
    setError(null);

    try {
      const tempRejectionMessageId = `temp-rejection-${Date.now()}`;
      const tempRejectionMessage: ChatMessage = {
        id: tempRejectionMessageId,
        text: rejectReason.trim() || '', // Use comment directly without prefix
        senderId: currentUserId,
        senderName: currentUserName,
        timestamp: new Date(),
        actionType: 'approval',
        approvalStatus: 'rejected',
      };
      
      optimisticMessagesRef.current.add(tempRejectionMessageId);
      setMessages((prev) => [...prev, tempRejectionMessage]);

      // Send via Socket.IO
      const localId = tempRejectionMessageId;
      pendingMessagesRef.current.set(localId, tempRejectionMessageId);

      socket.sendMessage(
        approvalChannelId,
        '', // No text for rejection action
        {
          action: 'approval:rejected',
          actionData: { text: rejectReason.trim() || undefined },
          localId,
        },
        'approval'
      );

      // Set timeout fallback in case MESSAGE_SENT event doesn't arrive
      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn('[SubmissionChat] No confirmation received for rejection after 5s:', localId);
          pendingMessagesRef.current.delete(localId);
        }
      }, 5000);

      // Clear input immediately after sending
      setRejectReason('');
      setShowRejectInput(false);
      setIsSendingMessage(false);
    } catch (error: any) {
      console.error('Error sending rejection:', error);
      message.error(error?.message || 'Failed to reject submission');
      setIsSendingMessage(false);
    }
  };

  const handleSendDispute = async () => {
    if (isSendingMessage) return;
    
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

      // Send via Socket.IO
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

      // Set timeout fallback in case MESSAGE_SENT event doesn't arrive
      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn('[SubmissionChat] No confirmation received for dispute after 5s:', localId);
          pendingMessagesRef.current.delete(localId);
        }
      }, 5000);

      // Clear input immediately after sending
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

      // Send via Socket.IO
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

      // Set timeout fallback in case MESSAGE_SENT event doesn't arrive
      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn('[SubmissionChat] No confirmation received for omit signature request after 5s:', localId);
          pendingMessagesRef.current.delete(localId);
        }
      }, 5000);

      // Clear input immediately after sending
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
    
    if (!omitSignatureApproveReason.trim()) {
      message.warning('Please enter a reason for approving omit signature request');
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

      // Send via Socket.IO
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

      // Set timeout fallback in case MESSAGE_SENT event doesn't arrive
      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn('[SubmissionChat] No confirmation received for omit signature approve after 5s:', localId);
          pendingMessagesRef.current.delete(localId);
        }
      }, 5000);

      // Clear input immediately after sending
      setOmitSignatureApproveReason('');
      setShowOmitSignatureApproveInput(false);
      setIsSendingMessage(false);
    } catch (error: any) {
      console.error('Error approving omit signature request:', error);
      message.error(error?.message || 'Failed to approve omit signature request');
      setIsSendingMessage(false);
    }
  };

  const handleSendOmitSignatureReject = async () => {
    if (isSendingMessage) return;
    
    if (!omitSignatureRejectReason.trim()) {
      message.warning('Please enter a reason for rejecting omit signature request');
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

      // Send via Socket.IO
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

      // Set timeout fallback in case MESSAGE_SENT event doesn't arrive
      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn('[SubmissionChat] No confirmation received for omit signature reject after 5s:', localId);
          pendingMessagesRef.current.delete(localId);
        }
      }, 5000);

      // Clear input immediately after sending
      setOmitSignatureRejectReason('');
      setShowOmitSignatureRejectInput(false);
      setIsSendingMessage(false);
    } catch (error: any) {
      console.error('Error rejecting omit signature request:', error);
      message.error(error?.message || 'Failed to reject omit signature request');
      setIsSendingMessage(false);
    }
  };

  const handleSignatureSend = async (signatureDataUrl: string) => {
    if (isSendingMessage) return;
    
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

      // Upload signature file first using upload API
      const uploadedFilePath = await uploadFile(signatureDataUrl);

      // Send via Socket.IO
      const localId = tempMessageId;
      pendingMessagesRef.current.set(localId, tempMessageId);

      socket.sendMessage(
        disputeChannelId,
        '',
        {
          action: 'submission:signature',
          actionData: { file: uploadedFilePath },
          localId,
        },
        'dispute'
      );

      // Set timeout fallback in case MESSAGE_SENT event doesn't arrive
      setTimeout(() => {
        if (pendingMessagesRef.current.has(localId)) {
          console.warn('[SubmissionChat] No confirmation received for signature after 5s:', localId);
          // Keep optimistic message - server might still process it
          // The useChatMessages hook will refetch and update
          pendingMessagesRef.current.delete(localId);
        }
      }, 5000);

      setIsSendingMessage(false);
    } catch (error: any) {
      console.error('Error sending signature:', error);
      optimisticMessagesRef.current.delete(tempMessageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
      const errorMessage = error?.data?.message || error?.message || 'Failed to send signature';
      setError(errorMessage);
      message.error(errorMessage);
      setIsSendingMessage(false);
    }
  };

  const handleRemoveFile = (file: UploadFile) => {
    const newFileList = fileList.filter((f) => f.uid !== file.uid);
    setFileList(newFileList);
  };

  // Custom scrollbar styles
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
        {/* Chat Header */}
        <ChatHeader
          otherUserName={otherUserName}
          hasApproval={hasApproval}
          hasDisputes={hasDisputes}
          formName={formName}
          submissionTitle={submissionTitle}
          isDark={isDark}
          token={token}
        />

        {/* Messages Area */}
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
          {/* Error banner */}
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

          {/* Messages List */}
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

        {/* Suggested Actions & Input Area - Fixed at bottom with Affix */}
        <Affix offsetBottom={0}>
          <div style={{ background: token.colorBgContainer, zIndex: 10 }}>
            {/* Suggested Actions - Only show if any action is available */}
            {(hasApproval || hasDisputes || signatureRequired) && (
              <>
                <SuggestedActions
                  hasApproval={hasApproval}
                  hasDisputes={hasDisputes}
                  omitSignatureAllowed={omitSignatureAllowed}
                  signatureRequired={signatureRequired}
                  showApprovalInput={showApprovalInput}
                  showRejectInput={showRejectInput}
                  showDisputeInput={showDisputeInput}
                  showSignaturePad={showSignaturePad}
                  showOmitSignatureRequestInput={showOmitSignatureRequestInput}
                  showOmitSignatureApproveInput={showOmitSignatureApproveInput}
                  showOmitSignatureRejectInput={showOmitSignatureRejectInput}
                  onToggleApproval={() => {
                    setShowApprovalInput(!showApprovalInput);
                    setShowRejectInput(false);
                  }}
                  onToggleReject={() => {
                    setShowRejectInput(!showRejectInput);
                    setShowApprovalInput(false);
                  }}
                  onToggleDispute={() => {
                    setShowDisputeInput(!showDisputeInput);
                  }}
                  onToggleSignature={() => {
                    setShowSignaturePad(!showSignaturePad);
                  }}
                  onToggleOmitSignatureRequest={() => {
                    setShowOmitSignatureRequestInput(!showOmitSignatureRequestInput);
                    setShowOmitSignatureApproveInput(false);
                    setShowOmitSignatureRejectInput(false);
                  }}
                  onToggleOmitSignatureApprove={() => {
                    setShowOmitSignatureApproveInput(!showOmitSignatureApproveInput);
                    setShowOmitSignatureRequestInput(false);
                    setShowOmitSignatureRejectInput(false);
                  }}
                  onToggleOmitSignatureReject={() => {
                    setShowOmitSignatureRejectInput(!showOmitSignatureRejectInput);
                    setShowOmitSignatureRequestInput(false);
                    setShowOmitSignatureApproveInput(false);
                  }}
                  isDark={isDark}
                  token={token}
                  isApprover={isApprover || false}
                  isAssignee={isAssignee || false}
                  isSubject={isSubject || false}
                  isOmitSignatureApprover={isOmitSignatureApprover || false}
                />

                {/* Action Inputs */}
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
                  onOmitSignatureRequestReasonChange={setOmitSignatureRequestReason}
                  onOmitSignatureRequestClose={() => {
                    setShowOmitSignatureRequestInput(false);
                    setOmitSignatureRequestReason('');
                  }}
                  onOmitSignatureRequestSend={handleSendOmitSignatureRequest}
                  showOmitSignatureApproveInput={showOmitSignatureApproveInput}
                  omitSignatureApproveReason={omitSignatureApproveReason}
                  onOmitSignatureApproveReasonChange={setOmitSignatureApproveReason}
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
                  hasApproval={hasApproval}
                  hasDisputes={hasDisputes}
                  isSending={isSendingMessage}
                  isDark={isDark}
                  token={token}
                  isApprover={isApprover || false}
                  isAssignee={isAssignee || false}
                  isSubject={isSubject || false}
                  isOmitSignatureApprover={isOmitSignatureApprover || false}
                />
              </>
            )}

            {/* Signature Pad */}
            <SignaturePadComponent
              visible={showSignaturePad && signatureRequired}
              onClose={() => setShowSignaturePad(false)}
              onSend={handleSignatureSend}
              isSending={isSendingMessage}
              isDark={isDark}
              token={token}
            />

            {/* Chat Input Area */}
            <ChatInputArea
              inputValue={inputValue}
              onInputChange={(value) => {
                setInputValue(value);
                setError(null);
              }}
              onSend={handleSend}
              fileList={fileList}
              onRemoveFile={handleRemoveFile}
              hasApproval={hasApproval}
              hasDisputes={hasDisputes}
              isSending={isSendingMessage}
              isDark={isDark}
              token={token}
              inputRef={inputRef}
              onKeyPress={handleKeyPress}
            />
          </div>
        </Affix>
      </div>
    </>
  );
};

