/**
 * Socket.IO Event Constants
 * Matches the backend event names
 */

export const SOCKET_EVENTS = {
  // Common events
  ERROR: 'error', // Common error event for all channel types (Server → Client)

  // Approval channel events
  APPROVAL: {
    // Client events (Client → Server)
    JOIN: 'join:approval',
    SEND_MESSAGE: 'approval:send:message',
    
    // Server events (Server → Client)
    MESSAGE_SENT: 'approval:message:sent',
    JOIN_SUCCESS: 'approval:join:success',
  },

  // Dispute channel events
  DISPUTE: {
    // Client events (Client → Server)
    JOIN: 'join:dispute',
    SEND_MESSAGE: 'dispute:send:message', // Client sends a message to a dispute channel
    
    // Server events (Server → Client)
    MESSAGE_SENT: 'dispute:message:sent',
    JOIN_SUCCESS: 'dispute:join:success',
  },

  // Question approval (form/assignment) – join, send, message:sent
  QUESTION_APPROVAL: {
    // Client events (Client → Server)
    JOIN: 'join:question_approval',
    SEND_MESSAGE: 'question_approval:send:message', // Client sends a message to a question approval channel
    
    // Server events (Server → Client)
    MESSAGE_SENT: 'question_approval:message:sent',
    JOIN_SUCCESS: 'question_approval:join:success',
  },

  // Course form approval (form-level) – course page inline forms
  COURSE_FORM_APPROVAL: {
    JOIN: 'join:course_form_approval',
    SEND_MESSAGE: 'course_form_approval:send:message',
    MESSAGE_SENT: 'course_form_approval:message:sent',
    JOIN_SUCCESS: 'course_form_approval:join:success',
  },

  // Course form question-level approval (course inline form) – join, send, message:sent
  COURSE_FORM_QUESTION_APPROVAL: {
    JOIN: 'join:course_form_question_approval',
    SEND_MESSAGE: 'course_form_question_approval:send:message',
    MESSAGE_SENT: 'course_form_question_approval:message:sent',
    JOIN_SUCCESS: 'course_form_question_approval:join:success',
  },

  // Profile room – namespace /queues, doc: UI-PROFILE-ROOM-REACT.md
  PROFILE: {
    JOIN: 'profile:join',
    LEAVE: 'profile:leave',
    JOIN_SUCCESS: 'profile:join:success',
    PERMISSIONS_UPDATED: 'profile:permissions:updated',
  },

  // DM (Direct Message) – namespace /queues, doc: DM_CHAT_API_UI_DEVELOPER.md
  DM: {
    JOIN: 'dm:join',
    LEAVE: 'dm:leave',
    SEND_MESSAGE: 'dm:send:message',
    SEND_THREAD_REPLY: 'dm:send:thread:reply',
    TYPING_START: 'dm:typing:start',
    TYPING_STOP: 'dm:typing:stop',
    /** Emit to mark as read (backend may use this) */
    READ: 'dm:read',
    MESSAGE_READ: 'dm:message:read',
    JOIN_SUCCESS: 'dm:join:success',
    NEW_MESSAGE: 'dm:new:message',
    /** Alias for useSocketChannel; server emits new messages on this event */
    MESSAGE_SENT: 'dm:new:message',
    NEW_THREAD_REPLY: 'dm:new:thread:reply',
    TYPING_STATUS: 'dm:typing:status',
    READ_RECEIPT: 'dm:read:receipt',
    /** Server broadcast when someone marks read: { channelId, profileId, lastReadAt } */
    READ_UPDATE: 'dm:read:update',
    ONLINE_STATUS: 'dm:online:status',
    MENTION_NOTIFICATION: 'dm:mention:notification',
    ERROR: 'dm:error',
  },
} as const;

export type SocketChannelType =
  | 'approval'
  | 'dispute'
  | 'question_approval'
  | 'course_form_approval'
  | 'course_form_question_approval'
  | 'dm'
  | 'general';

/**
 * Helper function to get channel-specific event names
 */
export const getChannelEvents = (channelType: SocketChannelType) => {
  switch (channelType) {
    case 'approval':
      return SOCKET_EVENTS.APPROVAL;
    case 'dispute':
      return SOCKET_EVENTS.DISPUTE;
    case 'question_approval':
      return SOCKET_EVENTS.QUESTION_APPROVAL;
    case 'course_form_approval':
      return SOCKET_EVENTS.COURSE_FORM_APPROVAL;
    case 'course_form_question_approval':
      return SOCKET_EVENTS.COURSE_FORM_QUESTION_APPROVAL;
    case 'dm':
      return SOCKET_EVENTS.DM;
    default:
      return SOCKET_EVENTS.APPROVAL;
  }
};

/**
 * Helper function to get channel room name
 * Matches backend implementation: channel:${channelId}
 */
export const getChannelRoomName = (channelId: string): string => {
  return `channel:${channelId}`;
};
