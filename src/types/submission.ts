/**
 * Submission Type Definitions
 * Based on Mongoose Submission Schema
 */

export type SubmissionStatus =
  | 'submission_not_started'
  | 'submission_in_progress'
  | 'submission_completed'
  | 'approval_in_progress'
  | 'approval_completed'
  | 'dispute_in_progress'
  | 'dispute_completed'
  | 'complete';

// Import shared types from channel.ts
import type { ApprovalStatus, DisputeStatus } from './channel';

// Re-export for convenience
export type { ApprovalStatus, DisputeStatus };

export type AnswerType = 'doc' | string;

export interface SubmissionAnswers {
  type: AnswerType;
  content: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface Submission {
  _id: string;
  organization: string; // ObjectId reference to 'Organization', required
  assignment: string; // ObjectId reference to 'Assignment', required
  assignee: string; // ObjectId reference to 'Profile', required
  subject?: string; // ObjectId reference to 'Profile'
  formTemplateSchema: string; // ObjectId reference to 'FormTemplateSchema', required
  status: SubmissionStatus;
  answers: SubmissionAnswers;
  approvalStatus: ApprovalStatus;
  approvalChannel?: string; // ObjectId reference to 'Channel'
  disputeStatus: DisputeStatus;
  disputeChannel?: string; // ObjectId reference to 'Channel'
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Submission Document (as returned from Mongoose/MongoDB)
 * Includes MongoDB-specific fields
 */
export interface SubmissionDocument extends Submission {
  __v?: number;
  deletedAt?: Date | string | null;
}

