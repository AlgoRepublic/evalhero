/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Tag, Typography, theme, Image } from 'antd';
import { AssetAvatar } from '../../../components';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { ChatMessage as ChatMessageType } from './types';
import { formatTime, formatFullTime, formatDateSeparator, isSameDay, getSenderColor } from './chatUtils';
import { RichTextRenderer } from './RichTextRenderer';
import { RankingAnswerRenderer } from './RankingAnswerRenderer';
import { RatingAnswerRenderer } from './RatingAnswerRenderer';
import { DateAnswerRenderer } from './DateAnswerRenderer';
import { AddressAnswerRenderer } from './AddressAnswerRenderer';
import type { JSONContent } from '@tiptap/core';

const { Text, Paragraph } = Typography;

// Helper function to extract answer value from message meta/questionData
// Returns string for simple types, JSONContent for rich text, or null
const getAnswerValue = (msg: ChatMessageType): string | JSONContent | null => {
  if (!msg.meta?.questionData) return null;
  
  const questionData = msg.meta.questionData;
  const answerData = questionData.answerData;
  const questionType = questionData.questionType;
  
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
      return String(answerData.groupData.groupValue);
    }
    // Check for ungrouped value
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
      return String(answerData.dateValue);
    }
    if (answerData.dateTimeValue !== undefined && answerData.dateTimeValue !== null && answerData.dateTimeValue !== '') {
      return String(answerData.dateTimeValue);
    }
    if (answerData.selectedOption !== undefined && answerData.selectedOption !== null && answerData.selectedOption !== '') {
      return String(answerData.selectedOption);
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
  if (questionData.questionValue !== undefined && questionData.questionValue !== null && questionData.questionValue !== '') {
    return String(questionData.questionValue);
  }
  
  return null;
};

// Color scheme for different action types
const getActionTypeColors = (actionType: string | undefined, approvalStatus: 'approved' | 'rejected' | undefined, isDark: boolean, token: any) => {
  const isApproved = actionType === 'approval' && approvalStatus === 'approved';
  const isRejected = actionType === 'approval' && approvalStatus === 'rejected';
  
  if (isRejected || actionType === 'omit-signature-request-reject') {
    // Red for rejections
    return {
      tagColor: 'error',
      tagBg: isDark ? 'rgba(255, 77, 79, 0.2)' : '#fff1f0',
      tagBorder: isDark ? 'rgba(255, 77, 79, 0.4)' : '#ffccc7',
      tagText: isDark ? '#ff7875' : '#cf1322',
      badgeBg: isDark ? 'rgba(255, 77, 79, 0.15)' : '#fff1f0',
      badgeBorder: isDark ? 'rgba(255, 77, 79, 0.3)' : '#ffccc7',
      textColor: isDark ? '#ff7875' : '#cf1322',
    };
  }
  
  if (actionType === 'approval-request') {
    // Blue for approval requested (assignee requested approval)
    return {
      tagColor: 'processing',
      tagBg: isDark ? 'rgba(24, 144, 255, 0.15)' : '#e6f7ff',
      tagBorder: isDark ? 'rgba(24, 144, 255, 0.3)' : '#91d5ff',
      tagText: isDark ? '#69c0ff' : '#0958d9',
      badgeBg: isDark ? 'rgba(24, 144, 255, 0.15)' : '#e6f7ff',
      badgeBorder: isDark ? 'rgba(24, 144, 255, 0.3)' : '#91d5ff',
      textColor: isDark ? '#69c0ff' : '#0958d9',
    };
  }

  if (isApproved || actionType === 'approval') {
    // Green for approvals
    return {
      tagColor: 'success',
      tagBg: isDark ? 'rgba(82, 196, 26, 0.2)' : '#f6ffed',
      tagBorder: isDark ? 'rgba(82, 196, 26, 0.4)' : '#b7eb8f',
      tagText: isDark ? '#73d13d' : '#389e0d',
      badgeBg: isDark ? 'rgba(82, 196, 26, 0.15)' : '#f6ffed',
      badgeBorder: isDark ? 'rgba(82, 196, 26, 0.3)' : '#b7eb8f',
      textColor: isDark ? '#73d13d' : '#389e0d',
    };
  }
  
  if (actionType === 'dispute') {
    // Red-orange for disputes
    return {
      tagColor: 'error',
      tagBg: isDark ? 'rgba(255, 77, 79, 0.15)' : '#fff1f0',
      tagBorder: isDark ? 'rgba(255, 77, 79, 0.3)' : '#ffccc7',
      tagText: isDark ? '#ff7875' : '#cf1322',
      badgeBg: isDark ? 'rgba(255, 77, 79, 0.15)' : '#fff1f0',
      badgeBorder: isDark ? 'rgba(255, 77, 79, 0.3)' : '#ffccc7',
      textColor: isDark ? '#ff7875' : '#cf1322',
    };
  }
  
  if (actionType === 'omit-signature-request') {
    // Orange/amber for omit signature requests
    return {
      tagColor: 'warning',
      tagBg: isDark ? 'rgba(250, 173, 20, 0.15)' : '#fffbe6',
      tagBorder: isDark ? 'rgba(250, 173, 20, 0.3)' : '#ffe58f',
      tagText: isDark ? '#ffc53d' : '#d48806',
      badgeBg: isDark ? 'rgba(250, 173, 20, 0.15)' : '#fffbe6',
      badgeBorder: isDark ? 'rgba(250, 173, 20, 0.3)' : '#ffe58f',
      textColor: isDark ? '#ffc53d' : '#d48806',
    };
  }
  
  if (actionType === 'omit-signature-request-approve') {
    // Blue for omit signature approvals
    return {
      tagColor: 'processing',
      tagBg: isDark ? 'rgba(24, 144, 255, 0.15)' : '#e6f7ff',
      tagBorder: isDark ? 'rgba(24, 144, 255, 0.3)' : '#91d5ff',
      tagText: isDark ? '#69c0ff' : '#0958d9',
      badgeBg: isDark ? 'rgba(24, 144, 255, 0.15)' : '#e6f7ff',
      badgeBorder: isDark ? 'rgba(24, 144, 255, 0.3)' : '#91d5ff',
      textColor: isDark ? '#69c0ff' : '#0958d9',
    };
  }
  
  if (actionType === 'omit-signature-request-reject') {
    // Red for omit signature rejections
    return {
      tagColor: 'error',
      tagBg: isDark ? 'rgba(255, 77, 79, 0.15)' : '#fff1f0',
      tagBorder: isDark ? 'rgba(255, 77, 79, 0.3)' : '#ffccc7',
      tagText: isDark ? '#ff7875' : '#cf1322',
      badgeBg: isDark ? 'rgba(255, 77, 79, 0.15)' : '#fff1f0',
      badgeBorder: isDark ? 'rgba(255, 77, 79, 0.3)' : '#ffccc7',
      textColor: isDark ? '#ff7875' : '#cf1322',
    };
  }
  
  if (actionType === 'signature') {
    // Purple for signatures
    return {
      tagColor: 'purple',
      tagBg: isDark ? 'rgba(114, 46, 209, 0.15)' : '#f9f0ff',
      tagBorder: isDark ? 'rgba(114, 46, 209, 0.3)' : '#d3adf7',
      tagText: isDark ? '#b37feb' : '#722ed1',
      badgeBg: isDark ? 'rgba(114, 46, 209, 0.15)' : '#f9f0ff',
      badgeBorder: isDark ? 'rgba(114, 46, 209, 0.3)' : '#d3adf7',
      textColor: isDark ? '#b37feb' : '#722ed1',
    };
  }
  
  // Question approval actions
  if (actionType === 'question-approval-approved') {
    // Green for question approvals
    return {
      tagColor: 'success',
      tagBg: isDark ? 'rgba(82, 196, 26, 0.2)' : '#f6ffed',
      tagBorder: isDark ? 'rgba(82, 196, 26, 0.4)' : '#b7eb8f',
      tagText: isDark ? '#73d13d' : '#389e0d',
      badgeBg: isDark ? 'rgba(82, 196, 26, 0.15)' : '#f6ffed',
      badgeBorder: isDark ? 'rgba(82, 196, 26, 0.3)' : '#b7eb8f',
      textColor: isDark ? '#73d13d' : '#389e0d',
    };
  }
  
  if (actionType === 'question-approval-rejected') {
    // Red for question rejections
    return {
      tagColor: 'error',
      tagBg: isDark ? 'rgba(255, 77, 79, 0.2)' : '#fff1f0',
      tagBorder: isDark ? 'rgba(255, 77, 79, 0.4)' : '#ffccc7',
      tagText: isDark ? '#ff7875' : '#cf1322',
      badgeBg: isDark ? 'rgba(255, 77, 79, 0.15)' : '#fff1f0',
      badgeBorder: isDark ? 'rgba(255, 77, 79, 0.3)' : '#ffccc7',
      textColor: isDark ? '#ff7875' : '#cf1322',
    };
  }
  
  if (actionType === 'question-approval-request') {
    // Blue for question approval requests
    return {
      tagColor: 'processing',
      tagBg: isDark ? 'rgba(24, 144, 255, 0.15)' : '#e6f7ff',
      tagBorder: isDark ? 'rgba(24, 144, 255, 0.3)' : '#91d5ff',
      tagText: isDark ? '#69c0ff' : '#0958d9',
      badgeBg: isDark ? 'rgba(24, 144, 255, 0.15)' : '#e6f7ff',
      badgeBorder: isDark ? 'rgba(24, 144, 255, 0.3)' : '#91d5ff',
      textColor: isDark ? '#69c0ff' : '#0958d9',
    };
  }
  
  // Default
  return {
    tagColor: 'default',
    tagBg: 'transparent',
    tagBorder: 'transparent',
    tagText: token.colorText,
    badgeBg: 'transparent',
    badgeBorder: 'transparent',
    textColor: token.colorText,
  };
};

const getActionTypeIcon = (actionType: string | undefined, approvalStatus?: 'approved' | 'rejected') => {
  const isApproved = actionType === 'approval' && approvalStatus === 'approved';
  const isRejected = actionType === 'approval' && approvalStatus === 'rejected';
  
  if (isRejected || actionType === 'omit-signature-request-reject' || actionType === 'question-approval-rejected') {
    return <CloseCircleOutlined />;
  }
  if (actionType === 'approval-request') {
    return <SendOutlined />;
  }
  if (isApproved || actionType === 'approval' || actionType === 'omit-signature-request-approve' || actionType === 'question-approval-approved') {
    return <CheckCircleOutlined />;
  }
  if (actionType === 'dispute') {
    return <ExclamationCircleOutlined />;
  }
  if (actionType === 'omit-signature-request' || actionType === 'question-approval-request') {
    return <QuestionCircleOutlined />;
  }
  if (actionType === 'signature') {
    return <EditOutlined />;
  }
  return <FileTextOutlined />;
};

const getActionTypeLabel = (actionType: string | undefined, approvalStatus?: 'approved' | 'rejected') => {
  const isApproved = actionType === 'approval' && approvalStatus === 'approved';
  const isRejected = actionType === 'approval' && approvalStatus === 'rejected';
  
  if (isRejected) return 'Rejected';
  if (isApproved) return 'Approved';
  if (actionType === 'approval-request') return 'Requested';
  if (actionType === 'approval') return 'Approved';
  if (actionType === 'dispute') return 'Dispute';
  if (actionType === 'omit-signature-request') return 'Omit Signature Request';
  if (actionType === 'omit-signature-request-approve') return 'Omit Signature Approved';
  if (actionType === 'omit-signature-request-reject') return 'Omit Signature Rejected';
  if (actionType === 'signature') return 'Signature';
  if (actionType === 'question-approval-request') return 'Question Approval Requested';
  if (actionType === 'question-approval-approved') return 'Question Approved';
  if (actionType === 'question-approval-rejected') return 'Question Rejected';
  return 'Action';
};

interface ChatMessageProps {
  message: ChatMessageType;
  prevMessage: ChatMessageType | null;
  currentUserId: string;
  isDark: boolean;
  token: ReturnType<typeof theme.useToken>['token'];
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message: msg,
  prevMessage,
  currentUserId,
  isDark,
  token,
}) => {
  const isCurrentUser = msg.senderId === currentUserId;
  const isActionMessage = !!msg.actionType;
  const isSignature = msg.actionType === 'signature' || !!msg.signature;
  // Get colors and styling for the action type
  const actionColors = getActionTypeColors(msg.actionType, msg.approvalStatus, isDark, token);
  const actionIcon = getActionTypeIcon(msg.actionType, msg.approvalStatus);
  const actionLabel = getActionTypeLabel(msg.actionType, msg.approvalStatus);
  
  // Determine if message has visual styling (bubble, border, etc.)
  const hasActionStyling = isActionMessage && (msg.actionType === 'approval' || msg.actionType === 'approval-request' || msg.actionType === 'dispute' || 
    msg.actionType === 'signature' || msg.actionType === 'omit-signature-request' || 
    msg.actionType === 'omit-signature-request-approve' || msg.actionType === 'omit-signature-request-reject' ||
    msg.actionType === 'question-approval-request' || msg.actionType === 'question-approval-approved' || 
    msg.actionType === 'question-approval-rejected');

  // Determine avatar and name color - always sender-specific and consistent
  // Each sender gets a consistent color based on their ID, regardless of message type
  // Color is adjusted for dark mode to ensure good contrast
  const avatarColor = getSenderColor(msg.senderId, msg.senderName, isDark);

  // Message grouping logic - Slack style
  const showAvatar = !prevMessage || 
    prevMessage.senderId !== msg.senderId ||
    (prevMessage.timestamp && msg.timestamp && 
     (msg.timestamp.getTime() - prevMessage.timestamp.getTime() > 300000)); // 5 minutes gap
  
  // Show date separator if different day
  const showDateSeparator = !prevMessage || 
    (prevMessage.timestamp && msg.timestamp && !isSameDay(prevMessage.timestamp, msg.timestamp));

  return (
    <React.Fragment>
      {/* Date Separator */}
      {showDateSeparator && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px 6px',
            width: '100%',
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: token.colorBorderSecondary,
              marginRight: 10,
              opacity: 0.5,
            }}
          />
          <Text
            type="secondary"
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: token.colorText,
              padding: '0 6px',
            }}
          >
            {formatDateSeparator(msg.timestamp)}
          </Text>
          <div
            style={{
              flex: 1,
              height: 1,
              background: token.colorBorderSecondary,
              marginLeft: 10,
              opacity: 0.5,
            }}
          />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          padding: showAvatar ? '4px 16px' : '1px 16px 4px 44px',
          width: '100%',
          transition: 'background-color 0.1s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = isDark ? token.colorFillTertiary : token.colorFillAlter;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {/* Avatar */}
        <div style={{ marginRight: '8px', flexShrink: 0, width: showAvatar ? '32px' : 0 }}>
          {showAvatar && (
            <AssetAvatar
              avatarKey={msg.senderAvatar}
              size={32}
              fallback={(msg.senderName || 'U').charAt(0).toUpperCase()}
              style={{
                backgroundColor: avatarColor,
                color: 'white',
                fontSize: 13,
                fontWeight: 500,
              }}
            />
          )}
        </div>

        {/* Message Content */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Username and Timestamp */}
          {showAvatar && (
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                marginBottom: 1,
              }}
            >
              <Text
                strong
                style={{
                  fontSize: 14,
                  color: avatarColor,
                  fontWeight: 600,
                }}
              >
                {isCurrentUser ? 'You' : msg.senderName || 'Unknown User'}
              </Text>
              {msg.timestamp && (
                <Text
                  type="secondary"
                  title={formatFullTime(msg.timestamp)}
                  style={{
                    fontSize: 11,
                    fontWeight: 400,
                    color: token.colorTextTertiary,
                    cursor: 'help',
                    opacity: 0.7,
                  }}
                >
                  {formatTime(msg.timestamp)}
                </Text>
              )}
            </div>
          )}

          {/* Message Bubble */}
          <div
            style={{
              padding: hasActionStyling ? (isDark ? '10px 14px' : '12px 16px') : 0,
              borderRadius: hasActionStyling ? '8px' : 0,
              background: hasActionStyling ? actionColors.badgeBg : 'transparent',
              border: hasActionStyling ? `1.5px solid ${actionColors.badgeBorder}` : 'none',
              position: 'relative',
              boxShadow: isDark 
                ? (hasActionStyling ? `0 2px 8px rgba(0, 0, 0, 0.15)` : 'none')
                : (hasActionStyling ? `0 2px 8px ${actionColors.badgeBorder}20` : 'none'),
              transition: 'all 0.2s ease',
            }}
          >
            {/* Action Type Badge */}
            {isActionMessage && (
              <div style={{ marginBottom: hasActionStyling ? 10 : 6 }}>
                <Tag
                  color={actionColors.tagColor}
                  icon={actionIcon}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    border: `1px solid ${actionColors.tagBorder}`,
                    borderRadius: 6,
                    padding: '4px 10px',
                    height: 'auto',
                    lineHeight: '18px',
                    background: actionColors.tagBg,
                    color: actionColors.tagText,
                    boxShadow: isDark 
                      ? `0 1px 3px rgba(0, 0, 0, 0.2)` 
                      : `0 1px 3px ${actionColors.tagBorder}30`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {actionLabel}
                </Tag>
                
                {/* Question Context - Show question name for question approval actions */}
                {msg.questionContext && (
                  <div style={{ marginTop: 6 }}>
                    <Text
                      type="secondary"
                      style={{
                        fontSize: 11,
                        fontStyle: 'italic',
                      }}
                    >
                      Question: <Text strong style={{ fontSize: 11 }}>{msg.questionContext.questionName}</Text>
                      {msg.questionContext.questionType && (
                        <> ({msg.questionContext.questionType})</>
                      )}
                    </Text>
                  </div>
                )}
              </div>
            )}

            {/* Message Text */}
            {msg.text && !isSignature && (
              <Paragraph
                style={{
                  margin: 0,
                  color: hasActionStyling ? actionColors.textColor : token.colorText,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontWeight: hasActionStyling ? 500 : 400,
                  fontSize: 14,
                  lineHeight: 1.6,
                  maxWidth: '100%',
                  overflowWrap: 'break-word',
                }}
                ellipsis={
                  msg.text.length > 500
                    ? {
                        rows: 8,
                        expandable: true,
                        symbol: 'Show more',
                      }
                    : false
                }
              >
                {msg.text}
              </Paragraph>
            )}

            {/* Answer Display for Question Approval Requests */}
            {msg.actionType === 'question-approval-request' && (() => {
              const answerValue = getAnswerValue(msg);
              return answerValue ? (
                <div style={{
                  marginTop: '10px',
                  padding: '10px 12px',
                  background: token.colorFillAlter,
                  borderRadius: '6px',
                  border: `1px solid ${token.colorBorder}`,
                  borderLeft: `3px solid ${actionColors.tagText || token.colorWarning}`
                }}>
                  <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                    Answer:
                  </Text>
                  {(() => {
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
                      return <RichTextRenderer content={answerValue as JSONContent} className="tiptap ProseMirror rich-text-renderer answer-rich-text" />;
                    }
                    // Check if it's a stringified JSONContent
                    if (typeof answerValue === 'string') {
                      const trimmed = answerValue.trim();
                      if (trimmed.startsWith('{') && trimmed.includes('"type":"doc"')) {
                        try {
                          const parsed = JSON.parse(answerValue);
                          if (parsed && parsed.type === 'doc') {
                            return <RichTextRenderer content={parsed as JSONContent} className="tiptap ProseMirror rich-text-renderer answer-rich-text" />;
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
                              wordBreak: 'break-word',
                              color: actionColors.textColor || token.colorText
                            }}
                          />
                        );
                      }
                    }
                    // Fallback to plain text
                    return (
                      <Text strong style={{ fontSize: '14px', wordBreak: 'break-word', color: actionColors.textColor || token.colorText }}>
                        {String(answerValue)}
                      </Text>
                    );
                  })()}
                </div>
              ) : null;
            })()}

            {/* Signature */}
            {msg.signature && (
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <div
                  style={{
                    // background: '#ffffff', // Always white background for black signature text
                    padding: '6px',
                    borderRadius: '6px',
                    border: `1px solid ${isDark ? token.colorBorder : token.colorBorderSecondary}`,
                    display: 'inline-block',
                    boxShadow: isDark ? '0 1px 2px rgba(0, 0, 0, 0.2)' : '0 1px 2px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = isDark 
                      ? '0 2px 8px rgba(0, 0, 0, 0.3)' 
                      : '0 2px 8px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = isDark 
                      ? '0 1px 2px rgba(0, 0, 0, 0.2)' 
                      : '0 1px 2px rgba(0, 0, 0, 0.04)';
                  }}
                >
                  <Image
                    src={msg.signature.dataUrl}
                    alt="Signature"
                    width={160}
                    height={80}
                    style={{
                      maxWidth: '160px',
                      maxHeight: '80px',
                      objectFit: 'contain',
                      display: 'block',
                      borderRadius: '4px',
                      background: '#ffffff', // Always white background for black signature text
                    }}
                    preview={{
                      mask: 'Preview',
                      maskClassName: 'signature-preview-mask',
                      onVisibleChange: (visible) => {
                        if (visible) {
                          // Ensure light background for signature visibility (light gray, not pure white)
                          setTimeout(() => {
                            const previewImg = document.querySelector('.ant-image-preview-img');
                            if (previewImg) {
                              (previewImg as HTMLElement).style.backgroundColor = '#f5f5f5';
                            }
                          }, 100);
                        }
                      },
                    }}
                    fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5TaWduYXR1cmU8L3RleHQ+PC9zdmc+"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </React.Fragment>
  );
};

