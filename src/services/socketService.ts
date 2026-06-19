/* eslint-disable @typescript-eslint/no-explicit-any */
import { io, Socket } from 'socket.io-client';
import { getChannelRoomName, SOCKET_EVENTS } from './socketEvents';

/** Payload for sending a DM message (doc: DM_CHAT_API_UI_DEVELOPER.md) */
export interface SendDMMessagePayload {
  channelId: string;
  text: string;
  mentions?: string[];
  localId?: string;
}

/** Payload for sending a DM thread reply */
export interface SendDMThreadReplyPayload {
  messageId: string;
  text: string;
  mentions?: string[];
  localId?: string;
}

/**
 * Socket.IO Service
 * Production-ready Socket.IO client with authentication, reconnection, and error handling
 */

export interface SocketConfig {
  url?: string;
  accessToken?: string | null;
  profileId?: string | null;
  autoConnect?: boolean;
}

export interface SocketEventHandlers {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
  onMessageSent?: (data: any) => void;
  onErrorEvent?: (data: any) => void;
  onJoinSuccess?: (data: any) => void;
}

class SocketService {
  private socket: Socket | null = null;
  private config: SocketConfig = {};
  private handlers: SocketEventHandlers = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private isManuallyDisconnected = false;
  private connectionTimeout: NodeJS.Timeout | null = null;

  /**
   * Get the Socket.IO server URL
   * Defaults to the same origin as the API URL
   */
  private getSocketUrl(): string {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    // Extract base URL (remove /api/v1 if present)
    const baseUrl = apiUrl.replace(/\/api\/v1\/?$/, '');
    const url = this.config.url || baseUrl || window.location.origin;
    return `${url}/queues`;
  }

  /**
   * Initialize and connect to Socket.IO server
   */
  connect(config: SocketConfig, handlers?: SocketEventHandlers): void {
    // Disconnect existing connection if any
    if (this.socket?.connected) {
      this.disconnect();
    }

    this.config = { ...config, autoConnect: config.autoConnect !== false };
    this.handlers = handlers || {};
    this.isManuallyDisconnected = false;
    this.reconnectAttempts = 0;

    const socketUrl = this.getSocketUrl();
    const accessToken = config.accessToken || localStorage.getItem('accessToken');
    const profileId = config.profileId;

    if (!accessToken) {
      console.warn('[SocketService] No access token available, skipping connection');
      return;
    }

    // Create socket connection with authentication
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'], // Prefer websocket, fallback to polling
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: this.maxReconnectDelay,
      timeout: 20000, // 20 seconds connection timeout
      auth: {
        token: accessToken,
        ...(profileId && { profileId }),
      },
      // Add profile ID to headers if needed
      extraHeaders: profileId
        ? {
            'x-profile-id': profileId,
          }
        : undefined,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup all Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('[SocketService] Connected to server', this.socket?.id);
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000; // Reset delay
      this.clearConnectionTimeout();
      this.handlers.onConnect?.();
      // Join profile room for real-time permission updates (UI-PROFILE-ROOM-REACT.md)
      if (this.config.profileId) {
        this?.socket?.emit(SOCKET_EVENTS.PROFILE.JOIN);
      }
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('[SocketService] Disconnected from server', reason);
      this.handlers.onDisconnect?.(reason);

      // Auto-reconnect unless manually disconnected or auth failed
      if (
        !this.isManuallyDisconnected &&
        reason !== 'io server disconnect' &&
        reason !== 'io client disconnect'
      ) {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('[SocketService] Connection error:', error);
      this.handlers.onError?.(error);

      // Handle authentication errors
      if (error.message.includes('auth') || error.message.includes('401')) {
        console.error('[SocketService] Authentication failed, disconnecting');
        this.disconnect();
      }
    });

    // Common error event
    this.socket.on(SOCKET_EVENTS.ERROR, (data: any) => {
      console.error('[SocketService] Error event:', data);
      this.handlers.onErrorEvent?.(data);
    });

    // Channel-specific events - Approval
    this.socket.on(SOCKET_EVENTS.APPROVAL.MESSAGE_SENT, (data: any) => {
      console.log('[SocketService] Approval message sent event:', data);
      this.handlers.onMessageSent?.(data);
    });

    this.socket.on(SOCKET_EVENTS.APPROVAL.JOIN_SUCCESS, (data: any) => {
      console.log('[SocketService] Approval join success event:', data);
      this.handlers.onJoinSuccess?.(data);
    });

    // Channel-specific events - Dispute
    this.socket.on(SOCKET_EVENTS.DISPUTE.MESSAGE_SENT, (data: any) => {
      console.log('[SocketService] Dispute message sent event:', data);
      this.handlers.onMessageSent?.(data);
    });

    this.socket.on(SOCKET_EVENTS.DISPUTE.JOIN_SUCCESS, (data: any) => {
      console.log('[SocketService] Dispute join success event:', data);
      this.handlers.onJoinSuccess?.(data);
    });

    // Channel-specific events - Question Approval
    this.socket.on(SOCKET_EVENTS.QUESTION_APPROVAL.MESSAGE_SENT, (data: any) => {
      console.log('[SocketService] Question approval message sent event:', data);
      this.handlers.onMessageSent?.(data);
    });

    this.socket.on(SOCKET_EVENTS.QUESTION_APPROVAL.JOIN_SUCCESS, (data: any) => {
      const payload = data != null ? (typeof data === 'object' ? JSON.stringify(data) : data) : data;
      console.log('[SocketService] Question approval join success event:', payload);
      this.handlers.onJoinSuccess?.(data);
    });

    // Channel-specific events - Course Form Approval (form-level)
    this.socket.on(SOCKET_EVENTS.COURSE_FORM_APPROVAL.MESSAGE_SENT, (data: any) => {
      console.log('[SocketService] Course form approval message sent event:', data);
      this.handlers.onMessageSent?.(data);
    });

    this.socket.on(SOCKET_EVENTS.COURSE_FORM_APPROVAL.JOIN_SUCCESS, (data: any) => {
      console.log('[SocketService] Course form approval join success event:', data);
      this.handlers.onJoinSuccess?.(data);
    });

    // Channel-specific events - Course Form Question Approval
    this.socket.on(SOCKET_EVENTS.COURSE_FORM_QUESTION_APPROVAL.MESSAGE_SENT, (data: any) => {
      console.log('[SocketService] Course form question approval message sent event:', data != null ? JSON.stringify(data) : data);
      this.handlers.onMessageSent?.(data);
    });

    this.socket.on(SOCKET_EVENTS.COURSE_FORM_QUESTION_APPROVAL.JOIN_SUCCESS, (data: any) => {
      const payload = data != null ? (typeof data === 'object' ? JSON.stringify(data) : data) : data;
      console.log('[SocketService] Course form question approval join success event:', payload);
      this.handlers.onJoinSuccess?.(data);
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SocketService] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(
      `[SocketService] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    setTimeout(() => {
      if (!this.isManuallyDisconnected && this.socket && !this.socket.connected) {
        this.socket.connect();
      }
    }, delay);
  }

  /**
   * Clear connection timeout
   */
  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  /**
   * Disconnect from Socket.IO server
   */
  disconnect(): void {
    this.isManuallyDisconnected = true;
    this.clearConnectionTimeout();

    if (this.socket) {
      if (this.socket.connected && this.config.profileId) {
        this.socket.emit(SOCKET_EVENTS.PROFILE.LEAVE);
      }
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Update authentication tokens
   */
  updateAuth(accessToken: string, profileId?: string | null): void {
    this.config.accessToken = accessToken;
    if (profileId !== undefined) {
      this.config.profileId = profileId;
    }

    // Reconnect with new auth if already connected
    if (this.socket?.connected) {
      this.disconnect();
      this.connect(this.config, this.handlers);
    }
  }

  /**
   * Join a channel room (generic method)
   * Note: For typed channels (approval, dispute, question_approval), use the specific methods instead
   */
  joinChannel(channelId: string): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot join channel, socket not connected');
      return;
    }

    const roomName = getChannelRoomName(channelId);
    console.log('[SocketService] Joining room:', roomName);
    // For generic channels, use question_approval as default
    // If you know the channel type, use joinApproval, joinDispute, or joinQuestionApproval instead
    this.socket.emit(SOCKET_EVENTS.QUESTION_APPROVAL.JOIN, { channelId });
  }

  /**
   * Join approval room
   */
  joinApproval(channelId: string): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot join approval, socket not connected');
      return;
    }

    console.log('[SocketService] Joining approval room:', channelId);
    this.socket.emit(SOCKET_EVENTS.APPROVAL.JOIN, { channelId });
  }

  /**
   * Join dispute room
   */
  joinDispute(channelId: string): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot join dispute, socket not connected');
      return;
    }

    console.log('[SocketService] Joining dispute room for channel:', channelId);
    this.socket.emit(SOCKET_EVENTS.DISPUTE.JOIN, { channelId });
  }

  /**
   * Join question approval room
   */
  joinQuestionApproval(channelId: string): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot join question approval, socket not connected');
      return;
    }

    console.log('[SocketService] Joining question approval room for channel:', channelId);
    this.socket.emit(SOCKET_EVENTS.QUESTION_APPROVAL.JOIN, { channelId });
  }

  /**
   * Join course form approval room (form-level – course page inline forms)
   */
  joinCourseFormApproval(channelId: string): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot join course form approval, socket not connected');
      return;
    }
    console.log('[SocketService] Joining course form approval room:', channelId);
    this.socket.emit(SOCKET_EVENTS.COURSE_FORM_APPROVAL.JOIN, { channelId });
  }

  /**
   * Join course form question approval room (question-level – course page inline forms)
   */
  joinCourseFormQuestionApproval(channelId: string): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot join course form question approval, socket not connected');
      return;
    }
    console.log('[SocketService] Joining course form question approval room:', channelId);
    this.socket.emit(SOCKET_EVENTS.COURSE_FORM_QUESTION_APPROVAL.JOIN, { channelId });
  }

  /**
   * Send a message to an approval channel
   * @param channelId - Channel ID (hex string, 24 chars)
   * @param action - Action type: 'message' | 'approval:requested' | 'approval:approved' | 'approval:rejected'
   * @param actionData - Action data object with text (required when action is 'message')
   * @param localId - Optional local ID for optimistic updates
   */
  sendApprovalMessage(
    channelId: string,
    action: 'message' | 'approval:requested' | 'approval:approved' | 'approval:rejected',
    actionData: { text?: string; [key: string]: any },
    localId?: string
  ): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot send message, socket not connected');
      return;
    }

    console.log('[SocketService] Sending approval message to channel:', channelId, 'action:', action);
    
    const payload: {
      channelId: string;
      action: string;
      actionData: { text?: string; [key: string]: any };
      localId?: string;
    } = {
      channelId,
      action,
      actionData,
    };

    if (localId) {
      payload.localId = localId;
    }

    this.socket.emit(SOCKET_EVENTS.APPROVAL.SEND_MESSAGE, payload);
  }

  /**
   * Send a message to a dispute channel
   * @param channelId - Channel ID (hex string, 24 chars)
   * @param action - Action type: 'message' | 'dispute:open' | 'submission:signature' | 'omit-signature:requested' | 'omit-signature:approved' | 'omit-signature:rejected'
   * @param actionData - Action data object with text (required when action is 'message') or file (required when action is 'submission:signature')
   * @param localId - Optional local ID for optimistic updates
   */
  sendDisputeMessage(
    channelId: string,
    action: 'message' | 'dispute:open' | 'submission:signature' | 'omit-signature:requested' | 'omit-signature:approved' | 'omit-signature:rejected',
    actionData: { text?: string; file?: string; [key: string]: any },
    localId?: string
  ): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot send dispute message, socket not connected');
      return;
    }

    console.log('[SocketService] Sending dispute message to channel:', channelId, 'action:', action);
    
    const payload: {
      channelId: string;
      action: string;
      actionData: { text?: string; file?: string; [key: string]: any };
      localId?: string;
    } = {
      channelId,
      action,
      actionData,
    };

    if (localId) {
      payload.localId = localId;
    }

    this.socket.emit(SOCKET_EVENTS.DISPUTE.SEND_MESSAGE, payload);
  }

  /**
   * Send a message to a question approval channel
   * @param channelId - Channel ID (hex string, 24 chars)
   * @param action - Action type: 'message' | 'approval:requested' | 'approval:approved' | 'approval:rejected'
   * @param actionData - Action data object with text (required when action is 'message')
   * @param localId - Optional local ID for optimistic updates
   * @param meta - Optional metadata with question data and answer details (required for approval:requested)
   */
  sendQuestionApprovalMessage(
    channelId: string,
    action: 'message' | 'approval:requested' | 'approval:approved' | 'approval:rejected',
    actionData: { text?: string; [key: string]: any },
    localId?: string,
    meta?: any
  ): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot send question approval message, socket not connected');
      return;
    }

    console.log('[SocketService] Sending question approval message to channel:', channelId, 'action:', action);
    
    const payload: {
      channelId: string;
      action: string;
      actionData: { text?: string; [key: string]: any };
      localId?: string;
      meta?: any;
    } = {
      channelId,
      action,
      actionData,
    };

    if (localId) {
      payload.localId = localId;
    }

    // Include meta when action is 'approval:requested' (contains question metadata and answer details)
    if (action === 'approval:requested' && meta) {
      payload.meta = meta;
    }

    this.socket.emit(SOCKET_EVENTS.QUESTION_APPROVAL.SEND_MESSAGE, payload);
  }

  /**
   * Send a message to a course form approval channel (form-level)
   * Action: 'message' | 'approval:approved' | 'approval:rejected' | 'approval:requested'
   */
  sendCourseFormApprovalMessage(
    channelId: string,
    action: 'message' | 'approval:approved' | 'approval:rejected' | 'approval:requested',
    actionData: { text?: string; comment?: string; [key: string]: any },
    localId?: string
  ): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot send course form approval message, socket not connected');
      return;
    }
    console.log('[SocketService] Sending course form approval message:', channelId, action);
    const payload: { channelId: string; action: string; actionData: Record<string, any>; localId?: string } = {
      channelId,
      action,
      actionData,
    };
    if (localId) payload.localId = localId;
    this.socket.emit(SOCKET_EVENTS.COURSE_FORM_APPROVAL.SEND_MESSAGE, payload);
  }

  /**
   * Send a message to a course form question approval channel (question-level)
   * meta: course/form context (courseId, pageId, formBlockId, questionKey, courseEnrolmentId, etc.) – same pattern as question_approval
   */
  sendCourseFormQuestionApprovalMessage(
    channelId: string,
    action: 'message' | 'approval:approved' | 'approval:rejected' | 'approval:requested',
    actionData: { text?: string; comment?: string; [key: string]: any },
    localId?: string,
    meta?: any
  ): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot send course form question approval message, socket not connected');
      return;
    }
    console.log('[SocketService] Sending course form question approval message:', channelId, action);
    const payload: {
      channelId: string;
      action: string;
      actionData: Record<string, any>;
      localId?: string;
      meta?: any;
    } = {
      channelId,
      action,
      actionData,
    };
    if (localId) payload.localId = localId;
    if (meta) payload.meta = meta;
    this.socket.emit(SOCKET_EVENTS.COURSE_FORM_QUESTION_APPROVAL.SEND_MESSAGE, payload);
  }

  /**
   * Send a message (generic method - defaults to approval)
   * Supports approval, dispute, and question_approval channels
   * 
   * @param channelId - Channel ID (hex string, 24 chars)
   * @param message - Message text (for 'message' action) or action type
   * @param metadata - Optional metadata. If action is provided, it will be used; otherwise defaults to 'message'
   * @param channelType - Channel type ('approval' or 'dispute')
   */
  sendMessage(
    channelId: string,
    message: string,
    metadata?: {
      action?: 'message' | 'approval:requested' | 'approval:approved' | 'approval:rejected' | 'dispute:open' | 'submission:signature' | 'omit-signature:requested' | 'omit-signature:approved' | 'omit-signature:rejected';
      actionData?: { text?: string; file?: string; [key: string]: any };
      localId?: string;
      meta?: any; // Question metadata with answer details (for approval:requested)
    },
    channelType: 'approval' | 'dispute' | 'question_approval' | 'course_form_approval' | 'course_form_question_approval' = 'approval'
  ): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot send message, socket not connected');
      return;
    }

    if (channelType === 'approval') {
      const action = (metadata?.action || 'message') as 'message' | 'approval:requested' | 'approval:approved' | 'approval:rejected';
      const actionData = metadata?.actionData || { text: message };
      
      // Ensure text is provided when action is 'message'
      if (action === 'message' && !actionData.text) {
        actionData.text = message;
      }

      this.sendApprovalMessage(channelId, action, actionData, metadata?.localId);
    } else if (channelType === 'dispute') {
      const action = (metadata?.action || 'message') as 'message' | 'dispute:open' | 'submission:signature' | 'omit-signature:requested' | 'omit-signature:approved' | 'omit-signature:rejected';
      const actionData = metadata?.actionData || { text: message };
      
      // Ensure text is provided when action is 'message'
      if (action === 'message' && !actionData.text) {
        actionData.text = message;
      }

      this.sendDisputeMessage(channelId, action, actionData, metadata?.localId);
    } else if (channelType === 'question_approval') {
      const action = (metadata?.action || 'message') as 'message' | 'approval:requested' | 'approval:approved' | 'approval:rejected';
      const actionData = metadata?.actionData || { text: message };
      
      // Ensure text is provided when action is 'message'
      if (action === 'message' && !actionData.text) {
        actionData.text = message;
      }

      this.sendQuestionApprovalMessage(channelId, action, actionData, metadata?.localId, metadata?.meta);
    } else if (channelType === 'course_form_approval') {
      const msgAction = (metadata?.action || 'message') as 'message' | 'approval:requested' | 'approval:approved' | 'approval:rejected';
      const actionData = metadata?.actionData || { text: message };
      if (msgAction === 'message' && !actionData.text) actionData.text = message;
      this.sendCourseFormApprovalMessage(channelId, msgAction, actionData, metadata?.localId);
    } else if (channelType === 'course_form_question_approval') {
      const msgAction = (metadata?.action || 'message') as 'message' | 'approval:requested' | 'approval:approved' | 'approval:rejected';
      const actionData = metadata?.actionData || { text: message };
      if (msgAction === 'message' && !actionData.text) actionData.text = message;
      this.sendCourseFormQuestionApprovalMessage(channelId, msgAction, actionData, metadata?.localId, metadata?.meta);
    } else {
      console.warn(`[SocketService] Sending messages via Socket.IO is not supported for ${channelType} channels`);
    }
  }

  /**
   * DM: join a DM channel room (namespace /queues)
   */
  joinDmChannel(channelId: string): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot join DM channel, socket not connected');
      return;
    }
    this.socket.emit(SOCKET_EVENTS.DM.JOIN, { channelId });
  }

  /**
   * DM: leave a DM channel room
   */
  leaveDmChannel(channelId: string): void {
    if (!this.socket?.connected) return;
    console.log('[SocketService] Leaving DM channel:', channelId);
    this.socket.emit(SOCKET_EVENTS.DM.LEAVE, { channelId });
  }

  /**
   * DM: send a message
   */
  sendDmMessage(payload: SendDMMessagePayload): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot send DM message, socket not connected');
      return;
    }
    this.socket.emit(SOCKET_EVENTS.DM.SEND_MESSAGE, payload);
  }

  /**
   * DM: send a thread reply (dm:send:thread:reply)
   */
  sendDmThreadReply(payload: SendDMThreadReplyPayload): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot send DM thread reply, socket not connected');
      return;
    }
    this.socket.emit(SOCKET_EVENTS.DM.SEND_THREAD_REPLY, payload);
  }

  /**
   * DM: typing start
   */
  dmTypingStart(channelId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit(SOCKET_EVENTS.DM.TYPING_START, { channelId });
  }

  /**
   * DM: typing stop
   */
  dmTypingStop(channelId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit(SOCKET_EVENTS.DM.TYPING_STOP, { channelId });
  }

  /**
   * DM: mark messages as read. Emits dm:read (backend) and dm:message:read (doc).
   */
  dmMarkAsRead(channelId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit(SOCKET_EVENTS.DM.READ, { channelId });
    this.socket.emit(SOCKET_EVENTS.DM.MESSAGE_READ, { channelId });
  }

  /**
   * Leave a channel room
   */
  leaveChannel(channelId: string): void {
    if (!this.socket?.connected) {
      return;
    }

    const roomName = `channel:${channelId}`;
    console.log('[SocketService] Leaving room:', roomName);
    // Note: Socket.IO doesn't have a built-in leave event, but we can track this client-side
    // The server will handle cleanup when the client disconnects
  }

  /**
   * Subscribe to a custom event
   */
  on(event: string, handler: (data: any) => void): void {
    if (!this.socket) {
      console.warn('[SocketService] Cannot subscribe to event, socket not initialized');
      return;
    }

    this.socket.on(event, handler);
  }

  /**
   * Unsubscribe from a custom event
   */
  off(event: string, handler?: (data: any) => void): void {
    if (!this.socket) {
      return;
    }

    if (handler) {
      this.socket.off(event, handler);
    } else {
      this.socket.off(event);
    }
  }

  /**
   * Emit a custom event
   */
  emit(event: string, data: any): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot emit event, socket not connected');
      return;
    }

    this.socket.emit(event, data);
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get socket instance (for advanced usage)
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Export singleton instance
export const socketService = new SocketService();
