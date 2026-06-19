/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { setStatus, setError } from '../features/socket/socketSlice';
import { setStatus as setDmOnlineStatus, setBulkFromMap, clear as clearDmOnlineStatus } from '../features/dmOnlineStatus/dmOnlineStatusSlice';
import { socketService, SocketEventHandlers } from '../services/socketService';
import { SOCKET_EVENTS } from '../services/socketEvents';
import { dmchatsApi } from '../services/dmchatsApi';
import type { DMOnlineStatusItem } from '../services/dmchatsApi';

/** Payload for sending a DM message (DM_CHAT_API_UI_DEVELOPER.md) */
export interface SendDMMessagePayload {
  channelId: string;
  text: string;
  mentions?: string[];
  localId?: string;
}

interface SocketContextValue {
  isConnected: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error: string | null;
  joinChannel: (channelId: string) => void;
  joinApproval: (channelId: string) => void;
  joinDispute: (channelId: string) => void;
  joinQuestionApproval: (channelId: string) => void;
  joinCourseFormApproval: (channelId: string) => void;
  joinCourseFormQuestionApproval: (channelId: string) => void;
  joinDmChannel: (channelId: string) => void;
  leaveDmChannel: (channelId: string) => void;
  sendDmMessage: (payload: SendDMMessagePayload) => void;
  sendDmThreadReply: (payload: { messageId: string; text: string; mentions?: string[]; localId?: string }) => void;
  dmTypingStart: (channelId: string) => void;
  dmTypingStop: (channelId: string) => void;
  dmMarkAsRead: (channelId: string) => void;
  sendMessage: (
    channelId: string,
    message: string,
    metadata?: {
      action?: 'message' | 'approval:requested' | 'approval:approved' | 'approval:rejected' | 'dispute:open' | 'submission:signature' | 'omit-signature:requested' | 'omit-signature:approved' | 'omit-signature:rejected';
      actionData?: { text?: string; file?: string; [key: string]: any };
      localId?: string;
      meta?: any; // Question metadata with answer details (for approval:requested)
    },
    channelType?: 'approval' | 'dispute' | 'question_approval' | 'course_form_approval' | 'course_form_question_approval'
  ) => void;
  leaveChannel: (channelId: string) => void;
  on: (event: string, handler: (data: any) => void) => void;
  off: (event: string, handler?: (data: any) => void) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

interface SocketProviderProps {
  children: React.ReactNode;
}

/**
 * Socket.IO Context Provider
 * Manages Socket.IO connection lifecycle and provides socket methods to children
 */
export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { accessToken, selectedProfile } = useSelector((state: RootState) => state.auth);
  const socketState = useSelector((state: RootState) => state.socket);
  const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const isInitializedRef = useRef(false);

  // Initialize socket connection
  useEffect(() => {
    if (!accessToken) {
      console.log('[SocketProvider] No access token, skipping socket initialization');
      return;
    }

    if (isInitializedRef.current) {
      // Update auth if already initialized
      socketService.updateAuth(accessToken, selectedProfile?._id || null);
      return;
    }

    isInitializedRef.current = true;
    dispatch(setStatus('connecting'));

    const handlers: SocketEventHandlers = {
      onConnect: () => {
        console.log('[SocketProvider] Socket connected');
        dispatch(setStatus('connected'));
        dispatch(setError(null));
      },
      onDisconnect: (reason: string) => {
        console.log('[SocketProvider] Socket disconnected:', reason);
        dispatch(setStatus('disconnected'));
      },
      onError: (error: Error) => {
        console.error('[SocketProvider] Socket error:', error);
        dispatch(setError(error.message));
        dispatch(setStatus('error'));
      },
      onMessageSent: (data: any) => {
        // Trigger handlers for all channel-specific message events
        const approvalHandlers = handlersRef.current.get(SOCKET_EVENTS.APPROVAL.MESSAGE_SENT);
        const disputeHandlers = handlersRef.current.get(SOCKET_EVENTS.DISPUTE.MESSAGE_SENT);
        const questionApprovalHandlers = handlersRef.current.get(SOCKET_EVENTS.QUESTION_APPROVAL.MESSAGE_SENT);
        const courseFormApprovalHandlers = handlersRef.current.get(SOCKET_EVENTS.COURSE_FORM_APPROVAL.MESSAGE_SENT);
        const courseFormQuestionApprovalHandlers = handlersRef.current.get(SOCKET_EVENTS.COURSE_FORM_QUESTION_APPROVAL.MESSAGE_SENT);

        if (approvalHandlers) approvalHandlers.forEach((handler) => handler(data));
        if (disputeHandlers) disputeHandlers.forEach((handler) => handler(data));
        if (questionApprovalHandlers) questionApprovalHandlers.forEach((handler) => handler(data));
        if (courseFormApprovalHandlers) courseFormApprovalHandlers.forEach((handler) => handler(data));
        if (courseFormQuestionApprovalHandlers) courseFormQuestionApprovalHandlers.forEach((handler) => handler(data));
      },
      onErrorEvent: (data: any) => {
        // Trigger all registered handlers for ERROR event
        const handlers = handlersRef.current.get(SOCKET_EVENTS.ERROR);
        if (handlers) {
          handlers.forEach((handler) => handler(data));
        }
      },
      onJoinSuccess: (data: any) => {
        // Trigger handlers for all channel-specific join success events
        const approvalHandlers = handlersRef.current.get(SOCKET_EVENTS.APPROVAL.JOIN_SUCCESS);
        const disputeHandlers = handlersRef.current.get(SOCKET_EVENTS.DISPUTE.JOIN_SUCCESS);
        const questionApprovalHandlers = handlersRef.current.get(SOCKET_EVENTS.QUESTION_APPROVAL.JOIN_SUCCESS);
        const courseFormApprovalHandlers = handlersRef.current.get(SOCKET_EVENTS.COURSE_FORM_APPROVAL.JOIN_SUCCESS);
        const courseFormQuestionApprovalHandlers = handlersRef.current.get(SOCKET_EVENTS.COURSE_FORM_QUESTION_APPROVAL.JOIN_SUCCESS);

        if (approvalHandlers) approvalHandlers.forEach((handler) => handler(data));
        if (disputeHandlers) disputeHandlers.forEach((handler) => handler(data));
        if (questionApprovalHandlers) questionApprovalHandlers.forEach((handler) => handler(data));
        if (courseFormApprovalHandlers) courseFormApprovalHandlers.forEach((handler) => handler(data));
        if (courseFormQuestionApprovalHandlers) courseFormQuestionApprovalHandlers.forEach((handler) => handler(data));
      },
    };

    socketService.connect(
      {
        accessToken,
        profileId: selectedProfile?._id || null,
        autoConnect: true,
      },
      handlers
    );

    // Cleanup on unmount
    return () => {
      console.log('[SocketProvider] Cleaning up socket connection');
      socketService.disconnect();
      isInitializedRef.current = false;
    };
  }, [accessToken, selectedProfile?._id, dispatch]);

  // Update socket auth when tokens change
  useEffect(() => {
    if (isInitializedRef.current && accessToken) {
      socketService.updateAuth(accessToken, selectedProfile?._id || null);
    }
  }, [accessToken, selectedProfile?._id]);

  // Handle logout - disconnect socket
  useEffect(() => {
    if (!accessToken && isInitializedRef.current) {
      console.log('[SocketProvider] Access token removed, disconnecting socket');
      socketService.disconnect();
      dispatch(setStatus('disconnected'));
      isInitializedRef.current = false;
    }
  }, [accessToken, dispatch]);

  // Listen for global DM online/offline status and dm:join:success (onlineProfiles)
  useEffect(() => {
    if (socketState.status !== 'connected') return;
    const onOnlineStatus = (data: { profileId?: string; isOnline?: boolean }) => {
      if (data.profileId != null && data.isOnline !== undefined) {
        dispatch(setDmOnlineStatus({ profileId: data.profileId, isOnline: data.isOnline }));
      }
    };
    const onJoinSuccess = (data: { channelId?: string; onlineProfiles?: Record<string, boolean> }) => {
      if (data.onlineProfiles && typeof data.onlineProfiles === 'object') {
        dispatch(setBulkFromMap(data.onlineProfiles));
      }
    };
    socketService.on(SOCKET_EVENTS.DM.ONLINE_STATUS, onOnlineStatus);
    socketService.on(SOCKET_EVENTS.DM.JOIN_SUCCESS, onJoinSuccess);
    return () => {
      socketService.off(SOCKET_EVENTS.DM.ONLINE_STATUS, onOnlineStatus);
      socketService.off(SOCKET_EVENTS.DM.JOIN_SUCCESS, onJoinSuccess);
    };
  }, [socketState.status, dispatch]);

  // Fetch organization profiles online status when profile/org changes; clear when no profile
  const orgId = selectedProfile?.organization && typeof selectedProfile.organization === 'object' && '_id' in selectedProfile.organization
    ? (selectedProfile.organization as { _id: string })._id
    : undefined;

  useEffect(() => {
    const profileId = selectedProfile?._id;
    if (!profileId) {
      dispatch(clearDmOnlineStatus());
      return;
    }
    void dispatch(dmchatsApi.endpoints.getDMOnlineStatus.initiate(undefined, { forceRefetch: true }))
      .then((result: { data?: DMOnlineStatusItem[] }) => {
        if (result?.data && Array.isArray(result.data)) {
          const map: Record<string, boolean> = {};
          result.data.forEach((item: DMOnlineStatusItem) => {
            map[item.profileId] = item.isOnline;
          });
          dispatch(setBulkFromMap(map));
        }
      })
      .catch(() => {});
  }, [selectedProfile?._id, orgId, dispatch]);

  // Context methods
  const joinChannel = useCallback((channelId: string) => {
    socketService.joinChannel(channelId);
  }, []);

  const joinApproval = useCallback((channelId: string) => {
    socketService.joinApproval(channelId);
  }, []);

  const joinDispute = useCallback((channelId: string) => {
    socketService.joinDispute(channelId);
  }, []);

  const joinQuestionApproval = useCallback((channelId: string) => {
    socketService.joinQuestionApproval(channelId);
  }, []);

  const joinCourseFormApproval = useCallback((channelId: string) => {
    socketService.joinCourseFormApproval(channelId);
  }, []);

  const joinCourseFormQuestionApproval = useCallback((channelId: string) => {
    socketService.joinCourseFormQuestionApproval(channelId);
  }, []);

  const joinDmChannel = useCallback((channelId: string) => {
    socketService.joinDmChannel(channelId);
  }, []);

  const leaveDmChannel = useCallback((channelId: string) => {
    socketService.leaveDmChannel(channelId);
  }, []);

  const sendDmMessage = useCallback((payload: SendDMMessagePayload) => {
    socketService.sendDmMessage(payload);
  }, []);

  const sendDmThreadReply = useCallback(
    (payload: { messageId: string; text: string; mentions?: string[]; localId?: string }) => {
      socketService.sendDmThreadReply(payload);
    },
    []
  );

  const dmTypingStart = useCallback((channelId: string) => {
    socketService.dmTypingStart(channelId);
  }, []);

  const dmTypingStop = useCallback((channelId: string) => {
    socketService.dmTypingStop(channelId);
  }, []);

  const dmMarkAsRead = useCallback((channelId: string) => {
    socketService.dmMarkAsRead(channelId);
  }, []);

  const sendMessage = useCallback(
    (channelId: string, message: string, metadata?: Record<string, any>, channelType: 'approval' | 'dispute' | 'question_approval' | 'course_form_approval' | 'course_form_question_approval' = 'approval') => {
      socketService.sendMessage(channelId, message, metadata, channelType);
    },
    []
  );

  const leaveChannel = useCallback((channelId: string) => {
    socketService.leaveChannel(channelId);
  }, []);

  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);

    // Also register with socket service for direct events
    socketService.on(event, handler);
  }, []);

  const off = useCallback((event: string, handler?: (data: any) => void) => {
    if (handler) {
      handlersRef.current.get(event)?.delete(handler);
      socketService.off(event, handler);
    } else {
      handlersRef.current.delete(event);
      socketService.off(event);
    }
  }, []);

  const value = useMemo<SocketContextValue>(
    () => ({
      isConnected: socketState.status === 'connected',
      status: socketState.status,
      error: socketState.error,
      joinChannel,
      joinApproval,
      joinDispute,
      joinQuestionApproval,
      joinCourseFormApproval,
      joinCourseFormQuestionApproval,
      joinDmChannel,
      leaveDmChannel,
      sendDmMessage,
      sendDmThreadReply,
      dmTypingStart,
      dmTypingStop,
      dmMarkAsRead,
      sendMessage,
      leaveChannel,
      on,
      off,
    }),
    [
      socketState.status,
      socketState.error,
      joinChannel,
      joinApproval,
      joinDispute,
      joinQuestionApproval,
      joinCourseFormApproval,
      joinCourseFormQuestionApproval,
      joinDmChannel,
      leaveDmChannel,
      sendDmMessage,
      sendDmThreadReply,
      dmTypingStart,
      dmTypingStop,
      dmMarkAsRead,
      sendMessage,
      leaveChannel,
      on,
      off,
    ]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

/**
 * Hook to use Socket.IO context
 */
export const useSocket = (): SocketContextValue => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
