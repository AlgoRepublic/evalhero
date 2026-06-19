/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/queueApi.ts
import { api } from './api';
import { toFormData } from '../utils/formDataHelper';
import { Assignment, AssignmentResponse, FormTemplateSchema, UpdateAssignmentDto } from './assignmentsApi';
import { JSONContent } from '@tiptap/core';
import { Profile, User } from '../features/auth/authSlice';
import { Channel } from '../pages/chat/types';
import type {
  SubmissionStatus,
  SubmissionAnswers,
  ApprovalStatus,
  DisputeStatus,
} from '../types/submission';
import { ChannelType } from '../types';

export type QueueStatus =
  | 'not-started'
  | 'in-progress'
  | 'submitted'
  | 'approval-pending'
  | 'approved'
  | 'disputed'
  | 'complete';

export type ResponsibilityStatus =
  | 'completed'
  | 'pending_submission'
  | 'pending_approval'
  | 'pending_question_approval'
  | 'pending_omit_signature_approval'
  | 'pending_signature'
  | 'not_applicable';

export type ResponsibilityRole =
  | 'assignee'
  | 'subject'
  | 'approver'
  | 'question_approver'
  | 'omit_signature_approver';

export interface QueueFilters {
  formId?: string | string[];
  status?: QueueStatus | 'all';
  assignedById?: string;
  assigneeId?: string;
  subjectId?: string;
  profileId?: string;
  dueRange?: [string, string];
  type?: 'one_time' | 'recurring' | 'all';
  // Responsibility filters (per API spec)
  responsibilityStatus?: ResponsibilityStatus;
  responsibilityStatuses?: ResponsibilityStatus | ResponsibilityStatus[];
  responsibilityProfileId?: string;
  filterProfileId?: string;
  responsibilityRole?: ResponsibilityRole;
  responsibilityRoles?: ResponsibilityRole | ResponsibilityRole[];
  // Pagination and sorting
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface QueueResponse {
  success: boolean;
  data: {
    records: Assignment[];
    metadata: { count: number; page: number; perPage: number };
  };
}

/**
 * QueueSubmission - Submission type for queue API responses
 * Based on Mongoose Submission Schema, with optional fields for API flexibility
 * Includes backward-compatible field names (assignmentId, subjectId)
 */
export interface QueueSubmission {
  _id: string;
  // Core required fields from Submission schema (optional in API responses)
  organization?: string; // ObjectId reference to 'Organization', required in schema
  assignment?: string | Assignment; // ObjectId reference to 'Assignment', required in schema
  assignee?: string | Profile; // ObjectId reference to 'Profile', required in schema
  subject?: string | Profile; // ObjectId reference to 'Profile'
  formTemplateSchema?: string | FormTemplateSchema; // ObjectId reference to 'FormTemplateSchema', required in schema
  status?: SubmissionStatus; // Submission status enum
  answers?: SubmissionAnswers | JSONContent | unknown; // Flexible to support both structured and legacy formats
  approvalStatus?: ApprovalStatus; // Default: 'pending'
  approvalChannel?: string; // ObjectId reference to 'Channel'
  disputeStatus?: DisputeStatus; // Default: 'none'
  disputeChannel?: string; // ObjectId reference to 'Channel'
  createdAt?: string;
  updatedAt?: string;
  // Additional MongoDB fields
  __v?: number;
  deletedAt?: string | null;
  // Allow for additional fields in API responses
  [key: string]: unknown;
}

export interface QueueSubmissionsResponse {
  success: boolean;
  message?: string;
  data: {
    assignment: Assignment;
    submissions: {
      records: QueueSubmission[];
      metadata: { count: number; page: number; perPage: number };
    };
  };
}

export interface SubmitQueuePayload {
  assignmentId: string;
  data: {
    // For single subject submission (legacy)
    subjectId?: string;
    assigneeId?: string;
    targetStatus: 'submission_in_progress' | 'submission_complete';
    validate: boolean;
    answers?: JSONContent;
    signature?: { name: string; user: string };
    attachments?: {
      filename: string;
      path: string;
      mimetype: string;
      size: number;
    }[];
    location?: {
      latitude: string;
      longitude: string;
      address: string;
    };
    disputeReason?: string;
    allowedBy?: string;
    threadRef?: string;
    // For auto-save with multiple subjects
    _id?: string; // assignmentId (alternative way to pass)
    meta?: {
      globalGroups?: Array<{
        id: string;
        name: string;
        subjectIds: string[];
        locked?: boolean;
      }>;
      ungroupedSubjects?: Array<{
        id: string;
        name: string;
        locked?: boolean;
      }>;
      isAllLocked?: boolean;
      [key: string]: any;
    };
    submissions?: Array<{
      subjectId: string;
      answers: JSONContent;
      [key: string]: any;
    }>;
  };
}

export interface ApproveQueuePayload {
  assignmentId: string;
  submissionId: string;
  decision: 'approved' | 'rejected';
  reason?: string;
}

export interface ApproveQueueResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export interface QuickSubmitPayload {
  timezone: string;
  formTemplateId: string;
  formTemplateSchemaId: string;
  configSetId?: string;
  assignees?: string[];
  subjects?: string[];
  hasApproval?: boolean;
  hasDisputes?: boolean;
  signatureRequired?: boolean;
  approvers?: string[];
  approvalRule?: 'ALL' | 'ANY' | 'MIN';
  approvalMinCount?: number;
  omitSignatureAllowed?: boolean;
  omitSignatureApprovers?: string[];
  answers: JSONContent;
}

export interface QuickSubmitResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export interface ApprovalInfo {
  _id?: string;
  submissionId?: string;
  assignmentId?: string;
  approvedBy?: string;
  decision?: 'approved' | 'rejected';
  reason?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ApprovalApprover {
  _id?: string;
  user?: {
    _id?: string;
    name?: string;
    email?: string;
  };
}

export interface ApprovalData {
  _id?: string;
  reason?: string;
  decision?: 'approved' | 'rejected';
  submission?: string;
  assignment?: string;
  approver?: ApprovalApprover;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApprovalSummary {
  totalApprovers?: number;
  approvalRule?: 'ALL' | 'ANY' | 'MIN';
  approvalMinCount?: number;
  approvedCount?: number;
  rejectedCount?: number;
  changesRequestedCount?: number;
  pendingCount?: number;
  status?: string;
  overallStatus?: string;
}

export interface GetApprovalsResponse {
  success: boolean;
  message?: string;
  data?: {
    submission?: {
      _id?: string;
      status?: SubmissionStatus; // Submission status enum
    };
    assignment?: {
      _id?: string;
      hasApproval?: boolean;
      approvalRule?: 'ALL' | 'ANY' | 'MIN';
      approvalMinCount?: number;
      approvers?: string[];
    };
    approval?: ApprovalData;
    approvalSummary?: ApprovalSummary;
    [key: string]: unknown;
  };
}

// Chat API Types
export interface ChatAttachment {
  filename: string;
  path?: string;
  url?: string;
  mimetype?: string;
  size?: number;
}

export interface ChatMessage {
  _id?: string;
  text: string;
  senderId?: string;
  senderName?: string;
  sentBy?: {
    _id?: string;
    user?: {
      _id?: string;
      name?: string;
      email?: string;
    };
  };
  timestamp?: string;
  createdAt?: string;
  updatedAt?: string;
  conversation?: string;
  attachments?: ChatAttachment[];
  readBy?: any[];
  actionType?: 'approval' | 'dispute' | 'signature';
  signature?: {
    dataUrl?: string;
    signerName?: string;
    timestamp?: string;
  };
}

export interface Conversation {
  _id: string;
  conversationId?: string; // Optional, for backward compatibility
  submissionId?: string;
  assignment?: string;
  submission?: string;
  participants?: any[];
  type?: string;
  status?: string;
  messages?: ChatMessage[];
  createdAt?: string;
  updatedAt?: string;
}

export interface StartConversationPayload {
  assignmentId: string;
  submissionId: string;
}

export interface StartConversationResponse {
  success: boolean;
  message?: string;
  data?: {
    conversation?: Conversation;
  };
}

export interface SendMessagePayload {
  assignmentId: string;
  submissionId: string;
  conversationId: string;
  text: string;
  attachments?: ChatAttachment[];
}

export interface SendMessageResponse {
  success: boolean;
  message?: string;
  data?: {
    message?: ChatMessage;
    conversation?: Conversation;
  };
}

export interface ListConversationsPayload {
  assignmentId: string;
  submissionId: string;
}

export interface ListConversationsResponse {
  success: boolean;
  message?: string;
  data?: {
    conversations?: Conversation[];
  };
}

export interface GetConversationPayload {
  assignmentId: string;
  submissionId: string;
  conversationId?: string; // Optional - if not provided, gets conversation for submission
}

export interface GetConversationResponse {
  success: boolean;
  message?: string;
  data?: {
    conversation?: Conversation;
    messages?: ChatMessage[];
  };
}

export interface SignaturePayload {
  assignmentId: string;
  submissionId: string;
  conversationId: string;
}

export interface SignatureResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export interface DisputePayload {
  assignmentId: string;
  submissionId: string;
  conversationId: string;
}

export interface DisputeResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export interface ApprovalChatPayload {
  assignmentId: string;
  submissionId: string;
  action: 'message' | 'approve' | 'reject';
  text?: string; // For action: 'message'
  comment?: string; // For action: 'approve' | 'reject' (optional)
}

export interface ApprovalChatResponse {
  success: boolean;
  message?: string;
  data?: {
    message?: ChatMessage;
    [key: string]: any;
  };
}

export interface GetApprovalChatMessagesPayload {
  assignmentId: string;
  submissionId: string;
}

export interface ApprovalChatMessage {
  _id: string;
  action: 'message' | 'approval:approve' | 'approval:reject';
  actionData?: {
    text?: string;
    comment?: string;
  };
  deletedAt?: string | null;
  organization?: string;
  conversation?: string;
  sentBy?: {
    _id: string;
    user?: {
      _id: string;
      name: string;
      email: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  assignment?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApprovalRecord {
  _id: string;
  comment?: string;
  deletedAt?: string | null;
  organization?: string;
  submission?: string;
  assignment?: string;
  approver?: {
    _id: string;
    user?: {
      _id: string;
      name: string;
      email: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  decision: 'approved' | 'rejected';
  createdAt?: string;
  updatedAt?: string;
}

export interface GetApprovalChatMessagesResponse {
  success: boolean;
  message?: string;
  data?: {
    conversation?: {
      _id: string;
      type?: string;
      deletedAt?: string | null;
      organization?: string;
      submission?: string;
      assignment?: string;
      createdAt?: string;
      updatedAt?: string;
    };
    messages?: ApprovalChatMessage[];
    approvals?: ApprovalRecord[];
  }
}

// Dispute Chat APIs
export interface DisputeChatPayload {
  assignmentId: string;
  submissionId: string;
  action: 'message' | 'dispute' | 'signature' | 'omit-signature-request' | 'omit-signature-request-approve' | 'omit-signature-request-reject';
  text?: string; // For message action
  comment?: string; // For dispute action
  file?: File | Blob; // For signature action
}

export interface DisputeChatResponse {
  success: boolean;
  message?: string;
  data?: {
    message?: ChatMessage;
    conversation?: {
      _id: string;
      type?: string;
      deletedAt?: string | null;
      organization?: string;
      submission?: string;
      assignment?: string;
      createdAt?: string;
      updatedAt?: string;
    };
  };
}

export interface GetDisputeChatMessagesPayload {
  assignmentId: string;
  submissionId: string;
}

export interface DisputeChatMessage {
  _id: string;
  action: 'message' | 'dispute' | 'signature' | 'submission:dispute' | 'submission:signature' | 'omit-signature-request' | 'omit-signature-request-approve' | 'omit-signature-request-reject' | 'submission:omit-signature-request' | 'submission:omit-signature-request-approve' | 'submission:omit-signature-request-reject';
  actionData?: {
    text?: string;
    comment?: string;
    file?: {
      filename: string;
      url: string;
      mimetype: string;
      size: number;
    } | string; // Can be a string path or an object
  };
  deletedAt?: string | null;
  organization?: string;
  conversation?: string;
  sentBy?: {
    _id: string;
    user?: {
      _id: string;
      name: string;
      email: string;
    };
    name?: string;
  };
  assignment?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GetDisputeChatMessagesResponse {
  success: boolean;
  message?: string;
  data?: {
    conversation?: {
      _id: string;
      type?: string;
      deletedAt?: string | null;
      organization?: string;
      submission?: string;
      assignment?: string;
      createdAt?: string;
      updatedAt?: string;
    };
    messages?: DisputeChatMessage[];
  };
}

// Unified Chat Messages API Types
export interface UnifiedChatMessage {
  _id: string;
  type: 'question-approval' | 'approval' | 'dispute';
  action?: string;
  actionData?: {
    text?: string;
    comment?: string;
    [key: string]: any;
  };
  text?: string;
  questionName?: string;
  questionId?: string;
  questionType?: string;
  questionNumber?: number;
  sentBy?: {
    _id?: string;
    user?: {
      _id?: string;
      name?: string;
      email?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
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
          allGroupValues?: Record<string, any>;
        };
        ungroupedData?: {
          subjectId?: string;
          subjectIds?: string[];
          subjectName?: string;
          subjectValue?: any;
          subjectValues?: Record<string, any>;
          allGroupValues?: Record<string, any>;
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
  createdAt?: string;
  updatedAt?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface GetUnifiedChatMessagesPayload {
  assignmentId: string;
  submissionId: string;
  questionName?: string;
}

export interface GetUnifiedChatMessagesResponse {
  success: boolean;
  message?: string;
  data?: {
    messages?: UnifiedChatMessage[];
  };
}

// Question Approval Chat API Types
export interface QuestionApprovalChatPayload {
  assignmentId: string;
  submissionId: string;
  questionName: string;
  questionNumber: number;
  action: 'request' | 'approve' | 'reject';
  comment?: string;
}

export interface QuestionApprovalChatResponse {
  success: boolean;
  message?: string;
  data?: {
    message?: UnifiedChatMessage;
    [key: string]: any;
  };
}

// Question Conversation API Types
export interface GetQuestionConversationPayload {
  assignmentId: string;
  questionKey: string;
  subjects: string[];
  questionConversationId?: string;
  meta?: {
    type?: 'group' | 'ungrouped';
    subjectId?: string[];
    subjectName?: string;
    groupId?: string;
    groupName?: string;
    questionData?: {
      questionId?: string;
      questionName?: string;
      questionType?: string;
      questionLabel?: string;
      questionValue?: any;
      answerData?: {
        // Common fields
        required?: boolean;
        enableGrouping?: boolean;
        nodeGroups?: any[];
        // Group/Ungrouped specific data
        groupData?: {
          groupId?: string;
          groupName?: string;
          groupValue?: any;
          allGroupValues?: Record<string, any>;
        };
        ungroupedData?: {
          subjectId?: string;
          subjectName?: string;
          subjectValue?: any;
          subjectIds?: string[];
          subjectValues?: Record<string, any>;
          allGroupValues?: Record<string, any>;
        };
        // Node-type-specific fields
        textValue?: string;
        placeholder?: string;
        maxLength?: number;
        numberValue?: number;
        min?: number;
        max?: number;
        step?: number;
        unit?: string;
        prefix?: string;
        suffix?: string;
        dateValue?: string;
        dateTimeValue?: string;
        format?: string;
        selectedOption?: any;
        selectedOptions?: any[];
        options?: any[];
        otherValue?: string;
        ratingValue?: number;
        maxRating?: number;
        ratingLabels?: string[];
        ratingVariant?: 'stars' | 'anchors' | 'emoji';
        allowHalf?: boolean;
        sliderValue?: number;
        order?: any[];
        htmlContent?: string;
        jsonContent?: any;
        addressData?: {
          street?: string;
          apartment?: string;
          city?: string;
          state?: string;
          postalCode?: string;
          country?: string;
          formatted?: string;
          lat?: number;
          lng?: number;
        };
        rawValue?: any;
        [key: string]: any;
      };
    };
    [key: string]: any;
  };
}

export interface QuestionConversation {
  _id: string;
  subjects: Profile[];
  meta: {
    type?: 'group' | 'ungrouped';
    subjectId?: string[];
    subjectName?: string;
    groupId?: string;
    groupName?: string;
    [key: string]: any; // Allow unknown keys and values
  };
  deletedAt?: string | null;
  organization?: string;
  assignment?: string;
  assignee?: Profile;
  questionKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuestionConversationMessage {
  _id?: string;
  action?: 'approval:request' | 'message';
  actionData?: {
    text?: string;
    [key: string]: any;
  } | null;
  deletedAt?: string | null;
  organization?: string;
  questionConversation?: string;
  sentBy?: Profile;
  assignment?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface GetQuestionConversationResponse {
  success: boolean;
  message?: string;
  data?: {
    questionConversation?: QuestionConversation;
    messages?: QuestionConversationMessage[];
    [key: string]: any;
  };
}

// Question Chat API Types (for sending messages and approval requests)
export interface SendQuestionChatPayload {
  assignmentId: string; // Used in URL, but _id is sent in body
  questionKey: string;
  questionConversationId?: string;
  subjects: string[];
  action: 'message' | 'approval:approve' | 'approval:reject' | 'approval:request';
  actionData?: {
    text?: string; // Required when action is 'message'
    comment?: string; // Optional for other actions
  };
  meta?: {
    type?: 'group' | 'ungrouped';
    subjectId?: string[];
    subjectName?: string;
    groupId?: string;
    groupName?: string;
    questionData?: {
      questionId?: string;
      questionName?: string;
      questionType?: string;
      questionLabel?: string;
      questionValue?: any;
      answerData?: {
        // Common fields
        required?: boolean;
        enableGrouping?: boolean;
        nodeGroups?: any[];
        // Group/Ungrouped specific data
        groupData?: {
          groupId?: string;
          groupName?: string;
          groupValue?: any;
          allGroupValues?: Record<string, any>;
        };
        ungroupedData?: {
          subjectId?: string;
          subjectName?: string;
          subjectValue?: any;
          allGroupValues?: Record<string, any>;
        };
        // Node-type-specific fields
        textValue?: string;
        placeholder?: string;
        maxLength?: number;
        numberValue?: number;
        min?: number;
        max?: number;
        step?: number;
        unit?: string;
        prefix?: string;
        suffix?: string;
        dateValue?: string;
        dateTimeValue?: string;
        format?: string;
        selectedOption?: any;
        selectedOptions?: any[];
        options?: any[];
        otherValue?: string;
        ratingValue?: number;
        maxRating?: number;
        ratingLabels?: string[];
        sliderValue?: number;
        order?: any[];
        htmlContent?: string;
        addressData?: {
          street?: string;
          apartment?: string;
          city?: string;
          state?: string;
          postalCode?: string;
          country?: string;
          formatted?: string;
          lat?: number;
          lng?: number;
        };
        rawValue?: any;
        [key: string]: any;
      };
    };
    [key: string]: any;
  };
}

export interface SendQuestionChatResponse {
  success: boolean;
  message?: string;
  data?: {
    message?: QuestionConversationMessage;
    [key: string]: any;
  };
}

// Get Channel API Types
export interface GetChannelPayload {
  channelType: 'course' | 'group_dm' | 'dm' | 'approval' | 'dispute' | 'question_approval' | 'course_form_approval' | 'course_form_question_approval';
  submissionId?: string; // Required when channelType is 'approval' or 'dispute'
  assignmentId?: string; // Required when channelType is 'question_approval'
  questionKey?: string; // Required when channelType is 'question_approval'
  assigneeId?: string;
  // For channelType 'course_form_approval' | 'course_form_question_approval'
  courseFormSubmissionId?: string;
  courseEnrolmentId?: string;
  coursePageId?: string;
  formBlockId?: string;
  meta?: {
    subjects?: Array<{
      id: string;
      name: string;
      [key: string]: any;
    }>;
    groups?: Array<{
      id: string;
      name: string;
      subjectIds: string[];
      [key: string]: any;
    }>;
    ungroupedSubjects?: Array<{
      id: string;
      name: string;
      [key: string]: any;
    }>;
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
          allGroupValues?: Record<string, any>;
        };
        ungroupedData?: {
          subjectId?: string;
          subjectIds?: string[];
          subjectName?: string;
          subjectValue?: any;
          subjectValues?: Record<string, any>;
          allGroupValues?: Record<string, any>;
        };
        [key: string]: any;
      };
      [key: string]: any;
    };
    [key: string]: any;
  };
}

/** API channel type for question/approval channels (assignment or course form) */
export type QuestionApprovalChannelType = 'question_approval' | 'course_form_question_approval';

export interface ChannelData {
  _id: string;
  organization: string;
  channelType: ChannelType | QuestionApprovalChannelType;
  name?: string;
  topic?: string;
  description?: string;
  createdBy?: string;
  lastActivityAt?: string;
  submission?: string;
  assignment?: string;
  questionKey?: string;
  assignee?: string;
  subjects?: string[];  
  approvalStatus?: ApprovalStatus;
  questionApprovalStatus?: ApprovalStatus;
  disputeStatus?: 'none' | 'open';
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  messageCount?: number;
  __v?: number;
  meta?: {
    type?: 'group' | 'ungrouped';
    subjectId?: string | string[];
    subjectName?: string;
    groupId?: string;
    groupName?: string;
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
          allGroupValues?: Record<string, any>;
        };
        ungroupedData?: {
          subjectId?: string;
          subjectIds?: string[];
          subjectName?: string;
          subjectValue?: any;
          subjectValues?: Record<string, any>;
          allGroupValues?: Record<string, any>;
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
  [key: string]: any; // Allow for additional fields
}

export interface GetChannelResponse {
  success: boolean;
  message?: string;
  data?: ChannelData;
}

// Question Approval Channels API Types
// API: GET /queues2/question-approval-channels?type=question_approval | type=course_form_question_approval
// Both types return data.records[].

/** Query param type for GET /queues2/question-approval-channels (matches API) */
export type QuestionApprovalChannelsType = 'question_approval' | 'course_form_question_approval';
export interface GetQuestionApprovalChannelsPayload {
  /** type=question_approval (form/assignment) or course_form_question_approval (course inline form) */
  type?: QuestionApprovalChannelsType;
  page?: number;
  perPage?: number;
  sortBy?: 'latestActivity' | 'count';
  order?: 'asc' | 'desc';
}

/** Form/assignment question approval record (type=question_approval) */
export interface QuestionApprovalChannelRecord {
  assignmentId: string;
  assigneeId: string;
  assignment?: Assignment;
  assignee?: Profile;
  channels: ChannelData[];
  total: number;
}

/** Channel item inside course_form_question_approval record (API channelType: course_form_question_approval) */
export interface CourseFormApprovalChannelItem {
  _id: string;
  organization: string;
  channelType: 'course_form_question_approval';
  courseFormSubmission?: string;
  courseEnrolment?: string;
  coursePage?: string;
  formBlockId: string;
  questionKey?: string;
  approvalStatus?: string;
  questionApprovalStatus?: string;
  courseFormApprovalStatus?: string;
  courseFormQuestionApprovalStatus?: string;
  disputeStatus?: string;
  meta?: {
    type?: string;
    subjectId?: string | string[];
    subjectName?: string;
    groupId?: string;
    groupName?: string;
    questionData?: {
      questionId?: string;
      questionName?: string;
      questionType?: string;
      questionLabel?: string;
      questionValue?: unknown;
      answerData?: Record<string, unknown>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  } | null;
  lastActivityAt?: string;
  messageCount?: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

/** Course inline form question approval record (type=course_form_question_approval) */
export interface CourseFormApprovalChannelRecord {
  courseEnrolmentId: string;
  coursePageId: string;
  formBlockId: string;
  courseEnrolment?: {
    _id: string;
    enrollee?: {
      _id: string;
      user?: { _id?: string; name?: string; email?: string; avatar?: string; [key: string]: unknown };
    };
    status?: string;
    createdAt?: string;
    [key: string]: unknown;
  };
  coursePage?: { _id: string; title?: string; [key: string]: unknown };
  course?: { _id: string; title?: string; description?: string; [key: string]: unknown };
  channels: CourseFormApprovalChannelItem[];
  total: number;
  latestActivity?: string;
}

export interface GetQuestionApprovalChannelsResponse {
  success: boolean;
  message?: string;
  data?: {
    metadata?: { count: number; page: number; perPage: number };
    /** Both question_approval and course_form_question_approval return records */
    records?: (QuestionApprovalChannelRecord | CourseFormApprovalChannelRecord)[];
  };
}

/** Transform course form question approval channel item + record to Channel (for list display). */
export const transformCourseFormApprovalChannelToChannel = (
  channelItem: CourseFormApprovalChannelItem,
  record: CourseFormApprovalChannelRecord
): Channel => {
  const enrolleeName =
    record.courseEnrolment?.enrollee?.user?.name ?? 'Enrollee';
  const courseTitle = record.course?.title ?? 'Course';
  const pageTitle = record.coursePage?.title ?? 'Page';
  const questionLabel =
    channelItem.meta?.questionData?.questionLabel ?? channelItem.questionKey ?? 'Question';
  const maxLen = 50;
  const truncatedQuestion =
    questionLabel.length > maxLen ? `${questionLabel.slice(0, maxLen)}...` : questionLabel;
  const friendlyTitle = `${courseTitle} · ${pageTitle} · ${enrolleeName} – "${truncatedQuestion}"`;
  const status =
    (channelItem.courseFormQuestionApprovalStatus ?? channelItem.questionApprovalStatus ?? channelItem.courseFormApprovalStatus) as
      | 'pending'
      | 'requested'
      | 'approved'
      | 'rejected'
      | undefined;
  return {
    id: channelItem._id,
    name: friendlyTitle,
    type: 'organization',
    visibility: 'public',
    status: 'active',
    topic: channelItem.questionKey ?? record.formBlockId,
    description: `Course form: ${record.course?.title ?? ''} – ${record.coursePage?.title ?? record.coursePageId}`,
    createdAt: channelItem.createdAt ?? channelItem.lastActivityAt ?? new Date().toISOString(),
    createdBy: record.courseEnrolmentId,
    lastActivityAt: channelItem.lastActivityAt ?? new Date().toISOString(),
    memberCount: record.total,
    unreadCount: 0,
    friendlyTitle,
    questionInfo: questionLabel,
    questionApprovalStatus: status ?? 'pending',
  };
};

// Transform ChannelData to Channel format for question approval channels
export const transformQuestionApprovalChannelToChannel = (
  channelData: ChannelData,
  record: QuestionApprovalChannelRecord
): Channel => {
  // Extract question information from meta
  const questionLabel = channelData.meta?.questionData?.questionLabel || 'Question';
  const questionKey = channelData.questionKey || 'Unknown Question';
  
  // Extract assignee information
  let assigneeName = 'Unknown User';
  const user = record.assignee?.user;
  if (user && typeof user === 'object' && 'name' in user) {
    assigneeName = (user as User).name || 'Unknown User';
  } else if (typeof user === 'string') {
    // If user is just a string, use it
    assigneeName = user;
  }
  const assigneeId = record.assigneeId;
  
  // Extract assignment and form information
  const assignment = record.assignment;
  const formName = assignment?.formTemplate?.name || 'Form';
  const formTemplateId = assignment?.formTemplate?._id;
  
  // Extract subject information
  const metaSubjectId = channelData.meta?.subjectId;
  const subjectName = channelData.meta?.subjectName || 
                     (Array.isArray(metaSubjectId) 
                       ? metaSubjectId.join(', ') 
                       : metaSubjectId || '');
  const subjectNames = subjectName;
  
  // Generate friendly title similar to transformQuestionConversationToChannel
  const subjectCount = Array.isArray(metaSubjectId) 
    ? metaSubjectId.length 
    : (metaSubjectId ? 1 : 0);
  const subjectText = subjectCount === 1 ? 'subject' : 'subjects';
  
  // Truncate question text if too long
  const maxQuestionLength = 50;
  const truncatedQuestionText = questionLabel.length > maxQuestionLength
    ? `${questionLabel.substring(0, maxQuestionLength)}...`
    : questionLabel;
  
  // Format: "Approval requested by ASSIGNEE_NAME for QUESTION_LABEL on FORM_NAME (NUMBER_OF_SUBJECTS subjects)"
  const friendlyTitle = `Approval requested by ${assigneeName} for "${truncatedQuestionText}" on ${formName}${subjectCount > 0 ? ` (${subjectCount} ${subjectText})` : ''}`;
  
  // Get question info text
  const questionInfo = questionLabel || questionKey;
  
  return {
    id: channelData._id,
    name: friendlyTitle, // Use friendly title as the main name
    type: 'organization',
    visibility: 'public',
    status: channelData.deletedAt ? 'archived' : 'active',
    topic: channelData.questionKey,
    description: `Assignment: ${record.assignmentId}`,
    createdAt: channelData.createdAt || new Date().toISOString(),
    createdBy: channelData.assignee || channelData.organization || assigneeId,
    lastActivityAt: channelData.lastActivityAt || channelData.updatedAt || channelData.createdAt || new Date().toISOString(),
    memberCount: subjectCount || channelData.subjects?.length || 0,
    unreadCount: 0, // TODO: Calculate unread count if available from API
    // Additional metadata
    friendlyTitle,
    questionKey: channelData.questionKey,
    subjectNames,
    assigneeName,
    formName,
    formTemplateId,
    questionInfo,
    questionApprovalStatus: channelData.questionApprovalStatus,
    // Store the full channel data for detailed access
    questionConversation: {
      _id: channelData._id,
      assignment: assignment ? { ...assignment, _id: record.assignmentId } : { _id: record.assignmentId },
      assignee: record.assignee ? { ...record.assignee, _id: assigneeId } : { _id: assigneeId },
      questionKey: channelData.questionKey,
      subjects: channelData.subjects || [],
      meta: channelData.meta || {
        type: 'ungrouped',
        subjectId: channelData.subjects || [],
      },
      createdAt: channelData.createdAt || new Date().toISOString(),
      updatedAt: channelData.updatedAt || channelData.createdAt || new Date().toISOString(),
      deletedAt: channelData.deletedAt,
      organization: channelData.organization,
    },
  };
};

// Get Channel Messages API Types
export interface GetChannelMessagesPayload {
  channelId: string;
}

export interface ChannelMessage {
  _id: string;
  action: 'message' | 'approval:requested' | 'approval:approved' | 'approval:rejected' | string;
  actionData: {
    text?: string;
    comment?: string;
    [key: string]: any;
  } | null;
  meta?: {
    [key: string]: any;
  };
  localId?: string; // Optional local ID for optimistic updates
  deletedAt?: string | null;
  organization: string;
  channel: string; // Channel ID
  sentBy: {
    _id: string;
    user: {
      _id: string;
      name: string;
      email: string;
      avatar?: string;
      isAdmin?: boolean;
      deletedAt?: string | null;
      createdAt: string;
      updatedAt: string;
    };
    permissionCodes?: string[];
    roles?: Array<{
      role: string;
      permissionCodes: string[];
      _id: string;
    }>;
    departments?: Array<{
      department: string;
      permissionCodes: string[];
      _id: string;
    }>;
    locations?: Array<{
      location: string;
      permissionCodes: string[];
      _id: string;
    }>;
    organization?: string;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface GetChannelMessagesResponse {
  success: boolean;
  message?: string;
  data?: {
    metadata?: {
      count: number;
      page: number;
      perPage: number;
    };
    records?: ChannelMessage[];
    [key: string]: any;
  };
}

// --- Activity (Notifications) API ---
export interface ActivityRecord {
  _id: string;
  type: string;
  message: string;
  read: boolean;
  readAt: string | null;
  assignmentId: string | null;
  submissionId: string | null;
  channelId: string | null;
  createdAt: string;
  lastActivityAt: string;
  assignment?: unknown | null;
  submission?: unknown | null;
  channel?: unknown | null;
  courseFormSubmission?: unknown | null;
  courseEnrolment?: unknown | null;
  coursePage?: unknown | null;
}

export interface ActivityListParams {
  page?: number;
  perPage?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  read?: boolean;
  types?: string | string[];
  profileId?: string;
}

export interface ActivityListResponse {
  success: boolean;
  message?: string;
  data: {
    metadata: { count: number; page: number; perPage: number };
    records: ActivityRecord[];
  };
}

export interface MarkActivityReadPayload {
  notificationIds?: string[];
  items?: Array<{
    type: string;
    assignmentId?: string;
    submissionId?: string;
    channelId?: string;
  }>;
}

export interface MarkActivityReadResponse {
  success: boolean;
  message?: string;
  data: { success: boolean; marked: number };
}

export const queueApi = api.injectEndpoints({
  endpoints: (build) => ({
    getActivity: build.query<ActivityListResponse, ActivityListParams | void>({
      query: (params = {}) => {
        const query: Record<string, string | number | boolean | string[] | undefined> = {
          page: params?.page ?? 1,
          perPage: params?.perPage ?? 50,
          sortBy: params?.sortBy ?? 'createdAt',
          order: params?.order ?? 'desc',
        };
        if (params?.read !== undefined) query.read = params.read;
        if (params?.profileId) query.profileId = params.profileId;
        if (params?.types !== undefined) {
          if (Array.isArray(params.types)) query.types = params.types;
          else query.types = params.types;
        }
        return { url: '/queues/activity', params: query };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.records.map((r) => ({ type: 'Activity' as const, id: r._id })),
              { type: 'Activity', id: 'LIST' },
            ]
          : [{ type: 'Activity', id: 'LIST' }],
    }),
    markActivityRead: build.mutation<MarkActivityReadResponse, MarkActivityReadPayload>({
      query: (body) => ({
        url: '/queues/activity/read',
        method: 'POST',
        body: toFormData(body),
      }),
      invalidatesTags: [{ type: 'Activity', id: 'LIST' }],
    }),
    getQueues: build.query<
      QueueResponse,
      QueueFilters & { page?: number; perPage?: number }
    >({
      query: (filters) => {
        const params: Record<string, any> = {
          page: filters.page || 1,
          perPage: filters.perPage || 10,
        };

        // Standard filters
        if (filters.sortBy) params.sortBy = filters.sortBy;
        if (filters.order) params.order = filters.order;
        if (filters.profileId) params.profileId = filters.profileId;
        if (filters.dueRange?.[0]) params.dueFrom = filters.dueRange[0];
        if (filters.dueRange?.[1]) params.dueTo = filters.dueRange[1];
        if (filters.type && filters.type !== 'all') params.type = filters.type;

        // Form template filter
        if (filters.formId) {
          if (Array.isArray(filters.formId)) {
            params.formId = filters.formId;
          } else {
            params.formId = filters.formId;
          }
        }

        // Responsibility status filters
        if (filters.responsibilityStatus) params.responsibilityStatus = filters.responsibilityStatus;
        if (filters.responsibilityStatuses) params.responsibilityStatuses = filters.responsibilityStatuses;
        if (filters.responsibilityProfileId) params.responsibilityProfileId = filters.responsibilityProfileId;
        if (filters.filterProfileId) params.filterProfileId = filters.filterProfileId;

        // Responsibility role filters
        if (filters.responsibilityRole) params.responsibilityRole = filters.responsibilityRole;
        if (filters.responsibilityRoles) params.responsibilityRoles = filters.responsibilityRoles;

        return {
          url: '/queues',
          params,
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.records.map((i) => ({
                type: 'Queue' as const,
                id: i._id,
              })),
              { type: 'Queue', id: 'LIST' },
            ]
          : [{ type: 'Queue', id: 'LIST' }],
    }),

    // 🟢 GET - Single Queue
    getQueue: build.query<AssignmentResponse, { id: string; assigneeId?: string }>({
      query: ({ id, assigneeId }) => ({
        url: `/queues/${id}`,
        method: 'GET',
        params: assigneeId ? { assigneeId } : {},
      }),
      providesTags: (_result, _error, { id }) => [{ type: 'Assignment', id }],
      // Keep cache time short to ensure fresh data after auto-save
      keepUnusedDataFor: 0,
    }),

    // POST  - Submit Queue
    submitQueue: build.mutation<AssignmentResponse, SubmitQueuePayload>({
      query: ({ assignmentId, data }) => ({
        url: `/queues/${assignmentId}/submit`,
        method: 'POST',
        body: toFormData(data),
      }),
      // invalidatesTags: (_result, _error, { assignmentId }) => [
      //   { type: 'Queue', id: assignmentId },
      //   { type: 'Assignment', id: assignmentId },
      // ],
    }),

    // 🟠 PUT - Update Queue
    updateQueue: build.mutation<AssignmentResponse, UpdateAssignmentDto>({
      query: ({ id, ...rest }) => ({
        url: `/queues/${id}`,
        method: 'PUT',
        body: toFormData(rest),
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Queue', id },
        { type: 'Assignment', id },
      ],
    }),

    // 🟢 GET - Queue Submissions
    getQueueSubmissions: build.query<
      QueueSubmissionsResponse,
      { assignmentId: string; subjectId?: string | null; assigneeId?: string; page?: number; perPage?: number; sortBy?: string; order?: 'asc' | 'desc' }
    >({
      query: ({ assignmentId, subjectId, assigneeId, page = 1, perPage = 10000, sortBy = 'updatedAt', order = 'desc' }) => ({
        url: `/queues/${assignmentId}/submissions`,
        method: 'GET',
        params: {
          page,
          perPage,
          sortBy,
          order,
          ...(subjectId ? { subjectId } : {}),
          ...(assigneeId ? { assigneeId } : {}),
        },
      }),
      providesTags: (_result, _error, { assignmentId }) => [{ type: 'Queue', id: assignmentId }],
    }),

    bulkRemind: build.mutation<void, string[]>({
      query: (ids) => ({
        url: '/queues/bulk/remind',
        method: 'POST',
        body: toFormData({ ids }),
      }),
      invalidatesTags: [{ type: 'Queue', id: 'LIST' }],
    }),

    bulkCancel: build.mutation<void, string[]>({
      query: (ids) => ({
        url: '/queues/bulk/cancel',
        method: 'POST',
        body: toFormData({ ids }),
      }),
      invalidatesTags: [{ type: 'Queue', id: 'LIST' }],
    }),

    bulkReassign: build.mutation<void, { ids: string[]; assigneeId: string }>({
      query: ({ ids, assigneeId }) => ({
        url: '/queues/bulk/reassign',
        method: 'POST',
        body: toFormData({ ids, assigneeId }),
      }),
      invalidatesTags: [{ type: 'Queue', id: 'LIST' }],
    }),

    // POST - Approve/Reject Queue Submission
    approveQueue: build.mutation<ApproveQueueResponse, ApproveQueuePayload>({
      query: ({ assignmentId, submissionId, decision, reason }) => ({
        url: `/queues/${assignmentId}/approve`,
        method: 'POST',
        body: toFormData({
          submissionId,
          decision,
          reason: reason || '',
        }),
      }),
      invalidatesTags: (_result, _error, { assignmentId }) => [
        { type: 'Queue', id: assignmentId },
      ],
    }),

    // GET - Get Approvals for Assignment
    getApprovals: build.query<
      GetApprovalsResponse,
      { assignmentId: string; submissionId: string }
    >({
      query: ({ assignmentId, submissionId }) => ({
        url: `/queues/${assignmentId}/approvals`,
        method: 'GET',
        params: {
          submissionId,
        },
      }),
      providesTags: (_result, _error, { assignmentId }) => [
        { type: 'Queue', id: assignmentId },
      ],
    }),

    // POST - Start Conversation
    startConversation: build.mutation<StartConversationResponse, StartConversationPayload>({
      query: ({ assignmentId, submissionId }) => ({
        url: `/queues/${assignmentId}/chat`,
        method: 'POST',
        body: toFormData({
          submissionId,
          action: 'start',
        }),
      }),
      invalidatesTags: (_result, _error, { assignmentId }) => [
        { type: 'Queue', id: assignmentId },
      ],
    }),

    // POST - Send Message
    sendChatMessage: build.mutation<SendMessageResponse, SendMessagePayload>({
      query: ({ assignmentId, submissionId, conversationId, text, attachments }) => {
        const formData = toFormData({
          submissionId,
          action: 'message',
          conversationId,
          text,
        });
        
        // Add attachments as JSON string if provided
        if (attachments && attachments.length > 0) {
          formData.append('attachments', JSON.stringify(attachments));
        }
        
        return {
          url: `/queues/${assignmentId}/chat`,
          method: 'POST',
          body: formData,
        };
      },
      // invalidatesTags: (_result, _error, { assignmentId }) => [
      //   { type: 'Queue', id: assignmentId },
      // ],
    }),

    // POST - Get Conversation
    getConversation: build.mutation<GetConversationResponse, GetConversationPayload>({
      query: ({ assignmentId, submissionId, conversationId }) => {
        const formData = toFormData({
          submissionId,
          action: 'get',
        });
        if (conversationId) {
          formData.append('conversationId', conversationId);
        }
        return {
          url: `/queues/${assignmentId}/chat`,
          method: 'POST',
          body: formData,
        };
      },
    }),

    // POST - Signature
    signature: build.mutation<SignatureResponse, SignaturePayload>({
      query: ({ assignmentId, submissionId, conversationId }) => ({
        url: `/queues/${assignmentId}/signature`,
        method: 'POST',
        body: toFormData({
          submissionId,
          conversationId,
        }),
      }),
      invalidatesTags: (_result, _error, { assignmentId }) => [
        { type: 'Queue', id: assignmentId },
      ],
    }),

    // POST - Dispute
    dispute: build.mutation<DisputeResponse, DisputePayload>({
      query: ({ assignmentId, submissionId, conversationId }) => ({
        url: `/queues/${assignmentId}/dispute`,
        method: 'POST',
        body: toFormData({
          submissionId,
          conversationId,
        }),
      }),
      invalidatesTags: (_result, _error, { assignmentId }) => [
        { type: 'Queue', id: assignmentId },
      ],
    }),

    // POST - Approval Chat (message/approve/reject)
    approvalChat: build.mutation<ApprovalChatResponse, ApprovalChatPayload>({
      query: ({ assignmentId, submissionId, action, text, comment }) => {
        const formData = toFormData({
          submissionId,
          action,
        });
        
        if (action === 'message' && text) {
          formData.append('actionData[text]', text);
        }
        
        if ((action === 'approve' || action === 'reject') && comment) {
          formData.append('actionData[comment]', comment);
        }
        
        return {
          url: `/queues/${assignmentId}/approvalchat`,
          method: 'POST',
          body: formData,
        };
      },
      // Don't invalidate tags - polling will handle updates
      // This prevents immediate refetch after sending messages
      // invalidatesTags: (_result, _error, { assignmentId }) => [
      //   { type: 'Queue', id: assignmentId },
      // ],
    }),

    // GET - Get Approval Chat Messages
    getApprovalChatMessages: build.query<
      GetApprovalChatMessagesResponse,
      GetApprovalChatMessagesPayload
    >({
      query: ({ assignmentId, submissionId }) => ({
        url: `/queues/${assignmentId}/approvalchatmessages`,
        method: 'GET',
        params: { submissionId },
      }),
      // Use specific tag for approval chat messages to avoid conflicts
      providesTags: (_result, _error, { assignmentId, submissionId }) => [
        { type: 'Queue', id: `approval-chat-${assignmentId}-${submissionId}` },
      ],
    }),

    // POST - Dispute Chat (message/dispute/signature/omit-signature-request/omit-signature-request-approve/omit-signature-request-reject)
    disputeChat: build.mutation<DisputeChatResponse, DisputeChatPayload>({
      query: ({ assignmentId, submissionId, action, text, comment, file }) => {
        const formData = toFormData({
          submissionId,
          action,
        });
        
        if (action === 'message' && text) {
          formData.append('actionData[text]', text);
        }
        
        if (action === 'dispute' || action === 'omit-signature-request' || action === 'omit-signature-request-approve' || action === 'omit-signature-request-reject') {
          // Always append comment for these actions, even if empty
          formData.append('actionData[comment]', comment || '');
        }
        
        if (action === 'signature' && file) {
          formData.append('actionData[file]', file);
        }
        
        return {
          url: `/queues/${assignmentId}/disputechat`,
          method: 'POST',
          body: formData,
        };
      },
      // Don't invalidate tags - polling will handle updates
    }),

    // GET - Get Dispute Chat Messages
    getDisputeChatMessages: build.query<
      GetDisputeChatMessagesResponse,
      GetDisputeChatMessagesPayload
    >({
      query: ({ assignmentId, submissionId }) => ({
        url: `/queues/${assignmentId}/disputechatmessages`,
        method: 'GET',
        params: { submissionId },
      }),
      // Use specific tag for dispute chat messages to avoid conflicts
      providesTags: (_result, _error, { assignmentId, submissionId }) => [
        { type: 'Queue', id: `dispute-chat-${assignmentId}-${submissionId}` },
      ],
    }),

    // GET - Get Unified Chat Messages (combines approval, dispute, and question-approval messages)
    getUnifiedChatMessages: build.query<
      GetUnifiedChatMessagesResponse,
      GetUnifiedChatMessagesPayload
    >({
      query: ({ assignmentId, submissionId, questionName }) => ({
        url: `/queues/${assignmentId}/unifiedchatmessages`,
        method: 'GET',
        params: { 
          submissionId,
          ...(questionName && { questionName }),
        },
      }),
      // Use specific tag for unified chat messages
      providesTags: (_result, _error, { assignmentId, submissionId, questionName }) => [
        { type: 'Queue', id: `unified-chat-${assignmentId}-${submissionId}${questionName ? `-${questionName}` : ''}` },
      ],
    }),

    // POST - Question Approval Chat (request/approve/reject for specific questions)
    questionApprovalChat: build.mutation<QuestionApprovalChatResponse, QuestionApprovalChatPayload>({
      query: ({ assignmentId, submissionId, questionName, questionNumber, action, comment }) => {
        const formData = toFormData({
          submissionId,
          questionName,
          questionNumber: String(questionNumber),
          action,
        });
        
        if (comment) {
          formData.append('actionData[comment]', comment);
        }
        
        return {
          url: `/queues/${assignmentId}/questionapprovalchat`,
          method: 'POST',
          body: formData,
        };
      },
      // Don't invalidate tags - polling will handle updates
    }),

    // POST - Get Question Conversation
    getQuestionConversation: build.mutation<GetQuestionConversationResponse, GetQuestionConversationPayload>({
      query: ({ assignmentId, questionKey, subjects, questionConversationId, meta }) => {
        const formData = toFormData({
          questionKey,
          action: 'get',
          meta,
        });

        // Add subjects array
        subjects.forEach((subjectId, index) => {
          formData.append(`subjects[${index}]`, subjectId);
        });
        
        // Add optional questionConversationId
        if (questionConversationId) {
          formData.append('questionConversationId', questionConversationId);
        }
        
        // Add optional meta object with group/ungrouped subject details
        // if (meta) {
        //   if (meta.type) {
        //     formData.append('meta[type]', meta.type);
        //   }
        //   if (meta.subjectId) {
        //     formData.append('meta[subjectId]', meta.subjectId);
        //   }
        //   if (meta.subjectName) {
        //     formData.append('meta[subjectName]', meta.subjectName);
        //   }
        //   if (meta.groupId) {
        //     formData.append('meta[groupId]', meta.groupId);
        //   }
        //   if (meta.groupName) {
        //     formData.append('meta[groupName]', meta.groupName);
        //   }
        // }
        
        return {
          url: `/queues/${assignmentId}/msgchat`,
          method: 'POST',
          body: formData,
        };
      },
    }),

    // POST - Send Question Chat (message, approval:request, approval:approve, approval:reject)
    sendQuestionChat: build.mutation<SendQuestionChatResponse, SendQuestionChatPayload>({
      query: ({ assignmentId, questionKey, subjects, action, actionData, meta, questionConversationId }) => {
        // Create object structure matching the Joi schema
        const payload: Record<string, any> = {
          questionKey: questionKey.trim(),
          subjects,
          action,
          questionConversationId,
        };
        
        // Add actionData based on action type
        if (action === 'message') {
          // For 'message' action: actionData.text is required
          if (actionData?.text) {
            payload.actionData = {
              text: actionData.text,
            };
          }
        } else {
          // For other actions ('approval:approve', 'approval:reject', 'approval:request'): actionData.comment is optional
          if (actionData?.comment) {
            payload.actionData = {
              comment: actionData.comment,
            };
          }
        }
        
        // Add meta object if provided (optional) - questionData is stored in meta
        if (meta) {
          payload.meta = meta;
        }
        
        return {
          url: `/queues/${assignmentId}/questionchat`,
          method: 'POST',
          body: toFormData(payload),
        };
      },
    }),

    // POST - Quick Submit
    quickSubmit: build.mutation<QuickSubmitResponse, QuickSubmitPayload>({
      query: (payload) => {
        // const formData = toFormData({
        //   timezone: payload.timezone,
        //   formTemplateId: payload.formTemplateId,
        //   formTemplateSchemaId: payload.formTemplateSchemaId,
        //   answers: payload.answers,
        // });

        // // Add optional fields
        // if (payload.configSetId) {
        //   formData.append('configSetId', payload.configSetId);
        // }
        // if (payload.assignees && payload.assignees.length > 0) {
        //   payload.assignees.forEach((assignee, index) => {
        //     formData.append(`assignees[${index}]`, assignee);
        //   });
        // }
        // if (payload.subjects && payload.subjects.length > 0) {
        //   payload.subjects.forEach((subject, index) => {
        //     formData.append(`subjects[${index}]`, subject);
        //   });
        // }
        // if (payload.hasApproval !== undefined) {
        //   formData.append('hasApproval', String(payload.hasApproval));
        // }
        // if (payload.hasDisputes !== undefined) {
        //   formData.append('hasDisputes', String(payload.hasDisputes));
        // }
        // if (payload.signatureRequired !== undefined) {
        //   formData.append('signatureRequired', String(payload.signatureRequired));
        // }
        // if (payload.approvers && payload.approvers.length > 0) {
        //   payload.approvers.forEach((approver, index) => {
        //     formData.append(`approvers[${index}]`, approver);
        //   });
        // }
        // if (payload.approvalRule) {
        //   formData.append('approvalRule', payload.approvalRule);
        // }
        // if (payload.approvalMinCount !== undefined) {
        //   formData.append('approvalMinCount', String(payload.approvalMinCount));
        // }

        if (payload.approvalRule !== 'MIN') {
          delete payload.approvalMinCount
        }

        return {
          url: '/queues/quicksubmit',
          method: 'POST',
          body: toFormData(payload),
        };
      },
      invalidatesTags: [{ type: 'Queue', id: 'LIST' }],
    }),

    // 🟢 POST - Get Channel
    getChannel: build.mutation<GetChannelResponse, GetChannelPayload>({
      query: (params) => {
        const body: Record<string, any> = {
          channelType: params.channelType,
        };

        // Add submissionId if provided (required for 'approval' or 'dispute')
        if (params.submissionId) {
          body.submissionId = params.submissionId;
        }

        // Add assignmentId if provided (required for 'question_approval')
        if (params.assignmentId) {
          body.assignmentId = params.assignmentId;
        }

        // Add questionKey if provided (required for 'question_approval')
        if (params.questionKey) {
          body.questionKey = params.questionKey;
        }

        // Add assigneeId if provided
        if (params.assigneeId) {
          body.assigneeId = params.assigneeId;
        }

        // Add meta if provided
        if (params.meta) {
          body.meta = params.meta;
        }

        // For course_form_approval / course_form_question_approval
        if (params.courseFormSubmissionId) {
          body.courseFormSubmissionId = params.courseFormSubmissionId;
        }
        if (params.courseEnrolmentId) {
          body.courseEnrolmentId = params.courseEnrolmentId;
        }
        if (params.coursePageId) {
          body.coursePageId = params.coursePageId;
        }
        if (params.formBlockId) {
          body.formBlockId = params.formBlockId;
        }
        if (params.channelType === 'course_form_question_approval' && params.questionKey) {
          body.questionKey = params.questionKey;
        }

        return {
          url: '/queues2/channel',
          method: 'POST',
          body: toFormData(body),
        };
      },
    }),

    // 🟢 GET - Get Channel Messages
    getChannelMessages: build.query<GetChannelMessagesResponse, GetChannelMessagesPayload>({
      query: ({ channelId }) => ({
        url: '/queues2/messages',
        method: 'GET',
        params: { channelId },
      }),
      providesTags: (_result, _error, { channelId }) => [
        { type: 'Queue', id: `channel-messages-${channelId}` },
      ],
    }),

    // 🟢 GET - Get Question Approval Channels (assignment | course_form | course_form_question)
    getQuestionApprovalChannels: build.query<
      GetQuestionApprovalChannelsResponse,
      GetQuestionApprovalChannelsPayload | void
    >({
      query: (params) => {
        const queryParams: Record<string, string | number | undefined> = {};
        if (params) {
          if (params.type) queryParams.type = params.type;
          if (params.page != null) queryParams.page = params.page;
          if (params.perPage != null) queryParams.perPage = params.perPage;
          if (params.sortBy) queryParams.sortBy = params.sortBy;
          if (params.order) queryParams.order = params.order;
        }
        return {
          url: '/queues2/question-approval-channels',
          method: 'GET',
          params: Object.keys(queryParams).length ? queryParams : undefined,
        };
      },
      providesTags: (_result, _error, arg) => [
        { type: 'Queue', id: arg?.type ? `question-approval-channels-${arg.type}` : 'question-approval-channels' },
      ],
      transformResponse: (response: GetQuestionApprovalChannelsResponse) => response,
    }),
  }),
});

export const {
  useGetQueuesQuery,
  useBulkRemindMutation,
  useBulkCancelMutation,
  useBulkReassignMutation,
  useGetQueueQuery,
  useUpdateQueueMutation,
  useSubmitQueueMutation,
  useGetQueueSubmissionsQuery,
  useApproveQueueMutation,
  useGetApprovalsQuery,
  useStartConversationMutation,
  useSendChatMessageMutation,
  useGetConversationMutation,
  useSignatureMutation,
  useDisputeMutation,
  useApprovalChatMutation,
  useGetApprovalChatMessagesQuery,
  useDisputeChatMutation,
  useGetDisputeChatMessagesQuery,
  useGetUnifiedChatMessagesQuery,
  useQuestionApprovalChatMutation,
  useGetQuestionConversationMutation,
  useSendQuestionChatMutation,
  useQuickSubmitMutation,
  useGetChannelMutation,
  useGetChannelMessagesQuery,
  useGetQuestionApprovalChannelsQuery,
  useGetActivityQuery,
  useMarkActivityReadMutation,
} = queueApi;
