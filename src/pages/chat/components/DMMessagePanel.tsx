/**
 * DM chat panel: socket join/leave, send/receive messages, typing, mark read.
 * Uses same /queues socket namespace (dm:* events).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, theme, Spin, Button, Input, Drawer } from 'antd';
import { AssetAvatar } from '../../../components';
import { ArrowLeftOutlined, CommentOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, type AppDispatch } from '../../../store';
import { useSocket } from '../../../context/SocketContext';
import { SOCKET_EVENTS } from '../../../services/socketEvents';
import { setStatus as setDmOnlineStatus } from '../../../features/dmOnlineStatus/dmOnlineStatusSlice';
import { selectIsProfileOnline } from '../../../features/dmOnlineStatus/dmOnlineStatusSlice';
import {
  useGetDMChannelQuery,
  useListDMMessagesQuery,
  useListDMThreadRepliesQuery,
  type DMChannel,
  type DMMessage,
  type DMProfile,
} from '../../../services/dmchatsApi';
import { api } from '../../../services/api';

const { Header, Content, Footer } = Layout;

const typingIndicatorStyles = `
  @keyframes dm-typing-bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
    30% { transform: translateY(-3px); opacity: 1; }
  }
  .dm-typing-dot {
    display: inline-block;
    width: 4px;
    height: 4px;
    margin: 0 2px;
    border-radius: 50%;
    animation: dm-typing-bounce 1.2s ease-in-out infinite;
  }
  .dm-typing-dot:nth-child(1) { animation-delay: 0s; }
  .dm-typing-dot:nth-child(2) { animation-delay: 0.15s; }
  .dm-typing-dot:nth-child(3) { animation-delay: 0.3s; }
`;

function getProfileDisplayName(p: DMProfile): string {
  const u = p.user;
  if (!u) return 'Unknown';
  if (typeof u === 'object' && u !== null && 'name' in u) return (u as { name?: string }).name ?? (u as { email?: string }).email ?? 'Unknown';
  return 'Unknown';
}

function getOtherParticipant(channel: DMChannel, currentProfileId: string): DMProfile | undefined {
  return channel.participants.find((p) => p._id !== currentProfileId);
}

export interface DMMessagePanelProps {
  channelId: string;
  onBack: () => void;
}

export function DMMessagePanel({ channelId, onBack }: DMMessagePanelProps) {
  const { token } = theme.useToken();
  const dispatch = useDispatch<AppDispatch>();
  const currentProfileId = useSelector((state: RootState) => state.auth.selectedProfile?._id) ?? null;
  const socket = useSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadRepliesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMarkReadRef = useRef<number>(0);
  const channelIdRef = useRef<string | null>(null);
  const MARK_READ_THROTTLE_MS = 2000;

  channelIdRef.current = channelId;

  const { data: channel, isLoading: isLoadingChannel } = useGetDMChannelQuery(channelId, { skip: !channelId });
  const { data: messagesData, isLoading: isLoadingMessages } = useListDMMessagesQuery(
    { channelId },
    { skip: !channelId }
  );

  const [optimisticMessages, setOptimisticMessages] = useState<DMMessage[]>([]);
  const [socketMessages, setSocketMessages] = useState<DMMessage[]>([]);
  const [typingProfileIds, setTypingProfileIds] = useState<Set<string>>(new Set());
  /** Current user's last read timestamp in this channel (for unread message visuals). From lastReadByParticipants + dm:read:update. */
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  /** Other participant's last read (for "Read" in header). */
  const [lastReadAtByOther, setLastReadAtByOther] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  /** Thread panel (Slack-style): root message when thread drawer is open */
  const [openThreadRoot, setOpenThreadRoot] = useState<DMMessage | null>(null);
  const [threadReplyInput, setThreadReplyInput] = useState('');
  const [sendingThreadReply, setSendingThreadReply] = useState(false);
  /** Optimistic + socket thread replies by parent message id */
  const [threadRepliesByParent, setThreadRepliesByParent] = useState<Record<string, DMMessage[]>>({});
  /** Extra reply count when we receive new thread reply (main list may not include thread replies) */
  const [replyCountBump, setReplyCountBump] = useState<Record<string, number>>({});

  const otherParticipant = channel && currentProfileId ? getOtherParticipant(channel, currentProfileId) : undefined;
  const headerTitle = otherParticipant ? getProfileDisplayName(otherParticipant) : 'Direct message';
  const isOtherOnline = useSelector((state: RootState) => selectIsProfileOnline(state, otherParticipant?._id));

  const parentIdForThread =
    openThreadRoot?._id && !String(openThreadRoot._id).startsWith('dm-') ? openThreadRoot._id : null;
  const { data: threadData } = useListDMThreadRepliesQuery(
    { messageId: parentIdForThread! },
    { skip: !parentIdForThread }
  );

  const apiThreadReplies = threadData?.replies ?? [];
  const optimisticForOpenThread = openThreadRoot
    ? (threadRepliesByParent[openThreadRoot._id ?? ''] ?? threadRepliesByParent[openThreadRoot.localId ?? ''] ?? [])
    : [];
  const mergedThreadReplies = (() => {
    const byId = new Map<string, DMMessage>();
    apiThreadReplies.forEach((r) => {
      byId.set(r._id, r);
    });
    optimisticForOpenThread.forEach((r) => {
      if (r._id && !byId.has(r._id)) byId.set(r._id, r);
      else if (r.localId && !apiThreadReplies.some((a) => a.localId === r.localId)) byId.set(r.localId, r);
    });
    return Array.from(byId.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  })();

  const apiMessages = messagesData?.messages ?? [];
  const apiIds = new Set(apiMessages.map((m) => m._id));
  const merged = [...apiMessages];
  socketMessages.forEach((m) => {
    if (m._id && !apiIds.has(m._id)) {
      merged.push(m);
      apiIds.add(m._id);
    }
  });
  optimisticMessages.forEach((m) => {
    const hasInApi = apiMessages.some((a) => a._id === m._id || a.localId === m.localId);
    const hasInSocket = socketMessages.some((s) => s._id === m._id || s.localId === m.localId);
    if (!hasInApi && !hasInSocket) merged.push(m);
  });
  const allMessages = merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  /** Root messages only (no thread/parent) for main timeline; thread replies stay in allMessages for reply count */
  const rootMessages = allMessages.filter(
    (m) => !(m.thread != null && m.thread !== '') && !(m.parentMessage != null && m.parentMessage !== '')
  );
  const replyCountByRootId: Record<string, number> = {};
  allMessages.forEach((m) => {
    const rootId = m.thread || m.parentMessage;
    if (rootId) {
      replyCountByRootId[rootId] = (replyCountByRootId[rootId] ?? 0) + 1;
    }
  });
  Object.entries(replyCountBump).forEach(([rootId, bump]) => {
    replyCountByRootId[rootId] = (replyCountByRootId[rootId] ?? 0) + bump;
  });

  useEffect(() => {
    setLastReadAt(null);
    setLastReadAtByOther(null);
  }, [channelId]);

  const currentUserLastReadFromChannel = channel && currentProfileId ? channel.lastReadByParticipants?.[currentProfileId] : undefined;
  useEffect(() => {
    if (currentUserLastReadFromChannel) {
      setLastReadAt((prev) => prev ?? currentUserLastReadFromChannel);
    }
  }, [currentUserLastReadFromChannel]);

  // Update channel list cache so sidebar shows no "1 new" after closing DM (lastReadByParticipants in sync)
  const updateChannelListLastRead = useCallback(
    (readAt: string) => {
      if (!currentProfileId) return;
      dispatch(
        api.util.updateQueryData(
          'listDMChannels' as Parameters<typeof api.util.updateQueryData>[0],
          undefined as Parameters<typeof api.util.updateQueryData>[1],
          (draft) => {
            const data = draft as { channels?: DMChannel[] };
            const ch = data?.channels?.find((c) => c._id === channelId);
            if (ch) {
              ch.lastReadByParticipants = ch.lastReadByParticipants ?? {};
              ch.lastReadByParticipants[currentProfileId] = readAt;
            }
          }
        ) as unknown as Parameters<AppDispatch>[0]
      );
    },
    [channelId, currentProfileId, dispatch]
  );

  // Read DM messages (DM_CHAT_API_UI_DEVELOPER.md): mark as read when channel is viewed
  useEffect(() => {
    if (!channelId) return;
    const readAt = new Date().toISOString();
    if (socket.isConnected) {
      socket.joinDmChannel(channelId);
      socket.dmMarkAsRead(channelId);
    }
    setLastReadAt(readAt);
    updateChannelListLastRead(readAt);
    return () => {
      if (socket.isConnected) {
        const id = channelIdRef.current;
        if (id) socket.leaveDmChannel(id);
      }
    };
  }, [channelId, socket.isConnected, socket, updateChannelListLastRead]);

  const handleBack = useCallback(() => {
    if (channelId && socket.isConnected) {
      socket.leaveDmChannel(channelId);
    }
    onBack();
  }, [channelId, socket.isConnected, socket, onBack]);

  useEffect(() => {
    const handler = (data: { message?: DMMessage; channelId?: string }) => {
      if (data.channelId !== channelId) return;
      const msg = data.message;
      if (msg) {
        setOptimisticMessages((prev) => prev.filter((m) => m.localId !== msg.localId));
        setSocketMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        // Batch read receipts: mark as read when viewing (throttled per doc)
        if (socket.isConnected) {
          const now = Date.now();
          if (now - lastMarkReadRef.current >= MARK_READ_THROTTLE_MS) {
            lastMarkReadRef.current = now;
            const readAt = new Date().toISOString();
            socket.dmMarkAsRead(channelId);
            setLastReadAt(readAt);
            updateChannelListLastRead(readAt);
          }
        }
      }
    };
    socket.on(SOCKET_EVENTS.DM.NEW_MESSAGE, handler);
    return () => {
      socket.off(SOCKET_EVENTS.DM.NEW_MESSAGE, handler);
    };
  }, [channelId, socket, updateChannelListLastRead]);

  useEffect(() => {
    const handler = (data: {
      message?: DMMessage;
      channelId?: string;
      parentMessageId?: string;
      isNotification?: boolean;
    }) => {
      if (data.channelId !== channelId || !data.message || !data.parentMessageId) return;
      const parentId = data.parentMessageId;
      setThreadRepliesByParent((prev) => {
        const list = prev[parentId] ?? [];
        const incoming = data.message!;
        if (list.some((r) => r._id === incoming._id)) return prev;
        const withoutOptimistic = incoming.localId
          ? list.filter((r) => r.localId !== incoming.localId)
          : list;
        const isReplacingOwn = withoutOptimistic.length < list.length;
        if (!isReplacingOwn) {
          setReplyCountBump((b) => ({ ...b, [parentId]: (b[parentId] ?? 0) + 1 }));
        }
        return { ...prev, [parentId]: [...withoutOptimistic, incoming] };
      });
    };
    socket.on(SOCKET_EVENTS.DM.NEW_THREAD_REPLY, handler);
    return () => {
      socket.off(SOCKET_EVENTS.DM.NEW_THREAD_REPLY, handler);
    };
  }, [channelId, socket]);

  useEffect(() => {
    const handler = (data: { channelId?: string; profileId?: string; isTyping?: boolean; typingProfiles?: string[] }) => {
      if (data.channelId !== channelId) return;
      if (data.typingProfiles) {
        setTypingProfileIds(new Set(data.typingProfiles));
      } else if (data.profileId != null) {
        setTypingProfileIds((prev) => {
          const next = new Set(prev);
          if (data.isTyping) next.add(data.profileId!);
          else next.delete(data.profileId!);
          return next;
        });
      }
    };
    socket.on(SOCKET_EVENTS.DM.TYPING_STATUS, handler);
    return () => {
      socket.off(SOCKET_EVENTS.DM.TYPING_STATUS, handler);
    };
  }, [channelId, socket]);

  // Read receipts: dm:read:receipt { channelId, profileId, timestamp } and dm:read:update { channelId, profileId, lastReadAt }
  useEffect(() => {
    const onReceipt = (data: { channelId?: string; profileId?: string; timestamp?: number | string }) => {
      if (data.channelId !== channelId) return;
      if (otherParticipant && data.profileId === otherParticipant._id && data.timestamp != null) {
        const ts = typeof data.timestamp === 'string' ? new Date(data.timestamp).getTime() : Number(data.timestamp);
        if (!Number.isNaN(ts)) setLastReadAtByOther(ts);
      }
    };
    const onReadUpdate = (data: { channelId?: string; profileId?: string; lastReadAt?: string }) => {
      if (data.channelId !== channelId || !data.lastReadAt) return;
      if (data.profileId === currentProfileId) setLastReadAt(data.lastReadAt);
    };
    socket.on(SOCKET_EVENTS.DM.READ_RECEIPT, onReceipt);
    socket.on(SOCKET_EVENTS.DM.READ_UPDATE, onReadUpdate);
    return () => {
      socket.off(SOCKET_EVENTS.DM.READ_RECEIPT, onReceipt);
      socket.off(SOCKET_EVENTS.DM.READ_UPDATE, onReadUpdate);
    };
  }, [channelId, currentProfileId, otherParticipant?._id, socket]);

  useEffect(() => {
    const handler = (data: { channelId?: string; profileId?: string; leftBy?: string }) => {
      if (data.channelId !== channelId) return;
      const leftProfileId = data.profileId ?? data.leftBy;
      if (leftProfileId) {
        dispatch(setDmOnlineStatus({ profileId: leftProfileId, isOnline: false }));
      }
    };
    socket.on(SOCKET_EVENTS.DM.LEAVE, handler);
    return () => {
      socket.off(SOCKET_EVENTS.DM.LEAVE, handler);
    };
  }, [channelId, socket, dispatch]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]);

  useEffect(() => {
    if (openThreadRoot) {
      threadRepliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [openThreadRoot, mergedThreadReplies.length]);

  const sendMessage = useCallback(() => {
    const text = inputValue.trim();
    if (!text || !channelId || !socket.isConnected) return;
    const localId = `dm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setOptimisticMessages((prev) => [
      ...prev,
      {
        _id: localId,
        localId,
        channel: channelId,
        sentBy: { _id: currentProfileId!, user: { _id: '', name: 'You', email: '' } },
        action: 'message',
        actionData: { text },
        createdAt: new Date().toISOString(),
      } as DMMessage,
    ]);
    setInputValue('');
    setSending(true);
    socket.sendDmMessage({ channelId, text, localId });
    socket.dmTypingStop(channelId);
    setSending(false);
  }, [inputValue, channelId, socket, currentProfileId]);

  const sendThreadReply = useCallback(
    (parentMessageId: string, text: string) => {
      const t = text.trim();
      if (!t || !socket.isConnected) return;
      const localId = `dm-thread-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic: DMMessage = {
        _id: localId,
        localId,
        channel: channelId,
        sentBy: { _id: currentProfileId!, user: { _id: '', name: 'You', email: '' } },
        action: 'message',
        actionData: { text: t },
        thread: parentMessageId,
        parentMessage: parentMessageId,
        createdAt: new Date().toISOString(),
      } as DMMessage;
      setThreadRepliesByParent((prev) => ({
        ...prev,
        [parentMessageId]: [...(prev[parentMessageId] ?? []), optimistic],
      }));
      setReplyCountBump((prev) => ({ ...prev, [parentMessageId]: (prev[parentMessageId] ?? 0) + 1 }));
      setThreadReplyInput('');
      setSendingThreadReply(true);
      socket.sendDmThreadReply({ messageId: parentMessageId, text: t, localId });
      setSendingThreadReply(false);
    },
    [channelId, socket, currentProfileId]
  );

  const handleTyping = useCallback(() => {
    if (!channelId || !socket.isConnected) return;
    socket.dmTypingStart(channelId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.dmTypingStop(channelId);
      typingTimeoutRef.current = null;
    }, 3000);
  }, [channelId, socket]);

  if (isLoadingChannel || !channel) {
    return (
      <Layout style={{ height: '100%', background: token.colorBgContainer }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Spin size="large" />
        </div>
      </Layout>
    );
  }

  const otherAvatar =
    otherParticipant?.user && typeof otherParticipant.user === 'object' && 'avatar' in otherParticipant.user
      ? (otherParticipant.user as { avatar?: string }).avatar
      : undefined;
  const presenceText = isOtherOnline ? 'Active now' : lastReadAtByOther != null ? 'Viewed' : 'Offline';

  return (
    <Layout
      style={{
        height: '100%',
        background: token.colorBgLayout ?? '#f8f8f8',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{typingIndicatorStyles}</style>
      {/* Slack-like minimal header */}
      <Header
        style={{
          height: 52,
          minHeight: 52,
          padding: '0 16px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary ?? token.colorBorder}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          lineHeight: 1,
        }}
      >
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
          style={{ color: token.colorTextSecondary, marginLeft: -4 }}
        />
        <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
          <AssetAvatar
            avatarKey={otherAvatar}
            size={36}
            style={{ backgroundColor: token.colorTextPlaceholder }}
          />
          {otherParticipant && (
            <span
              title={isOtherOnline ? 'Active now' : 'Offline'}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: isOtherOnline ? token.colorSuccess : token.colorTextPlaceholder,
                border: `2px solid ${token.colorBgContainer}`,
                boxSizing: 'content-box',
              }}
            />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: token.colorText }}>
            {headerTitle}
          </div>
          <div style={{ fontSize: 13, color: token.colorTextSecondary, marginTop: 1 }}>
            {presenceText}
          </div>
        </div>
      </Header>

      <Content
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px 20px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 2,
        }}
      >
        {isLoadingMessages ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : (
          <>
            {(() => {
              const readAtTime = lastReadAt ? new Date(lastReadAt).getTime() : 0;
              let firstUnreadIndex = -1;
              for (let i = 0; i < rootMessages.length; i++) {
                const msg = rootMessages[i];
                const isOwn = msg.sentBy?._id === currentProfileId;
                if (isOwn) continue;
                const msgTime = new Date(msg.createdAt).getTime();
                if (
                  !lastReadAt ||
                  (Number.isFinite(msgTime) && Number.isFinite(readAtTime) && msgTime > readAtTime)
                ) {
                  firstUnreadIndex = i;
                  break;
                }
              }
              const hasUnread = firstUnreadIndex >= 0;

              const newMessagesDivider = hasUnread && (
                <div
                  key="new-messages-divider"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    margin: '12px 0 8px',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: token.colorBorderSecondary ?? token.colorBorder,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: token.colorTextSecondary,
                      padding: '2px 10px',
                      backgroundColor: token.colorBgLayout ?? token.colorBgContainer,
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  >
                    New messages
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: token.colorBorderSecondary ?? token.colorBorder,
                    }}
                  />
                </div>
              );

              const AVATAR_SIZE = 36;
              const AVATAR_GAP = 10;
              const groupContinuationIndent = AVATAR_SIZE + AVATAR_GAP;

              return (
                <>
                  {rootMessages.map((msg, index) => {
                    const isOwn = msg.sentBy?._id === currentProfileId;
                    const prevMsg = index > 0 ? rootMessages[index - 1] : null;
                    const nextMsg = index < rootMessages.length - 1 ? rootMessages[index + 1] : null;
                    const isFirstInGroup = !prevMsg || prevMsg.sentBy?._id !== msg.sentBy?._id;
                    const isLastInGroup = !nextMsg || nextMsg.sentBy?._id !== msg.sentBy?._id;
                    const text = msg.actionData?.text ?? '';
                    const msgTime = new Date(msg.createdAt).getTime();
                    const isUnread =
                      !isOwn &&
                      (!lastReadAt ||
                        (Number.isFinite(msgTime) &&
                          Number.isFinite(readAtTime) &&
                          msgTime > readAtTime));
                    const timeStr = new Date(msg.createdAt).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    });
                    const showDividerBefore = index === firstUnreadIndex;
                    const rootId = msg._id ?? msg.localId ?? '';
                    const replyCount = rootId ? (replyCountByRootId[rootId] ?? 0) : 0;

                    const threadActions = (
                      <div
                        className="dm-message-thread-actions"
                        style={{
                          position: 'absolute',
                          top: -22,
                          right: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 8,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: token.colorBgContainer,
                          boxShadow: token.boxShadowSecondary,
                          border: `1px solid ${token.colorBorderSecondary ?? token.colorBorder}`,
                          opacity: 0,
                          pointerEvents: 'none',
                          transition: 'opacity 0.15s ease',
                          zIndex: 1,
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenThreadRoot(msg);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          style={{
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            fontSize: 12,
                            color: token.colorPrimary,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            pointerEvents: 'auto',
                          }}
                        >
                          <CommentOutlined />
                          Reply in thread
                        </button>
                        {replyCount > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenThreadRoot(msg);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              fontSize: 12,
                              color: token.colorTextSecondary,
                              display: 'inline-flex',
                              alignItems: 'center',
                              pointerEvents: 'auto',
                            }}
                          >
                            View thread ({replyCount} {replyCount === 1 ? 'reply' : 'replies'})
                          </button>
                        )}
                      </div>
                    );

                    return (
                      <div
                        key={msg._id ?? msg.localId}
                        style={{
                          position: 'relative',
                          width: '100%',
                          marginBottom: isLastInGroup ? 8 : 1,
                        }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget.querySelector('.dm-message-thread-actions') as HTMLElement;
                          if (el) el.style.opacity = '1';
                          if (el) el.style.pointerEvents = 'auto';
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget.querySelector('.dm-message-thread-actions') as HTMLElement;
                          if (el) el.style.opacity = '0';
                          if (el) el.style.pointerEvents = 'none';
                        }}
                      >
                        {showDividerBefore && newMessagesDivider}
                        {isFirstInGroup ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: AVATAR_GAP,
                              width: '100%',
                            }}
                          >
                            <AssetAvatar
                              avatarKey={msg.sentBy?.user?.avatar}
                              size={AVATAR_SIZE}
                              style={{
                                flexShrink: 0,
                                marginTop: 2,
                                backgroundColor: token.colorTextPlaceholder,
                              }}
                            />
                            <div style={{ minWidth: 0, flex: 1, position: 'relative', textAlign: 'left' }}>
                              {threadActions}
                              <div
                                style={{
                                  marginBottom: 2,
                                  display: 'flex',
                                  alignItems: 'baseline',
                                  gap: 8,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 15,
                                    fontWeight: 600,
                                    color: token.colorText,
                                  }}
                                >
                                  {isOwn ? 'You' : getProfileDisplayName(msg.sentBy as DMProfile)}
                                </span>
                                <span
                                  style={{
                                    fontSize: 12,
                                    color: token.colorTextTertiary,
                                  }}
                                >
                                  {timeStr}
                                </span>
                              </div>
                              <div
                                style={{
                                  display: 'block',
                                  maxWidth: '85%',
                                  padding: '4px 0 2px',
                                  textAlign: 'left',
                                  borderLeft: isUnread
                                    ? `3px solid ${token.colorPrimary}`
                                    : undefined,
                                  paddingLeft: isUnread ? 8 : 0,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 15,
                                    color: token.colorText,
                                    wordBreak: 'break-word',
                                    lineHeight: 1.4,
                                  }}
                                >
                                  {text}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              paddingLeft: groupContinuationIndent,
                              position: 'relative',
                              textAlign: 'left',
                            }}
                          >
                            {threadActions}
                            <div
                              style={{
                                display: 'block',
                                maxWidth: '85%',
                                padding: '2px 0',
                                borderLeft: isUnread
                                  ? `3px solid ${token.colorPrimary}`
                                  : undefined,
                                paddingLeft: isUnread ? 8 : 0,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 15,
                                  color: token.colorText,
                                  wordBreak: 'break-word',
                                  lineHeight: 1.4,
                                }}
                              >
                                {text}
                              </span>
                              <span
                                style={{
                                  marginLeft: 8,
                                  fontSize: 11,
                                  color: token.colorTextTertiary,
                                }}
                              >
                                {timeStr}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              );
            })()}
          </>
        )}
      </Content>

      <Footer
        style={{
          padding: '12px 16px 16px',
          borderTop: `1px solid ${token.colorBorderSecondary ?? token.colorBorder}`,
          background: token.colorBgContainer,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {typingProfileIds.size > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontStyle: 'italic',
              color: token.colorTextSecondary,
            }}
          >
            <span className="dm-typing-dot" style={{ backgroundColor: token.colorTextSecondary }} />
            <span className="dm-typing-dot" style={{ backgroundColor: token.colorTextSecondary }} />
            <span className="dm-typing-dot" style={{ backgroundColor: token.colorTextSecondary }} />
            <span style={{ marginLeft: 2 }}>{headerTitle} is typing</span>
          </div>
        )}
        <Input.TextArea
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            handleTyping();
          }}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={`Message ${headerTitle}`}
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={sending}
          style={{
            borderRadius: 8,
            resize: 'none',
          }}
        />
      </Footer>

      {/* Slack-style thread drawer */}
      <Drawer
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CommentOutlined />
            Thread
          </span>
        }
        placement="right"
        width={400}
        open={!!openThreadRoot}
        onClose={() => {
          setOpenThreadRoot(null);
          setThreadReplyInput('');
        }}
        styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
      >
        {openThreadRoot && (
          <>
            <div
              style={{
                padding: 12,
                borderBottom: `1px solid ${token.colorBorderSecondary ?? token.colorBorder}`,
                background: token.colorFillQuaternary ?? token.colorBgLayout,
              }}
            >
              <div style={{ fontSize: 13, color: token.colorTextSecondary, marginBottom: 4 }}>
                {getProfileDisplayName(openThreadRoot.sentBy as DMProfile)} ·{' '}
                {new Date(openThreadRoot.createdAt).toLocaleString(undefined, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </div>
              <div style={{ fontSize: 15, color: token.colorText }}>{openThreadRoot.actionData?.text ?? ''}</div>
            </div>
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 0,
              }}
            >
              {mergedThreadReplies.map((reply, idx) => {
                const replyText = reply.actionData?.text ?? '';
                const replyTimeStr = new Date(reply.createdAt).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                });
                const prevReply = idx > 0 ? mergedThreadReplies[idx - 1] : null;
                const nextReply = idx < mergedThreadReplies.length - 1 ? mergedThreadReplies[idx + 1] : null;
                const isFirstInGroup = !prevReply || prevReply.sentBy?._id !== reply.sentBy?._id;
                const isLastInGroup = !nextReply || nextReply.sentBy?._id !== reply.sentBy?._id;
                const threadAvatarSize = 32;
                const threadAvatarGap = 8;
                const threadContentIndent = threadAvatarSize + threadAvatarGap;
                return (
                  <div
                    key={reply._id ?? reply.localId}
                    style={{
                      width: '100%',
                      marginBottom: isLastInGroup ? 12 : 1,
                      textAlign: 'left',
                    }}
                  >
                    {isFirstInGroup ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: threadAvatarGap,
                          width: '100%',
                        }}
                      >
                        <AssetAvatar
                          avatarKey={reply.sentBy?.user?.avatar}
                          size={threadAvatarSize}
                          style={{
                            flexShrink: 0,
                            marginTop: 2,
                            backgroundColor: token.colorTextPlaceholder,
                          }}
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              marginBottom: 2,
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: 8,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: token.colorText,
                              }}
                            >
                              {reply.sentBy?._id === currentProfileId
                                ? 'You'
                                : getProfileDisplayName(reply.sentBy as DMProfile)}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                color: token.colorTextTertiary,
                              }}
                            >
                              {replyTimeStr}
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'block',
                              fontSize: 14,
                              color: token.colorText,
                              wordBreak: 'break-word',
                              lineHeight: 1.4,
                            }}
                          >
                            {replyText}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: `2px 0 2px ${threadContentIndent}px`,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            color: token.colorText,
                            wordBreak: 'break-word',
                            lineHeight: 1.4,
                          }}
                        >
                          {replyText}
                        </span>
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            color: token.colorTextTertiary,
                          }}
                        >
                          {replyTimeStr}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={threadRepliesEndRef} />
            </div>
            <div
              style={{
                padding: 12,
                borderTop: `1px solid ${token.colorBorderSecondary ?? token.colorBorder}`,
              }}
            >
              <Input.TextArea
                value={threadReplyInput}
                onChange={(e) => setThreadReplyInput(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    if (parentIdForThread) sendThreadReply(parentIdForThread, threadReplyInput);
                  }
                }}
                placeholder="Reply in thread..."
                autoSize={{ minRows: 1, maxRows: 3 }}
                disabled={sendingThreadReply || !parentIdForThread}
                style={{ borderRadius: 8, resize: 'none' }}
              />
            </div>
          </>
        )}
      </Drawer>
    </Layout>
  );
}
