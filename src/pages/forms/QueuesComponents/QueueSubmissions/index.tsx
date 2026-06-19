import React from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Select,
  Space,
  Spin,
  Typography,
  theme,
  Tooltip,
  Steps,
  Affix,
  message,
  Checkbox,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  MessageOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useGetQueueSubmissionsQuery, useGetChannelMutation, queueApi } from '../../../../services/queueApi';
import type { ChannelMessage } from '../../../../services/queueApi';
import { useSelector } from 'react-redux';
import { downloadSubmissionPDF, type SubmissionPdfExportInput } from '../../../../utils/submissionPdfExport';
import { RootState, store } from '../../../../store';
import { SubmissionSummaryStep } from './SubmissionSummaryStep';
import { ApprovalsStep } from './ApprovalsStep';
import { DisputesSignatureStep } from './DisputesSignatureStep';
import { SubmissionsTableCard } from './SubmissionsTableCard';
import { Assignment } from '../../../../services/assignmentsApi';
import { Profile, User } from '../../../../features/auth/authSlice';

const { Text } = Typography;

interface QueueSubmissionsComponentProps {
  queueId: string;
  subjectOptions: Array<{ label: string; value: string }>;
  assignment: Assignment; // Assignment data with subjects, assignees, approvers, omitSignatureApprovers
  selectedAssigneeId?: string;
  onAssigneeChange?: (assigneeId: string) => void;
  assignees?: Profile[];
}

export const QueueSubmissionsComponent: React.FC<QueueSubmissionsComponentProps> = ({
  queueId,
  subjectOptions,
  assignment,
  selectedAssigneeId,
  onAssigneeChange,
  assignees = [],
}) => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const subjectId = searchParams.get('subjectId');
  const stepParam = searchParams.get('step');
  const { user } = useSelector((state: RootState) => state.auth);
  const [getChannel] = useGetChannelMutation();
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);
  const [includeDisputeMessagingInPdf, setIncludeDisputeMessagingInPdf] = React.useState(true);

  // When only one subject option (e.g. subject-only user), default subjectId to that option
  React.useEffect(() => {
    if (subjectOptions.length !== 1 || !selectedAssigneeId) return;
    const onlySubjectId = subjectOptions[0].value;
    if (subjectId !== onlySubjectId) {
      const next = new URLSearchParams(searchParams);
      next.set('subjectId', onlySubjectId);
      setSearchParams(next, { replace: true });
    }
  }, [subjectOptions, subjectId, selectedAssigneeId, searchParams, setSearchParams]);

  // Update step in query params
  const handleStepChange = React.useCallback((step: number) => {
    const next = new URLSearchParams(searchParams);
    if (step === 0) {
      next.delete('step');
    } else {
      next.set('step', step.toString());
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const {
    data: submissionsData,
    isFetching: submissionsLoading,
    error: submissionsError,
    refetch: refetchSubmissions,
  } = useGetQueueSubmissionsQuery(
    {
      assignmentId: queueId,
      subjectId: subjectId || undefined,
      assigneeId: selectedAssigneeId,
      perPage: 10000,
      page: 1,
      sortBy: 'updatedAt',
      order: 'desc',
    },
    { 
      skip: !queueId || !subjectId || !selectedAssigneeId,
      // Always refetch to get fresh data (effectively disables cache)
      refetchOnMountOrArgChange: true,
    }
  );

  const records = submissionsData?.data?.submissions?.records || [];
  const submission = records[0];

  const handleDownloadPdf = React.useCallback(async () => {
    if (!submission?._id) return;
    setIsDownloadingPdf(true);
    try {
      let approvalMessages: Array<{ action: string; comment?: string; text?: string; sentBy?: { user?: { name?: string } }; createdAt?: string }> = [];
      let disputeMessages: Array<{ action: string; text?: string; comment?: string; signature?: { dataUrl?: string }; sentBy?: { user?: { name?: string } }; createdAt?: string }> = [];

      const approvalChan = await getChannel({ submissionId: submission._id, channelType: 'approval' }).unwrap();
      const approvalChannelId = (approvalChan as { data?: { _id?: string } })?.data?._id;
      if (approvalChannelId) {
        const msgRes = await store.dispatch(
          queueApi.endpoints.getChannelMessages.initiate({ channelId: approvalChannelId })
        );
        const recordsList = (msgRes as { data?: { data?: { records?: ChannelMessage[] } } })?.data?.data?.records ?? [];
        approvalMessages = recordsList.map((msg: ChannelMessage) => ({
          action: msg.action ?? '',
          comment: msg.actionData?.comment ?? msg.actionData?.text,
          text: msg.actionData?.text,
          sentBy: msg.sentBy,
          createdAt: msg.createdAt,
        }));
      }

      const disputeChan = await getChannel({ submissionId: submission._id, channelType: 'dispute' }).unwrap();
      const disputeChannelId = (disputeChan as { data?: { _id?: string } })?.data?._id;
      if (disputeChannelId) {
        const msgRes = await store.dispatch(
          queueApi.endpoints.getChannelMessages.initiate({ channelId: disputeChannelId })
        );
        const recordsList = (msgRes as { data?: { data?: { records?: ChannelMessage[] } } })?.data?.data?.records ?? [];
        const apiBase = import.meta.env.VITE_API_URL ?? '';
        disputeMessages = recordsList.map((msg: ChannelMessage) => {
          const action = msg.action ?? '';
          let dataUrl: string | undefined;
          const fileData = msg.actionData?.file;
          if ((action === 'signature' || action === 'submission:signature') && fileData) {
            if (typeof fileData === 'string') {
              dataUrl = fileData.startsWith('http') ? fileData : fileData.startsWith('/') ? `${apiBase}${fileData}` : `${apiBase}/${fileData}`;
            } else {
              dataUrl = (fileData as { url?: string }).url;
            }
          }
          return {
            action,
            text: msg.actionData?.text,
            comment: msg.actionData?.comment ?? msg.actionData?.text,
            signature: dataUrl ? { dataUrl } : undefined,
            sentBy: msg.sentBy,
            createdAt: msg.createdAt,
          };
        });
      }

      let preApproval: { preApproved?: boolean; preApprovalComment?: string } | undefined;
      const submitMeta = assignment?.submitMeta as {
        preApprovalByAssignee?: Record<string, {
          preApprovalByQuestion?: Record<string, {
            globalGroups?: Array<{ subjectIds?: string[]; preApproved?: boolean; preApprovalComment?: string }>;
            ungroupedSubjects?: Array<{ preApproved?: boolean; preApprovalComment?: string }>;
          }>;
        }>;
      } | undefined;
      if (subjectId && selectedAssigneeId && submitMeta?.preApprovalByAssignee?.[selectedAssigneeId]) {
        const byQ = submitMeta.preApprovalByAssignee[selectedAssigneeId].preApprovalByQuestion;
        if (byQ) {
          for (const q of Object.values(byQ)) {
            for (const g of q?.globalGroups ?? []) {
              if (g.subjectIds?.includes(subjectId) && g.preApproved) {
                preApproval = { preApproved: true, preApprovalComment: g.preApprovalComment };
                break;
              }
            }
            for (const u of q?.ungroupedSubjects ?? []) {
              if (u.preApproved) {
                preApproval = { preApproved: true, preApprovalComment: u.preApprovalComment };
                break;
              }
            }
            if (preApproval) break;
          }
        }
      }

      const templateName =
        assignment?.formTemplate && typeof assignment.formTemplate === 'object' && 'name' in assignment.formTemplate
          ? (assignment.formTemplate as { name?: string }).name
          : undefined;
      await downloadSubmissionPDF(
        {
          submission: submission as SubmissionPdfExportInput['submission'],
          assignment: assignment as unknown as SubmissionPdfExportInput['assignment'],
          approvalMessages,
          disputeMessages,
          preApproval,
          subjectId: subjectId ?? undefined,
          assigneeId: selectedAssigneeId,
          templateName,
          includeDisputeMessaging: includeDisputeMessagingInPdf,
          logoUrl: '/logo-no-background.png',
        },
        undefined
      );
      message.success('PDF downloaded');
    } catch (e) {
      console.error('Download PDF failed:', e);
      message.error('Failed to download PDF. Please try again.');
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [submission, assignment, subjectId, selectedAssigneeId, getChannel, includeDisputeMessagingInPdf]);

  const { stages = [] } = assignment;
  const submissionStatus = submission?.status;
  const isSubmissionCompleted = submissionStatus === "complete";
  
  // Status order for comparison (lower index = earlier in sequence)
  const statusOrder: Record<string, number> = {
    'submission_not_started': 0,
    'submission_in_progress': 1,
    'submission_completed': 2,
    'approval_in_progress': 3,
    'approval_completed': 4,
    'dispute_in_progress': 5,
    'dispute_completed': 6,
    'complete': 7,
  };
  
  // Helper function to compare statuses
  const isStatusAtOrAfter = (currentStatus: string | undefined, targetStatus: string): boolean => {
    if (!currentStatus) return false;
    const currentOrder = statusOrder[currentStatus] ?? -1;
    const targetOrder = statusOrder[targetStatus] ?? -1;
    return currentOrder >= targetOrder;
  };
  
  // Determine which steps should be shown based on assignment.stages
  const showApprovalStep = stages.includes('approval_in_progress');
  const showDisputeStep = stages.includes('dispute_in_progress');
  
  // Determine if steps should be disabled based on submission.status sequence
  // Approval step enabled when status is "submission_completed" or above
  const isApprovalStepDisabled = !isStatusAtOrAfter(submissionStatus, 'submission_completed');
  // Dispute step enabled when status is "approval_completed" or above
  const isDisputeStepDisabled = !isStatusAtOrAfter(submissionStatus, 'approval_completed');
  
  // Determine if chat/actions should be shown in steps
  const showApprovalChatActions = submissionStatus === 'approval_in_progress';
  const showDisputeChatActions = submissionStatus === 'dispute_in_progress';
  
  // Build steps array dynamically
  const stepItems = React.useMemo(() => {
    const items: Array<{
      title: string;
      icon: React.ReactNode;
      key: string;
      disabled?: boolean;
    }> = [
      {
        title: 'Submission Summary',
        icon: <FileTextOutlined />,
        key: 'summary',
      },
    ];
    
    if (showApprovalStep) {
      items.push({
        title: 'Approvals',
        icon: <CheckCircleOutlined />,
        key: 'approvals',
        disabled: isApprovalStepDisabled,
      });
    }
    
    if (showDisputeStep) {
      items.push({
        title: 'Disputes/Signature',
        icon: <MessageOutlined />,
        key: 'disputes',
        disabled: isDisputeStepDisabled,
      });
    }
    
    return items;
  }, [showApprovalStep, showDisputeStep, isApprovalStepDisabled, isDisputeStepDisabled]);
  
  // Map step index to step key
  const getStepKey = (index: number) => stepItems[index]?.key;
  
  // Get step index by key
  const getStepIndex = (key: string) => stepItems.findIndex(item => item.key === key);
  
  // Update currentStep validation to use dynamic step count
  const validatedCurrentStep = React.useMemo(() => {
    const step = stepParam ? parseInt(stepParam, 10) : 0;
    if (isNaN(step) || step < 0) return 0;
    const maxStep = stepItems.length - 1;
    if (step > maxStep) return maxStep;
    return step;
  }, [stepParam, stepItems.length]);
  
  // Use validated current step
  const currentStep = validatedCurrentStep;
  
  // Reset step to 0 when there's no submission
  React.useEffect(() => {
    if (!submission && stepParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('step');
      setSearchParams(next, { replace: true });
    }
  }, [submission, stepParam, searchParams, setSearchParams]);

  return (
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>

      <Col span={24}>
        <SubmissionsTableCard
          queueId={queueId}
          assignment={assignment}
        />
      </Col>

      <Col span={24}>
        <Card
          style={{
            borderRadius: 12,
            boxShadow: token.boxShadowSecondary,
            background: token.colorBgContainer,
          }}
          styles={{ body: { padding: 16 } }}
        >
          <Flex align='center' justify='space-between' wrap style={{ width: '100%', gap: 12 }}>
            <Space size={10} align="center" wrap>
            <ArrowLeftOutlined onClick={() => navigate(`/forms/queues/${queueId}/submit`)} />
              {assignees && assignees.length > 0 && (
                <>
                  <Text type="secondary">Assignee:</Text>
                  <Select
                    showSearch
                    size="middle"
                    placeholder="Select assignee"
                    style={{ minWidth: 200 }}
                    value={selectedAssigneeId}
                    onChange={(value) => {
                      if (onAssigneeChange) {
                        onAssigneeChange(value);
                        // Clear subject when assignee changes
                        const next = new URLSearchParams(searchParams);
                        next.set('assigneeId', value);
                        next.delete('subjectId');
                        next.delete('step');
                        setSearchParams(next, { replace: true });
                      }
                    }}
                    filterOption={(input, option) => {
                      const label = typeof option?.label === 'string' 
                        ? option.label 
                        : typeof option?.children === 'string' 
                        ? option.children 
                        : '';
                      return label.toLowerCase().includes(input.toLowerCase());
                    }}
                  >
                    {assignees.map((assignee: Profile) => {
                      const userName = typeof assignee.user === 'object' && assignee.user ? (assignee.user as User).name : undefined;
                      const userEmail = typeof assignee.user === 'object' && assignee.user ? (assignee.user as User).email : undefined;
                      const displayName = userName || userEmail || assignee._id;
                      return (
                        <Select.Option key={assignee._id} value={assignee._id}>
                          {displayName}
                        </Select.Option>
                      );
                    })}
                  </Select>
                </>
              )}
              <Text type="secondary">Subject:</Text>
              <Select
                allowClear
                showSearch
                size="middle"
                placeholder="Select subject"
                style={{ minWidth: 280 }}
                options={subjectOptions}
                value={subjectId || undefined}
                disabled={!selectedAssigneeId}
                filterOption={(input, option) =>
                  (option?.label as string).toLowerCase().includes(input.toLowerCase())
                }
                onChange={(val) => {
                  const next = new URLSearchParams(searchParams);
                  if (!val) {
                    next.delete('subjectId');
                    next.delete('step'); // Reset step when subject is cleared
                  } else {
                    next.set('subjectId', val);
                    next.delete('step'); // Reset step when subject changes
                  }
                  setSearchParams(next, { replace: true });
                }}
              />
            </Space>
            <Space size={8} wrap align="center">
              {isSubmissionCompleted && (
                <Checkbox
                  checked={includeDisputeMessagingInPdf}
                  onChange={(e) => setIncludeDisputeMessagingInPdf(e.target.checked)}
                >
                  <Text type="secondary" style={{ fontSize: 12 }}>Include dispute messaging in PDF</Text>
                </Checkbox>
              )}
              <Tooltip title={subjectId ? 'Refresh submissions' : 'Select a subject first'}>
                <Button
                  variant='solid'
                  color='green'
                  icon={<ReloadOutlined />}
                  onClick={() => refetchSubmissions()}
                  loading={submissionsLoading}
                  disabled={!subjectId}
                >
                  Refresh
                </Button>
              </Tooltip>
              {isSubmissionCompleted && (
                <Tooltip title={submission ? 'Download this submission as PDF' : 'Select a subject with a submission first'}>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadPdf}
                    loading={isDownloadingPdf}
                    disabled={!submission || isDownloadingPdf}
                  >
                    Download PDF
                  </Button>
                </Tooltip>
              )}
            </Space>
          </Flex>
        </Card>
      </Col>

      <Col span={24}>
        <Card
          style={{
            borderRadius: 12,
            boxShadow: token.boxShadowSecondary,
            background: token.colorBgContainer,
          }}
        >
          {!subjectId ? (
            <Empty description="Select a subject to view submissions" />
          ) : submissionsLoading ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Spin tip="Loading submissions..." />
            </div>
          ) : submissionsError ? (
            <Alert
              type="error"
              message="Failed to load submissions"
              action={<Button onClick={() => refetchSubmissions()}>Retry</Button>}
            />
          ) : !submission ? (
            <Empty description="No submission found" />
          ) : (
            <div>
              {/* Stepper */}
              <Affix offsetTop={65}>
                <Card
                  style={{
                    borderRadius: 12,
                    boxShadow: token.boxShadowSecondary,
                    background: token.colorBgContainer,
                    marginBottom: 16,
                    zIndex: 10,
                  }}
                  styles={{ body: { padding: '12px 24px' } }}
                >
                  <Steps
                    current={currentStep}
                    onChange={handleStepChange}
                    items={stepItems}
                  />
                </Card>
              </Affix>

              {/* Step Content */}
              <Card
                style={{
                  borderRadius: 12,
                  boxShadow: token.boxShadowSecondary,
                  background: token.colorBgContainer,
                  minHeight: 400,
                }}
              >
                {getStepKey(currentStep) === 'summary' && (
                  <SubmissionSummaryStep
                    submission={submission}
                    token={token}
                    assignment={
                      assignment
                        ? {
                            passingScore: assignment.passingScore,
                            passingPassFailCount:
                              assignment.passingPassFailCount,
                            maxPointsPossible: assignment.formTemplateSchema?.totalScore,
                            totalPassFail: assignment.formTemplateSchema?.totalPassFail,
                          }
                        : undefined
                    }
                  />
                )}
                {getStepKey(currentStep) === 'approvals' && (
                  <ApprovalsStep
                    submission={submission}
                    assignmentId={queueId}
                    isActive={currentStep === getStepIndex('approvals')}
                    user={user}
                    assignment={assignment}
                    showChatActions={showApprovalChatActions}
                    refetchSubmissions={refetchSubmissions}
                  />
                )}
                {getStepKey(currentStep) === 'disputes' && (
                  <DisputesSignatureStep
                    submission={submission}
                    assignmentId={queueId}
                    user={user}
                    isActive={currentStep === getStepIndex('disputes')}
                    assignment={assignment}
                    showChatActions={showDisputeChatActions}
                  />
                )}
              </Card>
            </div>
          )}
        </Card>
      </Col>
    </Row>
  );
};

