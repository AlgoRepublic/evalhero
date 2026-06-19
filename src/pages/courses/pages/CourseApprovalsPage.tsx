/**
 * Course Approvals – sub-tab under Courses.
 * No sidebar; only the conversation list and (when selected) the message panel.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Layout, theme, Spin, Alert, Button, Typography, Grid } from 'antd';
import { ReloadOutlined, MessageOutlined } from '@ant-design/icons';
import { PageHeader } from '../../../components';
import { BookOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { PATH_COURSES } from '../../../constants/routes';
import {
  getChannelId,
  matchChannelById,
  COURSE_FORM_QUESTION_APPROVAL_TYPE,
  getSocketMessageSentEventForApprovalTab,
  SOCKET_REFETCH_DELAY_MS,
  SOCKET_REFETCH_ACTION_DELAY_MS,
  SOCKET_REFETCH_ACTION_FOLLOW_UP_MS,
  type ApprovalRecord,
  type SocketMessageSentPayload,
} from '../../chat/components/chatLayoutUtils';
import type { Channel } from '../../chat/types';
import type { ChannelData } from '../../../services/queueApi';
import {
  useGetQuestionApprovalChannelsQuery,
  type CourseFormApprovalChannelRecord,
  type CourseFormApprovalChannelItem,
  queueApi,
} from '../../../services/queueApi';
import { useSocket } from '../../../context/SocketContext';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../../store';
import { CourseFormApprovalChannelsList } from '../../chat/components/CourseFormApprovalChannelsList';
import { MessagePanel } from '../../chat/components/MessagePanel';

const { Content } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

export const CourseApprovalsPage = () => {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isMd = Boolean(screens.md ?? screens.lg ?? screens.xl ?? screens.xxl);
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch<AppDispatch>();
  const socket = useSocket();

  const channelParam = searchParams.get('channel');
  const threadParam = searchParams.get('thread');

  const { data: approvalChannelsResponse, isLoading, isFetching, isError, error, refetch } = useGetQuestionApprovalChannelsQuery(
    {
      type: 'course_form_question_approval',
      page: 1,
      perPage: 50,
      sortBy: 'latestActivity',
      order: 'desc',
    },
    {
      pollingInterval: 0,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useEffect(() => {
    if (!socket.isConnected) return;
    const event = getSocketMessageSentEventForApprovalTab(COURSE_FORM_QUESTION_APPROVAL_TYPE);
    const handleMessageSent = (data: unknown) => {
      const payload = data as SocketMessageSentPayload;
      const isNonMessageAction = Boolean(payload?.action && payload.action !== 'message');
      const delay = isNonMessageAction ? SOCKET_REFETCH_ACTION_DELAY_MS : SOCKET_REFETCH_DELAY_MS;
      setTimeout(() => {
        refetchRef.current?.();
        if (isNonMessageAction) {
          setTimeout(() => refetchRef.current?.(), SOCKET_REFETCH_ACTION_FOLLOW_UP_MS);
        }
      }, delay);
    };
    socket.on(event, handleMessageSent);
    return () => {
      socket.off(event, handleMessageSent);
    };
  }, [socket.isConnected, socket]);

  const approvalRecords = useMemo((): CourseFormApprovalChannelRecord[] => {
    if (!approvalChannelsResponse?.data) return [];
    const data = approvalChannelsResponse.data as { records?: ApprovalRecord[]; list?: ApprovalRecord[] };
    const raw = (data.records ?? data.list ?? []) as ApprovalRecord[];
    return raw.filter((r): r is CourseFormApprovalChannelRecord => 'courseEnrolmentId' in r);
  }, [approvalChannelsResponse]);

  const updateParams = useCallback((updates: { channel?: string | null; thread?: string | null }) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (updates.channel !== undefined) {
        if (updates.channel) next.set('channel', updates.channel);
        else next.delete('channel');
        next.delete('thread');
      }
      if (updates.thread !== undefined) {
        if (updates.thread) next.set('thread', updates.thread);
        else next.delete('thread');
      }
      return next;
    });
  }, []);

  const selectedChannel = useMemo((): ChannelData | null => {
    if (!channelParam) return null;
    const channelId = String(channelParam);
    const match = matchChannelById(channelId);
    for (const record of approvalRecords) {
      const list = record.channels && Array.isArray(record.channels) ? record.channels : [];
      const channelData = list.find(match);
      if (!channelData) continue;
      const courseRecord = record as CourseFormApprovalChannelRecord;
      const enrolleeName = courseRecord.courseEnrolment?.enrollee?.user?.name ?? 'Enrollee';
      const courseTitle = courseRecord.course?.title ?? 'Course';
      const pageTitle = courseRecord.coursePage?.title ?? 'Page';
      const title = `${courseTitle} · ${pageTitle} · ${enrolleeName}`;
      const item = channelData as CourseFormApprovalChannelItem;
      const status = item.courseFormQuestionApprovalStatus ?? item.questionApprovalStatus ?? item.courseFormApprovalStatus;
      return {
        ...(channelData as unknown as Record<string, unknown>),
        _id: (channelData as { _id: string })._id,
        title,
        questionApprovalStatus: status,
        lastActivityAt: (channelData as { lastActivityAt?: string }).lastActivityAt,
        channelType: COURSE_FORM_QUESTION_APPROVAL_TYPE,
      } as unknown as ChannelData;
    }
    return null;
  }, [channelParam, approvalRecords]);

  useEffect(() => {
    if (approvalRecords.length > 0 && channelParam && selectedChannel == null) {
      updateParams({ channel: null, thread: null });
    }
  }, [approvalRecords.length, channelParam, selectedChannel, updateParams]);

  const approvalRecord = useMemo((): ApprovalRecord | null => {
    if (!selectedChannel) return null;
    const channelId = getChannelId(selectedChannel as ChannelData);
    return (
      (approvalRecords.find((r) => r.channels?.some(matchChannelById(channelId))) as ApprovalRecord) ?? null
    );
  }, [selectedChannel, approvalRecords]);

  const selectedQuestionApprovalStatus = useMemo(() => {
    if (!selectedChannel) return '';
    const channelId = getChannelId(selectedChannel as ChannelData);
    const record = approvalRecords.find((r) => r.channels?.some(matchChannelById(channelId)));
    const ch = record?.channels?.find(matchChannelById(channelId)) as
      | { questionApprovalStatus?: string; courseFormQuestionApprovalStatus?: string }
      | undefined;
    return ch?.courseFormQuestionApprovalStatus ?? ch?.questionApprovalStatus ?? '';
  }, [selectedChannel, approvalRecords]);

  const selectedChannelForPanel = useMemo((): ChannelData | null => {
    if (!selectedChannel) return null;
    if ('_id' in selectedChannel) return selectedChannel as ChannelData;
    return { ...(selectedChannel as object), _id: (selectedChannel as { id: string }).id } as unknown as ChannelData;
  }, [selectedChannel]);

  const handleChannelSelect = useCallback(
    (channel: Channel) => {
      updateParams({ channel: getChannelId(channel), thread: null });
    },
    [updateParams]
  );

  const handleBack = useCallback(() => {
    updateParams({ channel: null, thread: null });
    refetch();
  }, [updateParams, refetch]);

  const handleThreadSelect = useCallback(
    (threadId: string | null) => updateParams({ thread: threadId ?? null }),
    [updateParams]
  );

  const handleRefresh = useCallback(async () => {
    dispatch(
      queueApi.util.invalidateTags([{ type: 'Queue', id: 'question-approval-channels-course_form_question_approval' }])
    );
    await refetch();
  }, [refetch, dispatch]);

  if (isLoading) {
    return (
      <Layout style={{ minHeight: 400, background: token.colorBgContainer }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          <Spin size="large" />
        </div>
      </Layout>
    );
  }

  if (isError) {
    const errorMessage =
      error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : 'Failed to load course approvals';
    return (
      <Layout style={{ minHeight: 400, background: token.colorBgContainer }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Alert message="Error" description={errorMessage} type="error" showIcon />
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Helmet>
        <title>Course Approvals - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Course Approvals"
        breadcrumbs={[
          { title: <><BookOutlined /><span>Courses</span></>, path: PATH_COURSES.courses },
          { title: 'Course Approvals' },
        ]}
      />
      <Layout
        style={{
          height: isMd ? 'calc(100vh - 180px)' : 'calc(100vh - 160px)',
          minHeight: 400,
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorder}`,
          borderRadius: token.borderRadius,
          overflow: 'hidden',
        }}
      >
        <Content
          style={{
            display: 'flex',
            flexDirection: 'row',
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {/* Conversation list – hidden on mobile when a conversation is open */}
          <div
            style={{
              width: isMd ? 320 : '100%',
              minWidth: isMd ? 280 : undefined,
              flexShrink: 0,
              borderRight: selectedChannelForPanel && isMd ? `1px solid ${token.colorBorder}` : undefined,
              display: !isMd && selectedChannelForPanel ? 'none' : 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '19px 16px 20px 16px',
                borderBottom: `1px solid ${token.colorBorder}`,
              }}
            >
              <Text strong style={{ fontSize: 14 }}>
                <CheckCircleOutlined style={{ marginRight: 8 }} />
                Conversations
              </Text>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                size="small"
                type="text"
                title="Refresh"
                loading={isFetching}
              />
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <CourseFormApprovalChannelsList
                records={approvalRecords}
                onChannelSelect={handleChannelSelect}
                selectedChannelId={channelParam}
              />
            </div>
          </div>

          {/* Message panel when a channel is selected – full width on mobile when list is hidden */}
          {selectedChannelForPanel ? (
            <div
              style={{
                flex: 1,
                minWidth: 0,
                width: !isMd ? '100%' : undefined,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <MessagePanel
                key={`channel-${getChannelId(selectedChannelForPanel)}-${threadParam ?? 'no-thread'}`}
                channel={selectedChannelForPanel}
                threadId={threadParam}
                onThreadSelect={handleThreadSelect}
                onBack={handleBack}
                approvalRecord={approvalRecord}
                onRefetchApprovalChannels={refetch}
                selectedQuestionApprovalStatus={selectedQuestionApprovalStatus}
                approvalChannelType={COURSE_FORM_QUESTION_APPROVAL_TYPE}
              />
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: isMd ? 'flex' : 'none',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: token.colorTextSecondary,
                gap: 16,
                padding: 32,
                borderLeft: isMd ? `1px solid ${token.colorBorder}` : undefined,
              }}
            >
              <MessageOutlined style={{ fontSize: 48, opacity: 0.3 }} />
              <Text type="secondary" style={{ textAlign: 'center' }}>
                Select a conversation from the list
              </Text>
            </div>
          )}
        </Content>
      </Layout>
    </>
  );
};
