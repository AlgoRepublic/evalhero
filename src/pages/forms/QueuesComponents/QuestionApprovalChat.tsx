/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Input,
  Button,
  Space,
  Typography,
  Empty,
  Tag,
  message as antMessage,
} from 'antd';
import { AssetAvatar } from '../../../components';
import { SendOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import { useSocket } from '../../../context/SocketContext';
import { RichTextRenderer } from './RichTextRenderer';
import { RankingAnswerRenderer } from './RankingAnswerRenderer';
import { RatingAnswerRenderer } from './RatingAnswerRenderer';
import { DateAnswerRenderer } from './DateAnswerRenderer';
import { AddressAnswerRenderer } from './AddressAnswerRenderer';
import type { JSONContent } from '@tiptap/core';
import { ApprovalStatus } from '../../../types';

const { Text, Paragraph } = Typography;

interface QuestionApprovalMessage {
  _id: string;
  questionId: string;
  assignmentId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  actionType?: 'request' | 'approve' | 'reject';
  action?: 'approval:requested' | 'approval:approved' | 'approval:rejected' | 'message';
  /** True when this approval was sent by auto-approval (pre-approval); from actionData.isAutoApproval */
  isAutoApproval?: boolean;
  timestamp: Date;
  meta?: {
    questionData?: {
      questionValue?: any;
      answerData?: {
        groupData?: {
          groupValue?: any;
        };
        ungroupedData?: {
          subjectValue?: any;
        };
        textValue?: string;
        numberValue?: number;
        dateValue?: string;
        dateTimeValue?: string;
        selectedOption?: any;
        selectedOptions?: any[];
        ratingValue?: number;
        sliderValue?: number;
        htmlContent?: string;
        addressData?: any;
        [key: string]: any;
      };
      [key: string]: any;
    };
    [key: string]: any;
  };
}

interface QuestionApprovalChatProps {
  questionId: string;
  assignmentId: string;
  currentUserId: string;
  currentUserName: string;
  approvers: Array<{ _id: string; name: string }>;
  approvalStatus?: ApprovalStatus;
  onApprovalAction?: (action: 'approve' | 'reject', message?: string) => void;
  onRequestApproval?: () => void;
  questionConversationId?: string;
  initialMessages?: any[];
  onRefreshConversation?: () => void;
  questionKey: string;
  subjects: string[];
  questionLabel?: string;
  formName?: string;
  meta?: {
    type?: 'group' | 'ungrouped';
    subjectId?: string[];
    subjectName?: string;
    groupId?: string;
    groupName?: string;
    [key: string]: any;
  };
  questionData?: {
    questionId?: string;
    questionName?: string;
    questionType?: string;
    questionLabel?: string;
    questionValue?: any;
    answerData?: {
      // Common fields
      required?: boolean;
      enableGrouping?: boolean;
      nodeGroups?: any[];
      // Group/Ungrouped specific data
      groupData?: {
        groupId?: string;
        groupName?: string;
        groupValue?: any;
        allGroupValues?: Record<string, any>;
      };
      ungroupedData?: {
        subjectId?: string;
        subjectIds?: string[];
        subjectName?: string;
        subjectValue?: any;
        subjectValues?: Record<string, any>;
        allGroupValues?: Record<string, any>;
      };
      // Node-type-specific fields (will vary by type)
      [key: string]: any;
    };
  };
  questionApprovalStatus?: ApprovalStatus;
}

export const QuestionApprovalChat: React.FC<QuestionApprovalChatProps> = ({
  questionId,
  assignmentId,
  currentUserId,
  // currentUserName, // Reserved for future use
  approvers,
  approvalStatus, // Legacy prop - kept for backward compatibility
  questionApprovalStatus, // Preferred prop from channel API response
  onApprovalAction,
  onRequestApproval,
  questionConversationId,
  initialMessages = [],
  onRefreshConversation,
  // questionKey, // Reserved for future use
  subjects,
  // questionLabel, // Reserved for future use
  // formName, // Reserved for future use
  meta,
  questionData,
}) => {
  const { token } = theme.useToken();
  const socket = useSocket();
  const [messages, setMessages] = useState<QuestionApprovalMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if current user is an approver
  const isApprover = approvers.some(approver => approver._id === currentUserId);

  // Check if a request has been sent (look for approval:request action in messages)
  // const hasRequestBeenSent = useMemo(() => {
  //   return messages.some((msg) => 
  //     msg.action === 'approval:request' || msg.actionType === 'request'
  //   );
  // }, [messages]);

  // Determine if send request button should be disabled
  // Disable if:
  // 1. Request has not been sent yet AND status is not rejected (can't request if not requested and not rejected)
  // 2. Status is pending (already requested, waiting for approval)
  // 3. Status is approved (already approved, no need to request again)
  // const canRequestApproval = useMemo(() => {
  //   // If approved, can't request again
  //   console.log('approvalStatus', approvalStatus);
  //   if (approvalStatus === 'approved') {
  //     return false;
  //   }
  //   // If pending, can't request again (already requested)
  //   if (approvalStatus === 'pending') {
  //     return false;
  //   }
  //   // If rejected, can re-request
  //   if (approvalStatus === 'rejected') {
  //     return true;
  //   }
  //   // If no status and no request sent, can request
  //   if (!approvalStatus && !hasRequestBeenSent) {
  //     return true;
  //   }
  //   // If no status but request was sent, can't request again
  //   if (!approvalStatus && hasRequestBeenSent) {
  //     return false;
  //   }
  //   return true;
  // }, [approvalStatus, hasRequestBeenSent]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Function to get latest approval status from messages
  const getLatestApprovalStatusFromMessages = useCallback((messages: QuestionApprovalMessage[]): 'requested' | 'approved' | 'rejected' | null => {
    if (!messages || messages.length === 0) {
      return null;
    }
    
    // Filter messages with approval actions and sort by timestamp (newest first)
    // Support both old format (approval:request, approval:approve, approval:reject) and new format (approval:requested, approval:approved, approval:rejected)
    const approvalMessages = messages
      .filter((msg) => {
        const action = msg.action;
        return action === 'approval:requested' ||
               action === 'approval:approved' ||
               action === 'approval:rejected';
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Newest first

    if (approvalMessages.length === 0) {
      return null;
    }
    
    // Get the latest message with an approval action
    const latestMessage = approvalMessages[0];
    const action = latestMessage.action;
    
    // Map action to status (support both old and new formats)
    if (action === 'approval:approved') {
      return 'approved';
    } else if (action === 'approval:rejected') {
      return 'rejected';
    } else if (action === 'approval:requested') {
      return 'requested';
    }
    
    return null;
  }, []);

  // Get effective approval status - prioritize status from messages (most up-to-date), then questionApprovalStatus, then fallback to approvalStatus
  const effectiveApprovalStatus = useMemo(() => {
    const statusFromMessages = getLatestApprovalStatusFromMessages(messages);
    // Priority: messages > questionApprovalStatus (from channel API) > approvalStatus (legacy)
    return statusFromMessages !== null 
      ? statusFromMessages 
      : (questionApprovalStatus || approvalStatus || null);
  }, [messages, questionApprovalStatus, approvalStatus, getLatestApprovalStatusFromMessages]);

  // Initialize messages from initialMessages prop
  useEffect(() => {
    if (initialMessages && Array.isArray(initialMessages) && initialMessages.length > 0) {
      const formattedMessages: QuestionApprovalMessage[] = initialMessages.map((msg) => {
        // CRITICAL: Only use message-specific meta - don't fallback to conversation-level meta
        // This ensures each approval:requested message shows its own answer from when it was sent
        // Each message should have its own meta.questionData.answerData from the API
        const messageMeta = (msg as any).meta;
        
        // Debug: Log meta for approval:requested messages to verify each has its own
        if (msg.action === 'approval:requested' && messageMeta?.questionData?.answerData) {
          console.log('[QuestionApprovalChat] Message meta for approval:requested:', {
            messageId: msg._id,
            hasMeta: !!messageMeta,
            hasQuestionData: !!messageMeta.questionData,
            hasAnswerData: !!messageMeta.questionData.answerData,
            answerValue: messageMeta.questionData.answerData.ungroupedData?.subjectValue || 
                        messageMeta.questionData.answerData.groupData?.groupValue ||
                        messageMeta.questionData.answerData.textValue ||
                        messageMeta.questionData.questionValue,
          });
        }
        // Determine actionType from action field (support both old and new formats)
        let actionType: 'request' | 'approve' | 'reject' | undefined;
        if (msg.action === 'approval:requested') {
          actionType = 'request';
        } else if (msg.action === 'approval:approved') {
          actionType = 'approve';
        } else if (msg.action === 'approval:rejected') {
          actionType = 'reject';
        } else {
          // Fallback to existing actionType if action doesn't match
          actionType = msg.actionType as 'request' | 'approve' | 'reject' | undefined;
        }
        
        // Extract sender name
        const senderName = msg.sentBy?.user?.name || (msg.sentBy as any)?.name || 'Unknown';
        
        // Extract text based on action type - match format from chatApi.ts (support both old and new formats)
        let text = '';
        if (msg.action === 'approval:approved') {
          const comment = msg.actionData?.comment || msg.actionData?.text;
          text = comment || '';
        } else if (msg.action === 'approval:rejected') {
          // Generate user-friendly rejection message (same format as chatApi.ts)
          const comment = msg.actionData?.comment || msg.actionData?.text;
          if (comment) {
            text = `${senderName} rejected: ${comment}`;
          } else {
            text = `${senderName} rejected`;
          }
        } else if (msg.action === 'approval:requested') {
          // Generate user-friendly approval request message (same format as chatApi.ts)
          const comment = msg.actionData?.comment || msg.actionData?.text;
          if (comment) {
            text = `${senderName} requested approval with comment: ${comment}`;
          } else {
            text = `${senderName} requested approval`;
          }
        } else {
          // For regular messages, use text from actionData
          text = msg.actionData?.text || msg.text || '';
        }
        
        return {
          _id: msg._id || Date.now().toString(),
          questionId,
          assignmentId,
          senderId: msg.sentBy?._id || msg.sentBy?.user?._id || '',
          senderName,
          senderAvatar: msg.sentBy?.user?.avatar,
          text,
          actionType,
          isAutoApproval: msg.actionData?.isAutoApproval === true,
          timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
          action: msg.action, // Store original action for rendering
          meta: messageMeta, // CRITICAL: Only use message-specific meta - each message has its own answer data
        };
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()); // Sort by timestamp for proper grouping
      setMessages(formattedMessages);
    } else {
      // Clear messages if initialMessages is empty or undefined
      setMessages([]);
    }
  }, [initialMessages, questionId, assignmentId]); // Removed 'meta' from deps since we only use message-specific meta

  // Memoized fetch function
  // const fetchMessages = useCallback(async () => {
  //   if (onRefreshConversation) {
  //     try {
  //       setLoading(true);
  //       onRefreshConversation();
  //       // Note: Status update will happen in the parent component (QuestionApprovalDrawer)
  //       // when it receives the updated messages via initialMessages prop
  //     } catch (error) {
  //       console.error('Failed to fetch messages:', error);
  //     } finally {
  //       setLoading(false);
  //     }
  //   }
  // }, [onRefreshConversation]);

  // Note: The parent component (QuestionApprovalDrawer) handles updating node attributes
  // when it receives updated messages via initialMessages prop and refreshConversation callback
  // The effectiveApprovalStatus computed above provides the current status for display purposes

  // Poll for updates (parent handles initial fetch)
  // useEffect(() => {
  //   if (onRefreshConversation) {
  //     // Don't fetch on mount - parent (QuestionApprovalDrawer) already fetches when drawer opens
  //     // Only poll every 15 seconds to check for new approval actions
  //     const interval = setInterval(fetchMessages, 15000);
  //     return () => clearInterval(interval);
  //   }
  //   // Note: We only depend on onRefreshConversation, not fetchMessages, to prevent infinite loops
  //   // fetchMessages is stable because onRefreshConversation is stable
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [onRefreshConversation]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setSending(true);
      
      // Ensure subjects is always an array
      let subjectsArray = Array.isArray(subjects) ? subjects : [subjects].filter(Boolean);
      
      // Collect all relevant subjects from both groupData and ungroupedData
      if (questionData?.answerData) {
        const allSubjectIds = new Set<string>(subjectsArray);
        
        // Add subjects from groupData if present
        if (questionData.answerData.groupData) {
          // If groupData has subjectIds (from the group context), add them
          if (meta?.subjectId) {
            const metaSubjectIds = Array.isArray(meta.subjectId) ? meta.subjectId : [meta.subjectId].filter(Boolean);
            metaSubjectIds.forEach((id: string) => allSubjectIds.add(id));
          }
        }
        
        // Add subjects from ungroupedData if present
        if (questionData.answerData.ungroupedData) {
          const ungroupedData = questionData.answerData.ungroupedData as any;
          if (ungroupedData.subjectId) {
            allSubjectIds.add(ungroupedData.subjectId);
          }
          if (ungroupedData.subjectIds && Array.isArray(ungroupedData.subjectIds)) {
            ungroupedData.subjectIds.forEach((id: string) => allSubjectIds.add(id));
          }
        }
        
        subjectsArray = Array.from(allSubjectIds);
      }
      
      // Send message via socket.io
      // Note: questionKey (which includes node ID) is used to ensure messages are correctly associated
      // with the right question/node. The questionKey is generated from node ID + group/subject ID,
      // ensuring uniqueness and persistence across operations.
      if (!questionConversationId) {
        antMessage.error('Channel not available. Please try again.');
        setSending(false);
        return;
      }

      socket.sendMessage(
        questionConversationId,
        newMessage,
        {
          action: 'message',
          actionData: {
            text: newMessage,
          },
        },
        'question_approval'
      );

      setNewMessage('');
      // antMessage.success('Message sent');
      // Refresh conversation to get updated messages (socket.io will also trigger refetch)
      if (onRefreshConversation) {
        setTimeout(() => {
          onRefreshConversation();
        }, 500); // Small delay to allow socket.io to process
      }
      setSending(false);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      antMessage.error('Failed to send message');
      setSending(false);
    }
  };

  const handleApprove = async () => {
    try {
      if (!questionConversationId) {
        antMessage.error('Channel not available. Please try again.');
        return;
      }

      // Send approval via socket.io
      socket.sendMessage(
        questionConversationId,
        '',
        {
          action: 'approval:approved',
          actionData: {
            text: newMessage,
          },
        },
        'question_approval'
      );

      onApprovalAction?.('approve', newMessage);
      setNewMessage('');
      // antMessage.success('Question approved');
      
      // Refresh conversation to get updated messages
      // if (onRefreshConversation) {
      //   setTimeout(() => {
      //     onRefreshConversation();
      //   }, 500);
      // }
    } catch (error) {
      console.error('Failed to approve:', error);
      antMessage.error('Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!newMessage.trim()) {
      antMessage.warning('Please provide a rejection message');
      return;
    }

    try {
      if (!questionConversationId) {
        antMessage.error('Channel not available. Please try again.');
        return;
      }

      // Send rejection via socket.io
      socket.sendMessage(
        questionConversationId,
        newMessage,
        {
          action: 'approval:rejected',
          actionData: {
            text: newMessage,
          },
        },
        'question_approval'
      );

      onApprovalAction?.('reject', newMessage);
      setNewMessage('');
      // antMessage.success('Question rejected');
      
      // Refresh conversation to get updated messages
      // if (onRefreshConversation) {
      //   setTimeout(() => {
      //     onRefreshConversation();
      //   }, 500);
      // }
    } catch (error) {
      console.error('Failed to reject:', error);
      antMessage.error('Failed to reject');
    }
  };

  const handleRequestApproval = async () => {
    if (!onRequestApproval) return;
    
    try {
      setRequesting(true);
      
      // Prepare actionData with optional text from message input
      const actionData: {
        text?: string;
      } = {};
      
      // Add optional text from message input if provided
      if (newMessage.trim()) {
        actionData.text = newMessage.trim();
      }
      
      // Ensure subjects is always an array
      let subjectsArray = Array.isArray(subjects) ? subjects : [subjects].filter(Boolean);

      // Collect all relevant subjects from both groupData and ungroupedData
      if (questionData?.answerData) {
        const allSubjectIds = new Set<string>(subjectsArray);
        
        // Add subjects from groupData if present
        if (questionData.answerData.groupData) {
          // If groupData has subjectIds (from the group context), add them
          if (meta?.subjectId) {
            const metaSubjectIds = Array.isArray(meta.subjectId) ? meta.subjectId : [meta.subjectId].filter(Boolean);
            metaSubjectIds.forEach((id: string) => allSubjectIds.add(id));
          }
        }
        
        // Add subjects from ungroupedData if present
        if (questionData.answerData.ungroupedData) {
          const ungroupedData = questionData.answerData.ungroupedData as any;
          if (ungroupedData.subjectId) {
            allSubjectIds.add(ungroupedData.subjectId);
          }
          if (ungroupedData.subjectIds && Array.isArray(ungroupedData.subjectIds)) {
            ungroupedData.subjectIds.forEach((id: string) => allSubjectIds.add(id));
          }
        }
        
        subjectsArray = Array.from(allSubjectIds);
      }
      
      // Ensure meta.subjectId is always an array
      // const metaSubjectIds = meta?.subjectId 
      //   ? (Array.isArray(meta.subjectId) ? meta.subjectId : [meta.subjectId].filter(Boolean))
      //   : subjectsArray;
      
      // Prepare meta object with complete question/answer data including all filled details
      // CRITICAL: Always use questionKey (which includes node ID) for questionId
      // This ensures socket.io messages are correctly associated with the right question/node
      // const metaWithQuestionData = {
      //   ...meta,
      //   subjectId: metaSubjectIds as string[],
      //   ...(questionData && {
      //     questionData: {
      //       // CRITICAL: Prioritize questionKey (includes node ID) over questionData.questionId
      //       // The questionKey is generated from node ID + group/subject ID, ensuring uniqueness
      //       questionId: questionKey || questionData.questionId,
      //       questionName: questionData.questionName || questionLabel || '',
      //       questionType: questionData.questionType || '',
      //       questionLabel: questionData.questionLabel || questionLabel || '',
      //       questionValue: questionData.questionValue,
      //       // Include complete answerData with all node-type-specific details and group data
      //       // This now includes both groupData and ungroupedData for persistence
      //       answerData: questionData.answerData,
      //     },
      //   }),
      // };
      
      console.log('handleRequestApproval - subjectsArray:', subjectsArray);
      console.log('handleRequestApproval - meta:', meta);
      
      // Send approval request via socket.io
      if (!questionConversationId) {
        antMessage.error('Channel not available. Please try again.');
        setRequesting(false);
        return;
      }

      socket.sendMessage(
        questionConversationId,
        actionData.text || '',
        {
          action: 'approval:requested',
          actionData: actionData.text ? { text: actionData.text } : {},
          meta: meta, // Include question metadata with answer details
        },
        'question_approval'
      );

      onRequestApproval();
      // antMessage.success('Approval request sent');
      // Clear message input after successful send
      setNewMessage('');
      // Refresh conversation to get updated messages (socket.io will also trigger refetch)
      if (onRefreshConversation) {
        setTimeout(() => {
          onRefreshConversation();
        }, 500); // Small delay to allow socket.io to process
      }
      setRequesting(false);
    } catch (error: any) {
      console.error('Failed to request approval:', error);
      antMessage.error('Failed to send approval request');
      setRequesting(false);
    }
  };

  const formatTime = (date: Date) => {
    try {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return date.toLocaleTimeString();
    }
  };

  const getMessageColor = (senderId: string) => {
    return senderId === currentUserId ? token.colorPrimary : token.colorTextSecondary;
  };

  // Helper function to extract answer value from message meta/questionData
  // Returns string for simple types, JSONContent for rich text, ranking/rating/date/address data object, or null
  // CRITICAL: Only uses message-specific meta to ensure each message shows its own answer
  const getAnswerValue = (msg: QuestionApprovalMessage): string | JSONContent | { type: 'ranking'; order: any[]; options: any[] } | { type: 'rating'; ratingValue: number; maxRating?: number; ratingLabels?: string[]; variant?: string; allowHalf?: boolean } | { type: 'date'; dateValue: string; format?: string } | { type: 'dateTime'; dateValue: string; format?: string } | { type: 'address'; addressData: any } | null => {
    // CRITICAL: Only use message-specific meta - don't fallback to conversation-level meta or current questionData
    // This ensures each approval:requested message shows its own answer from when it was sent
    const questionDataToUse = msg.meta?.questionData;
    
    if (!questionDataToUse) return null;

    const answerData = questionDataToUse.answerData;
    const questionType = questionDataToUse.questionType;
    
    // Try to get value from answerData first (preferred - has structured data)
    if (answerData) {
      // Check for ranking answer first (before converting to string)
      if (questionType === 'ranking' && answerData.order !== undefined && answerData.order !== null && Array.isArray(answerData.order)) {
        return {
          type: 'ranking' as const,
          order: answerData.order,
          options: answerData.options || [],
        };
      }
      // Check for grouped value
      if (answerData.groupData?.groupValue !== undefined && answerData.groupData.groupValue !== null && answerData.groupData.groupValue !== '') {
        // For single choice, check if groupValue is a selectedOption object
        if (questionType === 'singleChoice' && typeof answerData.groupData.groupValue === 'object' && answerData.groupData.groupValue !== null && (answerData.groupData.groupValue as any).label) {
          return answerData.groupData.groupValue;
        }
        // Also check if selectedOption exists in groupData directly
        const groupDataAny = answerData.groupData as any;
        if (questionType === 'singleChoice' && groupDataAny.selectedOption && typeof groupDataAny.selectedOption === 'object' && groupDataAny.selectedOption !== null && groupDataAny.selectedOption.label) {
          return groupDataAny.selectedOption;
        }
        // Don't convert ranking to string
        if (questionType === 'ranking' && Array.isArray(answerData.groupData.groupValue)) {
          return {
            type: 'ranking' as const,
            order: answerData.groupData.groupValue,
            options: answerData.options || [],
          };
        }
        // Don't convert rating to string
        if (questionType === 'ratingField' && (typeof answerData.groupData.groupValue === 'number' || typeof answerData.groupData.groupValue === 'string')) {
          // Parse string values to numbers/booleans
          const ratingValue = typeof answerData.groupData.groupValue === 'string' 
            ? parseFloat(answerData.groupData.groupValue) 
            : answerData.groupData.groupValue;
          const maxRating = answerData.maxRating 
            ? (typeof answerData.maxRating === 'string' ? parseInt(answerData.maxRating, 10) : answerData.maxRating)
            : 5;
          const allowHalf = answerData.allowHalf 
            ? (typeof answerData.allowHalf === 'string' ? answerData.allowHalf === 'true' : answerData.allowHalf)
            : false;
          
          // Parse ratingLabels if it's a string
          let ratingLabels = answerData.ratingLabels;
          if (typeof ratingLabels === 'string') {
            try {
              ratingLabels = JSON.parse(ratingLabels);
            } catch {
              // If parsing fails, treat as comma-separated string
              ratingLabels = ratingLabels.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
          }
          
          return {
            type: 'rating' as const,
            ratingValue: ratingValue,
            maxRating: maxRating,
            ratingLabels: Array.isArray(ratingLabels) ? ratingLabels : undefined,
            variant: answerData.ratingVariant as 'stars' | 'anchors' | 'emoji' | undefined,
            allowHalf: allowHalf,
          };
        }
        // Don't convert date to string
        if (questionType === 'dateField' && answerData.groupData.groupValue) {
          return {
            type: 'date' as const,
            dateValue: String(answerData.groupData.groupValue),
            format: answerData.format,
          };
        }
        // Don't convert dateTime to string
        if (questionType === 'dateTimeField' && answerData.groupData.groupValue) {
          return {
            type: 'dateTime' as const,
            dateValue: String(answerData.groupData.groupValue),
            format: answerData.format,
          };
        }
        // Don't convert address to string
        if ((questionType === 'addressField' || questionType === 'addressNode') && answerData.groupData.groupValue) {
          // If groupValue is already an object, use it; otherwise try to parse it
          const addressValue = typeof answerData.groupData.groupValue === 'object' 
            ? answerData.groupData.groupValue 
            : (typeof answerData.groupData.groupValue === 'string' ? JSON.parse(answerData.groupData.groupValue) : answerData.groupData.groupValue);
          return {
            type: 'address' as const,
            addressData: addressValue,
          };
        }
        return String(answerData.groupData.groupValue);
      }
      // Check for ungrouped value
      if (answerData.ungroupedData?.subjectValue !== undefined && answerData.ungroupedData.subjectValue !== null && answerData.ungroupedData.subjectValue !== '') {
        // For single choice, check if subjectValue is a selectedOption object
        if (questionType === 'singleChoice' && typeof answerData.ungroupedData.subjectValue === 'object' && answerData.ungroupedData.subjectValue !== null && (answerData.ungroupedData.subjectValue as any).label) {
          return answerData.ungroupedData.subjectValue;
        }
        // Also check if selectedOption exists in ungroupedData directly
        const ungroupedDataAny = answerData.ungroupedData as any;
        if (questionType === 'singleChoice' && ungroupedDataAny.selectedOption && typeof ungroupedDataAny.selectedOption === 'object' && ungroupedDataAny.selectedOption !== null && ungroupedDataAny.selectedOption.label) {
          return ungroupedDataAny.selectedOption;
        }
        // Don't convert ranking to string
        if (questionType === 'ranking' && Array.isArray(answerData.ungroupedData.subjectValue)) {
          return {
            type: 'ranking' as const,
            order: answerData.ungroupedData.subjectValue,
            options: answerData.options || [],
          };
        }
        // Don't convert rating to string
        if (questionType === 'ratingField' && (typeof answerData.ungroupedData.subjectValue === 'number' || typeof answerData.ungroupedData.subjectValue === 'string')) {
          // Parse string values to numbers/booleans
          const ratingValue = typeof answerData.ungroupedData.subjectValue === 'string' 
            ? parseFloat(answerData.ungroupedData.subjectValue) 
            : answerData.ungroupedData.subjectValue;
          const maxRating = answerData.maxRating 
            ? (typeof answerData.maxRating === 'string' ? parseInt(answerData.maxRating, 10) : answerData.maxRating)
            : 5;
          const allowHalf = answerData.allowHalf 
            ? (typeof answerData.allowHalf === 'string' ? answerData.allowHalf === 'true' : answerData.allowHalf)
            : false;
          
          // Parse ratingLabels if it's a string
          let ratingLabels = answerData.ratingLabels;
          if (typeof ratingLabels === 'string') {
            try {
              ratingLabels = JSON.parse(ratingLabels);
            } catch {
              // If parsing fails, treat as comma-separated string
              ratingLabels = ratingLabels.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
          }
          
          return {
            type: 'rating' as const,
            ratingValue: ratingValue,
            maxRating: maxRating,
            ratingLabels: Array.isArray(ratingLabels) ? ratingLabels : undefined,
            variant: answerData.ratingVariant as 'stars' | 'anchors' | 'emoji' | undefined,
            allowHalf: allowHalf,
          };
        }
        // Don't convert date to string
        if (questionType === 'dateField' && answerData.ungroupedData.subjectValue) {
          return {
            type: 'date' as const,
            dateValue: String(answerData.ungroupedData.subjectValue),
            format: answerData.format,
          };
        }
        // Don't convert dateTime to string
        if (questionType === 'dateTimeField' && answerData.ungroupedData.subjectValue) {
          return {
            type: 'dateTime' as const,
            dateValue: String(answerData.ungroupedData.subjectValue),
            format: answerData.format,
          };
        }
        // Don't convert address to string
        if ((questionType === 'addressField' || questionType === 'addressNode') && answerData.ungroupedData.subjectValue) {
          // If subjectValue is already an object, use it; otherwise try to parse it
          const addressValue = typeof answerData.ungroupedData.subjectValue === 'object' 
            ? answerData.ungroupedData.subjectValue 
            : (typeof answerData.ungroupedData.subjectValue === 'string' ? JSON.parse(answerData.ungroupedData.subjectValue) : answerData.ungroupedData.subjectValue);
          return {
            type: 'address' as const,
            addressData: addressValue,
          };
        }
        return String(answerData.ungroupedData.subjectValue);
      }
      // Check for type-specific values
      if (answerData.textValue !== undefined && answerData.textValue !== null && answerData.textValue !== '') {
        return String(answerData.textValue);
      }
      if (answerData.numberValue !== undefined && answerData.numberValue !== null) {
        return String(answerData.numberValue);
      }
      if (answerData.dateValue !== undefined && answerData.dateValue !== null && answerData.dateValue !== '') {
        return {
          type: 'date' as const,
          dateValue: String(answerData.dateValue),
          format: answerData.format,
        };
      }
      if (answerData.dateTimeValue !== undefined && answerData.dateTimeValue !== null && answerData.dateTimeValue !== '') {
        return {
          type: 'dateTime' as const,
          dateValue: String(answerData.dateTimeValue),
          format: answerData.format,
        };
      }
      // Check for selectedOption object (new format with full option details)
      if (answerData.selectedOption !== undefined && answerData.selectedOption !== null) {
        // If it's an object with label property, return it as-is for proper rendering
        if (typeof answerData.selectedOption === 'object' && answerData.selectedOption !== null && answerData.selectedOption.label) {
          return answerData.selectedOption;
        }
        // Otherwise, convert to string for backward compatibility
        if (answerData.selectedOption !== '') {
          return String(answerData.selectedOption);
        }
      }
      if (answerData.selectedOptions && Array.isArray(answerData.selectedOptions) && answerData.selectedOptions.length > 0) {
        return answerData.selectedOptions.join(', ');
      }
      if (answerData.ratingValue !== undefined && answerData.ratingValue !== null) {
        return String(answerData.ratingValue);
      }
      if (answerData.sliderValue !== undefined && answerData.sliderValue !== null) {
        return String(answerData.sliderValue);
      }
      // Check for jsonContent (new approach - stored directly as JSONContent)
      if (answerData.jsonContent !== undefined && answerData.jsonContent !== null) {
        const jsonContent = answerData.jsonContent;
        // If it's already a JSONContent object, return it
        if (typeof jsonContent === 'object' && jsonContent !== null && (jsonContent as any).type === 'doc') {
          return jsonContent as JSONContent;
        }
        // If it's a string, try to parse it
        if (typeof jsonContent === 'string') {
          try {
            const parsed = JSON.parse(jsonContent);
            if (parsed && parsed.type === 'doc') {
              return parsed as JSONContent;
            }
          } catch {
            // Not JSON, treat as HTML string
            return jsonContent;
          }
        }
        return jsonContent as any;
      }
      // Fallback to htmlContent for backward compatibility
      if (answerData.htmlContent !== undefined && answerData.htmlContent !== null && answerData.htmlContent !== '') {
        const htmlContent = answerData.htmlContent;
        // Check if it's a JSONContent object
        if (typeof htmlContent === 'object' && htmlContent !== null && (htmlContent as any).type === 'doc') {
          return htmlContent as JSONContent;
        }
        // Check if it's a stringified JSONContent
        if (typeof htmlContent === 'string' && htmlContent.trim().startsWith('{')) {
          try {
            const jsonContent = JSON.parse(htmlContent);
            if (jsonContent && jsonContent.type === 'doc') {
              return jsonContent as JSONContent;
            }
          } catch {
            // Not JSON, treat as HTML string
            return htmlContent;
          }
        }
        // Return HTML content as-is if it's already HTML
        return htmlContent;
      }
      if (answerData.addressData) {
        return {
          type: 'address' as const,
          addressData: answerData.addressData,
        };
      }
    }
    
    // Fallback to questionValue
    if (questionDataToUse.questionValue !== undefined && questionDataToUse.questionValue !== null && questionDataToUse.questionValue !== '') {
      return String(questionDataToUse.questionValue);
    }
    
    return null;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: token.colorBgContainer,
      }}
    >
      {/* Messages Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          background: token.colorBgLayout,
          minHeight: 300,
          maxHeight: 400,
        }}
      >
        {messages.length === 0 && initialMessages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            {/* <Spin /> */}
          </div>
        ) : messages.length === 0 ? (
          <Empty
            description="No messages yet"
            style={{ marginTop: 32 }}
          />
        ) : (
          <div>
            {messages.map((msg, index) => {
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const showAvatar =
                !prevMessage ||
                prevMessage.senderId !== msg.senderId ||
                // msg.senderAvatar !== prevMessage.senderAvatar ||
                (msg.timestamp && prevMessage.timestamp &&
                  new Date(msg.timestamp).getTime() -
                    new Date(prevMessage.timestamp).getTime() >
                    300000); // 5 minutes

              const isCurrentUser = msg.senderId === currentUserId;
              
              // Reduce spacing for grouped messages (same sender, within 5 minutes)
              const isGrouped = !showAvatar;
              const messageSpacing = isGrouped ? '4px' : '16px';

              return (
                <div
                  key={msg._id}
                  style={{
                    marginBottom: messageSpacing,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  {showAvatar && (
                    <AssetAvatar
                      avatarKey={msg.senderAvatar}
                      size={32}
                      fallback={msg.senderName.charAt(0).toUpperCase()}
                      style={{
                        backgroundColor: getMessageColor(msg.senderId),
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {!showAvatar && <div style={{ width: '32px', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {showAvatar && (
                      <div style={{ marginBottom: '4px' }}>
                        <Text strong style={{ fontSize: '13px' }}>
                          {isCurrentUser ? 'You' : msg.senderName}
                        </Text>
                        <Text type="secondary" style={{ fontSize: '11px', marginLeft: '8px' }}>
                          {formatTime(msg.timestamp)}
                        </Text>
                      </div>
                    )}
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: isCurrentUser 
                          ? token.colorPrimaryBg 
                          : token.colorBgLayout,
                        border: `1px solid ${token.colorBorder}`,
                      }}
                    >
                      {(msg.action === 'approval:requested') ? (
                        <div>
                          <div style={{ 
                            marginBottom: msg.text ? '8px' : '0px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 8px',
                            background: token.colorWarningBg || '#fff7e6',
                            borderRadius: '4px',
                            border: `1px solid ${token.colorWarningBorder || token.colorWarning || '#faad14'}`
                          }}>
                            <ClockCircleOutlined style={{ 
                              marginRight: '6px', 
                              color: token.colorWarning,
                              fontSize: '14px'
                            }} />
                            <Text type="warning" strong style={{ fontSize: '13px' }}>
                              Approval Request
                            </Text>
                          </div>
                          {msg.text && (
                            <div style={{ marginTop: '8px', marginBottom: '0px' }}>
                              <Text style={{ fontSize: '14px', lineHeight: '1.5', color: token.colorText }}>
                                {msg.text}
                              </Text>
                            </div>
                          )}
                          {(() => {
                            // CRITICAL: Only get answer from message-specific meta
                            // This ensures each approval:requested message shows its own answer from when it was sent
                            const answerValue = getAnswerValue(msg);
                            
                            // Debug logging
                            if (msg.action === 'approval:requested' && !answerValue) {
                              console.log('Approval request message - no answer found in message meta:', {
                                hasMeta: !!msg.meta,
                                hasQuestionData: !!msg.meta?.questionData,
                                hasAnswerData: !!msg.meta?.questionData?.answerData,
                                messageId: msg._id,
                                message: msg,
                              });
                            }
                            
                            return answerValue ? (
                              <div style={{ 
                                marginTop: '12px', 
                                padding: '12px 14px', 
                                background: token.colorFillQuaternary || token.colorFillAlter, 
                                borderRadius: '8px', 
                                border: `1px solid ${token.colorBorderSecondary || token.colorBorder}`,
                                borderLeft: `4px solid ${token.colorWarning}`,
                                boxShadow: `0 1px 2px ${token.colorFillSecondary}`
                              }}>
                                <Text 
                                  type="secondary" 
                                  style={{ 
                                    fontSize: '11px', 
                                    display: 'block', 
                                    marginBottom: '8px', 
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    color: token.colorTextTertiary
                                  }}
                                >
                                  Answer
                                </Text>
                                {(() => {
                                  // CRITICAL: Only use message-specific meta for enhanced rendering
                                  // This ensures each approval:requested message shows its own answer with proper formatting
                                  const questionDataFromMeta = msg.meta?.questionData;
                                  const answerDataFromMeta = questionDataFromMeta?.answerData;
                                  const questionTypeFromMeta = questionDataFromMeta?.questionType;

                                  // Check if it's a ranking answer
                                  if (typeof answerValue === 'object' && answerValue !== null && (answerValue as any).type === 'ranking') {
                                    const rankingData = answerValue as { type: 'ranking'; order: any[]; options: any[] };
                                    return (
                                      <RankingAnswerRenderer
                                        order={rankingData.order}
                                        options={rankingData.options}
                                        className="answer-ranking"
                                      />
                                    );
                                  }
                                  // Check if it's a rating answer
                                  if (typeof answerValue === 'object' && answerValue !== null && (answerValue as any).type === 'rating') {
                                    const ratingData = answerValue as { type: 'rating'; ratingValue: number; maxRating?: number; ratingLabels?: string[]; variant?: string; allowHalf?: boolean };
                                    return (
                                      <RatingAnswerRenderer
                                        ratingValue={ratingData.ratingValue}
                                        maxRating={ratingData.maxRating}
                                        ratingLabels={ratingData.ratingLabels}
                                        variant={ratingData.variant as 'stars' | 'anchors' | 'emoji' | undefined}
                                        allowHalf={ratingData.allowHalf}
                                        className="answer-rating"
                                      />
                                    );
                                  }
                                  // Check if it's a date answer
                                  if (typeof answerValue === 'object' && answerValue !== null && (answerValue as any).type === 'date') {
                                    const dateData = answerValue as { type: 'date'; dateValue: string; format?: string };
                                    return (
                                      <DateAnswerRenderer
                                        dateValue={dateData.dateValue}
                                        isDateTime={false}
                                        format={dateData.format}
                                        className="answer-date"
                                      />
                                    );
                                  }
                                  // Check if it's a dateTime answer
                                  if (typeof answerValue === 'object' && answerValue !== null && (answerValue as any).type === 'dateTime') {
                                    const dateTimeData = answerValue as { type: 'dateTime'; dateValue: string; format?: string };
                                    return (
                                      <DateAnswerRenderer
                                        dateValue={dateTimeData.dateValue}
                                        isDateTime={true}
                                        format={dateTimeData.format}
                                        className="answer-datetime"
                                      />
                                    );
                                  }
                                  // Check if it's an address answer
                                  if (typeof answerValue === 'object' && answerValue !== null && (answerValue as any).type === 'address') {
                                    const addressData = answerValue as { type: 'address'; addressData: any };
                                    return (
                                      <AddressAnswerRenderer
                                        addressData={addressData.addressData}
                                        className="answer-address"
                                      />
                                    );
                                  }
                                  // Check if it's a JSONContent object (richText)
                                  if (typeof answerValue === 'object' && answerValue !== null && (answerValue as any).type === 'doc') {
                                    return <RichTextRenderer content={answerValue as JSONContent} className="answer-rich-text" />;
                                  }
                                  // Check if it's a stringified JSONContent
                                  if (typeof answerValue === 'string') {
                                    const trimmed = answerValue.trim();
                                    if (trimmed.startsWith('{') && trimmed.includes('"type":"doc"')) {
                                      try {
                                        const parsed = JSON.parse(answerValue);
                                        if (parsed && parsed.type === 'doc') {
                                          return <RichTextRenderer content={parsed as JSONContent} className="answer-rich-text" />;
                                        }
                                      } catch {
                                        // Not valid JSON, continue
                                      }
                                    }
                                    // Check if it's HTML
                                    if (answerValue.includes('<')) {
                                      return (
                                        <div 
                                          dangerouslySetInnerHTML={{ __html: answerValue }}
                                          style={{ 
                                            fontSize: '14px',
                                            lineHeight: '1.5',
                                            wordBreak: 'break-word'
                                          }}
                                        />
                                      );
                                    }
                                  }

                                  // Enhanced rendering for specific node types with formatting
                                  if (questionTypeFromMeta === 'singleChoice') {
                                    // Handle selectedOption object (can come from getAnswerValue or directly from answerData)
                                    let selectedOptionObj: any = null;
                                    
                                    // Check if answerValue itself is a selectedOption object (from getAnswerValue)
                                    if (typeof answerValue === 'object' && answerValue !== null && (answerValue as any).label) {
                                      selectedOptionObj = answerValue;
                                    }
                                    // Check top-level selectedOption
                                    else if (answerDataFromMeta?.selectedOption && typeof answerDataFromMeta.selectedOption === 'object' && answerDataFromMeta.selectedOption !== null) {
                                      selectedOptionObj = answerDataFromMeta.selectedOption;
                                    }
                                    // Check groupData.selectedOption
                                    const groupDataAny = answerDataFromMeta?.groupData as any;
                                    if (groupDataAny?.selectedOption && typeof groupDataAny.selectedOption === 'object' && groupDataAny.selectedOption !== null) {
                                      selectedOptionObj = groupDataAny.selectedOption;
                                    }
                                    // Check ungroupedData.selectedOption
                                    else {
                                      const ungroupedDataAny = answerDataFromMeta?.ungroupedData as any;
                                      if (ungroupedDataAny?.selectedOption && typeof ungroupedDataAny.selectedOption === 'object' && ungroupedDataAny.selectedOption !== null) {
                                        selectedOptionObj = ungroupedDataAny.selectedOption;
                                      }
                                      // Check if groupData.groupValue is a selectedOption object
                                      else if (answerDataFromMeta?.groupData?.groupValue && typeof answerDataFromMeta.groupData.groupValue === 'object' && answerDataFromMeta.groupData.groupValue !== null && (answerDataFromMeta.groupData.groupValue as any).label) {
                                        selectedOptionObj = answerDataFromMeta.groupData.groupValue;
                                      }
                                      // Check if ungroupedData.subjectValue is a selectedOption object
                                      else if (answerDataFromMeta?.ungroupedData?.subjectValue && typeof answerDataFromMeta.ungroupedData.subjectValue === 'object' && answerDataFromMeta.ungroupedData.subjectValue !== null && (answerDataFromMeta.ungroupedData.subjectValue as any).label) {
                                        selectedOptionObj = answerDataFromMeta.ungroupedData.subjectValue;
                                      }
                                    }
                                    
                                    // If we found a selectedOption object, use it
                                    if (selectedOptionObj) {
                                      const optionLabel = selectedOptionObj.label || selectedOptionObj.value || String(selectedOptionObj);
                                      
                                      // Check if "Other" option is selected and has otherValue
                                      if ((selectedOptionObj.value === '__other__' || selectedOptionObj.value === 'other') && answerDataFromMeta?.otherValue) {
                                        return (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <Text strong style={{ fontSize: '14px', wordBreak: 'break-word' }}>
                                              {optionLabel}
                                            </Text>
                                            <Text style={{ fontSize: '13px', color: token.colorTextSecondary, fontStyle: 'italic', wordBreak: 'break-word' }}>
                                              {String(answerDataFromMeta.otherValue)}
                                            </Text>
                                          </div>
                                        );
                                      }
                                      
                                      return (
                                        <Text 
                                          strong 
                                          style={{ 
                                            fontSize: '14px', 
                                            wordBreak: 'break-word',
                                            color: token.colorText,
                                            lineHeight: '1.6'
                                          }}
                                        >
                                          {optionLabel}
                                        </Text>
                                      );
                                    }
                                    
                                    // Fallback: If selectedOption is not available, try to find from options array (backward compatibility)
                                    if (answerDataFromMeta?.options && typeof answerValue === 'string') {
                                      // Find the selected option and display its label
                                      const options = Array.isArray(answerDataFromMeta.options) ? answerDataFromMeta.options : [];
                                      const selectedOption = options.find((opt: any) => {
                                        const optValue = typeof opt === 'object' && opt !== null ? opt.value || opt.id : opt;
                                        return String(optValue) === String(answerValue);
                                      });
                                      
                                      if (selectedOption) {
                                        const optionLabel = typeof selectedOption === 'object' && selectedOption !== null 
                                          ? selectedOption.label || selectedOption.name || String(selectedOption.value || selectedOption.id)
                                          : String(selectedOption);
                                        
                                        // Check if "Other" option is selected and has otherValue
                                        if ((answerValue === '__other__' || answerValue === 'other') && answerDataFromMeta.otherValue) {
                                          return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                              <Text strong style={{ fontSize: '14px', wordBreak: 'break-word' }}>
                                                {optionLabel}
                                              </Text>
                                              <Text style={{ fontSize: '13px', color: token.colorTextSecondary, fontStyle: 'italic', wordBreak: 'break-word' }}>
                                                {String(answerDataFromMeta.otherValue)}
                                              </Text>
                                            </div>
                                          );
                                        }
                                        
                                        return (
                                          <Text 
                                            strong 
                                            style={{ 
                                              fontSize: '14px', 
                                              wordBreak: 'break-word',
                                              color: token.colorText,
                                              lineHeight: '1.6'
                                            }}
                                          >
                                            {optionLabel}
                                          </Text>
                                        );
                                      }
                                    }
                                  }

                                  if (questionTypeFromMeta === 'multipleChoice' && answerDataFromMeta?.options && typeof answerValue === 'string') {
                                    // Parse comma-separated values and find their labels
                                    const selectedValues = answerValue.split(',').map(v => v.trim()).filter(Boolean);
                                    const options = Array.isArray(answerDataFromMeta.options) ? answerDataFromMeta.options : [];
                                    
                                    const selectedLabels = selectedValues.map((val) => {
                                      const option = options.find((opt: any) => {
                                        const optValue = typeof opt === 'object' && opt !== null ? opt.value || opt.id : opt;
                                        return String(optValue) === val;
                                      });
                                      
                                      if (option) {
                                        return typeof option === 'object' && option !== null 
                                          ? option.label || option.name || String(option.value || option.id)
                                          : String(option);
                                      }
                                      return val;
                                    });

                                    // Check if "Other" is selected and has otherValue
                                    const hasOther = selectedValues.includes('__other__') || selectedValues.includes('other');
                                    const otherValue = hasOther && answerDataFromMeta.otherValue ? String(answerDataFromMeta.otherValue) : null;

                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                          {selectedLabels.map((label, idx) => (
                                            <Tag key={idx} color="blue" style={{ margin: 0, fontSize: '13px' }}>
                                              {label}
                                            </Tag>
                                          ))}
                                        </div>
                                        {otherValue && (
                                          <Text style={{ fontSize: '13px', color: token.colorTextSecondary, fontStyle: 'italic', wordBreak: 'break-word', marginTop: '4px' }}>
                                            Other: {otherValue}
                                          </Text>
                                        )}
                                      </div>
                                    );
                                  }

                                  if (questionTypeFromMeta === 'numberField' && typeof answerValue === 'string' && answerDataFromMeta) {
                                    // Format number with prefix/suffix/unit
                                    const prefix = answerDataFromMeta.prefix || '';
                                    const suffix = answerDataFromMeta.suffix || '';
                                    const unit = answerDataFromMeta.unit || '';
                                    const formattedValue = [prefix, answerValue, suffix, unit].filter(Boolean).join(' ');
                                    return (
                                      <Text 
                                        strong 
                                        style={{ 
                                          fontSize: '14px', 
                                          wordBreak: 'break-word',
                                          color: token.colorText,
                                          lineHeight: '1.6'
                                        }}
                                      >
                                        {formattedValue}
                                      </Text>
                                    );
                                  }

                                  if (questionTypeFromMeta === 'sliderRangeField' && typeof answerValue === 'string' && answerDataFromMeta) {
                                    // Format slider value with unit
                                    const unit = answerDataFromMeta.unit || '';
                                    const formattedValue = unit ? `${answerValue} ${unit}` : answerValue;
                                    return (
                                      <Text 
                                        strong 
                                        style={{ 
                                          fontSize: '14px', 
                                          wordBreak: 'break-word',
                                          color: token.colorText,
                                          lineHeight: '1.6'
                                        }}
                                      >
                                        {formattedValue}
                                      </Text>
                                    );
                                  }

                                  // Fallback to plain text
                                  return (
                                    <Text 
                                      strong 
                                      style={{ 
                                        fontSize: '14px', 
                                        wordBreak: 'break-word',
                                        color: token.colorText,
                                        lineHeight: '1.6'
                                      }}
                                    >
                                      {String(answerValue)}
                                    </Text>
                                  );
                                })()}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      ) : (msg.action === 'approval:approved') ? (
                        <div>
                          <div style={{ 
                            marginBottom: msg.text ? '8px' : '0px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 8px',
                            background: token.colorSuccessBg || '#f6ffed',
                            borderRadius: '4px',
                            border: `1px solid ${token.colorSuccessBorder || token.colorSuccess || '#52c41a'}`
                          }}>
                            <CheckCircleOutlined style={{ 
                              marginRight: '6px', 
                              color: token.colorSuccess,
                              fontSize: '14px'
                            }} />
                            <Text type="success" strong style={{ fontSize: '13px' }}>
                              {msg.isAutoApproval ? 'Auto approved' : 'Approved'}
                            </Text>
                          </div>
                          {msg.text && (
                            <div style={{ marginTop: '8px' }}>
                              <Text style={{ fontSize: '14px', lineHeight: '1.5', color: token.colorText }}>
                                {msg.text}
                              </Text>
                            </div>
                          )}
                        </div>
                      ) : (msg.action === 'approval:rejected') ? (
                        <div>
                          <div style={{ 
                            marginBottom: msg.text ? '8px' : '0px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 8px',
                            background: token.colorErrorBg || '#fff2f0',
                            borderRadius: '4px',
                            border: `1px solid ${token.colorErrorBorder || token.colorError || '#ff4d4f'}`
                          }}>
                            <CloseCircleOutlined style={{ 
                              marginRight: '6px', 
                              color: token.colorError,
                              fontSize: '14px'
                            }} />
                            <Text type="danger" strong style={{ fontSize: '13px' }}>
                              Rejected
                            </Text>
                          </div>
                          {msg.text && (
                            <div style={{ marginTop: '8px' }}>
                              <Text style={{ fontSize: '14px', lineHeight: '1.5', color: token.colorText }}>
                                {msg.text}
                              </Text>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* Fallback to actionType for backward compatibility */}
                          {msg.actionType && (
                            <div style={{ marginBottom: '4px' }}>
                              {msg.actionType === 'approve' && (
                                <Text type="success" strong>
                                  <CheckCircleOutlined style={{ marginRight: '4px' }} />
                                  Approved
                                </Text>
                              )}
                              {msg.actionType === 'reject' && (
                                <Text type="danger" strong>
                                  <CloseCircleOutlined style={{ marginRight: '4px' }} />
                                  Rejected
                                </Text>
                              )}
                            </div>
                          )}
                          <Paragraph
                            style={{
                              margin: 0,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {msg.text}
                          </Paragraph>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div
        style={{
          borderTop: `1px solid ${token.colorBorder}`,
          padding: 16,
          background: token.colorBgContainer,
        }}
      >
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder={isApprover ? "Type a message or rejection reason..." : "Type a message or comment for approval request..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={sending || requesting}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={sendMessage}
            loading={sending}
            disabled={!newMessage.trim() || requesting}
          >
            Send
          </Button>
        </Space.Compact>

        {/* Request Approval Action Button */}
        {/* Always show if user is not an approver (approvers don't request approval) */}
        {/* Button is disabled when approved, but always visible */}
        {!isApprover && (
          <div style={{ marginTop: 12 }}>
            <Button
              type="default"
              icon={<ClockCircleOutlined />}
              onClick={handleRequestApproval}
              loading={requesting}
              disabled={effectiveApprovalStatus === 'approved' || effectiveApprovalStatus === 'requested'}
              block
              style={{
                borderColor: token.colorWarning,
                color: token.colorWarning,
                opacity: effectiveApprovalStatus === 'approved' || effectiveApprovalStatus === 'requested' ? 0.6 : 1,
              }}
            >
              {effectiveApprovalStatus === 'pending'
                ? 'Request Approval'
                : effectiveApprovalStatus === 'requested'
                ? 'Approval Requested'
                : effectiveApprovalStatus === 'rejected'
                ? 'Re-request Approval'
                : effectiveApprovalStatus === 'approved'
                ? 'Approval Approved'
                : 'Request Approval'}
              {newMessage.trim() && (
                <span style={{ marginLeft: 4, fontSize: 12, opacity: 0.8 }}>
                  (with comment)
                </span>
              )}
            </Button>
            {
              effectiveApprovalStatus === 'requested' && (
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                  This question has been requested for approval. You can still view the conversation.
                </Text>
              )
            }
            {effectiveApprovalStatus === 'approved' && (
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                This question has been approved. You can still view the conversation.
              </Text>
            )}
          </div>
        )}

        {/* Approver Action Buttons - show when status is requested (or pending/rejected) so approver can act */}
        {isApprover && effectiveApprovalStatus === 'requested' && (
          <div style={{ marginTop: 12 }}>
            <Space>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleApprove}
                disabled={!newMessage.trim()}
                style={{ background: token.colorSuccess }}
              >
                Approve
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={handleReject}
                disabled={!newMessage.trim()}
                style={{ background: token.colorErrorBg }}
              >
                Reject with Message
              </Button>
            </Space>
          </div>
        )}
      </div>
    </div>
  );
};
