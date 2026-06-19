/* eslint-disable @typescript-eslint/no-explicit-any */
export type ChannelType = 'organization' | 'course' | 'group_dm' | 'dm';

export type ChannelVisibility = 'public' | 'private' | 'restricted';

export type ChannelStatus = 'active' | 'archived' | 'read-only';

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  visibility: ChannelVisibility;
  status: ChannelStatus;
  topic?: string;
  description?: string;
  courseId?: string;
  createdAt: string;
  createdBy: string;
  lastActivityAt: string;
  memberCount?: number;
  unreadCount?: number;
  // Additional metadata for question conversations
  friendlyTitle?: string;
  questionKey?: string;
  subjectNames?: string;
  assigneeName?: string;
  formName?: string;
  formTemplateId?: string; // Form template ID for grouping
  questionInfo?: string;
  questionApprovalStatus?: 'pending' | 'requested' | 'approved' | 'rejected';
  // Full question conversation object for detailed access
  questionConversation?: any; // Store the full QuestionConversation object
}

export type MessageContentType = 'text' | 'attachment' | 'embed' | 'system';

export interface Message {
  id: string;
  channelId: string;
  threadId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  contentType: MessageContentType;
  attachments?: Attachment[];
  embeds?: Embed[];
  reactions?: Reaction[];
  createdAt: string;
  updatedAt?: string;
  editedAt?: string;
  deletedAt?: string;
  isSystem?: boolean;
  isApprovalRequest?: boolean; // Flag to identify approval request messages
  action?: string; // Store the original action type (approval:approve, approval:reject, etc.)
  meta?: {
    questionData?: {
      questionId?: string;
      questionName?: string;
      questionType?: string;
      questionLabel?: string;
      questionValue?: any;
      answerData?: {
        groupData?: {
          groupId?: string;
          groupName?: string;
          groupValue?: any;
        };
        ungroupedData?: {
          subjectId?: string;
          subjectName?: string;
          subjectValue?: any;
          subjectIds?: string[];
          subjectValues?: Record<string, any>;
        };
        textValue?: string;
        numberValue?: number;
        dateValue?: string;
        dateTimeValue?: string;
        selectedOption?: any;
        selectedOptions?: any[];
        ratingValue?: number;
        sliderValue?: number;
        htmlContent?: string;
        addressData?: any;
        [key: string]: any;
      };
      [key: string]: any;
    };
    [key: string]: any;
  };
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Embed {
  id: string;
  type: 'evaluation' | 'form' | 'taskbook' | 'checklist' | 'kb_doc';
  title: string;
  description?: string;
  url: string;
  thumbnail?: string;
}

export interface Reaction {
  emoji: string;
  users: string[];
  count: number;
}

export interface Thread {
  id: string;
  channelId: string;
  parentMessageId: string;
  title?: string;
  type: 'freeform' | 'dispute' | 'approval';
  status?: 'OPEN' | 'NEEDS_INFO' | 'RESOLVED' | 'CLOSED' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED' | 'EXPIRED';
  participants: string[];
  messageCount: number;
  createdAt: string;
  lastActivityAt: string;
}

export interface JitsiRoom {
  id: string;
  channelId: string;
  threadId?: string;
  roomId: string;
  roomName: string;
  startedBy: string;
  startedAt: string;
  endedAt?: string;
  isActive: boolean;
  participants: string[];
  recordingUrl?: string;
  transcriptUrl?: string;
}




