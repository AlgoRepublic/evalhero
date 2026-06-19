/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Layout, Typography, Space, theme, Spin, Alert, List, Badge, Button, Input, message as antMessage, Grid, Collapse } from 'antd';
import { ArrowLeftOutlined, SearchOutlined, UserOutlined, MessageOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { Message, Thread } from '../types';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ThreadView } from './ThreadView';
import { JitsiHuddle } from './JitsiHuddle';
import {
  transformApiMessageToMessage,
  ApiMessage,
} from '../../../services/chatApi';
import {
  useGetChannelMessagesQuery,
  ChannelMessage,
  ChannelData,
  QuestionApprovalChannelRecord,
  CourseFormApprovalChannelRecord,
  CourseFormApprovalChannelItem,
  queueApi,
} from '../../../services/queueApi';
import { skipToken } from '@reduxjs/toolkit/query';
import { ChatType } from './ChannelList';
import { useSocketChannel } from '../../../hooks/useSocketChannel';
import { useSocket } from '../../../context/SocketContext';
import { Profile } from '../../../features/auth/authSlice';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../../store';
import { APPROVAL_TAB_ITEMS } from './chatLayoutUtils';

const { Header, Content, Footer } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

/** Socket/channel type for approval tabs: form (assignment) vs course inline form */
export type ApprovalChannelType = 'question_approval' | 'course_form_question_approval';

interface MessagePanelProps {
  channel?: ChannelData;
  threadId?: string | null;
  onThreadSelect?: (threadId: string | null) => void;
  channels?: ChannelData[];
  records?: (QuestionApprovalChannelRecord | CourseFormApprovalChannelRecord)[];
  type?: ChatType;
  onChannelSelect?: (channel: ChannelData) => void;
  onBack?: () => void;
  approvalRecord?: QuestionApprovalChannelRecord | CourseFormApprovalChannelRecord | null;
  onRefetchApprovalChannels?: () => void;
  selectedQuestionApprovalStatus?: string;
  /** When on approval tab: which channel type for socket and send (form vs course). Defaults to question_approval. */
  approvalChannelType?: ApprovalChannelType;
}

export const MessagePanel = ({
  channel,
  threadId,
  onThreadSelect,
  channels,
  records,
  type,
  onChannelSelect,
  onBack,
  approvalRecord,
  onRefetchApprovalChannels,
  selectedQuestionApprovalStatus,
  approvalChannelType,
}: MessagePanelProps) => {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isMd = screens.md || screens.lg || screens.xl || screens.xxl;
  const { selectedProfile, user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();
  const socket = useSocket();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [showJitsi, setShowJitsi] = useState(false);
  const [jitsiRoomId, setJitsiRoomId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sending, setSending] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Track current channel ID to detect channel changes
  const currentChannelIdRef = useRef<string | null>(null);
  const [isChannelChanging, setIsChannelChanging] = useState(false);
  // Fetch question messages from API - skip if no channel or showing channels list
  const shouldFetchMessages = !!channel && !(channels && onChannelSelect && type);
  // Use channel._id directly as the channel ID (socket channel ID)
  const socketChannelId = shouldFetchMessages && channel ? channel._id : null;
  const channelId = socketChannelId;
  // Use channel's channelType for socket when available so course_form_question_approval channels use the correct room/events
  const effectiveApprovalChannelType: ApprovalChannelType | undefined =
    channel?.channelType === 'course_form_question_approval' || channel?.channelType === 'question_approval'
      ? (channel.channelType as ApprovalChannelType)
      : approvalChannelType;

  // Get questionConversation from channel (needed for other uses)
  const questionConversation = useMemo(() => {
    if (!channel) return null;
    // First try to get from channel's stored questionConversation
    if (channel?.questionConversation) {
      return channel.questionConversation;
    }
    return null;
  }, [channel]);
  
  // Store refetch function in ref to avoid recreating socket callbacks
  const refetchMessagesRef = useRef<(() => Promise<any>) | null>(null);
  const refetchWithCacheInvalidationRef = useRef<(() => Promise<void>) | null>(null);
  
  // Channel messages query (using channelId from useGetChannelQuery) - same pattern as useApprovalMessages
  const { 
    data: messagesResponse, 
    isLoading, 
    isError, 
    error,
    refetch: refetchMessages
  } = useGetChannelMessagesQuery(
    shouldFetchMessages && socketChannelId ? { channelId: socketChannelId } : skipToken,
    {
      skip: !shouldFetchMessages || !socketChannelId,
      pollingInterval: 0, // Disable polling - rely on Socket.IO for real-time updates
      refetchOnMountOrArgChange: false, // Only fetch once when channel becomes available
      refetchOnFocus: false, // Don't refetch on window focus
      refetchOnReconnect: false, // Don't refetch on reconnect (Socket.IO handles this)
    }
  );
  
  // Helper function to invalidate cache and refetch messages
  const refetchMessagesWithCacheInvalidation = useCallback(async () => {
    if (!socketChannelId) return;
    
    // Invalidate cache tags to force fresh data
    dispatch(queueApi.util.invalidateTags([{ type: 'Queue', id: `channel-messages-${socketChannelId}` }]));
    
    // Then refetch
    if (refetchMessagesRef.current) {
      await refetchMessagesRef.current();
    }
  }, [socketChannelId, dispatch]);
  
  // Update refetch refs when functions change
  useEffect(() => {
    refetchMessagesRef.current = refetchMessages;
  }, [refetchMessages]);
  
  useEffect(() => {
    refetchWithCacheInvalidationRef.current = refetchMessagesWithCacheInvalidation;
  }, [refetchMessagesWithCacheInvalidation]);
  
  // Get questionConversation from messagesResponse (for other uses, not for socket channel ID)
  const questionConversationFromMessages = useMemo(() => {
    if (messagesResponse?.data?.questionConversation) {
      return messagesResponse.data.questionConversation;
    }
    return questionConversation;
  }, [messagesResponse?.data?.questionConversation, questionConversation]);
  
  // Socket.IO integration for real-time updates
  // Use effectiveApprovalChannelType (from channel.channelType when available) so course form channels use course_form_question_approval
  useSocketChannel({
    channelId: socketChannelId,
    channelType: effectiveApprovalChannelType,
    onMessage: (message: { channelId?: string; channel?: string; message?: ApiMessage }) => {
      // When a new message arrives via Socket.IO, refetch messages to get the latest state
      console.log('[MessagePanel] New message received via Socket.IO:', message);

      const msg = message?.message;
      const isNonMessageAction = msg?.action && msg.action !== 'message';
      
      // Use ref to avoid dependency on refetchMessages in socket callback
      setTimeout(async () => {
        try {
          // Invalidate cache and refetch messages
          if (refetchWithCacheInvalidationRef.current) {
            await refetchWithCacheInvalidationRef.current();
          }
          
          // If action is not 'message', also refetch approval channels with longer delay
          // to ensure server has updated the channel status
          if (isNonMessageAction && onRefetchApprovalChannels) {
            console.log('[MessagePanel] Non-message action detected, refetching approval channels:', msg?.action);
            // Use a longer delay for approval channels to ensure server has updated the status
            // Force refetch to bypass cache and get fresh data
            setTimeout(() => {
              console.log('[MessagePanel] First refetch of approval channels');
              onRefetchApprovalChannels();
              // Second refetch after additional delay to catch any delayed updates
              setTimeout(() => {
                console.log('[MessagePanel] Second refetch of approval channels');
                onRefetchApprovalChannels();
              }, 1500);
            }, 1000); // Initial 1 second delay to ensure server has updated questionApprovalStatus
          }
        } catch (error) {
          console.error('[MessagePanel] Error calling refetch:', error);
        }
      }, 500); // Small delay to allow server to save the message
    },
    onError: (error) => {
      console.error('[MessagePanel] Socket.IO error:', error);
    },
    enabled: shouldFetchMessages && !!socketChannelId,
  });
  
  // Clear messages and set loading state when channel changes
  useEffect(() => {
    if (channelId && channelId !== currentChannelIdRef.current) {
      // Channel is changing
      setIsChannelChanging(true);
      currentChannelIdRef.current = channelId;
      // Clear optimistic messages when switching channels
      setOptimisticMessages([]);
      setThreads([]);
    } else if (!channelId) {
      // No channel selected
      currentChannelIdRef.current = null;
      setIsChannelChanging(false);
    }
  }, [channelId]);
  
  // Reset channel changing flag when new messages arrive
  useEffect(() => {
    if (messagesResponse && !isLoading && isChannelChanging) {
      setIsChannelChanging(false);
    }
  }, [messagesResponse, isLoading, isChannelChanging]);

  // Transform and merge API messages with optimistic messages (only when channel exists)
  // Handle response format from useGetChannelMessagesQuery: data.records
  // Return empty array if channel is changing to prevent showing stale messages
  const messagesArray = useMemo(() => {
    // Don't show messages while channel is changing
    if (isChannelChanging) return [];
    if (!messagesResponse) return [];
    
    // Check if data.records exists (useGetChannelMessagesQuery format)
    if (messagesResponse.data?.records && Array.isArray(messagesResponse.data.records)) {
      // Return the array directly - RTK Query should provide new references on updates
      return messagesResponse.data.records;
    }
    
    // Fallback: Check if data.messages exists (old format - for backward compatibility)
    if (messagesResponse.data?.messages && Array.isArray(messagesResponse.data.messages)) {
      return messagesResponse.data.messages;
    }
    
    return [];
  }, [messagesResponse, isChannelChanging]);
  
  
  // Extract meta from conversation
  const conversationMeta = useMemo(() => {
    if (!channel) return undefined;
    return questionConversationFromMessages?.meta || undefined;
  }, [channel, questionConversationFromMessages]);

  // Helper to transform ChannelMessage to Message format
  const transformChannelMessageToMessage = useCallback((msg: ChannelMessage & { sentBy?: any; createdAt?: string; updatedAt?: string }, channelId: string): Message => {
    const senderId = msg.sentBy?.user?._id || msg.sentBy?._id || '';
    const senderName = msg.sentBy?.user?.name || msg.sentBy?.user?.email || 'Unknown User';
    const senderAvatar = msg.sentBy?.user?.avatar;
    const timestamp = msg.createdAt || msg.updatedAt || new Date().toISOString();
    
    let text = '';
    if (msg.action === 'message') {
      text = msg.actionData?.text || '';
    } else if (msg.action === 'approval:approved') {
      text = msg.actionData?.text || msg.actionData?.comment || '';
    } else if (msg.action === 'approval:rejected') {
      text = msg.actionData?.text || msg.actionData?.comment || '';
    } else if (msg.action === 'approval:requested') {
      text = msg.actionData?.text || msg.actionData?.comment || '';
    }
    
    return {
      id: msg._id,
      channelId,
      userId: senderId,
      userName: senderName,
      userAvatar: senderAvatar ?? undefined,
      content: text,
      contentType: 'text',
      createdAt: timestamp,
      isSystem: false,
      action: msg.action,
      meta: msg.meta,
    };
  }, []);

  const apiMessages = useMemo(() => {
    // Don't show messages while channel is changing
    if (isChannelChanging) return [];
    if (!channel || messagesArray.length === 0) return [];
    return messagesArray.map((apiMsg: ChannelMessage | ApiMessage) => {
      // Check if it's a ChannelMessage (has _id and action) or ApiMessage (has questionConversation)
      const isChannelMessage = '_id' in apiMsg && 'action' in apiMsg && !('questionConversation' in apiMsg);
      const transformed = isChannelMessage 
        ? transformChannelMessageToMessage(apiMsg as ChannelMessage, channel._id)
        : transformApiMessageToMessage(apiMsg as ApiMessage, channel._id);
      // CRITICAL: Only use message-specific meta - don't fallback to conversation-level meta
      // This ensures each approval:requested message shows its own answer from when it was sent
      // Each message should have its own meta.questionData.answerData from the API
      // Only attach conversation meta if message has NO meta at all (not even partial meta)
      // This prevents overwriting message-specific answer data with conversation-level data
      if (conversationMeta && !transformed.meta) {
        // Only use conversation meta if message has absolutely no meta
        // This is a fallback for legacy messages that might not have meta
        transformed.meta = conversationMeta;
      }
      // DO NOT merge conversation meta's questionData into message meta
      // Each message should preserve its own questionData.answerData from when it was sent
      return transformed;
    });
  }, [channel, messagesArray, conversationMeta, isChannelChanging, transformChannelMessageToMessage]);

  const messages = useMemo(() => {
    // Filter out optimistic messages that have been confirmed by API (matched by localId)
    const confirmedLocalIds = new Set(
      messagesArray
        .filter((msg: ChannelMessage | ApiMessage) => {
          const isChannelMessage = '_id' in msg && 'action' in msg && !('questionConversation' in msg);
          return isChannelMessage && (msg as ChannelMessage).localId;
        })
        .map((msg: ChannelMessage | ApiMessage) => (msg as ChannelMessage).localId)
    );
    
    const unconfirmedOptimistic = optimisticMessages.filter(
      optMsg => !confirmedLocalIds.has(optMsg.id) // Use id as localId for matching
    );
    
    return [...apiMessages, ...unconfirmedOptimistic];
  }, [apiMessages, optimisticMessages, messagesArray]);

  // Track last message count to detect new messages
  const lastMessageCountRef = useRef<number>(0);
  
  // Clear optimistic messages when API data changes (message was successfully sent)
  useEffect(() => {
    const currentMessageCount = apiMessages.length;
    const lastCount = lastMessageCountRef.current;
    
    // If we have new messages from API, check for localId matches to remove optimistic messages
    if (currentMessageCount > lastCount && optimisticMessages.length > 0) {
      // Check if any optimistic message localIds match new API messages' localId
      const apiLocalIds = new Set(
        messagesArray
          .filter((msg: ChannelMessage | ApiMessage) => {
            const isChannelMessage = '_id' in msg && 'action' in msg && !('questionConversation' in msg);
            return isChannelMessage && (msg as ChannelMessage).localId;
          })
          .map((msg: ChannelMessage | ApiMessage) => (msg as ChannelMessage).localId)
      );
      
      const remainingOptimistic = optimisticMessages.filter(
        optMsg => !apiLocalIds.has(optMsg.id) // Use id as localId for matching
      );
      setOptimisticMessages(remainingOptimistic);
    }
    
    lastMessageCountRef.current = currentMessageCount;
  }, [apiMessages, optimisticMessages, messagesArray]);

  // Extract threads from messages (messages with threadId)
  // Use a ref to prevent infinite loops by only updating when message IDs actually change
  const prevMessagesKeyRef = useRef<string>('');
  const messagesKey = messages.map((m: Message) => m.id).sort().join(',');
  
  useEffect(() => {
    if (!channel) {
      if (threads.length > 0) {
        setThreads([]);
      }
      return;
    }
    
    // Only update if message IDs have changed
    if (messagesKey === prevMessagesKeyRef.current) {
      return;
    }
    
    prevMessagesKeyRef.current = messagesKey;
    
    const threadMap = new Map<string, Thread>();
    
    messages.forEach((message) => {
      if (message.threadId) {
        if (!threadMap.has(message.threadId)) {
          threadMap.set(message.threadId, {
            id: message.threadId,
            channelId: channel._id,
            parentMessageId: message.id,
            type: 'freeform',
            participants: [message.userId],
            messageCount: 1,
            createdAt: message.createdAt,
            lastActivityAt: message.createdAt,
          });
        } else {
          const thread = threadMap.get(message.threadId)!;
          thread.messageCount += 1;
          if (!thread.participants.includes(message.userId)) {
            thread.participants.push(message.userId);
          }
          if (new Date(message.createdAt) > new Date(thread.lastActivityAt)) {
            thread.lastActivityAt = message.createdAt;
          }
        }
      }
    });

    setThreads(Array.from(threadMap.values()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesKey, channel?._id]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Note: assignmentId is already extracted earlier for useGetChannelQuery
  // Note: subjects and meta are available via questionConversationFromMessages if needed

  // Helper: check if profileId is in approvers (string[] or Profile[])
  const isProfileInApprovers = useCallback(
    (approvers: string[] | Profile[] | undefined, profileId: string): boolean => {
      if (!Array.isArray(approvers) || approvers.length === 0) return false;
      if (typeof approvers[0] === 'string') {
        return (approvers as string[]).includes(profileId);
      }
      return (approvers as Profile[]).some((approver) => approver._id === profileId);
    },
    []
  );

  // Check if current user is an approver for both record types:
  // - QuestionApprovalChannelRecord: assignment.approvers
  // - CourseFormApprovalChannelRecord: coursePage.inlineForms[].configSet.approvers (match by formBlockId)
  const isApprover = useMemo(() => {
    if (!channel || !selectedProfile || !approvalRecord) return false;
    const profileId = selectedProfile._id;
    console.log('approvalRecord', approvalRecord)
    // Question approval (form/assignment): use assignment.questionApprovers
    if ('assignmentId' in approvalRecord) {
      const formRecord = approvalRecord as QuestionApprovalChannelRecord;
      const assignment = formRecord.assignment;
      const questionApprovers = assignment?.questionApprovers;
      return isProfileInApprovers(questionApprovers, profileId);
    }

    // Course form question approval: questionApprovers live in coursePage.inlineForms[].configSet
    if ('courseEnrolmentId' in approvalRecord) {
      const courseRecord = approvalRecord as CourseFormApprovalChannelRecord;
      const coursePage = courseRecord.coursePage as {
        inlineForms?: Array<{ formBlockId?: string; configSet?: { approvers?: string[] | Profile[]; questionApprovers?: string[] | Profile[] } }>;
      } | undefined;
      const inlineForms = coursePage?.inlineForms;
      if (!Array.isArray(inlineForms)) return false;
      const matchingInlineForm = inlineForms.find((inline) => inline.formBlockId === courseRecord.formBlockId);
      const questionApprovers = matchingInlineForm?.configSet?.questionApprovers;
      return isProfileInApprovers(questionApprovers, profileId);
    }

    return false;
  }, [channel, selectedProfile, approvalRecord, isProfileInApprovers]);

  // Function to get latest approval status from messages
  const getLatestApprovalStatusFromMessages = useCallback((msgs: Message[]): 'pending' | 'approved' | 'rejected' | null => {
    if (!msgs || msgs.length === 0) {
      return null;
    }
    
    // Filter messages with approval actions and sort by timestamp (newest first)
    const approvalMessages = msgs
      .filter((msg) => {
        const action = msg.action;
        return action === 'approval:request' || action === 'approval:approve' || action === 'approval:reject';
      })
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA; // Newest first
      });
    
    if (approvalMessages.length === 0) {
      return null;
    }
    
    // Get the latest message with an approval action
    const latestMessage = approvalMessages[0];
    const action = latestMessage.action;
    
    // Map action to status
    if (action === 'approval:approve') {
      return 'approved';
    } else if (action === 'approval:reject') {
      return 'rejected';
    } else if (action === 'approval:request') {
      return 'pending';
    }
    
    return null;
  }, []);

  // Get effective approval status from messages
  const effectiveApprovalStatus = useMemo(() => {
    return getLatestApprovalStatusFromMessages(messages);
  }, [messages, getLatestApprovalStatusFromMessages]);
  
  // Filter channels for list view - must be defined before conditional return
  // For approvals with records, we filter at the record level
  const filteredChannels = useMemo(() => {
    if (!channels || !onChannelSelect || !type) return [];
    if (!searchTerm) return channels;
    const searchLower = searchTerm.toLowerCase();
    return channels.filter((ch) => {
      return (
        ch.name?.toLowerCase().includes(searchLower) ||
        ch.friendlyTitle?.toLowerCase().includes(searchLower) ||
        ch.topic?.toLowerCase().includes(searchLower) ||
        ch.subjectNames?.toLowerCase().includes(searchLower) ||
        ch.formName?.toLowerCase().includes(searchLower) ||
        ch.questionInfo?.toLowerCase().includes(searchLower)
      );
    });
  }, [channels, searchTerm, onChannelSelect, type]);

  // Filter records for approvals type (form and course form)
  const filteredRecords = useMemo(() => {
    if (!records || !onChannelSelect || !type) return records || [];
    if (!searchTerm) return records;

    const searchLower = searchTerm.toLowerCase();
    return records.filter((record) => {
      const isForm = 'assignmentId' in record;
      const assigneeOrEnrolleeMatch = isForm
        ? (() => {
            const u = (record as QuestionApprovalChannelRecord).assignee?.user;
            return typeof u === 'object' && u !== null && 'name' in u && typeof (u as { name?: string }).name === 'string' && (u as { name: string }).name.toLowerCase().includes(searchLower);
          })()
        : (record as CourseFormApprovalChannelRecord).courseEnrolment?.enrollee?.user?.name?.toLowerCase().includes(searchLower);
      const contextMatch = isForm
        ? (record as QuestionApprovalChannelRecord).assignment?.formTemplate?.name?.toLowerCase().includes(searchLower)
        : [
            (record as CourseFormApprovalChannelRecord).course?.title?.toLowerCase().includes(searchLower),
            (record as CourseFormApprovalChannelRecord).coursePage?.title?.toLowerCase().includes(searchLower),
          ].some(Boolean);

      if (record.channels && Array.isArray(record.channels)) {
        return record.channels.some((ch: ChannelData | CourseFormApprovalChannelItem) => {
          const name = (ch as { name?: string }).name;
          const friendlyTitle = (ch as { friendlyTitle?: string }).friendlyTitle;
          const topic = (ch as { topic?: string }).topic;
          const subjectNames = (ch as { subjectNames?: string }).subjectNames;
          const formName = (ch as { formName?: string }).formName;
          const questionInfo = (ch as { questionInfo?: string }).questionInfo ?? (ch as { meta?: { questionData?: { questionLabel?: string } } }).meta?.questionData?.questionLabel;
          return (
            name?.toLowerCase().includes(searchLower) ||
            friendlyTitle?.toLowerCase().includes(searchLower) ||
            topic?.toLowerCase().includes(searchLower) ||
            subjectNames?.toLowerCase().includes(searchLower) ||
            formName?.toLowerCase().includes(searchLower) ||
            questionInfo?.toLowerCase().includes(searchLower) ||
            assigneeOrEnrolleeMatch ||
            contextMatch
          );
        });
      }
      return assigneeOrEnrolleeMatch || contextMatch;
    });
  }, [records, searchTerm, onChannelSelect, type]);

  // Use records directly for approvals type, or group channels if records not available
  const groupedChannelsByRecord = useMemo(() => {
    if (!onChannelSelect || !type) return [];
    
    // If records are provided, use them directly (with search filtering applied)
    if (records && records.length > 0) {
      const recordsToUse = filteredRecords.length > 0 ? filteredRecords : records;
      return recordsToUse.map((record) => {
        const isForm = 'assignmentId' in record;
        if (isForm) {
          const r = record as QuestionApprovalChannelRecord;
          const assigneeName = (r.assignee?.user && typeof r.assignee.user === 'object' && 'name' in r.assignee.user && r.assignee.user.name) || 'Unknown User';
          const assignmentName = r.assignment?.formTemplate?.name || r.assignmentId || 'Unknown Assignment';
          return {
            assigneeId: r.assigneeId,
            assignmentId: r.assignmentId,
            assigneeName,
            assignmentName,
            channels: r.channels || [],
          };
        }
        const r = record as CourseFormApprovalChannelRecord;
        const assigneeName = r.courseEnrolment?.enrollee?.user?.name ?? 'Enrollee';
        const courseTitle = r.course?.title ?? 'Course';
        const pageTitle = r.coursePage?.title ?? 'Page';
        const assignmentName = courseTitle && pageTitle ? `${courseTitle} · ${pageTitle}` : courseTitle || pageTitle || 'Course form';
        return {
          assigneeId: r.courseEnrolmentId,
          assignmentId: r.formBlockId,
          assigneeName,
          assignmentName,
          channels: r.channels || [],
        };
      });
    }
    
    // Fallback: group channels if records not provided
    if (!channels || channels.length === 0) return [];
    
    const groups = new Map<string, { assigneeId: string; assignmentId: string; assigneeName: string; assignmentName: string; channels: ChannelData[] }>();
    
    filteredChannels.forEach((channel: ChannelData) => {
      // Extract assignee and assignment info from channel
      const assigneeId = channel.assignee || channel.questionConversation?.assignee?._id || 'unknown';
      const assignmentId = channel.assignment || channel.questionConversation?.assignment?._id || 'unknown';
      const assigneeName = channel.assigneeName || channel.questionConversation?.assignee?.user?.name || 'Unknown User';
      const assignmentName = channel.formName || channel.questionConversation?.assignment?.formTemplate?.name || assignmentId || 'Unknown Assignment';
      
      const groupKey = `${assigneeId}-${assignmentId}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          assigneeId,
          assignmentId,
          assigneeName,
          assignmentName,
          channels: [],
        });
      }
      
      groups.get(groupKey)!.channels.push(channel);
    });
    
    return Array.from(groups.values());
  }, [records, filteredRecords, filteredChannels, channels, onChannelSelect, type]);

  const [expandedRecordGroups, setExpandedRecordGroups] = useState<Set<string>>(new Set());

  // Helper function to generate friendlyTitle from ChannelData
  const getFriendlyListTitleFromApprovalRequest = useCallback((assigneeName?: string, formName?: string): string => {    
    // Use provided names or extract from channel
    const assignee = assigneeName || 'Unknown User';
    const form = formName || 'Form';
    
    // Format: "Approval requests by ASSIGNEE_NAME for on FORM_NAME"
    return `Approval request by ${assignee} for on ${form}`;
  }, []);

    // Helper function to generate friendlyTitle from ChannelData
    const getFriendlyTitleFromChannel = useCallback((channel: ChannelData, assigneeName?: string, formName?: string): string => {
      const questionLabel = channel.meta?.questionData?.questionLabel || 'Question';
      
      // Truncate question text if too long
      const maxQuestionLength = 50;
      const truncatedQuestionText = questionLabel.length > maxQuestionLength
        ? `${questionLabel.substring(0, maxQuestionLength)}...`
        : questionLabel;
      
      // Get subject count
      const subjectIds = channel.meta?.subjectId;
      const subjectCount = Array.isArray(subjectIds) ? subjectIds.length : (subjectIds ? 1 : 0);
      const subjectText = subjectCount === 1 ? 'subject' : 'subjects';
      
      // Use provided names or extract from channel
      const assignee = assigneeName || 'Unknown User';
      const form = formName || 'Form';
      
      // Format: "Approval requested by ASSIGNEE_NAME for QUESTION_LABEL on FORM_NAME (NUMBER_OF_SUBJECTS subjects)"
      return `Approval requested by ${assignee} for "${truncatedQuestionText}" on ${form}${subjectCount > 0 ? ` (${subjectCount} ${subjectText})` : ''}`;
    }, []);

  // Auto-expand first group if none are open
  // useEffect(() => {
  //   if (type === 'approvals' && groupedChannelsByRecord.length > 0 && expandedRecordGroups.size === 0) {
  //     const firstGroupKey = `${groupedChannelsByRecord[0].assigneeId}-${groupedChannelsByRecord[0].assignmentId}`;
  //     setExpandedRecordGroups(new Set([firstGroupKey]));
  //   }
  // }, [type, groupedChannelsByRecord, expandedRecordGroups.size]);
  
  // If showing channels list, render that instead
  if ((channels || records) && onChannelSelect && type) {
    const label = APPROVAL_TAB_ITEMS.find((item) => item.key === type)?.label

    return (
      <Layout style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Header
          style={{
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            padding: isMd ? '0 20px' : '0 16px',
            display: 'flex',
            alignItems: 'center',
            gap: isMd ? '16px' : '8px',
            flexWrap: 'wrap',
            minHeight: isMd ? '64px' : '56px',
            boxShadow: `0 1px 3px ${token.colorFillSecondary}`,
          }}
        >
          <Text 
            strong 
            style={{ 
              fontSize: isMd ? '20px' : '18px', 
              textTransform: 'capitalize',
              fontWeight: 700,
              color: token.colorText,
            }}
          >
            {label}
          </Text>
          <Text 
            type="secondary" 
            style={{ 
              fontSize: isMd ? '13px' : '12px',
              opacity: 0.7,
            }}
          >
            ({records?.length || 0} {(records?.length || 0) === 1 ? 'conversation' : 'conversations'})
          </Text>
        </Header>
        <div style={{ 
          padding: isMd ? '16px 20px' : '12px 16px', 
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
        }}>
          <Input
            placeholder="Search conversations..."
            prefix={<SearchOutlined style={{ color: token.colorTextSecondary }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            allowClear
            size={isMd ? 'middle' : 'small'}
            style={{
              borderRadius: '8px',
            }}
          />
        </div>
        <Content
          style={{
            flex: 1,
            overflow: 'auto',
            padding: isMd ? '20px' : '16px',
            background: token.colorBgLayout,
          }}
        >
          {(records ? filteredRecords.length === 0 : filteredChannels.length === 0) ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: token.colorTextSecondary,
                gap: '8px',
              }}
            >
              <Text type="secondary">
                {searchTerm ? 'No conversations found' : 'No conversations available'}
              </Text>
            </div>
          ) : groupedChannelsByRecord.length > 0 ? (
            // Show grouped by records for approvals
            <Collapse
              activeKey={Array.from(expandedRecordGroups)}
              onChange={(keys) => {
                const keysArray = Array.isArray(keys) ? keys : [keys];
                setExpandedRecordGroups(new Set(keysArray));
              }}
              ghost
              style={{ background: 'transparent' }}
            >
              {groupedChannelsByRecord.map((group) => {
                const groupKey = `${group.assigneeId}-${group.assignmentId}`;
                // Generate friendlyTitle from the first channel
                const headerLabel = getFriendlyListTitleFromApprovalRequest(group.assigneeName, group.assignmentName);
                
                return (
                  <Collapse.Panel
                    key={groupKey}
                    header={
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                        }}
                      >
                        <UserOutlined
                          style={{
                            color: token.colorPrimary,
                            fontSize: '14px',
                          }}
                        />
                        <Text strong style={{ fontSize: '14px', color: token.colorText }}>
                          {headerLabel}
                        </Text>
                      </div>
                    }
                    style={{
                      marginBottom: '8px',
                      background: token.colorBgContainer,
                      borderRadius: token.borderRadius,
                      border: `1px solid ${token.colorBorder}`,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {group.channels.map((channel) => {
                        const isSelected = false; // TODO: Get selected channel ID if needed
                        const formatTimeAgo = (dateString: string) => {
                          const date = new Date(dateString);
                          const now = new Date();
                          const diffMs = now.getTime() - date.getTime();
                          const diffMins = Math.floor(diffMs / 60000);
                          const diffHours = Math.floor(diffMs / 3600000);
                          const diffDays = Math.floor(diffMs / 86400000);

                          if (diffMins < 1) return 'just now';
                          if (diffMins < 60) return `${diffMins}m ago`;
                          if (diffHours < 24) return `${diffHours}h ago`;
                          if (diffDays < 7) return `${diffDays}d ago`;
                          return date.toLocaleDateString();
                        };

                        return (
                          <div
                            key={channel._id}
                            onClick={() => onChannelSelect?.({ ...channel, friendlyTitle: headerLabel } as ChannelData)}
                            style={{
                              padding: '12px',
                              cursor: 'pointer',
                              backgroundColor: isSelected
                                ? token.colorPrimaryBg
                                : 'transparent',
                              borderRadius: token.borderRadius,
                              border: `1px solid ${
                                isSelected ? token.colorPrimaryBorder : 'transparent'
                              }`,
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.backgroundColor = token.colorFillTertiary;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                          >
                            <MessageOutlined
                              style={{
                                color: isSelected ? token.colorPrimary : token.colorTextSecondary,
                                fontSize: '16px',
                                marginTop: '2px',
                                flexShrink: 0,
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Text
                                strong={isSelected}
                                style={{
                                  fontSize: '13px',
                                  color: isSelected ? token.colorPrimary : token.colorText,
                                  display: 'block',
                                  marginBottom: '4px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {getFriendlyTitleFromChannel(channel as ChannelData, group.assigneeName, group.assignmentName)}
                              </Text>
                              {/* {channel.meta?.questionData?.questionLabel && (
                                <Text
                                  type="secondary"
                                  style={{
                                    fontSize: '11px',
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {channel.meta.questionData.questionLabel}
                                </Text>
                              )} */}
                              {'subjectNames' in channel && channel.subjectNames && (
                                <Text
                                  type="secondary"
                                  style={{
                                    fontSize: '11px',
                                    display: 'block',
                                    marginTop: '2px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Subjects: {channel.subjectNames}
                                </Text>
                              )}
                              {channel.lastActivityAt && (
                                <Text
                                  type="secondary"
                                  style={{
                                    fontSize: '10px',
                                    display: 'block',
                                    marginTop: '2px',
                                  }}
                                >
                                  {formatTimeAgo(channel.lastActivityAt)}
                                </Text>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Collapse.Panel>
                );
              })}
            </Collapse>
          ) : (
            // Show flat list for other types
            <List
              dataSource={filteredChannels}
              renderItem={(item) => {
                // Format the last activity time
                const formatTimeAgo = (dateString: string) => {
                  const date = new Date(dateString);
                  const now = new Date();
                  const diffMs = now.getTime() - date.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  const diffHours = Math.floor(diffMs / 3600000);
                  const diffDays = Math.floor(diffMs / 86400000);

                  if (diffMins < 1) return 'just now';
                  if (diffMins < 60) return `${diffMins}m ago`;
                  if (diffHours < 24) return `${diffHours}h ago`;
                  if (diffDays < 7) return `${diffDays}d ago`;
                  return date.toLocaleDateString();
                };

                return (
                  <List.Item
                    style={{
                      padding: isMd ? '14px 16px' : '12px 14px',
                      cursor: 'pointer',
                      backgroundColor: token.colorBgContainer,
                      borderRadius: '8px',
                      marginBottom: '8px',
                      border: `1px solid ${token.colorBorderSecondary}`,
                      transition: 'all 0.15s ease',
                      boxShadow: `0 1px 2px ${token.colorFillSecondary}`,
                    }}
                    onClick={() => onChannelSelect?.(item)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = token.colorPrimary;
                      e.currentTarget.style.backgroundColor = token.colorFillTertiary;
                      e.currentTarget.style.boxShadow = `0 2px 8px ${token.colorPrimaryBg}`;
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = token.colorBorderSecondary;
                      e.currentTarget.style.backgroundColor = token.colorBgContainer;
                      e.currentTarget.style.boxShadow = `0 1px 2px ${token.colorFillSecondary}`;
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <Space style={{ width: '100%' }} direction="vertical" size="small">
                      {/* Main title - friendly title or name */}
                      <Space style={{ width: '100%' }} align="start" wrap>
                        <div
                          style={{
                            width: isMd ? '44px' : '40px',
                            height: isMd ? '44px' : '40px',
                            borderRadius: '10px',
                            backgroundColor: token.colorPrimary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: `0 2px 4px ${token.colorPrimaryBg}`,
                          }}
                        >
                          <Text 
                            strong 
                            style={{ 
                              fontSize: isMd ? '18px' : '16px', 
                              color: '#ffffff',
                              fontWeight: 600,
                            }}
                          >
                            {item.subjectNames?.charAt(0)?.toUpperCase() || '?'}
                          </Text>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            strong
                            style={{
                              fontSize: isMd ? '15px' : '14px',
                              lineHeight: '1.4',
                              display: 'block',
                              marginBottom: '4px',
                              fontWeight: 600,
                              color: token.colorText,
                            }}
                            ellipsis={{ tooltip: item.friendlyTitle || item.name }}
                          >
                            {item.friendlyTitle || item.name}
                          </Text>
                          {item.lastActivityAt && (
                            <Text 
                              type="secondary" 
                              style={{ 
                                fontSize: '12px', 
                                whiteSpace: 'nowrap',
                                opacity: 0.7,
                              }}
                            >
                              {formatTimeAgo(item.lastActivityAt)}
                            </Text>
                          )}
                        </div>
                        <Space direction="vertical" align="end" size="small">
                          {item.unreadCount != null && Number(item.unreadCount) > 0 && (
                            <Badge count={Number(item.unreadCount)} size="small" />
                          )}
                        </Space>
                      </Space>
                    </Space>
                  </List.Item>
                );
              }}
            />
          )}
        </Content>
      </Layout>
    );
  }

  // Normal channel view - requires channel
  if (!channel) {
    return null;
  }

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) {
      return;
    }

    // Get channel ID for socket.io (from useGetChannelQuery)
    if (!socketChannelId) {
      antMessage.error('Channel not available. Please try again.');
      return;
    }

    // Create optimistic message for immediate UI update with localId
    // Match the exact structure of messages from the API to ensure consistent display
    // API messages use: sentBy.user._id for userId and sentBy.user.name for userName
    // Since we're the sender, we use user._id and user.name from auth state
    const localId = `local-${Date.now()}-${Math.random()}`;
    const now = new Date().toISOString();
    
    // Get user info - match the structure from transformChannelMessageToMessage
    // Messages use: msg.sentBy?.user?._id for userId and msg.sentBy?.user?.name for userName
    // For optimistic message, we use the logged-in user's info
    const userId = user?._id || '';
    const userName = user?.name || 'Unknown User';
    const userAvatar = user?.avatar ?? undefined;
    
    const optimisticMessage: Message = {
      id: localId, // Use localId as the id for matching
      channelId: channel._id,
      userId, // Match the userId structure from API messages (sentBy.user._id)
      userName, // Match the userName structure from API messages (sentBy.user.name)
      userAvatar, // Include avatar if available
      content,
      contentType: 'text',
      createdAt: now,
      updatedAt: now, // Include updatedAt to match API structure
      isSystem: false,
      action: 'message', // Include action to match API structure
      meta: conversationMeta || undefined, // Include meta for grouping and display consistency
    };

    // Add optimistic message immediately
    setOptimisticMessages((prev) => [...prev, optimisticMessage]);

    try {
      setSending(true);
      
      // Send message via socket.io with localId in metadata
      // Use effectiveApprovalChannelType so course_form_question_approval tab sends/receives on correct socket
      socket.sendMessage(
        socketChannelId,
        content,
        {
          action: 'message',
          actionData: {
            text: content,
          },
          localId: localId, // Pass localId for server to echo back
        },
        effectiveApprovalChannelType
      );

      setSending(false);
      // Refresh conversation to get updated messages (socket.io will also trigger refetch)
      setTimeout(async () => {
        await refetchMessagesWithCacheInvalidation();
      }, 500); // Small delay to allow socket.io to process
    } catch (error: any) {
      // Remove optimistic message on error
      setOptimisticMessages((prev) => prev.filter(m => m.id !== localId));
      console.error('Failed to send message:', error);
      antMessage.error('Failed to send message');
      setSending(false);
    }
  };

  const handleApprove = async (comment?: string) => {
    // Get channel ID for socket.io (from useGetChannelQuery)
    if (!socketChannelId) {
      antMessage.error('Channel not available. Please try again.');
      return;
    }

    try {
      setApproving(true);
      
      // Generate localId for optimistic update
      const localId = `local-${Date.now()}-${Math.random()}`;
      
      // Send approval via socket.io with localId
      socket.sendMessage(
        socketChannelId,
        comment || '',
        {
          action: 'approval:approved',
          actionData: comment ? { text: comment } : {},
          localId: localId,
        },
        effectiveApprovalChannelType
      );

      // antMessage.success('Question approved');
      // Refresh conversation to get updated messages (socket.io will also trigger refetch)
      // setTimeout(() => {
      //   refetchMessages();
      // }, 500); // Small delay to allow socket.io to process
      setApproving(false);
    } catch (error: any) {
      console.error('Failed to approve:', error);
      antMessage.error('Failed to approve');
      setApproving(false);
    }
  };

  const handleReject = async (comment: string) => {
    if (!comment.trim()) {
      antMessage.warning('Please provide a rejection reason');
      return;
    }

    // Get channel ID for socket.io (from useGetChannelQuery)
    if (!socketChannelId) {
      antMessage.error('Channel not available. Please try again.');
      return;
    }

    try {
      setRejecting(true);
      
      // Generate localId for optimistic update
      const localId = `local-${Date.now()}-${Math.random()}`;
      
      // Send rejection via socket.io with localId
      socket.sendMessage(
        socketChannelId,
        comment,
        {
          action: 'approval:rejected',
          actionData: {
            text: comment,
          },
          localId: localId,
        },
        effectiveApprovalChannelType
      );

      // antMessage.success('Question rejected');
      // Refresh conversation to get updated messages (socket.io will also trigger refetch)
      // setTimeout(() => {
      //   refetchMessages();
      // }, 500); // Small delay to allow socket.io to process
      setRejecting(false);
    } catch (error: any) {
      console.error('Failed to reject:', error);
      antMessage.error('Failed to reject');
      setRejecting(false);
    }
  };

  const handleRequestApproval = async (comment?: string) => {
    // Get channel ID for socket.io (from useGetChannelQuery)
    if (!socketChannelId) {
      antMessage.error('Channel not available. Please try again.');
      return;
    }

    try {
      setRequesting(true);
      
      // Generate localId for optimistic update
      const localId = `local-${Date.now()}-${Math.random()}`;
      
      // Send approval request via socket.io with localId
      socket.sendMessage(
        socketChannelId,
        comment || '',
        {
          action: 'approval:requested',
          actionData: comment ? { text: comment } : {},
          localId: localId,
        },
        effectiveApprovalChannelType
      );

      // antMessage.success('Approval request sent');
      // Refresh conversation to get updated messages (socket.io will also trigger refetch)
      // setTimeout(() => {
      //   refetchMessages();
      // }, 500); // Small delay to allow socket.io to process
      setRequesting(false);
    } catch (error: any) {
      console.error('Failed to request approval:', error);
      antMessage.error('Failed to send approval request');
      setRequesting(false);
    }
  };

  // TODO: Implement huddle functionality when needed
  // const handleStartHuddle = () => {
  //   const roomId = `${channel._id}.${Date.now()}`;
  //   setJitsiRoomId(roomId);
  //   setShowJitsi(true);
  // };

  const handleCloseJitsi = () => {
    setShowJitsi(false);
    setJitsiRoomId(null);
  };

  if (showJitsi && jitsiRoomId) {
    return (
      <JitsiHuddle
        roomId={jitsiRoomId}
        channelId={channel._id}
        onClose={handleCloseJitsi}
      />
    );
  }

  if (threadId && onThreadSelect) {
    const thread = threads.find((t) => t.id === threadId);
    const parentMessage = messages.find((m) => m.id === thread?.parentMessageId);
    const handleBack = () => onThreadSelect(null);
    return (
      <ThreadView
        thread={thread!}
        parentMessage={parentMessage!}
        channel={channel}
        onBack={handleBack}
      />
    );
  }

  // Show loading state when channel is changing or when initially loading
  const showLoading = isLoading || isChannelChanging;
  
  if (showLoading) {
    return (
      <Layout style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Header
          style={{
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorder}`,
            padding: isMd ? '0 16px' : '0 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: isMd ? '64px' : '56px',
          }}
        >
          <Space wrap>
            <Text strong style={{ fontSize: isMd ? '16px' : '14px' }}>
              #{channel.title}
            </Text>
            {/* {channel.topic && isMd && (
              <>
                <Divider type="vertical" />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {channel.topic}
                </Text>
              </>
            )} */}
          </Space>
        </Header>
        <Content
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: token.colorBgLayout,
          }}
        >
          <Spin size="large" />
        </Content>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Header
          style={{
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorder}`,
            padding: isMd ? '0 16px' : '0 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: isMd ? '64px' : '56px',
          }}
        >
          <Space wrap>
            <Text strong style={{ fontSize: isMd ? '16px' : '14px' }}>
              #{channel.title}
            </Text>
            {/* {channel.topic && isMd && (
              <>
                <Divider type="vertical" />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {channel.topic}
                </Text>
              </>
            )} */}
          </Space>
        </Header>
        <Content
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMd ? '16px' : '12px',
            background: token.colorBgLayout,
          }}
        >
          <Alert
            message="Error loading messages"
            description={error ? 'message' in error ? String(error.message) : 'An error occurred' : 'An error occurred'}
            type="error"
            showIcon
          />
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header
        style={{
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: isMd ? '0 20px' : '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: isMd ? '64px' : '56px',
          boxShadow: `0 1px 3px ${token.colorFillSecondary}`,
        }}
      >
        <Space wrap>
          {onBack && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={onBack}
              style={{ marginRight: isMd ? '8px' : '4px' }}
              size={isMd ? 'middle' : 'small'}
            />
          )}
          <Text 
            strong 
            style={{ 
              fontSize: isMd ? '18px' : '16px',
              fontWeight: 700,
              color: token.colorText,
            }}
          >
            #{channel.title}
          </Text>
          {/* {channel.topic && (
            <>
              <Divider type="vertical" />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {channel.topic}
              </Text>
            </>
          )} */}
        </Space>
        {/* <Space>
          <Tooltip title="Start Huddle">
            <Button
              type="text"
              icon={<VideoCameraOutlined />}
              onClick={handleStartHuddle}
            >
              Start Huddle
            </Button>
          </Tooltip>
          <Tooltip title="Channel Info">
            <Button type="text" icon={<InfoCircleOutlined />} />
          </Tooltip>
          <Button type="text" icon={<MoreOutlined />} />
        </Space> */}
      </Header>
      <Content
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 0,
          background: token.colorBgLayout,
        }}
      >
        <MessageList
          messages={messages}
          threads={threads}
          onThreadClick={(threadId) => onThreadSelect?.(threadId)}
          currentUserId={user?._id}
          isApprover={isApprover}
          onApprove={isApprover ? handleApprove : undefined}
          onReject={isApprover ? handleReject : undefined}
          approvalStatus={effectiveApprovalStatus || undefined}
        />
        <div ref={messagesEndRef} />
      </Content>
      <Footer
        style={{
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          padding: isMd ? '16px 20px' : '12px 16px',
          boxShadow: `0 -1px 3px ${token.colorFillSecondary}`,
        }}
      >
        <MessageInput 
          onSend={handleSendMessage} 
          onApprove={isApprover ? handleApprove : undefined}
          onReject={isApprover ? handleReject : undefined}
          onRequestApproval={!isApprover ? handleRequestApproval : undefined}
          isApprover={isApprover}
          sending={sending}
          approving={approving}
          rejecting={rejecting}
          requesting={requesting}
          approvalStatus={effectiveApprovalStatus || undefined}
          selectedQuestionApprovalStatus={selectedQuestionApprovalStatus as 'pending' | 'requested' | 'approved' | 'rejected' | undefined}
        />
      </Footer>
    </Layout>
  );
};

