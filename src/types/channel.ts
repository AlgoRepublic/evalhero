/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Channel Type Definitions
 * Based on Mongoose Channel Schema
 */

export type ChannelType =
  | 'course'
  | 'group_dm'
  | 'dm'
  | 'approval'
  | 'dispute'
  | 'question_approval';

// Shared types (also used in Submission)
export type ApprovalStatus = 'pending' | 'requested' | 'approved' | 'rejected';
export type DisputeStatus = 'none' | 'open';

export interface Channel {
  _id: string;
  organization: string; // ObjectId reference to 'Organization'
  channelType: ChannelType;
  name?: string;
  topic?: string;
  description?: string;
  createdBy?: string; // ObjectId reference to 'Profile'
  lastActivityAt?: Date | string;
  submission?: string; // ObjectId reference to 'Submission'
  assignment?: string; // ObjectId reference to 'Assignment'
  questionKey?: string;
  assignee?: string; // ObjectId reference to 'Profile'
  subjects?: string[]; // Array of ObjectId references to 'Profile'
  approvalStatus?: ApprovalStatus;
  questionApprovalStatus?: ApprovalStatus;
  disputeStatus?: DisputeStatus;
  meta?: Record<string, any> | null; // mongoose.Schema.Types.Mixed
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Channel Document (as returned from Mongoose/MongoDB)
 * Includes MongoDB-specific fields
 */
export interface ChannelDocument extends Channel {
  __v?: number;
  deletedAt?: Date | string | null;
}

