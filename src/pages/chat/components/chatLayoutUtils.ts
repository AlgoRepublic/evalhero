/**
 * Shared types and pure helpers for ChatLayout.
 * Keeps URL/channel typing and API response handling consistent for both chat types.
 * Separates question_approval (form/assignment) from course_form_question_approval (course inline form).
 */

import type { Channel } from '../types';
import type {
  ChannelData,
  QuestionApprovalChannelRecord,
  CourseFormApprovalChannelRecord,
} from '../../../services/queueApi';
import type { ChatType } from './ChannelList';
import { SOCKET_EVENTS } from '../../../services/socketEvents';

// ---------------------------------------------------------------------------
// Approval tab types (question_approval vs course_form_question_approval)
// ---------------------------------------------------------------------------

/** Form/assignment question approval (form approvals tab) */
export const QUESTION_APPROVAL_TYPE = 'question_approval' as const;

/** Course inline form question approval (course approvals tab) */
export const COURSE_FORM_QUESTION_APPROVAL_TYPE = 'course_form_question_approval' as const;

export type ApprovalTabType = typeof QUESTION_APPROVAL_TYPE | typeof COURSE_FORM_QUESTION_APPROVAL_TYPE;

export function isQuestionApprovalTab(type: ChatType): type is typeof QUESTION_APPROVAL_TYPE {
  return type === QUESTION_APPROVAL_TYPE;
}

export function isCourseFormQuestionApprovalTab(type: ChatType): type is typeof COURSE_FORM_QUESTION_APPROVAL_TYPE {
  return type === COURSE_FORM_QUESTION_APPROVAL_TYPE;
}

/** Socket event name for MESSAGE_SENT for the given approval tab (for refetch listeners) */
export function getSocketMessageSentEventForApprovalTab(type: ApprovalTabType): string {
  return type === COURSE_FORM_QUESTION_APPROVAL_TYPE
    ? SOCKET_EVENTS.COURSE_FORM_QUESTION_APPROVAL.MESSAGE_SENT
    : SOCKET_EVENTS.QUESTION_APPROVAL.MESSAGE_SENT;
}

/** Menu items for approval tabs (Form Approvals / Course Approvals) – single source of truth for keys and labels */
export const APPROVAL_TAB_ITEMS: { key: ApprovalTabType; label: string }[] = [
  // { key: QUESTION_APPROVAL_TYPE, label: 'Form Approvals' },
  // Course Approvals moved to Courses tab – uncomment below to show in Chat again
  // { key: COURSE_FORM_QUESTION_APPROVAL_TYPE, label: 'Course Approvals' },
];

// ---------------------------------------------------------------------------
// URL params (used by getUrlParams / updateUrlParams)
// ---------------------------------------------------------------------------

export interface UrlParams {
  type: ChatType;
  channel: string | null;
  thread: string | null;
  /** DM channel ID when viewing a direct message conversation */
  dmChannel: string | null;
}

export type UrlParamsUpdate = Partial<UrlParams>;

// ---------------------------------------------------------------------------
// Approval records (API returns records per type: question_approval or course_form_question_approval)
// ---------------------------------------------------------------------------

export type ApprovalRecord = QuestionApprovalChannelRecord | CourseFormApprovalChannelRecord;

// ---------------------------------------------------------------------------
// Channel ID (Channel uses `id`, ChannelData uses `_id`)
// ---------------------------------------------------------------------------

export type ChannelLike = Channel | ChannelData;

export function getChannelId(channel: ChannelLike): string {
  return 'id' in channel ? channel.id : channel._id;
}

export function matchChannelById(targetId: string) {
  const id = String(targetId);
  return (c: { _id?: string; id?: string }): boolean =>
    (c._id != null && String(c._id) === id) || (c.id != null && String(c.id) === id);
}

// ---------------------------------------------------------------------------
// Socket refetch delays (centralized for consistency)
// ---------------------------------------------------------------------------

export const SOCKET_REFETCH_DELAY_MS = 500;
export const SOCKET_REFETCH_ACTION_DELAY_MS = 1000;
export const SOCKET_REFETCH_ACTION_FOLLOW_UP_MS = 1500;

/** Payload shape for MESSAGE_SENT socket events (action can indicate non-message events) */
export interface SocketMessageSentPayload {
  action?: string;
  [key: string]: unknown;
}
