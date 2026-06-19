/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { SOCKET_EVENTS, getChannelEvents } from '../services/socketEvents';
import { ApiMessage } from '../services/chatApi';

/**
 * Hook for managing Socket.IO channel subscriptions
 * Automatically joins/leaves channels and handles message events
 */
export interface UseSocketChannelOptions {
  channelId: string | null | undefined;
  channelType?: 'approval' | 'dispute' | 'question_approval' | 'course_form_approval' | 'course_form_question_approval' | 'general';
  onMessage?: (message: {channelId: string, message: ApiMessage}) => void;
  onError?: (error: any) => void;
  onJoinSuccess?: (data: any) => void;
  enabled?: boolean;
}

export const useSocketChannel = ({
  channelId,
  channelType = 'general',
  onMessage,
  onError,
  onJoinSuccess,
  enabled = true,
}: UseSocketChannelOptions) => {
  const socket = useSocket();
  const currentChannelIdRef = useRef<string | null>(null);
  const messageHandlerRef = useRef<((data: any) => void) | null>(null);
  const errorHandlerRef = useRef<((data: any) => void) | null>(null);
  const joinSuccessHandlerRef = useRef<((data: any) => void) | null>(null);
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onJoinSuccessRef = useRef(onJoinSuccess);
  onMessageRef.current = onMessage;
  onErrorRef.current = onError;
  onJoinSuccessRef.current = onJoinSuccess;

  // Join channel when channelId changes (callbacks in refs so typing etc. does not trigger re-join)
  useEffect(() => {
    // If disabled, channelId is null, or socket not connected, clean up and return
    if (!enabled || !channelId || !socket.isConnected) {
      // Leave channel if we were previously connected to one
      if (currentChannelIdRef.current) {
        socket.leaveChannel(currentChannelIdRef.current);
        currentChannelIdRef.current = null;
      }
      return;
    }

    // Leave previous channel if switching
    if (currentChannelIdRef.current && currentChannelIdRef.current !== channelId) {
      socket.leaveChannel(currentChannelIdRef.current);
    }

    // Join channel if not already connected to this one
    if (currentChannelIdRef.current !== channelId) {
      currentChannelIdRef.current = channelId;

      // Join appropriate room based on channel type
      switch (channelType) {
        case 'approval':
          socket.joinApproval(channelId);
          break;
        case 'dispute':
          socket.joinDispute(channelId);
          break;
        case 'question_approval':
          socket.joinQuestionApproval(channelId);
          break;
        case 'course_form_approval':
          socket.joinCourseFormApproval(channelId);
          break;
        case 'course_form_question_approval':
          socket.joinCourseFormQuestionApproval(channelId);
          break;
        default:
          socket.joinChannel(channelId);
      }
    }

    const channelEvents = getChannelEvents(channelType);
    const messageSentEvent = channelEvents.MESSAGE_SENT;

    // Always set up message handler (even if already connected) to ensure it's up to date
    // Remove old handler first to avoid duplicate listeners
    if (messageHandlerRef.current) {
      socket.off(messageSentEvent, messageHandlerRef.current);
    }

    messageHandlerRef.current = (data: any) => {
      const isRoomBased =
        channelType === 'question_approval' ||
        channelType === 'course_form_question_approval' ||
        channelType === 'course_form_approval' ||
        channelType === 'approval' ||
        channelType === 'dispute';
      const rawChannel =
        data.channelId ?? data.channel ?? data.questionConversation;
      const payloadChannelId =
        rawChannel != null && typeof rawChannel === 'object' && '_id' in rawChannel
          ? (rawChannel as { _id: string })._id
          : rawChannel;
      const payloadMatches =
        payloadChannelId != null &&
        (String(payloadChannelId) === String(channelId) ||
          payloadChannelId === channelId);
      const accept = isRoomBased ? true : payloadMatches;
      if (accept) {
        console.log(`[useSocketChannel] ${channelType} message received:`, data);
        onMessageRef.current?.(data);
      }
    };
    socket.on(messageSentEvent, messageHandlerRef.current);
    if (channelType === 'course_form_question_approval') {
      console.log('[useSocketChannel] Registered listener for course_form_question_approval:message:sent, channelId:', channelId);
    }

    // Setup error handler (ref so callback identity does not trigger re-join)
    if (errorHandlerRef.current) {
      socket.off(SOCKET_EVENTS.ERROR, errorHandlerRef.current);
    }
    errorHandlerRef.current = (data: any) => {
      const payloadChannelId =
        data.channelId ?? data.channel ?? data.questionConversation;
      const matches =
        payloadChannelId != null &&
        (String(payloadChannelId) === String(channelId) ||
          payloadChannelId === channelId);
      if (matches) {
        onErrorRef.current?.(data);
      }
    };
    socket.on(SOCKET_EVENTS.ERROR, errorHandlerRef.current);

    // Setup join success handler (ref so callback identity does not trigger re-join)
    if (joinSuccessHandlerRef.current) {
      socket.off(channelEvents.JOIN_SUCCESS, joinSuccessHandlerRef.current);
    }
    joinSuccessHandlerRef.current = (data: any) => {
      if (data.channelId === channelId || data.channel === channelId) {
        onJoinSuccessRef.current?.(data);
      }
    };
    socket.on(channelEvents.JOIN_SUCCESS, joinSuccessHandlerRef.current);

    // Cleanup on unmount or channel change (only disconnect if channelId actually changed)
    return () => {
      const cleanupChannelEvents = getChannelEvents(channelType);
      const cleanupMessageSentEvent = cleanupChannelEvents.MESSAGE_SENT;

      // Only leave channel if channelId changed or component unmounting
      const shouldLeaveChannel = currentChannelIdRef.current !== channelId;
      
      if (shouldLeaveChannel && currentChannelIdRef.current) {
        socket.leaveChannel(currentChannelIdRef.current);
        currentChannelIdRef.current = null;
      }
      
      // Always remove handlers to prevent leaks
      if (messageHandlerRef.current) {
        socket.off(cleanupMessageSentEvent, messageHandlerRef.current);
        messageHandlerRef.current = null;
      }
      if (errorHandlerRef.current) {
        socket.off(SOCKET_EVENTS.ERROR, errorHandlerRef.current);
        errorHandlerRef.current = null;
      }
      if (joinSuccessHandlerRef.current) {
        socket.off(cleanupChannelEvents.JOIN_SUCCESS, joinSuccessHandlerRef.current);
        joinSuccessHandlerRef.current = null;
      }
    };
  }, [channelId, channelType, enabled, socket.isConnected, socket]);

  // Rejoin when connection is restored, or join when we have channelId but main effect returned early (e.g. socket wasn't connected yet)
  useEffect(() => {
    if (!socket.isConnected || !enabled || !channelId) return;
    // Join when we haven't joined this channel yet (ref null or different channel) so we never miss the join on Chat page
    if (currentChannelIdRef.current === channelId) return;
    const cid = channelId;
    currentChannelIdRef.current = cid;
    switch (channelType) {
      case 'approval':
        socket.joinApproval(cid);
        break;
      case 'dispute':
        socket.joinDispute(cid);
        break;
      case 'question_approval':
        socket.joinQuestionApproval(cid);
        break;
      case 'course_form_approval':
        socket.joinCourseFormApproval(cid);
        break;
      case 'course_form_question_approval':
        socket.joinCourseFormQuestionApproval(cid);
        break;
      default:
        socket.joinChannel(cid);
    }
  }, [socket.isConnected, channelType, enabled, channelId, socket]);

  // Send message helper
  const sendMessage = useCallback(
    (message: string, metadata?: Record<string, any>) => {
      if (!channelId) {
        console.warn('[useSocketChannel] Cannot send message, no channelId');
        return;
      }
      // Convert 'general' to 'approval' for message sending (only approval supports sending)
      const messageChannelType = channelType === 'general' ? 'approval' : channelType;
      socket.sendMessage(channelId, message, metadata, messageChannelType);
    },
    [channelId, channelType, socket]
  );

  return {
    sendMessage,
    isConnected: socket.isConnected,
    channelId: currentChannelIdRef.current,
  };
};
