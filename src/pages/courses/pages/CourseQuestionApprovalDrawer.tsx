/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Drawer,
  Input,
  Button,
  Typography,
  message as antMessage,
  Space,
  Tag,
  Alert,
  Spin,
  Empty,
} from 'antd';
import { AssetAvatar } from '../../../components';
import { theme } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useGetCourseFormQuestionApprovalMessagesQuery } from '../../../services/coursesApi';
import { useGetChannelMutation } from '../../../services/queueApi';
import type { CourseFormApprovalMessage, ApprovalStatus } from '../../../types/course';
import { skipToken } from '@reduxjs/toolkit/query';
import { useDispatch } from 'react-redux';
import { useSocketChannel } from '../../../hooks/useSocketChannel';
import { coursesApi } from '../../../services/coursesApi';

const { Title, Text } = Typography;

export interface CourseQuestionApprovalDrawerProps {
  open: boolean;
  onClose: () => void;
  courseId: string;
  pageId: string;
  formBlockId: string;
  questionKey: string;
  courseEnrolmentId: string;
  questionLabel?: string;
  /** Update the question node's approval attributes in the editor (so badge/button state stays in sync) */
  updateNodeAttributes?: (attrs: { approvalStatus?: ApprovalStatus; rejectionMessage?: string }) => void;
  /** Optional: show Required tag in title (matches queue drawer) */
  questionRequired?: boolean;
  /** Optional: list of approvers for display (matches queue drawer) */
  approvers?: Array<{ _id: string; name: string } | string>;
  /** Optional: context label e.g. form/course name (matches queue "Subject Context") */
  courseOrFormContext?: string;
  /** Optional: current user id to show "You" for own messages and to determine isApprover */
  currentUserId?: string;
  /** When false, template/form has approval disabled; show message and hide approval discussion. */
  templateHasApproval?: boolean;
  /** Optional channel ID for real-time socket updates. When provided, drawer joins course_form_question_approval room and refetches on new messages. */
  channelId?: string | null;
  /** Question node (type, attrs, content) for building questionData meta sent with messages (matches QuestionApprovalDrawer). */
  questionNode?: { type: string; attrs: Record<string, any>; content?: any };
}

interface FormattedMessage {
  _id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  action: string;
  actionData?: any;
  timestamp: Date;
  meta?: any;
}

export const CourseQuestionApprovalDrawer: React.FC<CourseQuestionApprovalDrawerProps> = ({
  open,
  onClose,
  courseId,
  pageId,
  formBlockId,
  questionKey,
  courseEnrolmentId,
  questionLabel = 'Question',
  updateNodeAttributes,
  questionRequired = false,
  approvers = [],
  courseOrFormContext,
  currentUserId,
  templateHasApproval = false,
  channelId: channelIdProp = null,
  questionNode: questionNodeProp,
}) => {
  const { token } = theme.useToken();
  const dispatch = useDispatch();
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const refetchRef = useRef<() => void>(() => {});
  const updateNodeAttributesRef = useRef(updateNodeAttributes);
  updateNodeAttributesRef.current = updateNodeAttributes;

  const { data, refetch, isLoading: isLoadingMessages } = useGetCourseFormQuestionApprovalMessagesQuery(
    open ? { courseId, pageId, formBlockId, questionKey, courseEnrolmentId } : skipToken
  );

  refetchRef.current = refetch;

  // Get channel ID using useGetChannelMutation (same pattern as QuestionApprovalDrawer)
  const [getChannel, { data: channelResponse }] = useGetChannelMutation();
  const [channelId, setChannelId] = useState<string | undefined>(undefined);
  const lastRequestedParamsRef = useRef<string | null>(null);

  const submission = data?.data?.submission;
  const channelIdFromResponse = data?.data?.channel?._id;

  // Channel request params for course_form_question_approval (need courseFormSubmissionId from messages response)
  const channelRequestParams = useMemo(() => {
    if (!open || !submission?._id) return null;
    return {
      channelType: 'course_form_question_approval' as const,
      courseFormSubmissionId: submission._id,
      courseEnrolmentId,
      coursePageId: pageId,
      formBlockId,
      questionKey,
    };
  }, [open, submission?._id, courseEnrolmentId, pageId, formBlockId, questionKey]);

  // Reset when drawer closes
  useEffect(() => {
    if (!open) {
      lastRequestedParamsRef.current = null;
      setChannelId(undefined);
    }
  }, [open]);

  // Trigger channel fetch when params are ready (same pattern as QuestionApprovalDrawer)
  useEffect(() => {
    if (!open || !channelRequestParams) return;
    const paramsKey = JSON.stringify(channelRequestParams);
    if (lastRequestedParamsRef.current === paramsKey) return;
    lastRequestedParamsRef.current = paramsKey;
    getChannel(channelRequestParams)
      .then((result) => {
        if ('data' in result && result.data?.data?._id) {
          setChannelId(result.data.data._id);
        }
      })
      .catch((err) => {
        console.error('[CourseQuestionApprovalDrawer] Failed to get channel:', err);
        lastRequestedParamsRef.current = null;
      });
  }, [channelRequestParams, open, getChannel]);

  // Sync channelId from mutation response (response shape: { data: { data: { _id } } })
  useEffect(() => {
    if (channelResponse?.data?.data?._id) {
      setChannelId(channelResponse.data.data._id);
    }
  }, [channelResponse?.data?.data?._id]);

  // Effective channel: prop (from list) > from getChannel mutation > from messages response
  const effectiveChannelId = channelIdProp ?? channelId ?? channelIdFromResponse ?? null;

  // Stable callback so useSocketChannel effect does not re-run on every render (e.g. when typing)
  const onSocketMessage = useCallback(
    () => {
      dispatch(
        coursesApi.util.invalidateTags([
          { type: 'CourseFormApproval', id: `${courseId}-${pageId}-${formBlockId}-${questionKey}-${courseEnrolmentId}` },
        ])
      );
      setTimeout(() => refetchRef.current(), 500);
    },
    [dispatch, courseId, pageId, formBlockId, questionKey, courseEnrolmentId]
  );

  // Real-time: join course_form_question_approval room and send/receive via Socket.IO
  const { sendMessage: sendSocketMessage } = useSocketChannel({
    channelId: open && effectiveChannelId ? effectiveChannelId : null,
    channelType: 'course_form_question_approval',
    onMessage: onSocketMessage,
    enabled: open && !!effectiveChannelId,
  });

  const [isSending, setIsSending] = useState(false);

  const messages = useMemo(() => data?.data?.messages ?? [], [data?.data?.messages]);
  const questionApprovalFromSubmission = submission?.questionApprovals?.find(
    (q: { questionKey: string }) => q.questionKey === questionKey
  );
  const approvalStatus: ApprovalStatus =
    (questionApprovalFromSubmission?.approvalStatus as ApprovalStatus) ?? 'pending';

  /** Normalize node content to array (handles JSON array or ProseMirror Fragment from view) */
  const contentToArray = useCallback((content: any): any[] => {
    if (!content) return [];
    if (Array.isArray(content)) return content;
    if (content?.content && Array.isArray(content.content)) return content.content;
    if (typeof content[Symbol.iterator] === 'function') return Array.from(content);
    return [];
  }, []);

  /** Extract question label from node content (first paragraph/heading) for title and meta. Handles both JSON and ProseMirror node shapes. */
  const resolvedQuestionLabel = useMemo(() => {
    if (!questionNodeProp?.content) return questionLabel;
    const arr = contentToArray(questionNodeProp.content);
    if (!arr.length) return questionLabel;
    const extractText = (n: any): string => {
      if (!n) return '';
      // ProseMirror nodes expose text via .textContent
      if (typeof n.textContent === 'string' && n.textContent.trim()) return n.textContent.trim();
      // JSON text node
      const typeName = n?.type?.name ?? n?.type;
      if (typeName === 'text' && typeof n.text === 'string') return n.text;
      const inner = contentToArray(n.content);
      if (inner.length) return inner.map(extractText).join('');
      return '';
    };
    for (const child of arr) {
      const type = child?.type?.name ?? child?.type;
      if (type === 'paragraph' || type === 'heading') {
        const text = extractText(child)?.trim();
        if (text) return text;
      }
    }
    return questionLabel;
  }, [questionNodeProp, questionLabel, contentToArray]);

  // Build questionData from questionNode (same shape as QuestionApprovalDrawer for messages)
  const questionData = useMemo(() => {
    if (!questionNodeProp?.attrs) return null;
    const attrs = questionNodeProp.attrs;
    const nodeType = questionNodeProp.type;
    const questionValue = attrs.value;
    const answerData: Record<string, any> = { required: attrs.required };

    switch (nodeType) {
      case 'shortText':
      case 'longText':
        answerData.textValue = questionValue;
        answerData.placeholder = attrs.placeholder;
        answerData.maxLength = attrs.maxLength;
        break;
      case 'numberField':
        answerData.numberValue = questionValue;
        answerData.min = attrs.min;
        answerData.max = attrs.max;
        answerData.step = attrs.step;
        answerData.unit = attrs.unit;
        answerData.prefix = attrs.prefix;
        answerData.suffix = attrs.suffix;
        break;
      case 'dateField':
        answerData.dateValue = questionValue;
        answerData.format = attrs.format;
        break;
      case 'dateTimeField':
        answerData.dateTimeValue = questionValue;
        answerData.format = attrs.format;
        break;
      case 'singleChoice': {
        const nodeContent = contentToArray(questionNodeProp.content);
        let selectedOptionDetails: any = null;
        if (questionValue && nodeContent.length) {
          const getOptionLabel = (optNode: any): string => {
            if (!optNode) return '';
            if (typeof optNode.textContent === 'string' && optNode.textContent.trim()) return optNode.textContent.trim();
            return optNode?.content?.[0]?.text ?? optNode?.attrs?.value ?? '';
          };
          const otherNode = nodeContent.find((c: any) => (c?.type === 'singleChoiceOther' || c?.type?.name === 'singleChoiceOther'));
          if (questionValue === '__other__' || questionValue === 'other') {
            const otherLabel = getOptionLabel(otherNode) || (attrs.otherPlaceholder ?? 'Other…');
            selectedOptionDetails = { value: '__other__', label: otherLabel };
          } else {
            const optionNode = nodeContent.find((c: any) => (c?.type === 'singleChoiceOption' || c?.type?.name === 'singleChoiceOption') && (c?.attrs?.value === questionValue));
            const optionLabel = getOptionLabel(optionNode) || (optionNode?.attrs?.value ?? questionValue);
            selectedOptionDetails = { value: questionValue, label: optionLabel };
          }
        }
        if (selectedOptionDetails) answerData.selectedOption = selectedOptionDetails;
        answerData.options = attrs.options;
        answerData.otherValue = attrs.otherValue;
        break;
      }
      case 'multipleChoice': {
        const nodeContent = contentToArray(questionNodeProp.content);
        const getOptionLabelByValue = (v: string): string => {
          const optNode = nodeContent.find((c: any) => (c?.type === 'multipleChoiceOption' || c?.type?.name === 'multipleChoiceOption') && (c?.attrs?.value === v));
          if (!optNode) return v;
          if (typeof optNode.textContent === 'string' && optNode.textContent.trim()) return optNode.textContent.trim();
          return optNode?.content?.[0]?.text ?? optNode?.attrs?.value ?? v;
        };
        const selectedValues = Array.isArray(questionValue) ? questionValue : [];
        answerData.selectedOptions = selectedValues;
        answerData.selectedOptionLabels = selectedValues.map(getOptionLabelByValue);
        answerData.options = attrs.options;
        answerData.otherValue = attrs.otherValue;
        break;
      }
      case 'ratingField':
        answerData.ratingValue = questionValue;
        answerData.maxRating = attrs.scale ?? attrs.maxRating ?? 5;
        answerData.ratingLabels = attrs.anchorLabels ?? attrs.ratingLabels;
        answerData.ratingVariant = attrs.variant ?? 'stars';
        answerData.allowHalf = attrs.allowHalf ?? false;
        break;
      case 'sliderRangeField':
        answerData.sliderValue = questionValue;
        answerData.min = attrs.min;
        answerData.max = attrs.max;
        answerData.step = attrs.step;
        answerData.unit = attrs.unit;
        break;
      case 'ranking':
        answerData.order = attrs.order ?? questionValue;
        answerData.options = attrs.options;
        break;
      case 'richText':
        answerData.jsonContent = typeof questionValue === 'object' && questionValue?.type === 'doc' ? questionValue : (typeof questionValue === 'string' && questionValue.trim().startsWith('{') ? (() => { try { const p = JSON.parse(questionValue); return p?.type === 'doc' ? p : questionValue; } catch { return questionValue; } })() : questionValue);
        break;
      case 'addressNode':
      case 'addressField': {
        let addressData = questionValue;
        if (typeof questionValue === 'string') {
          try { addressData = JSON.parse(questionValue); } catch { /* keep string */ }
        }
        answerData.addressData = addressData && typeof addressData === 'object' ? addressData : { formatted: questionValue };
        break;
      }
      default:
        answerData.rawValue = questionValue;
    }

    return {
      questionId: attrs.id ?? attrs.name ?? questionKey,
      questionName: attrs.name ?? '',
      questionType: nodeType,
      questionLabel: attrs.label ?? resolvedQuestionLabel ?? attrs.name ?? '',
      questionValue,
      answerData,
    };
  }, [questionNodeProp, questionKey, questionLabel, resolvedQuestionLabel, contentToArray]);

  // Meta for socket messages (same pattern as QuestionApprovalDrawer - include questionData for messages)
  const meta = useMemo(
    () => ({
      courseId,
      pageId,
      formBlockId,
      questionKey,
      courseEnrolmentId,
      questionLabel,
      ...(courseOrFormContext != null && { courseOrFormContext }),
      ...(questionData && { questionData }),
    }),
    [courseId, pageId, formBlockId, questionKey, courseEnrolmentId, questionLabel, courseOrFormContext, questionData]
  );

  // Sync approval status to editor node when drawer opens or status changes. Use ref for
  // updateNodeAttributes so we don't depend on callback identity and avoid infinite re-renders.
  useEffect(() => {
    if (!open || !approvalStatus) return;
    const update = updateNodeAttributesRef.current;
    if (!update) return;
    if (approvalStatus === 'approved' || approvalStatus === 'rejected' || approvalStatus === 'requested') {
      update({
        approvalStatus,
        ...(approvalStatus === 'rejected' ? { rejectionMessage: undefined } : {}),
      });
    }
  }, [open, approvalStatus]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formattedMessages: FormattedMessage[] = useMemo(() => {
    return messages.map((msg: CourseFormApprovalMessage) => {
      const sentBy = msg.sentBy as any;
      const senderId = sentBy?._id || sentBy?.user?._id || '';
      const senderName =
        sentBy?.user?.name || sentBy?.user?.firstName || sentBy?.user?.email || sentBy?.name || 'Someone';
      const senderAvatar = sentBy?.user?.avatar;
      let text = '';
      if (msg.action === 'approval:approved') {
        const comment = msg.actionData?.comment || msg.actionData?.text;
        text = comment ? `approved with comment: ${comment}` : 'approved';
      } else if (msg.action === 'approval:rejected') {
        const comment = msg.actionData?.comment || msg.actionData?.text;
        text = comment ? `rejected: ${comment}` : 'rejected';
      } else if (msg.action === 'approval:requested') {
        const comment = msg.actionData?.comment || msg.actionData?.text;
        text = comment ? `requested approval with comment: ${comment}` : 'requested approval';
      } else {
        text = msg.actionData?.text || (msg as any).text || '';
      }
      return {
        _id: (msg as any)._id || String(Date.now()),
        senderId,
        senderName,
        senderAvatar,
        text,
        action: msg.action,
        actionData: msg.actionData,
        timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
        meta: (msg as any).meta,
      };
    }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    if (!effectiveChannelId) {
      antMessage.error('Channel not ready. Please wait and try again.');
      return;
    }
    setIsSending(true);
    const text = messageText.trim();
    setMessageText('');
    sendSocketMessage(text, { action: 'message', actionData: { text }, meta });
    setTimeout(() => {
      refetchRef.current();
      setIsSending(false);
    }, 500);
  };

  const handleRequestApproval = () => {
    if (!effectiveChannelId) {
      antMessage.error('Channel not ready. Please wait and try again.');
      return;
    }
    setIsSending(true);
    const text = messageText.trim() || 'Please review and approve this question.';
    setMessageText('');
    sendSocketMessage(text, { action: 'approval:requested', actionData: { text }, meta });
    updateNodeAttributes?.({ approvalStatus: 'requested' });
    setTimeout(() => {
      refetchRef.current();
      setIsSending(false);
    }, 500);
  };

  const handleApprove = () => {
    if (!effectiveChannelId) {
      antMessage.error('Channel not ready. Please wait and try again.');
      return;
    }
    setIsSending(true);
    const comment = messageText.trim();
    sendSocketMessage(comment || '', {
      action: 'approval:approved',
      actionData: comment ? { comment } : {},
      meta,
    });
    updateNodeAttributes?.({ approvalStatus: 'approved', rejectionMessage: undefined });
    setTimeout(() => {
      refetchRef.current();
      setIsSending(false);
    }, 500);
  };

  const handleReject = () => {
    if (!messageText.trim()) {
      antMessage.warning('Please provide a reason for rejection');
      return;
    }
    if (!effectiveChannelId) {
      antMessage.error('Channel not ready. Please wait and try again.');
      return;
    }
    setIsSending(true);
    const comment = messageText.trim();
    setMessageText('');
    sendSocketMessage(comment, { action: 'approval:rejected', actionData: { comment }, meta });
    updateNodeAttributes?.({ approvalStatus: 'rejected', rejectionMessage: comment });
    setTimeout(() => {
      refetchRef.current();
      setIsSending(false);
    }, 500);
  };

  const approversList = Array.isArray(approvers) ? approvers : [];
  const isApprover = currentUserId && approversList.some((a) => (typeof a === 'string' ? a === currentUserId : a._id === currentUserId));

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

  // Get displayable answer from message meta (matches QuestionApprovalChat - for showing question/answer in messages)
  const getAnswerDisplayFromMessage = useCallback((msg: FormattedMessage): { questionLabel?: string; questionType?: string; answerValue: React.ReactNode; answerData?: any } | null => {
    const qd = msg.meta?.questionData;
    if (!qd) return null;
    const ad = qd.answerData;
    const displayQuestionLabel = qd.questionLabel ?? questionLabel;
    const questionType = qd.questionType;

    let answerValue: React.ReactNode = null;
    if (ad) {
      if (ad.selectedOption && typeof ad.selectedOption === 'object' && ad.selectedOption.label != null) {
        const opt = ad.selectedOption;
        if ((opt.value === '__other__' || opt.value === 'other') && ad.otherValue) {
          answerValue = (
            <>
              <Text strong style={{ fontSize: 14 }}>{opt.label}</Text>
              <Text type="secondary" style={{ fontSize: 13, fontStyle: 'italic', display: 'block', marginTop: 4 }}>{String(ad.otherValue)}</Text>
            </>
          );
        } else {
          answerValue = <Text strong style={{ fontSize: 14 }}>{opt.label ?? opt.value}</Text>;
        }
      } else if (ad.selectedOptions && Array.isArray(ad.selectedOptions) && ad.selectedOptions.length > 0) {
        const labels = Array.isArray(ad.selectedOptionLabels) && ad.selectedOptionLabels.length === ad.selectedOptions.length
          ? (ad.selectedOptionLabels as string[])
          : (ad.selectedOptions as string[]).map((v: string) => {
              const opt = Array.isArray(ad.options) ? ad.options.find((o: any) => (o?.value ?? o?.id) === v) : null;
              return opt && typeof opt === 'object' ? (opt.label ?? opt.name ?? v) : v;
            });
        answerValue = (
          <Space wrap size={4}>
            {labels.map((l, i) => (
              <Tag key={i} color="blue" style={{ margin: 0 }}>{l}</Tag>
            ))}
            {(ad.selectedOptions.includes('__other__') || ad.selectedOptions.includes('other')) && ad.otherValue && (
              <Text type="secondary" style={{ fontSize: 13, fontStyle: 'italic' }}>Other: {String(ad.otherValue)}</Text>
            )}
          </Space>
        );
      } else if (ad.textValue != null && ad.textValue !== '') {
        answerValue = <Text style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{String(ad.textValue)}</Text>;
      } else if (ad.numberValue != null && ad.numberValue !== '') {
        const pre = ad.prefix ?? ''; const suf = ad.suffix ?? ''; const u = ad.unit ?? '';
        answerValue = <Text strong style={{ fontSize: 14 }}>{[pre, ad.numberValue, suf, u].filter(Boolean).join(' ')}</Text>;
      } else if (ad.dateValue) {
        answerValue = <Text strong style={{ fontSize: 14 }}>{String(ad.dateValue)}</Text>;
      } else if (ad.dateTimeValue) {
        answerValue = <Text strong style={{ fontSize: 14 }}>{String(ad.dateTimeValue)}</Text>;
      } else if (ad.ratingValue != null) {
        answerValue = <Text strong style={{ fontSize: 14 }}>{String(ad.ratingValue)}</Text>;
      } else if (ad.sliderValue != null) {
        answerValue = <Text strong style={{ fontSize: 14 }}>{ad.unit ? `${ad.sliderValue} ${ad.unit}` : String(ad.sliderValue)}</Text>;
      } else if (ad.jsonContent && typeof ad.jsonContent === 'object' && ad.jsonContent.type === 'doc') {
        answerValue = <Text style={{ fontSize: 14 }} type="secondary">[Rich text]</Text>;
      } else if (ad.addressData && typeof ad.addressData === 'object') {
        const a = ad.addressData;
        answerValue = <Text style={{ fontSize: 14 }}>{a.formatted || [a.street, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(', ')}</Text>;
      } else if (ad.rawValue != null) {
        answerValue = <Text style={{ fontSize: 14 }}>{String(ad.rawValue)}</Text>;
      }
    }
    if (answerValue == null && qd.questionValue != null && qd.questionValue !== '') {
      answerValue = <Text style={{ fontSize: 14 }}>{String(qd.questionValue)}</Text>;
    }
    if (answerValue == null) return null;
    return { questionLabel: displayQuestionLabel, questionType, answerValue, answerData: ad };
  }, [questionLabel]);

  return (
    <Drawer
      title={
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Space>
            <Title level={5} style={{ margin: 0 }}>
              {resolvedQuestionLabel || questionLabel || 'Question Approval'}
            </Title>
          </Space>
          <Space>
            {questionRequired && (
              <Tag color="orange">Required</Tag>
            )}
          </Space>
        </Space>
      }
      placement="right"
      onClose={onClose}
      open={open}
      width={600}
      footer={null}
      destroyOnHidden
      styles={{
        body: { paddingTop: 16 },
      }}
    >
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {templateHasApproval === false && (
          <Alert
            message="Approval not enabled for this form"
            description="Question-level approval is only available when the form has approval enabled."
            type="info"
            showIcon
            style={{ marginBottom: 8 }}
          />
        )}
        {templateHasApproval !== false && (
        <>
        {/* Course / Form Context (matches queue "Subject Context") */}
        <div
          style={{
            background: token.colorBgLayout,
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${token.colorBorder}`,
          }}
        >
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
            Context
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {courseOrFormContext || 'This course'}
          </Text>
        </div>

        {/* Approvers (matches queue drawer) */}
        <div
          style={{
            background: token.colorBgLayout,
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${token.colorBorder}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text strong style={{ fontSize: 13 }}>
              Approvers
            </Text>
            {approversList.length > 0 && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {approversList.length} {approversList.length === 1 ? 'approver' : 'approvers'}
              </Text>
            )}
          </div>
          {approversList.length > 0 ? (
            <div style={{ maxHeight: 120, overflowY: 'auto', overflowX: 'hidden' }}>
              <Space wrap size={[4, 4]}>
                {approversList.map((approver, index) => {
                  const display = typeof approver === 'string' ? approver : (approver as any)?.name || (approver as any)?._id || 'Unknown';
                  return (
                    <Tag key={index} color="blue" style={{ margin: 0, fontSize: 11, padding: '0 6px' }}>
                      {display}
                    </Tag>
                  );
                })}
              </Space>
            </div>
          ) : (
            <Alert
              message="No approvers assigned"
              type="warning"
              showIcon
              description="Approvers may be configured at the form level."
              style={{ fontSize: 12 }}
            />
          )}
        </div>

        {/* Approval Discussion (matches QuestionApprovalChat) */}
        <div>
          <Text strong style={{ fontSize: 16, marginBottom: 8, display: 'block' }}>
            Approval Discussion
          </Text>
          <div
            style={{
              background: token.colorBgLayout,
              borderRadius: 8,
              border: `1px solid ${token.colorBorder}`,
              overflow: 'hidden',
              position: 'relative',
              minHeight: 300,
            }}
          >
            {isLoadingMessages ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, padding: 40 }}>
                <Spin size="large" />
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  background: token.colorBgContainer,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: 16,
                    background: token.colorBgLayout,
                    minHeight: 300,
                    maxHeight: 400,
                  }}
                >
                  {formattedMessages.length === 0 ? (
                    <Empty description="No messages yet" style={{ marginTop: 32 }} />
                  ) : (
                    <>
                      {formattedMessages.map((msg, index) => {
                        const prevMessage = index > 0 ? formattedMessages[index - 1] : null;
                        const showAvatar =
                          !prevMessage ||
                          prevMessage.senderId !== msg.senderId ||
                          (msg.timestamp && prevMessage.timestamp &&
                            msg.timestamp.getTime() - prevMessage.timestamp.getTime() > 300000);
                        const isCurrentUser = currentUserId && msg.senderId === currentUserId;
                        const messageSpacing = !showAvatar ? '4px' : '16px';

                        return (
                          <div
                            key={msg._id}
                            style={{
                              marginBottom: messageSpacing,
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 8,
                            }}
                          >
                            {showAvatar ? (
                              <AssetAvatar
                                avatarKey={msg.senderAvatar}
                                size={32}
                                fallback={msg.senderName.charAt(0).toUpperCase()}
                                style={{ backgroundColor: getMessageColor(msg.senderId), flexShrink: 0 }}
                              />
                            ) : (
                              <div style={{ width: 32, flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {showAvatar && (
                                <div style={{ marginBottom: 4 }}>
                                  <Text strong style={{ fontSize: 13 }}>
                                    {isCurrentUser ? 'You' : msg.senderName}
                                  </Text>
                                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                                    {formatTime(msg.timestamp)}
                                  </Text>
                                </div>
                              )}
                              <div
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  backgroundColor: isCurrentUser ? token.colorPrimaryBg : token.colorBgLayout,
                                  border: `1px solid ${token.colorBorder}`,
                                }}
                              >
                                {msg.action === 'approval:requested' ? (
                                  <div>
                                    <div
                                      style={{
                                        marginBottom: msg.text ? 8 : 0,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '4px 8px',
                                        background: token.colorWarningBg || '#fff7e6',
                                        borderRadius: 4,
                                        border: `1px solid ${token.colorWarningBorder || token.colorWarning || '#faad14'}`,
                                      }}
                                    >
                                      <ClockCircleOutlined style={{ marginRight: 6, color: token.colorWarning, fontSize: 14 }} />
                                      <Text type="warning" strong style={{ fontSize: 13 }}>
                                        Approval Request
                                      </Text>
                                    </div>
                                    {msg.text && (
                                      <div style={{ marginTop: 8 }}>
                                        <Text style={{ fontSize: 14, lineHeight: 1.5, color: token.colorText }}>
                                          {msg.text}
                                        </Text>
                                      </div>
                                    )}
                                    {(() => {
                                      const qa = getAnswerDisplayFromMessage(msg);
                                      if (!qa) return null;
                                      return (
                                        <div style={{ marginTop: 12, padding: '12px 14px', background: token.colorFillQuaternary || token.colorFillAlter, borderRadius: 8, border: `1px solid ${token.colorBorderSecondary || token.colorBorder}`, borderLeft: `4px solid ${token.colorWarning}` }}>
                                          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Question
                                          </Text>
                                          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>{qa.questionLabel || 'Question'}</Text>
                                          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Answer
                                          </Text>
                                          <div>{qa.answerValue}</div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                ) : msg.action === 'approval:approved' ? (
                                  <div>
                                    <div
                                      style={{
                                        marginBottom: msg.text ? 8 : 0,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '4px 8px',
                                        background: token.colorSuccessBg || '#f6ffed',
                                        borderRadius: 4,
                                        border: `1px solid ${token.colorSuccessBorder || token.colorSuccess || '#52c41a'}`,
                                      }}
                                    >
                                      <CheckCircleOutlined style={{ marginRight: 6, color: token.colorSuccess, fontSize: 14 }} />
                                      <Text type="success" strong style={{ fontSize: 13 }}>
                                        Approved
                                      </Text>
                                    </div>
                                    {msg.text && (
                                      <div style={{ marginTop: 8 }}>
                                        <Text style={{ fontSize: 14, lineHeight: 1.5, color: token.colorText }}>
                                          {msg.text}
                                        </Text>
                                      </div>
                                    )}
                                    {(() => {
                                      const qa = getAnswerDisplayFromMessage(msg);
                                      if (!qa) return null;
                                      return (
                                        <div style={{ marginTop: 12, padding: '12px 14px', background: token.colorFillQuaternary || token.colorFillAlter, borderRadius: 8, border: `1px solid ${token.colorBorderSecondary || token.colorBorder}` }}>
                                          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Question</Text>
                                          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>{qa.questionLabel || 'Question'}</Text>
                                          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Answer</Text>
                                          <div>{qa.answerValue}</div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                ) : msg.action === 'approval:rejected' ? (
                                  <div>
                                    <div
                                      style={{
                                        marginBottom: msg.text ? 8 : 0,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '4px 8px',
                                        background: token.colorErrorBg || '#fff2f0',
                                        borderRadius: 4,
                                        border: `1px solid ${token.colorErrorBorder || token.colorError || '#ff4d4f'}`,
                                      }}
                                    >
                                      <CloseCircleOutlined style={{ marginRight: 6, color: token.colorError, fontSize: 14 }} />
                                      <Text type="danger" strong style={{ fontSize: 13 }}>
                                        Rejected
                                      </Text>
                                    </div>
                                    {msg.text && (
                                      <div style={{ marginTop: 8 }}>
                                        <Text style={{ fontSize: 14, lineHeight: 1.5, color: token.colorText }}>
                                          {msg.text}
                                        </Text>
                                      </div>
                                    )}
                                    {(() => {
                                      const qa = getAnswerDisplayFromMessage(msg);
                                      if (!qa) return null;
                                      return (
                                        <div style={{ marginTop: 12, padding: '12px 14px', background: token.colorFillQuaternary || token.colorFillAlter, borderRadius: 8, border: `1px solid ${token.colorBorderSecondary || token.colorBorder}` }}>
                                          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Question</Text>
                                          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>{qa.questionLabel || 'Question'}</Text>
                                          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Answer</Text>
                                          <div>{qa.answerValue}</div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                ) : (
                                  <Text style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {msg.text}
                                  </Text>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Input area (matches QuestionApprovalChat) */}
                <div
                  style={{
                    borderTop: `1px solid ${token.colorBorder}`,
                    padding: 16,
                    background: token.colorBgContainer,
                  }}
                >
                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      placeholder={
                        isApprover
                          ? 'Type a message or rejection reason...'
                          : 'Type a message or comment for approval request...'
                      }
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onPressEnter={(e) => {
                        if (!e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={isSending}
                    />
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={handleSendMessage}
                      loading={isSending}
                      disabled={!messageText.trim()}
                    >
                      Send
                    </Button>
                  </Space.Compact>

                  {/* Request Approval (when not approver or when no approvers list - show to submitter) */}
                  {(!isApprover || approversList.length === 0) && (
                    <div style={{ marginTop: 12 }}>
                      <Button
                        type="default"
                        icon={<ClockCircleOutlined />}
                        onClick={handleRequestApproval}
                        loading={isSending}
                        disabled={approvalStatus === 'approved' || approvalStatus === 'requested'}
                        block
                        style={{
                          borderColor: token.colorWarning,
                          color: token.colorWarning,
                          opacity: approvalStatus === 'approved' || approvalStatus === 'requested' ? 0.6 : 1,
                        }}
                      >
                        {approvalStatus === 'pending'
                          ? 'Request Approval'
                          : approvalStatus === 'requested'
                          ? 'Approval Requested'
                          : approvalStatus === 'rejected'
                          ? 'Re-request Approval'
                          : 'Request Approval'}
                        {messageText.trim() && <span style={{ marginLeft: 4, fontSize: 12, opacity: 0.8 }}>(with comment)</span>}
                      </Button>
                      {(approvalStatus === 'requested' || approvalStatus === 'approved') && (
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                          {approvalStatus === 'approved'
                            ? 'This question has been approved. You can still view the conversation.'
                            : 'This question has been requested for approval. You can still view the conversation.'}
                        </Text>
                      )}
                    </div>
                  )}

                  {/* Approve / Reject (when pending/requested; for approvers or everyone if no approvers) */}
                  {(approvalStatus === 'pending' || approvalStatus === 'requested') && (isApprover || approversList.length === 0) && (
                    <div style={{ marginTop: 12 }}>
                      <Space>
                        <Button
                          type="primary"
                          icon={<CheckCircleOutlined />}
                          onClick={handleApprove}
                          loading={isSending}
                          style={{ background: token.colorSuccess }}
                        >
                          Approve
                        </Button>
                        <Button
                          danger
                          icon={<CloseCircleOutlined />}
                          onClick={handleReject}
                          disabled={!messageText.trim()}
                          loading={isSending}
                        >
                          Reject with Message
                        </Button>
                      </Space>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        </>
        )}
      </Space>
    </Drawer>
  );
};
