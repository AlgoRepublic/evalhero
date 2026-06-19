/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useEffect, useState } from 'react';
import { Empty, Typography, Spin } from 'antd';
import { ApprovalChat } from '../ApprovalChat';
import { Assignment } from '../../../../services/assignmentsApi';
import { useGetChannelMutation } from '../../../../services/queueApi';

const { Text } = Typography;

interface ApprovalsStepProps {
  submission: any;
  assignmentId: string;
  isActive?: boolean;
  user: any;
  assignment: Assignment;
  showChatActions?: boolean;
  refetchSubmissions?: () => void;
}

export const ApprovalsStep: React.FC<ApprovalsStepProps> = ({
  submission,
  assignmentId,
  isActive = false,
  user,
  assignment,
  showChatActions = true,
  refetchSubmissions,
}) => {
  // Check permissions
  const { hasApproval } = assignment;

  // Fetch channel data for approval - only when step is active
  const [getChannel, { data: channelResponse, isLoading: isLoadingChannel, error: channelError }] = useGetChannelMutation();
  const [channelId, setChannelId] = useState<string | null>(null);

  // Memoize channel request parameters
  const channelRequestParams = useMemo(() => {
    if (!submission?._id || !hasApproval || !isActive) {
      return null;
    }
    return {
      channelType: 'approval' as const,
      submissionId: submission._id,
    };
  }, [submission?._id, hasApproval, isActive, showChatActions]);

  // Refetch channel function
  const refetchChannel = React.useCallback(async () => {
    if (channelRequestParams) {
      try {
        const result = await getChannel(channelRequestParams);
        if ('data' in result && result.data?.data?._id) {
          setChannelId(result.data.data._id);
        }
      } catch (error) {
        console.error('[ApprovalsStep] Failed to refetch channel:', error);
      }
    }
  }, [channelRequestParams, getChannel]);

  // Trigger channel fetch when params are ready
  useEffect(() => {
    if (channelRequestParams) {
      getChannel(channelRequestParams).then((result) => {
        if ('data' in result && result.data?.data?._id) {
          setChannelId(result.data.data._id);
        }
      }).catch((error) => {
        console.error('[ApprovalsStep] Failed to get channel:', error);
      });
    }
  }, [channelRequestParams, getChannel]);

  // Update channelId when channelResponse changes
  useEffect(() => {
    if (channelResponse?.data?._id) {
      setChannelId(channelResponse.data._id);
    }
  }, [channelResponse?.data?._id]);

  if (!hasApproval) {
    return (
      <Empty
        description={
          <Text type="secondary">Approvals are not enabled for this submission</Text>
        }
      />
    );
  }

  if (!user || !submission?._id) {
    return <Empty description={<Text type="secondary">User information not available</Text>} />;
  }

  if (isLoadingChannel) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (channelError) {
    return (
      <Empty
        description={
          <Text type="danger">
            Failed to load channel data. Please try again later.
          </Text>
        }
      />
    );
  }

  return (
    <ApprovalChat
      submissionId={submission._id}
      assignmentId={assignmentId}
      currentUserId={user._id}
      currentUserName={user.name || user.email || user.phone}
      otherUserName={
        submission?.subject?.user?.name ||
        submission?.assignee?.user?.name ||
        submission?.subject?.user?.email ||
        submission?.assignee?.user?.email ||
        'Other User'
      }
      isActive={isActive}
      assignment={assignment}
      approvalChannelId={channelId}
      approvalStatus={(channelResponse?.data?.approvalStatus as 'pending' | 'requested' | 'approved' | 'rejected') ?? 'pending'}
      refetchSubmissions={refetchSubmissions}
      refetchChannel={refetchChannel}
    />
  );
};

