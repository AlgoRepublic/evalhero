/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useEffect, useState } from 'react';
import { Empty, Typography, Spin } from 'antd';
import { DisputeChat } from '../DisputeChat';
import { usePermission } from '../../../../hooks/usePermission';
import { useGetChannelMutation } from '../../../../services/queueApi';

const { Text } = Typography;

interface DisputesSignatureStepProps {
  submission: any;
  assignmentId: string;
  user: any;
  isActive?: boolean;
  assignment?: any;
  showChatActions?: boolean;
}

export const DisputesSignatureStep: React.FC<DisputesSignatureStepProps> = ({
  submission,
  assignmentId,
  user,
  isActive = true,
  assignment,
  // showChatActions = true,
}) => {
  // Check permissions
  const isSubject = usePermission('profile::issubject');
  const isAssignee = usePermission('profile::isassignee');
  const isApprover = usePermission('profile::isapprover');
  const isOmitSignatureApprover = usePermission('profile::isomitsignatureapprover');

  // Check if user has at least one of the required permissions
  const hasAccess = isSubject || isAssignee || isApprover || isOmitSignatureApprover;

  const { omitSignatureAllowed, hasDisputes, signatureRequired } = assignment;

  // Fetch channel data for dispute - only when step is active
  const [getChannel, { data: channelResponse, isLoading: isLoadingChannel, error: channelError }] = useGetChannelMutation();
  const [channelId, setChannelId] = useState<string | null>(null);

  // Memoize channel request parameters
  const channelRequestParams = useMemo(() => {
    if (!submission?._id || (!hasDisputes && !signatureRequired && !omitSignatureAllowed) || !isActive) {
      return null;
    }
    return {
      channelType: 'dispute' as const,
      submissionId: submission._id,
    };
  }, [submission?._id, hasDisputes, signatureRequired, omitSignatureAllowed, isActive]);

  // Trigger channel fetch when params are ready
  useEffect(() => {
    if (channelRequestParams) {
      getChannel(channelRequestParams).then((result) => {
        if ('data' in result && result.data?.data?._id) {
          setChannelId(result.data.data._id);
        }
      }).catch((error) => {
        console.error('[DisputesSignatureStep] Failed to get channel:', error);
      });
    }
  }, [channelRequestParams, getChannel]);

  // Update channelId when channelResponse changes
  useEffect(() => {
    if (channelResponse?.data?._id) {
      setChannelId(channelResponse.data._id);
    }
  }, [channelResponse?.data?._id]);

  if (!omitSignatureAllowed && !hasDisputes && !signatureRequired) {
    return (
      <Empty
        description={
          <Text type="secondary">
            Disputes and signature features are not enabled for this submission
          </Text>
        }
      />
    );
  }

  if (!user || !submission?._id) {
    return <Empty description={<Text type="secondary">User information not available</Text>} />;
  }

  if (!hasAccess) {
    return (
      <Empty
        description={
          <Text type="secondary">
            You do not have permission to view disputes/signature. You need to be a subject, assignee, approver, or omit signature approver.
          </Text>
        }
      />
    );
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
    <DisputeChat
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
      disputeChannelId={channelId}
      omitSignatureAllowed={omitSignatureAllowed}
      signatureRequired={signatureRequired}
      submissionStatus={submission?.status}
    />
  );
};

