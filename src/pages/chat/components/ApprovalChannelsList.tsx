/**
 * Dispatches to the correct approval channel list by type:
 * - question_approval → QuestionApprovalChannelsList (form/assignment)
 * - course_form_question_approval → CourseFormApprovalChannelsList (course inline form)
 */

import React from 'react';
import { Channel } from '../types';
import type { QuestionApprovalChannelRecord, CourseFormApprovalChannelRecord } from '../../../services/queueApi';
import { QuestionApprovalChannelsList } from './QuestionApprovalChannelsList';
import { CourseFormApprovalChannelsList } from './CourseFormApprovalChannelsList';
import { COURSE_FORM_QUESTION_APPROVAL_TYPE } from './chatLayoutUtils';
import type { ChatType } from './ChannelList';

type ApprovalChannelRecord = QuestionApprovalChannelRecord | CourseFormApprovalChannelRecord;

export interface ApprovalChannelsListProps {
  /** question_approval (form) or course_form_question_approval (course) - determines which list and API/socket type is used */
  selectedType: ChatType;
  records: ApprovalChannelRecord[];
  onChannelSelect: (channel: Channel) => void;
  selectedChannelId?: string | null;
}

export const ApprovalChannelsList: React.FC<ApprovalChannelsListProps> = ({
  selectedType,
  records,
  onChannelSelect,
  selectedChannelId,
}) => {
  if (selectedType === COURSE_FORM_QUESTION_APPROVAL_TYPE) {
    return (
      <CourseFormApprovalChannelsList
        records={records as CourseFormApprovalChannelRecord[]}
        onChannelSelect={onChannelSelect}
        selectedChannelId={selectedChannelId}
      />
    );
  }

  // question_approval (default)
  return (
    <QuestionApprovalChannelsList
      records={records as QuestionApprovalChannelRecord[]}
      onChannelSelect={onChannelSelect}
      selectedChannelId={selectedChannelId}
    />
  );
};
