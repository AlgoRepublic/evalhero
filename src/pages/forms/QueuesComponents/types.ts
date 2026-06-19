import { Assignment } from "../../../services/assignmentsApi";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string; // Avatar URL for the sender
  timestamp: Date;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  actionType?: 
    | 'approval'
    | 'approval-request'
    | 'approval-rejected'
    | 'dispute' 
    | 'signature' 
    | 'omit-signature-request' 
    | 'omit-signature-request-approve' 
    | 'omit-signature-request-reject'
    | 'question-approval-request'   // New: Request approval for a question
    | 'question-approval-approved'  // New: Question approved
    | 'question-approval-rejected'; // New: Question rejected
  approvalStatus?: 'approved' | 'rejected'; // Distinguishes approve from reject for approval actionType
  questionContext?: {
    questionId: string;
    questionName: string;
    questionType: string;
  };
  signature?: {
    dataUrl: string;
    signerName?: string;
    timestamp: Date;
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
}

export interface SubmissionChatProps {
  submissionId: string;
  assignmentId: string;
  currentUserId: string;
  currentUserName: string;
  otherUserId: string;
  otherUserName: string;
  hasApproval?: boolean;
  hasDisputes?: boolean;
  omitSignatureAllowed?: boolean;
  signatureRequired?: boolean;
  formName?: string;
  submissionTitle?: string;
  approvers?: { id: string; name: string }[];
  approvalRule?: 'ALL' | 'ANY' | 'MIN';
  approvalMinCount?: number;
  isActive?: boolean;
  submission?: any;
  assignment: Assignment;
  questionContext?: {
    questionId: string;
    questionName: string;
  };
  approvalChannelId?: string | null; // Channel ID for approval Socket.IO channel
  disputeChannelId?: string | null; // Channel ID for dispute Socket.IO channel
}

