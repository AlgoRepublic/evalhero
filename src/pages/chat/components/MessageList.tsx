/* eslint-disable @typescript-eslint/no-explicit-any */
import { Typography, Button, Tag, theme } from 'antd';
import { AssetAvatar } from '../../../components';
import {
  MessageOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
// import { useCallback } from 'react';
import { Message, Thread } from '../types';
import { MessageReactions } from './MessageReactions';
import { MessageEmbed } from './MessageEmbed';
import { MessageAttachment } from './MessageAttachment';
import { RichTextRenderer } from '../../forms/QueuesComponents/RichTextRenderer';
import { RankingAnswerRenderer } from '../../forms/QueuesComponents/RankingAnswerRenderer';
import { RatingAnswerRenderer } from '../../forms/QueuesComponents/RatingAnswerRenderer';
import { DateAnswerRenderer } from '../../forms/QueuesComponents/DateAnswerRenderer';
import { AddressAnswerRenderer } from '../../forms/QueuesComponents/AddressAnswerRenderer';
import type { JSONContent } from '@tiptap/core';

const { Text, Paragraph } = Typography;

// Helper function to extract answer value from message meta/questionData
// Returns string for simple types, JSONContent for rich text, ranking/rating/date/address data object, or null
// CRITICAL: Only uses message-specific meta to ensure each message shows its own answer
const getAnswerValue = (message: Message): string | JSONContent | { type: 'ranking'; order: any[]; options: any[] } | { type: 'rating'; ratingValue: number; maxRating?: number; ratingLabels?: string[]; variant?: string; allowHalf?: boolean } | { type: 'date'; dateValue: string; format?: string } | { type: 'dateTime'; dateValue: string; format?: string } | { type: 'address'; addressData: any } | null => {
  // CRITICAL: Only use message-specific meta - don't fallback to conversation-level meta or current questionData
  // This ensures each approval:requested message shows its own answer from when it was sent
  const questionDataToUse = message.meta?.questionData;
  
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
          try {
            const addressValue = typeof answerData.groupData.groupValue === 'object' 
              ? answerData.groupData.groupValue 
              : (typeof answerData.groupData.groupValue === 'string' ? JSON.parse(answerData.groupData.groupValue) : answerData.groupData.groupValue);
            return {
              type: 'address' as const,
              addressData: addressValue,
            };
          } catch {
            // If parsing fails, return as string
            return String(answerData.groupData.groupValue);
          }
        }
        return String(answerData.groupData.groupValue);
    }
    // Check for ungrouped value (singular)
    if (answerData.ungroupedData?.subjectValue !== undefined && answerData.ungroupedData.subjectValue !== null && answerData.ungroupedData.subjectValue !== '') {
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
          try {
            const addressValue = typeof answerData.ungroupedData.subjectValue === 'object' 
              ? answerData.ungroupedData.subjectValue 
              : (typeof answerData.ungroupedData.subjectValue === 'string' ? JSON.parse(answerData.ungroupedData.subjectValue) : answerData.ungroupedData.subjectValue);
            return {
              type: 'address' as const,
              addressData: addressValue,
            };
          } catch {
            // If parsing fails, return as string
            return String(answerData.ungroupedData.subjectValue);
          }
        }
        return String(answerData.ungroupedData.subjectValue);
    }
    // Check for ungrouped values (plural - map of subject IDs to values)
    if (answerData.ungroupedData && 'subjectValues' in answerData.ungroupedData && typeof (answerData.ungroupedData as any).subjectValues === 'object') {
      const subjectValues = (answerData.ungroupedData as any).subjectValues;
      // Get the first non-empty value
      const firstValue = Object.values(subjectValues).find((v: any) => v !== undefined && v !== null && v !== '');
      if (firstValue) {
        // Don't convert ranking to string
        if (questionType === 'ranking' && Array.isArray(firstValue)) {
          return {
            type: 'ranking' as const,
            order: firstValue,
            options: answerData.options || [],
          };
        }
        // Don't convert rating to string
        if (questionType === 'ratingField' && (typeof firstValue === 'number' || typeof firstValue === 'string')) {
          // Parse string values to numbers/booleans
          const ratingValue = typeof firstValue === 'string' 
            ? parseFloat(firstValue) 
            : firstValue;
          const maxRating = answerData.maxRating 
            ? (typeof answerData.maxRating === 'string' ? parseInt(answerData.maxRating, 10) : answerData.maxRating)
            : 5;
          const allowHalf = answerData.allowHalf 
            ? (typeof answerData.allowHalf === 'string' ? answerData.allowHalf === 'true' : answerData.allowHalf)
            : false;
          
          return {
            type: 'rating' as const,
            ratingValue: ratingValue,
            maxRating: maxRating,
            ratingLabels: answerData.ratingLabels,
            variant: answerData.ratingVariant as 'stars' | 'anchors' | 'emoji' | undefined,
            allowHalf: allowHalf,
          };
        }
        // Don't convert date to string
        if (questionType === 'dateField' && firstValue) {
          return {
            type: 'date' as const,
            dateValue: String(firstValue),
            format: answerData.format,
          };
        }
        // Don't convert dateTime to string
        if (questionType === 'dateTimeField' && firstValue) {
          return {
            type: 'dateTime' as const,
            dateValue: String(firstValue),
            format: answerData.format,
          };
        }
        return String(firstValue);
      }
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
    if (answerData.selectedOption !== undefined && answerData.selectedOption !== null) {
      if (typeof answerData.selectedOption === 'object' && answerData.selectedOption !== null && (answerData.selectedOption as any).label != null) {
        return answerData.selectedOption as { value?: string; label: string };
      }
      if (answerData.selectedOption !== '') return String(answerData.selectedOption);
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
    // Check for rating answer
    if (questionType === 'ratingField' && answerData.ratingValue !== undefined && answerData.ratingValue !== null) {
      // Parse string values to numbers/booleans
      const ratingValue = typeof answerData.ratingValue === 'string' 
        ? parseFloat(answerData.ratingValue) 
        : answerData.ratingValue;
      const maxRating = answerData.maxRating 
        ? (typeof answerData.maxRating === 'string' ? parseInt(answerData.maxRating, 10) : answerData.maxRating)
        : 5;
      const allowHalf = answerData.allowHalf 
        ? (typeof answerData.allowHalf === 'string' ? answerData.allowHalf === 'true' : answerData.allowHalf)
        : false;
      
      return {
        type: 'rating' as const,
        ratingValue: ratingValue,
        maxRating: maxRating,
        ratingLabels: answerData.ratingLabels,
        variant: answerData.ratingVariant as 'stars' | 'anchors' | 'emoji' | undefined,
        allowHalf: allowHalf,
      };
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

interface MessageListProps {
  messages: Message[];
  threads: Thread[];
  onThreadClick: (threadId: string) => void;
  currentUserId?: string;
  isApprover?: boolean;
  onApprove?: (comment?: string) => Promise<void>;
  onReject?: (comment: string) => Promise<void>;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

export const MessageList = ({
  messages,
  threads,
  onThreadClick,
  currentUserId,
  // isApprover = false,
  // onApprove,
  // onReject,
  // approvalStatus,
}: MessageListProps) => {
  const { token } = theme.useToken();
  // const [rejectComment, setRejectComment] = useState('');
  // const [showRejectInput, setShowRejectInput] = useState(false);
  // const [isApproving, setIsApproving] = useState(false);
  // const [isRejecting, setIsRejecting] = useState(false);
  const getThreadForMessage = (messageId: string) => {
    return threads.find((t) => t.parentMessageId === messageId);
  };

  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown time';
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateString;
    }
  };

  const getMessageColor = (userId: string) => {
    if (currentUserId && userId === currentUserId) {
      return token.colorPrimary;
    }
    return token.colorTextSecondary;
  };

  // Function to get latest approval status from messages
  // const getLatestApprovalStatusFromMessages = useCallback((msgs: Message[]): 'pending' | 'approved' | 'rejected' | null => {
  //   if (!msgs || msgs.length === 0) {
  //     return null;
  //   }
    
  //   // Filter messages with approval actions and sort by timestamp (newest first)
  //   const approvalMessages = msgs
  //     .filter((msg) => {
  //       const action = msg.action;
  //       return action === 'approval:request' || action === 'approval:approve' || action === 'approval:reject';
  //     })
  //     .sort((a, b) => {
  //       const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  //       const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  //       return timeB - timeA; // Newest first
  //     });
    
  //   if (approvalMessages.length === 0) {
  //     return null;
  //   }
    
  //   // Get the latest message with an approval action
  //   const latestMessage = approvalMessages[0];
  //   const action = latestMessage.action;
    
  //   // Map action to status
  //   if (action === 'approval:approve') {
  //     return 'approved';
  //   } else if (action === 'approval:reject') {
  //     return 'rejected';
  //   } else if (action === 'approval:request') {
  //     return 'pending';
  //   }
    
  //   return null;
  // }, []);

  // Get effective approval status - prioritize status from messages (most up-to-date), fallback to prop
  // const effectiveApprovalStatus = useMemo(() => {
  //   const statusFromMessages = getLatestApprovalStatusFromMessages(messages);
  //   return statusFromMessages !== null ? statusFromMessages : (approvalStatus || null);
  // }, [messages, approvalStatus, getLatestApprovalStatusFromMessages]);

  // Handle approve action
  // const handleApprove = useCallback(async () => {
  //   if (!onApprove) return;
    
  //   try {
  //     setIsApproving(true);
  //     await onApprove();
  //     antMessage.success('Question approved');
  //   } catch (error: any) {
  //     antMessage.error(error?.message || 'Failed to approve');
  //   } finally {
  //     setIsApproving(false);
  //   }
  // }, [onApprove]);

  // Handle reject action
  // const handleReject = useCallback(async () => {
  //   if (!onReject || !rejectComment.trim()) {
  //     antMessage.warning('Please provide a rejection reason');
  //     return;
  //   }
    
  //   try {
  //     setIsRejecting(true);
  //     await onReject(rejectComment.trim());
  //     setRejectComment('');
  //     setShowRejectInput(false);
  //     antMessage.success('Question rejected');
  //   } catch (error: any) {
  //     antMessage.error(error?.message || 'Failed to reject');
  //   } finally {
  //     setIsRejecting(false);
  //   }
  // }, [onReject, rejectComment]);

  if (messages.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          color: token.colorTextSecondary,
        }}
      >
        <Text type="secondary">No messages yet. Start the conversation!</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 20px', maxWidth: '100%' }}>
      {messages.map((message, index) => {
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const showAvatar =
          !prevMessage ||
          prevMessage.userId !== message.userId ||
          (message.createdAt && prevMessage.createdAt &&
            new Date(message.createdAt).getTime() -
              new Date(prevMessage.createdAt).getTime() >
              300000); // 5 minutes

        const thread = getThreadForMessage(message.id);
        const isSystem = message.isSystem || message.contentType === 'system';

        const isCurrentUser = currentUserId && message.userId === currentUserId;
        
        // Slack-like message bubble colors - transparent style
        const messageBg = 'transparent';
        const messageTextColor = token.colorText;
        const messageBorderRadius = '12px';
        
        return (
          <div
            key={message.id}
            style={{
              marginBottom: showAvatar ? '16px' : '4px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '4px 0',
              transition: 'background-color 0.15s ease',
              borderRadius: '4px',
              paddingLeft: '4px',
              paddingRight: '4px',
            }}
            onMouseEnter={(e) => {
              if (!isSystem) {
                e.currentTarget.style.backgroundColor = token.colorFillTertiary;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
        {showAvatar && !isSystem && (
          <AssetAvatar
            avatarKey={message.userAvatar}
            size={36}
            fallback={message.userName?.charAt(0)?.toUpperCase() || '?'}
            style={{
              backgroundColor: getMessageColor(message.userId),
              flexShrink: 0,
              border: 'none',
              boxShadow: `0 1px 2px ${token.colorFillSecondary}`,
            }}
          />
        )}
        {!showAvatar && !isSystem && <div style={{ width: '36px', flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
          {showAvatar && !isSystem && (
            <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
              <Text 
                strong 
                style={{ 
                  fontSize: '15px', 
                  fontWeight: 700,
                  color: token.colorText,
                  lineHeight: '1.4',
                }}
              >
                {isCurrentUser ? 'You' : message.userName || 'Unknown User'}
              </Text>
              <Text 
                type="secondary" 
                style={{ 
                  fontSize: '12px',
                  fontWeight: 400,
                  opacity: 0.7,
                  lineHeight: '1.4',
                }}
              >
                {formatTime(message.createdAt)}
              </Text>
              {message.editedAt && (
                <Text 
                  type="secondary" 
                  style={{ 
                    fontSize: '12px', 
                    fontStyle: 'italic',
                    opacity: 0.6,
                  }}
                >
                  (edited)
                </Text>
              )}
            </div>
          )}
          <div
            style={{
              padding: isSystem ? '4px 0' : '8px 14px',
              borderRadius: messageBorderRadius,
              backgroundColor: messageBg,
              border: isSystem ? 'none' : `1px solid ${token.colorBorder}`,
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              boxShadow: 'none',
              display: 'block',
              width: '100%',
            }}
          >
            {message.action === 'approval:requested' ? (
              <div>
                <div style={{ 
                  marginBottom: message.content ? '8px' : '0px',
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
                {message.content && (
                  <div style={{ marginTop: '8px', marginBottom: '0px' }}>
                    <Text style={{ fontSize: '14px', lineHeight: '1.5', color: messageTextColor }}>
                      {message.content}
                    </Text>
                  </div>
                )}
                {(() => {
                  // CRITICAL: Only get answer from message-specific meta
                  // This ensures each approval:requested message shows its own answer from when it was sent
                  const answerValue = getAnswerValue(message);
                  
                  // Debug logging
                  if (message.action === 'approval:requested' && !answerValue) {
                    console.log('Approval request message - no answer found in message meta:', {
                      hasMeta: !!message.meta,
                      hasQuestionData: !!message.meta?.questionData,
                      hasAnswerData: !!message.meta?.questionData?.answerData,
                      messageId: message.id,
                      message: message,
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
                        const questionDataFromMeta = message.meta?.questionData;
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
                        // Check if it's a JSONContent object
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
                        // singleChoice: answerValue can be selectedOption object { value, label } (course form) or string (queue)
                        if (questionTypeFromMeta === 'singleChoice') {
                          const selectedOptionObj = typeof answerValue === 'object' && answerValue !== null && (answerValue as any).label != null
                            ? (answerValue as { value?: string; label: string })
                            : null;
                          if (selectedOptionObj) {
                            const optionLabel = selectedOptionObj.label;
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
                              <Text strong style={{ fontSize: '14px', wordBreak: 'break-word' }}>
                                {optionLabel}
                              </Text>
                            );
                          }
                          if (answerDataFromMeta?.options && typeof answerValue === 'string') {
                          // Find the selected option and display its label (queue form: value is string)
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
                
                {/* Show Approve/Reject buttons for approvers if status is pending */}
                {/* {isApprover && effectiveApprovalStatus === 'pending' && (
                  <div style={{ 
                    marginTop: '12px', 
                    paddingTop: '12px', 
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                  }}>
                    {!showRejectInput ? (
                      <Space wrap>
                        <Button
                          type="primary"
                          icon={<CheckCircleOutlined />}
                          onClick={handleApprove}
                          loading={isApproving}
                          disabled={isApproving || isRejecting}
                          style={{ background: token.colorSuccess }}
                        >
                          Approve
                        </Button>
                        <Button
                          danger
                          icon={<CloseCircleOutlined />}
                          onClick={() => setShowRejectInput(true)}
                          disabled={isApproving || isRejecting}
                        >
                          Reject
                        </Button>
                      </Space>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <Input.TextArea
                          rows={3}
                          placeholder="Enter rejection reason (required)..."
                          value={rejectComment}
                          onChange={(e) => setRejectComment(e.target.value)}
                          disabled={isRejecting}
                        />
                        <Space>
                          <Button
                            size="small"
                            onClick={() => {
                              setShowRejectInput(false);
                              setRejectComment('');
                            }}
                            disabled={isRejecting}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="small"
                            danger
                            icon={<CloseCircleOutlined />}
                            onClick={handleReject}
                            loading={isRejecting}
                            disabled={!rejectComment.trim() || isRejecting}
                          >
                            Reject with Reason
                          </Button>
                        </Space>
                      </div>
                    )}
                  </div>
                )} */}
              </div>
            ) : message.action === 'approval:approved' ? (
              <div>
                <div style={{ 
                  marginBottom: message.content ? '8px' : '0px',
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
                    Approved
                  </Text>
                </div>
                {message.content && (
                  <div style={{ marginTop: '8px' }}>
                    <Text style={{ fontSize: '14px', lineHeight: '1.5', color: messageTextColor }}>
                      {message.content}
                    </Text>
                  </div>
                )}
              </div>
            ) : message.action === 'approval:rejected' ? (
              <div>
                <div style={{ 
                  marginBottom: message.content ? '8px' : '0px',
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
                {message.content && (
                  <div style={{ marginTop: '8px' }}>
                    <Text style={{ fontSize: '14px', lineHeight: '1.5', color: messageTextColor }}>
                      {message.content}
                    </Text>
                  </div>
                )}
              </div>
            ) : isSystem ? (
              <Text 
                type="secondary" 
                style={{ 
                  fontSize: '13px', 
                  fontStyle: 'italic',
                  opacity: 0.7,
                  lineHeight: '1.5',
                }}
              >
                {message.content || ''}
              </Text>
            ) : (
              <Paragraph
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: messageTextColor,
                  fontSize: '15px',
                  lineHeight: '1.5',
                }}
              >
                {message.content || ''}
              </Paragraph>
            )}

            {message.attachments && message.attachments.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                {message.attachments.map((attachment) => (
                  <MessageAttachment key={attachment.id} attachment={attachment} />
                ))}
              </div>
            )}

            {message.embeds && message.embeds.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                {message.embeds.map((embed) => (
                  <MessageEmbed key={embed.id} embed={embed} />
                ))}
              </div>
            )}

            {message.reactions && message.reactions.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <MessageReactions reactions={message.reactions} messageId={message.id} />
              </div>
            )}

            {thread && (
              <Button
                type="link"
                size="small"
                icon={<MessageOutlined />}
                onClick={() => onThreadClick(thread.id)}
                style={{ 
                  padding: '4px 8px', 
                  height: 'auto', 
                  marginTop: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: token.colorTextSecondary,
                }}
              >
                {thread.messageCount} {thread.messageCount === 1 ? 'reply' : 'replies'}
              </Button>
            )}
          </div>
        </div>
      </div>
        );
      })}
    </div>
  );
};

