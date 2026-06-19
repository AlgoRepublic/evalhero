/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from './api';
import { Channel, Message } from '../pages/chat/types';

// ======================
// 🔹 Types
// ======================

export interface QuestionConversationSubject {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    isAdmin: boolean;
    deletedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  [key: string]: unknown;
}

export interface QuestionConversationMeta {
  type: 'group' | 'ungrouped';
  subjectId: string[] | string;
  subjectName: string;
  groupId?: string;
  groupName?: string;
  questionData?: {
    questionId?: string;
    questionName?: string;
    questionType?: string;
    questionLabel?: string;
    questionValue?: any;
    answerData?: any;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface QuestionConversation {
  _id: string;
  subjects: QuestionConversationSubject[];
  meta: QuestionConversationMeta;
  assignment: {
    _id: string;
    formTemplate?: string | {
      _id?: string;
      name?: string;
      code?: string;
    };
    [key: string]: unknown;
  };
  assignee: QuestionConversationSubject;
  questionKey: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  organization: string;
}

export interface ChatResponse {
  success: boolean;
  message?: string;
  data: QuestionConversation[];
}

// API Message structure (matches the actual API response)
export interface ApiMessage {
  _id: string;
  action: 'message' | 'approval:request' | string;
  actionData: {
    text?: string;
    [key: string]: unknown;
  } | null;
  meta?: {
    questionData?: {
      questionId?: string;
      questionName?: string;
      questionLabel?: string;
      questionType?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  deletedAt?: string | null;
  organization: string;
  questionConversation: string;
  sentBy: {
    _id: string;
    user: {
      _id: string;
      name: string;
      email: string;
      isAdmin?: boolean;
      deletedAt?: string | null;
      createdAt: string;
      updatedAt: string;
    };
    [key: string]: unknown;
  };
  assignment: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface QuestionMessagesResponse {
  success: boolean;
  message?: string;
  data?: {
    messages?: ApiMessage[];
    questionConversation?: QuestionConversation;
    [key: string]: unknown;
  };
  // Support both response formats: direct array or nested in data.messages
  messages?: ApiMessage[];
  questionConversation?: QuestionConversation;
}

// Transform API message to our Message type
export const transformApiMessageToMessage = (
  apiMessage: ApiMessage,
  channelId: string,
  // channel?: Channel
): Message => {
  // Extract id
  const id = apiMessage._id;

  // Extract userName from sentBy.user.name
  const userName = apiMessage.sentBy?.user?.name || 'Unknown User';

  // Extract userId from sentBy.user._id
  const userId = apiMessage.sentBy?.user?._id || apiMessage.sentBy?._id || 'unknown';

  // Extract content from actionData.text or generate system message for approval:request
  let content = '';
  let contentType: Message['contentType'] = 'text';
  let isSystem = false;

  if (apiMessage.action === 'approval:request') {
    // Generate user-friendly approval request message (similar to approve/reject format)
    const text = apiMessage.actionData?.text;
    if (text) {
      content = `${userName} requested approval with text: ${text}`;
    } else {
      content = `${userName} requested approval`;
    }
    contentType = 'text'; // Display as regular message, not system message
    isSystem = false;
    // Mark as approval request for special rendering
    return {
      id,
      channelId,
      userId,
      userName,
      userAvatar: undefined,
      content,
      contentType,
      attachments: undefined,
      embeds: undefined,
      reactions: undefined,
      createdAt: apiMessage.createdAt,
      updatedAt: apiMessage.updatedAt,
      editedAt: undefined,
      deletedAt: apiMessage.deletedAt || undefined,
      isSystem: false,
      isApprovalRequest: true, // Flag for special rendering
      action: 'approval:request', // Store action type
      meta: apiMessage.meta, // Preserve meta/questionData for answer display
    };
  } else if (apiMessage.action === 'approval:approve') {
    // Generate user-friendly approval message
    const text = apiMessage.actionData?.text;
    if (text) {
      content = `${userName} approved with comment: ${text}`;
    } else {
      content = `${userName} approved`;
    }
    contentType = 'text';
    isSystem = false;
    return {
      id,
      channelId,
      userId,
      userName,
      userAvatar: undefined,
      content,
      contentType,
      attachments: undefined,
      embeds: undefined,
      reactions: undefined,
      createdAt: apiMessage.createdAt,
      updatedAt: apiMessage.updatedAt,
      editedAt: undefined,
      deletedAt: apiMessage.deletedAt || undefined,
      isSystem: false,
      isApprovalRequest: false,
      action: 'approval:approve', // Store action type for special rendering
      meta: apiMessage.meta, // Preserve meta/questionData for answer display
    };
  } else if (apiMessage.action === 'approval:reject') {
    // Generate user-friendly rejection message
    const text = apiMessage.actionData?.text;
    if (text) {
      content = `${userName} rejected: ${text}`;
    } else {
      content = `${userName} rejected`;
    }
    contentType = 'text';
    isSystem = false;
    return {
      id,
      channelId,
      userId,
      userName,
      userAvatar: undefined,
      content,
      contentType,
      attachments: undefined,
      embeds: undefined,
      reactions: undefined,
      createdAt: apiMessage.createdAt,
      updatedAt: apiMessage.updatedAt,
      editedAt: undefined,
      deletedAt: apiMessage.deletedAt || undefined,
      isSystem: false,
      isApprovalRequest: false,
      action: 'approval:reject', // Store action type for special rendering
      meta: apiMessage.meta, // Preserve meta/questionData for answer display
    };
  } else if (apiMessage.action === 'message') {
    content = apiMessage.actionData?.text || '';
    contentType = 'text';
    isSystem = false;
  } else {
    // Handle other action types
    content = apiMessage.actionData?.text || `${apiMessage.action} action`;
    contentType = 'text';
  }

  return {
    id,
    channelId,
    userId,
    userName,
    userAvatar: undefined, // Not available in API response
    content,
    contentType,
    attachments: undefined, // Not available in API response
    embeds: undefined, // Not available in API response
    reactions: undefined, // Not available in API response
    createdAt: apiMessage.createdAt,
    updatedAt: apiMessage.updatedAt,
    editedAt: undefined, // Not available in API response
    deletedAt: apiMessage.deletedAt || undefined,
    isSystem,
    isApprovalRequest: false,
    action: apiMessage.action, // Store action type for all messages
    meta: apiMessage.meta, // Preserve meta/questionData for answer display
  };
}

// ======================
// 🔹 Transform Functions
// ======================

// Parse question key to extract question information
const parseQuestionKey = (questionKey: string): { questionNumber?: number; questionName?: string } => {
  // Question keys can be in formats like:
  // "st-short-text-r1sp" - short text question
  // "lt-long-text-n6oqu-uui4" - long text question
  // Or might contain question number/name
  const parts = questionKey.split('-');
  
  // Try to extract question number from patterns
  const numberMatch = questionKey.match(/(?:q|question)[\s_-]?(\d+)/i);
  if (numberMatch) {
    return { questionNumber: parseInt(numberMatch[1], 10) };
  }
  
  // Extract readable question type
  const typeMap: Record<string, string> = {
    'st': 'Short Text',
    'lt': 'Long Text',
    'mc': 'Multiple Choice',
    'sc': 'Single Choice',
    'num': 'Number',
    'date': 'Date',
  };
  
  const questionType = parts[0] ? typeMap[parts[0]] || parts[0].toUpperCase() : 'Question';
  
  return { questionName: questionType };
};

// Generate user-friendly title for conversation
const generateFriendlyTitle = (conversation: QuestionConversation): string => {
  // Get assignee name (requester/submitter)
  const assigneeName = conversation.assignee?.user?.name || 'Unknown User';
  
  // Get question label from meta.questionData.questionLabel, fallback to parsing questionKey
  let questionText = 'a question';
  const meta = conversation.meta as any; // Use any to access questionData which may not be in the strict type
  if (meta?.questionData?.questionLabel) {
    questionText = meta.questionData.questionLabel;
  } else {
    // Fallback: parse questionKey
    const questionInfo = parseQuestionKey(conversation.questionKey);
    questionText = questionInfo.questionNumber
      ? `Question ${questionInfo.questionNumber}`
      : questionInfo.questionName || 'a question';
  }
  
  // Try to get form name (if available in assignment)
  let formName = 'Form';
  if (conversation.assignment.formTemplate) {
    if (typeof conversation.assignment.formTemplate === 'object' && conversation.assignment.formTemplate.name) {
      formName = conversation.assignment.formTemplate.name;
    } else if (typeof conversation.assignment.formTemplate === 'string') {
      // If it's just an ID, we'll use a generic name
      formName = 'Form';
    }
  }
  
  // Get subject count
  const subjectCount = conversation.subjects?.length || 0;
  const subjectText = subjectCount === 1 ? 'subject' : 'subjects';
  
  // Truncate question text if too long (max 50 characters)
  const maxQuestionLength = 50;
  const truncatedQuestionText = questionText.length > maxQuestionLength
    ? `${questionText.substring(0, maxQuestionLength)}...`
    : questionText;
  
  // Format: "Approval requested by ASSIGNEE_NAME for QUESTION_LABEL on FORM_NAME (NUMBER_OF_SUBJECTS subjects)"
  // Handles long question labels by truncating them
  return `Approval requested by ${assigneeName} for "${truncatedQuestionText}" on ${formName} (${subjectCount} ${subjectText})`;
};

export const transformQuestionConversationToChannel = (
  conversation: QuestionConversation
): Channel => {
  // Generate friendly title
  const friendlyTitle = generateFriendlyTitle(conversation);
  
  // Get subject names
  const subjectNames = conversation.subjects
    ?.map((s) => s.user?.name)
    .filter(Boolean)
    .join(', ') || 'Unknown';

  // Get form name and template ID
  let formName = 'Form';
  let formTemplateId: string | undefined;
  if (conversation.assignment.formTemplate) {
    if (typeof conversation.assignment.formTemplate === 'object') {
      formTemplateId = conversation.assignment.formTemplate._id;
      if (conversation.assignment.formTemplate.name) {
        formName = conversation.assignment.formTemplate.name;
      }
    } else if (typeof conversation.assignment.formTemplate === 'string') {
      formTemplateId = conversation.assignment.formTemplate;
    }
  }

  const questionInfo = parseQuestionKey(conversation.questionKey);
  const questionText = questionInfo.questionNumber
    ? `Question ${questionInfo.questionNumber}`
    : questionInfo.questionName || 'Question';

  return {
    id: conversation._id,
    name: friendlyTitle, // Use friendly title as the main name
    type: 'organization', // All question conversations are organization type
    visibility: 'public',
    status: conversation.deletedAt ? 'archived' : 'active',
    topic: conversation.questionKey,
    description: `Assignment: ${conversation.assignment._id}`,
    createdAt: conversation.createdAt,
    createdBy: conversation.assignee?.user?._id || conversation.organization,
    lastActivityAt: conversation.updatedAt,
    memberCount: conversation.subjects?.length || 0,
    unreadCount: 0, // TODO: Calculate unread count if available from API
    // Additional metadata
    friendlyTitle,
    questionKey: conversation.questionKey,
    subjectNames,
    assigneeName: conversation.assignee?.user?.name,
    formName,
    formTemplateId,
    questionInfo: questionText,
    // Store the full question conversation object for detailed access
    questionConversation: conversation,
  };
};

// ======================
// 🔹 API Definition
// ======================

export const chatApi = api.injectEndpoints({
  endpoints: (build) => ({
    // 🟢 GET - List Chats
    // Note: This endpoint is kept for initial fetch only. Real-time updates use socket.io.
    getChats: build.query<ChatResponse, void>({
      query: () => ({
        url: `/chats`,
        method: 'GET',
      }),
      providesTags: [{ type: 'Chat', id: 'LIST' }],
      transformResponse: (response: ChatResponse) => response,
    }),
    // Note: getQuestionMessages endpoint removed - use socket.io and useGetChannelMessagesQuery instead
  }),
});

// ======================
// 🔹 Exported Hooks
// ======================
// Note: useGetChatsQuery and useGetQuestionMessagesQuery removed - use socket.io instead
// The endpoints are still available via chatApi.endpoints for direct dispatch calls if needed
