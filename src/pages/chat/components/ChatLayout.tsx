import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Layout, theme, Spin, Alert, Typography, Drawer, Button, Grid, Divider } from 'antd';
import { MenuOutlined, MessageOutlined } from '@ant-design/icons';
import { ChannelList, ChatType } from './ChannelList';
import { MessagePanel } from './MessagePanel';
// import { ApprovalChannelsList } from './ApprovalChannelsList';
import { DMSidebar } from './DMSidebar';
import { DMMessagePanel } from './DMMessagePanel';
import {
  getChannelId,
  matchChannelById,
  UrlParams,
  UrlParamsUpdate,
  ApprovalRecord,
  SOCKET_REFETCH_DELAY_MS,
  SOCKET_REFETCH_ACTION_DELAY_MS,
  SOCKET_REFETCH_ACTION_FOLLOW_UP_MS,
  SocketMessageSentPayload,
  QUESTION_APPROVAL_TYPE,
  COURSE_FORM_QUESTION_APPROVAL_TYPE,
  isQuestionApprovalTab,
  isCourseFormQuestionApprovalTab,
  getSocketMessageSentEventForApprovalTab,
} from './chatLayoutUtils';
import { Channel } from '../types';
import {
  transformQuestionConversationToChannel,
  type ChatResponse,
} from '../../../services/chatApi';
import {
  type QuestionApprovalChannelRecord,
  type CourseFormApprovalChannelRecord,
  type CourseFormApprovalChannelItem,
  useGetQuestionApprovalChannelsQuery,
  type ChannelData,
  type GetQuestionApprovalChannelsPayload,
  type QuestionApprovalChannelsType,
  queueApi,
} from '../../../services/queueApi';
import { useSocket } from '../../../context/SocketContext';
import { chatApi } from '../../../services/chatApi';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../../store';
import { incrementUnread, clearUnread } from '../../../features/dmUnread/dmUnreadSlice';
import { SOCKET_EVENTS } from '../../../services/socketEvents';
import React from 'react';

const { Text } = Typography;
const { useBreakpoint } = Grid;
const { Sider, Content } = Layout;

// ---------------------------------------------------------------------------
// URL params (read once on mount, sync on popstate)
// ---------------------------------------------------------------------------

function getUrlParams(): UrlParams {
  if (typeof window === 'undefined') {
    return { type: null, channel: null, thread: null, dmChannel: null };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    type: params.get('type') as ChatType,
    channel: params.get('channel'),
    thread: params.get('thread'),
    dmChannel: params.get('dmChannel'),
  };
}

// ---------------------------------------------------------------------------
// Memoized MessagePanel (custom compare to avoid unnecessary re-renders)
// ---------------------------------------------------------------------------

const MemoizedMessagePanel = React.memo(MessagePanel, (prevProps, nextProps) => {
  const prevChannelId = prevProps.channel ? getChannelId(prevProps.channel as Channel | ChannelData) : null;
  const nextChannelId = nextProps.channel ? getChannelId(nextProps.channel as Channel | ChannelData) : null;
  if (prevChannelId !== nextChannelId) return false;
  if (prevProps.threadId !== nextProps.threadId) return false;
  if (prevProps.type !== nextProps.type) return false;
  if (prevProps.channels?.length !== nextProps.channels?.length) return false;
  if (prevProps.channels && nextProps.channels) {
    const prevIds = prevProps.channels.map((c) => getChannelId(c)).join(',');
    const nextIds = nextProps.channels.map((c) => getChannelId(c)).join(',');
    if (prevIds !== nextIds) return false;
  }
  if (prevProps.approvalRecord !== nextProps.approvalRecord) {
    if (!prevProps.approvalRecord || !nextProps.approvalRecord) return false;
    const prev = prevProps.approvalRecord as ApprovalRecord;
    const next = nextProps.approvalRecord as ApprovalRecord;
    const prevIsQuestionApproval = 'assignmentId' in prev;
    const nextIsQuestionApproval = 'assignmentId' in next;
    if (prevIsQuestionApproval !== nextIsQuestionApproval) return false;
    const prevKey = prevIsQuestionApproval
      ? (prev as QuestionApprovalChannelRecord).assignmentId
      : `${(prev as CourseFormApprovalChannelRecord).courseEnrolmentId}-${(prev as CourseFormApprovalChannelRecord).formBlockId}`;
    const nextKey = nextIsQuestionApproval
      ? (next as QuestionApprovalChannelRecord).assignmentId
      : `${(next as CourseFormApprovalChannelRecord).courseEnrolmentId}-${(next as CourseFormApprovalChannelRecord).formBlockId}`;
    if (prevKey !== nextKey) return false;
  }
  if (prevProps.selectedQuestionApprovalStatus !== nextProps.selectedQuestionApprovalStatus) return false;
  if (prevProps.approvalChannelType !== nextProps.approvalChannelType) return false;
  return true;
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ChatLayout = () => {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isMd = Boolean(screens.md ?? screens.lg ?? screens.xl ?? screens.xxl);
  const [urlParams, setUrlParams] = useState<UrlParams>(getUrlParams);
  const dispatch = useDispatch<AppDispatch>();
  const socket = useSocket();

  const selectedType: ChatType = urlParams.type;
  const isApprovalTab =
    isQuestionApprovalTab(selectedType) || isCourseFormQuestionApprovalTab(selectedType);

  const approvalChannelsQueryParams = useMemo((): GetQuestionApprovalChannelsPayload | undefined => {
    if (!isApprovalTab) return undefined;
    return {
      type: selectedType as QuestionApprovalChannelsType,
      page: 1,
      perPage: 10,
      sortBy: 'latestActivity',
      order: 'desc',
    };
  }, [isApprovalTab, selectedType]);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ---- Chats (non-approval): manual fetch via dispatch ----
  const [chatsResponse, setChatsResponse] = useState<ChatResponse | null>(null);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isErrorChats, setIsErrorChats] = useState(false);
  const [errorChats, setErrorChats] = useState<Error | null>(null);
  const refetchChatsRef = useRef<(() => Promise<void>) | null>(null);

  const fetchChats = useCallback(async () => {
    try {
      setIsLoadingChats(true);
      setIsErrorChats(false);
      setErrorChats(null);
      const result = await dispatch(chatApi.endpoints.getChats.initiate(undefined));
      if ('data' in result && result.data) {
        setChatsResponse(result.data as ChatResponse);
      } else if ('error' in result) {
        setIsErrorChats(true);
        setErrorChats((result as { error: Error }).error);
      } else {
        setChatsResponse(null);
      }
    } catch (error) {
      setIsErrorChats(true);
      setErrorChats(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoadingChats(false);
    }
  }, [dispatch]);

  refetchChatsRef.current = fetchChats;

  useEffect(() => {
    if (!isApprovalTab) fetchChats();
  }, [isApprovalTab, fetchChats]);

  // When not on approval tab: refetch chats list when any approval message is sent (either type)
  useEffect(() => {
    if (!socket.isConnected || isApprovalTab) return;
    const scheduleRefetch = () => {
      setTimeout(() => refetchChatsRef.current?.(), SOCKET_REFETCH_DELAY_MS);
    };
    const qaEvent = getSocketMessageSentEventForApprovalTab(QUESTION_APPROVAL_TYPE);
    const cfaEvent = getSocketMessageSentEventForApprovalTab(COURSE_FORM_QUESTION_APPROVAL_TYPE);
    socket.on(qaEvent, scheduleRefetch);
    socket.on(cfaEvent, scheduleRefetch);
    return () => {
      socket.off(qaEvent, scheduleRefetch);
      socket.off(cfaEvent, scheduleRefetch);
    };
  }, [socket.isConnected, socket, isApprovalTab]);

  useEffect(() => {
    const handlePopState = () => setUrlParams(getUrlParams());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // DM unread: increment when new message arrives in a channel we're not viewing
  useEffect(() => {
    if (!socket.isConnected) return;
    const handler = (data: { channelId?: string }) => {
      const channelId = data.channelId;
      if (channelId && channelId !== urlParams.dmChannel) {
        dispatch(incrementUnread(channelId));
      }
    };
    socket.on(SOCKET_EVENTS.DM.NEW_MESSAGE, handler);
    return () => {
      socket.off(SOCKET_EVENTS.DM.NEW_MESSAGE, handler);
    };
  }, [socket.isConnected, socket, urlParams.dmChannel, dispatch]);

  // DM unread: clear when user opens a channel
  useEffect(() => {
    if (urlParams.dmChannel) {
      dispatch(clearUnread(urlParams.dmChannel));
    }
  }, [urlParams.dmChannel, dispatch]);

  // ---- Approval channels: RTK Query ----
  const {
    data: approvalChannelsResponse,
    isLoading: isLoadingApprovals,
    isFetching: isFetchingApprovals,
    isError: isErrorApprovals,
    error: errorApprovals,
    refetch: refetchApprovalChannels,
  } = useGetQuestionApprovalChannelsQuery(
    isApprovalTab ? approvalChannelsQueryParams : undefined,
    {
      skip: !isApprovalTab,
      pollingInterval: 0,
      refetchOnFocus: true,
      refetchOnReconnect: true,
      refetchOnMountOrArgChange: true,
    }
  );

  const refetchApprovalChannelsRef = useRef(refetchApprovalChannels);
  useEffect(() => {
    refetchApprovalChannelsRef.current = refetchApprovalChannels;
  }, [refetchApprovalChannels]);

  // When on approval tab: subscribe only to the current tab's socket event (question_approval or course_form_question_approval)
  useEffect(() => {
    if (!socket.isConnected || !isApprovalTab || !selectedType) return;
    const messageSentEvent = getSocketMessageSentEventForApprovalTab(
      selectedType as typeof QUESTION_APPROVAL_TYPE | typeof COURSE_FORM_QUESTION_APPROVAL_TYPE
    );
    const handleMessageSent = (data: unknown) => {
      const payload = data as SocketMessageSentPayload;
      const isNonMessageAction = Boolean(payload?.action && payload.action !== 'message');
      const delay = isNonMessageAction ? SOCKET_REFETCH_ACTION_DELAY_MS : SOCKET_REFETCH_DELAY_MS;
      setTimeout(() => {
        refetchApprovalChannelsRef.current?.();
        if (isNonMessageAction) {
          setTimeout(() => refetchApprovalChannelsRef.current?.(), SOCKET_REFETCH_ACTION_FOLLOW_UP_MS);
        }
      }, delay);
    };
    socket.on(messageSentEvent, handleMessageSent);
    return () => {
      socket.off(messageSentEvent, handleMessageSent);
    };
  }, [socket.isConnected, socket, isApprovalTab, selectedType]);

  // Approval records: API returns data.records. Filter by selectedType so switching tabs shows the correct list
  // (avoids showing previous type's cached data while the new request is in flight).
  const approvalRecords = useMemo((): ApprovalRecord[] => {
    if (!isApprovalTab || !approvalChannelsResponse?.data) return [];
    const data = approvalChannelsResponse.data as { records?: ApprovalRecord[]; list?: ApprovalRecord[] };
    const raw = (data.records ?? data.list ?? []) as ApprovalRecord[];
    return raw.filter((r) => {
      if (isQuestionApprovalTab(selectedType)) return 'assignmentId' in r;
      if (isCourseFormQuestionApprovalTab(selectedType)) return 'courseEnrolmentId' in r;
      return true;
    });
  }, [isApprovalTab, approvalChannelsResponse, selectedType]);

  // Channels (non-approval): from chats API
  const channels = useMemo(() => {
    if (isApprovalTab) return [];
    const data = chatsResponse?.data;
    if (!data || !Array.isArray(data)) return [];
    return data.map(transformQuestionConversationToChannel);
  }, [chatsResponse, isApprovalTab]);

  const isLoading = isApprovalTab ? isLoadingApprovals : isLoadingChats;
  const isError = isApprovalTab ? isErrorApprovals : isErrorChats;
  const error = isApprovalTab ? errorApprovals : errorChats;

  // Selected channel from URL (ChannelData for approvals, Channel for others)
  const selectedChannel = useMemo(() => {
    if (!urlParams.channel) return null;
    const channelId = String(urlParams.channel);
    const match = matchChannelById(channelId);

    if (isApprovalTab) {
      for (const record of approvalRecords) {
        const list = record.channels && Array.isArray(record.channels) ? record.channels : [];
        const channelData = list.find(match);
        if (!channelData) continue;

        if (isQuestionApprovalTab(selectedType) && 'assignmentId' in record) {
          const assigneeRecord = record as QuestionApprovalChannelRecord;
          const assigneeName =
            typeof assigneeRecord.assignee?.user === 'object' && assigneeRecord.assignee?.user && 'name' in assigneeRecord.assignee.user
              ? (assigneeRecord.assignee.user as { name?: string }).name
              : typeof assigneeRecord.assignee?.user === 'string'
                ? assigneeRecord.assignee.user
                : undefined;
          const formTemplate = assigneeRecord.assignment?.formTemplate;
          const templateName =
            formTemplate && typeof formTemplate === 'object' && 'name' in formTemplate
              ? (formTemplate as { name?: string }).name
              : typeof formTemplate === 'string'
                ? formTemplate
                : undefined;
          const title = `Approval requested by ${assigneeName ?? 'Unknown'} on ${templateName ?? 'Form'}`;
          return {
            ...(channelData as ChannelData),
            title,
            assignment: assigneeRecord.assignment,
            questionApprovalStatus: (channelData as ChannelData).questionApprovalStatus,
            channelType: QUESTION_APPROVAL_TYPE,
          } as ChannelData;
        }

        if (isCourseFormQuestionApprovalTab(selectedType)) {
          const courseRecord = record as CourseFormApprovalChannelRecord;
          const enrolleeName = courseRecord.courseEnrolment?.enrollee?.user?.name ?? 'Enrollee';
          const courseTitle = courseRecord.course?.title ?? 'Course';
          const pageTitle = courseRecord.coursePage?.title ?? 'Page';
          const title = `${courseTitle} · ${pageTitle} · ${enrolleeName}`;
          const item = channelData as CourseFormApprovalChannelItem;
          const status = item.courseFormQuestionApprovalStatus ?? item.questionApprovalStatus ?? item.courseFormApprovalStatus;
          return {
            ...(channelData as Record<string, unknown>),
            _id: (channelData as { _id: string })._id,
            title,
            questionApprovalStatus: status,
            lastActivityAt: (channelData as { lastActivityAt?: string }).lastActivityAt,
            channelType: COURSE_FORM_QUESTION_APPROVAL_TYPE,
          } as unknown as ChannelData;
        }
      }
      if (approvalRecords.length > 0) {
        console.warn('[ChatLayout] Channel not found in any record:', urlParams.channel);
      }
      return null;
    }

    if (channels.length === 0) return null;
    return channels.find((c) => c.id === channelId) ?? null;
  }, [urlParams.channel, channels, isApprovalTab, approvalRecords, selectedType]);

  const selectedThread = useMemo(() => urlParams.thread, [urlParams.thread]);

  const updateUrlParams = useCallback((updates: UrlParamsUpdate) => {
    const currentParams = new URLSearchParams(window.location.search);
    if (updates.type !== undefined) {
      if (updates.type) currentParams.set('type', updates.type);
      else currentParams.delete('type');
    }
    if (updates.channel !== undefined) {
      if (updates.channel) currentParams.set('channel', updates.channel);
      else currentParams.delete('channel');
      currentParams.delete('thread');
    }
    if (updates.thread !== undefined) {
      if (updates.thread) currentParams.set('thread', updates.thread);
      else currentParams.delete('thread');
    }
    if (updates.dmChannel !== undefined) {
      if (updates.dmChannel) {
        currentParams.set('dmChannel', updates.dmChannel);
        currentParams.delete('channel');
        currentParams.delete('thread');
      } else currentParams.delete('dmChannel');
    }
    setUrlParams({
      type: currentParams.get('type') as ChatType || null,
      channel: currentParams.get('channel'),
      thread: currentParams.get('thread'),
      dmChannel: currentParams.get('dmChannel'),
    });
    const newSearch = currentParams.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`);
  }, []);

  useEffect(() => {
    if (!isApprovalTab || approvalRecords.length === 0 || !urlParams.channel || selectedChannel != null) return;
    updateUrlParams({ channel: null, thread: null });
  }, [isApprovalTab, approvalRecords.length, urlParams.channel, selectedChannel, updateUrlParams]);

  const handleTypeSelect = useCallback(
    (type: ChatType) => {
      updateUrlParams({ type, channel: null, thread: null, dmChannel: null });
      if (!isMd) setSidebarOpen(false);
    },
    [updateUrlParams, isMd]
  );

  const handleChannelSelect = useCallback(
    (channel: Channel | ChannelData) => {
      updateUrlParams({ channel: getChannelId(channel), thread: null, dmChannel: null });
      if (!isMd) setSidebarOpen(false);
    },
    [updateUrlParams, isMd]
  );

  const handleDmChannelSelect = useCallback(
    (channel: { _id: string }) => {
      updateUrlParams({ dmChannel: channel._id, channel: null, thread: null });
      if (!isMd) setSidebarOpen(false);
    },
    [updateUrlParams, isMd]
  );

  const handleDmBack = useCallback(() => {
    updateUrlParams({ dmChannel: null });
  }, [updateUrlParams]);

  const handleThreadSelect = useCallback(
    (threadId: string | null) => updateUrlParams({ thread: threadId }),
    [updateUrlParams]
  );

  const handleBack = useCallback(() => {
    updateUrlParams({ channel: null, thread: null });
    if (isApprovalTab) refetchApprovalChannels();
  }, [updateUrlParams, isApprovalTab, refetchApprovalChannels]);

  const channelsByType = useMemo(() => {
    if (isApprovalTab) return [];
    if (selectedType === 'submissions') return channels.filter((c) => c.type === 'course');
    return channels;
  }, [channels, selectedType, isApprovalTab]);

  const handleRefresh = useCallback(async () => {
    if (isApprovalTab) {
      dispatch(
        queueApi.util.invalidateTags([{ type: 'Queue', id: `question-approval-channels-${selectedType}` }])
      );
      await refetchApprovalChannels();
    } else {
      refetchChatsRef.current?.();
    }
  }, [isApprovalTab, selectedType, refetchApprovalChannels, dispatch]);

  // Approval record and status for the selected channel (memoized)
  const approvalRecord = useMemo((): ApprovalRecord | null => {
    if (!isApprovalTab || !selectedChannel) return null;
    const channelId = getChannelId(selectedChannel as Channel | ChannelData);
    return (
      (approvalRecords.find((r) => r.channels?.some(matchChannelById(channelId))) as ApprovalRecord) ?? null
    );
  }, [isApprovalTab, selectedChannel, approvalRecords]);

  const selectedQuestionApprovalStatus = useMemo(() => {
    if (!isApprovalTab || !selectedChannel) return '';
    const channelId = getChannelId(selectedChannel as Channel | ChannelData);
    const record = approvalRecords.find((r) => r.channels?.some(matchChannelById(channelId)));
    const ch = record?.channels?.find(matchChannelById(channelId)) as
      | { questionApprovalStatus?: string; courseFormQuestionApprovalStatus?: string }
      | undefined;
    // Form Approvals: question_approval → questionApprovalStatus; Course Approvals: course_form_question_approval → courseFormQuestionApprovalStatus
    if (isCourseFormQuestionApprovalTab(selectedType)) {
      return ch?.courseFormQuestionApprovalStatus ?? '';
    }
    return ch?.questionApprovalStatus ?? '';
  }, [isApprovalTab, selectedChannel, selectedType, approvalRecords]);

  const approvalChannelType = isApprovalTab
    ? (selectedType as typeof QUESTION_APPROVAL_TYPE | typeof COURSE_FORM_QUESTION_APPROVAL_TYPE)
    : undefined;

  // MessagePanel expects ChannelData with _id; Channel has id. Normalize for the selected-channel case.
  const selectedChannelForPanel = useMemo((): ChannelData | null => {
    if (!selectedChannel) return null;
    if ('_id' in selectedChannel) return selectedChannel as ChannelData;
    const c = selectedChannel as Channel;
    return { ...c, _id: c.id } as unknown as ChannelData;
  }, [selectedChannel]);

  const channelListContent = useMemo(
    () => {
      // const topSection = isApprovalTab ? (
      const topSection = <div style={{ display: 'flex', flexDirection: 'column',  minHeight: 10 }}>
          <ChannelList
            selectedType={selectedType}
            onTypeSelect={handleTypeSelect}
            onRefresh={handleRefresh}
            isRefreshing={isFetchingApprovals}
          />
          {/* <div style={{ flex: 1, overflow: 'auto' }}>
            <ApprovalChannelsList
              selectedType={selectedType}
              records={approvalRecords}
              onChannelSelect={handleChannelSelect}
              selectedChannelId={urlParams.channel}
            />
          </div> */}
        </div>
      // ) : (
      //   <div style={{ flexShrink: 0 }}>
      //     <ChannelList
      //       selectedType={selectedType}
      //       onTypeSelect={handleTypeSelect}
      //       onRefresh={handleRefresh}
      //     />
      //   </div>
      // );
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          {topSection}
          <Divider style={{ margin: '6px 0', flexShrink: 0 }} />
          <div style={{ minHeight: 0, overflow: 'hidden' }}>
            <DMSidebar
              selectedDmChannelId={urlParams.dmChannel}
              onSelectDmChannel={handleDmChannelSelect}
              onCloseSidebar={!isMd ? () => setSidebarOpen(false) : undefined}
            />
          </div>
        </div>
      );
    },
    [
      selectedType,
      isApprovalTab,
      handleTypeSelect,
      approvalRecords,
      handleChannelSelect,
      urlParams.channel,
      urlParams.dmChannel,
      handleRefresh,
      isFetchingApprovals,
      handleDmChannelSelect,
      isMd,
    ]
  );

  if (isLoading) {
    return (
      <Layout style={{ height: '100%', background: token.colorBgContainer }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Spin size="large" />
        </div>
      </Layout>
    );
  }

  if (isError) {
    const errorMessage =
      error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : 'An error occurred';
    return (
      <Layout style={{ height: '100%', background: token.colorBgContainer }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '16px' }}>
          <Alert message="Error loading chats" description={errorMessage} type="error" showIcon />
        </div>
      </Layout>
    );
  }

  return (
    <Layout style={{ height: '100%', background: token.colorBgContainer }}>
      <Drawer
        title="Chat Channels"
        placement="left"
        onClose={() => setSidebarOpen(false)}
        open={sidebarOpen}
        width={280}
        styles={{ body: { padding: 0 } }}
      >
        {channelListContent}
      </Drawer>

      {isMd && (
        <Sider
          width={240}
          style={{
            background: token.colorBgContainer,
            borderRight: `1px solid ${token.colorBorder}`,
            overflow: 'auto',
          }}
        >
          {channelListContent}
        </Sider>
      )}

      <Content
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          paddingRight: 0,
          marginLeft: 0,
        }}
      >
        {!isMd && (
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              borderBottom: `1px solid ${token.colorBorderSecondary ?? token.colorBorder}`,
              background: token.colorBgContainer,
            }}
          >
            <Button
              type="primary"
              icon={<MenuOutlined />}
              onClick={() => setSidebarOpen(true)}
              style={{ boxShadow: `0 2px 8px ${token.colorPrimaryBg}` }}
            >
              Chat Channels
            </Button>
          </div>
        )}
        {urlParams.dmChannel ? (
          <DMMessagePanel
            channelId={urlParams.dmChannel}
            onBack={handleDmBack}
          />
        ) : selectedChannelForPanel ? (
          <MemoizedMessagePanel
            key={`channel-${getChannelId(selectedChannelForPanel)}-${selectedThread ?? 'no-thread'}`}
            channel={selectedChannelForPanel}
            threadId={selectedThread}
            onThreadSelect={handleThreadSelect}
            onBack={handleBack}
            approvalRecord={approvalRecord}
            onRefetchApprovalChannels={refetchApprovalChannels}
            selectedQuestionApprovalStatus={selectedQuestionApprovalStatus}
            approvalChannelType={approvalChannelType}
          />
        ) : selectedType ? (
          <MemoizedMessagePanel
            key={`type-${selectedType}`}
            records={isApprovalTab ? approvalRecords : undefined}
            channels={
              !isApprovalTab && channelsByType.length > 0
                ? channelsByType.map((c) => ({ ...c, _id: c.id } as unknown as ChannelData))
                : undefined
            }
            type={selectedType}
            onChannelSelect={handleChannelSelect}
            approvalRecord={approvalRecord}
            onRefetchApprovalChannels={refetchApprovalChannels}
            selectedQuestionApprovalStatus={selectedQuestionApprovalStatus}
            approvalChannelType={approvalChannelType}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: token.colorTextSecondary,
              gap: '16px',
              padding: isMd ? '32px' : '16px',
            }}
          >
            <MessageOutlined
              style={{ fontSize: isMd ? 64 : 48, opacity: 0.3, color: token.colorTextSecondary }}
            />
            <Text type="secondary" style={{ fontSize: isMd ? 16 : 14, textAlign: 'center' }}>
              Select a chat type to get started
            </Text>
          </div>
        )}
      </Content>
    </Layout>
  );
};
