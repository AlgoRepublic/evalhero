import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import {
  FormOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { useGetQueueQuery } from '../../services/queueApi';
import { Alert, Button, Spin, Select, Space, Affix, Typography, theme, Result, Modal } from 'antd';
import { SubmitQueueComponent } from './QueuesComponents/SubmitQueue';
import { PreApprovalManager } from './QueuesComponents/PreApprovalManager';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Profile, User } from '../../features/auth/authSlice';
import { useState, useEffect, useMemo } from 'react';

const { Text } = Typography;

/** Interaction mode when user has both assignee and questionApprover roles */
type InteractionMode = 'assignee' | 'questionApprover' | null;

const SubmitQueuePage = () => {
  const { id } = useParams<{ id: string }>();
  const selectedProfile = useSelector((state: RootState) => state.auth.selectedProfile);
  const user = useSelector((state: RootState) => state.auth.user);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | undefined>(undefined);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(null);
  const { token } = theme.useToken();

  // First call to get the list of assignees (no assigneeId – used for role resolution and pre-approval)
  const {
    data: initialData,
    isFetching: isInitialFetching,
    error: initialError,
    refetch: refetchInitial,
  } = useGetQueueQuery(
    { id: id || '' }, 
    { 
      skip: !id,
      // Refetch on mount to ensure fresh data when opening in new tab
      refetchOnMountOrArgChange: true,
      // Refetch when window regains focus
      refetchOnFocus: true,
      // Refetch on reconnect
      refetchOnReconnect: true,
    }
  );

  const initialAssignment = initialData?.data?.assignment ?? null;

  // Resolve questionApprovers (configSet or direct on assignment)
  const questionApproverIds = useMemo(() => {
    if (!initialAssignment) return [];
    const raw = initialAssignment?.questionApprovers ?? initialAssignment.questionApprovers ?? [];
    return (Array.isArray(raw) ? raw : []).map((p: string | Profile) =>
      typeof p === 'string' ? p : (p as Profile)._id
    );
  }, [initialAssignment]);

  const isInQuestionApprovers = useMemo(
    () => Boolean(selectedProfile?._id && questionApproverIds.includes(selectedProfile._id)),
    [selectedProfile?._id, questionApproverIds]
  );

  const isInAssignees = useMemo(
    () =>
      Boolean(
        initialAssignment?.assignees?.some((a: Profile) => a._id === selectedProfile?._id)
      ),
    [initialAssignment, selectedProfile?._id]
  );

  // Associated roles from initial assignment (for access when assignment not yet loaded and for needAssigneeData)
  const isInSubjectsInitial = useMemo(
    () =>
      Boolean(
        selectedProfile?._id &&
        initialAssignment?.subjects?.some((s: Profile) => s._id === selectedProfile?._id)
      ),
    [initialAssignment, selectedProfile?._id]
  );
  const isInApproversInitial = useMemo(
    () =>
      Boolean(
        selectedProfile?._id &&
        initialAssignment?.approvers?.some((approver: string | Profile) =>
          typeof approver === 'string'
            ? approver === selectedProfile?._id
            : (approver as Profile)._id === selectedProfile?._id
        )
      ),
    [initialAssignment, selectedProfile?._id]
  );
  const isAssignerInitial = useMemo(
    () => initialAssignment?.assigner?._id === selectedProfile?._id,
    [initialAssignment, selectedProfile?._id]
  );
  const isInOmitSignatureApproversInitial = useMemo(
    () =>
      Boolean(
        selectedProfile?._id &&
        initialAssignment?.omitSignatureApprovers?.includes(selectedProfile._id)
      ),
    [initialAssignment, selectedProfile?._id]
  );
  const hasAssociatedRoleForView =
    isInQuestionApprovers ||
    isInSubjectsInitial ||
    isInApproversInitial ||
    isAssignerInitial ||
    isInOmitSignatureApproversInitial;

  const submissionNotStartedForAll = useMemo(() => {
    const statuses = initialAssignment?.submissionStatus ?? [];
    if (statuses.length === 0) return true;
    return statuses.every(
      (s: { status?: string }) => s.status === 'submission_not_started'
    );
  }, [initialAssignment]);

  useEffect(() => {
    if (!initialAssignment || interactionMode !== null) return;
    if (isInQuestionApprovers && isInAssignees && submissionNotStartedForAll) return;
    if (isInAssignees) setInteractionMode('assignee');
    else if (isInQuestionApprovers) setInteractionMode('questionApprover');
  }, [initialAssignment, isInAssignees, isInQuestionApprovers, submissionNotStartedForAll, interactionMode]);

  const isAdmin = user?.isAdmin ?? false;

  // Assignees to show in the Select: super admin / associated roles see all; assignee-only sees just themselves
  const assigneesToShow = useMemo(() => {
    if (!initialAssignment?.assignees?.length) return [];
    const profileId = selectedProfile?._id;
    if (isAdmin) return initialAssignment.assignees;
    const isInApproversList =
      initialAssignment.approvers?.some((approver: string | Profile) =>
        typeof approver === 'string' ? approver === profileId : (approver as Profile)._id === profileId
      ) ?? false;
    const isInSubjectsList =
      initialAssignment.subjects?.some((s: Profile) => s._id === profileId) ?? false;
    const isAssignerProfile = initialAssignment.assigner?._id === profileId;
    const isInOmitSigList =
      (profileId && initialAssignment.omitSignatureApprovers?.includes(profileId)) ?? false;
    const isAssociatedAsNonAssignee =
      isInQuestionApprovers ||
      isInApproversList ||
      isInSubjectsList ||
      isAssignerProfile ||
      isInOmitSigList;
    if (isAssociatedAsNonAssignee) return initialAssignment.assignees;
    if (isInAssignees && profileId) {
      const me = initialAssignment.assignees.find((a: Profile) => a._id === profileId);
      return me ? [me] : initialAssignment.assignees;
    }
    return initialAssignment.assignees;
  }, [
    initialAssignment,
    isAdmin,
    isInQuestionApprovers,
    isInAssignees,
    selectedProfile?._id,
  ]);

  const needAssigneeData =
    interactionMode === 'assignee' ||
    (interactionMode === 'questionApprover' && !submissionNotStartedForAll) ||
    isAdmin ||
    hasAssociatedRoleForView;

  // Second call with assigneeId when we need assignee-specific data (form/submission)
  const {
    data,
    isFetching,
    error,
    refetch: refetchQueue,
  } = useGetQueueQuery(
    { id: id || '', assigneeId: selectedAssigneeId ?? undefined },
    {
      skip: !id || !needAssigneeData || !selectedAssigneeId,
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  useEffect(() => {
    if (!needAssigneeData || !initialAssignment?.assignees?.length) return;
    if (selectedAssigneeId) return;
    if (
      selectedProfile?._id &&
      initialAssignment.assignees.some((a: Profile) => a._id === selectedProfile._id)
    ) {
      setSelectedAssigneeId(selectedProfile._id);
    } else {
      setSelectedAssigneeId(initialAssignment.assignees[0]._id);
    }
  }, [needAssigneeData, initialAssignment, selectedProfile?._id, selectedAssigneeId]);

  // Keep selected assignee in sync when assigneesToShow is restricted (e.g. assignee-only sees just themselves)
  useEffect(() => {
    if (assigneesToShow.length === 0) return;
    const ids = assigneesToShow.map((a: Profile) => a._id);
    if (selectedAssigneeId && !ids.includes(selectedAssigneeId)) {
      setSelectedAssigneeId(assigneesToShow[0]._id);
    }
  }, [assigneesToShow, selectedAssigneeId]);

  const displayData = selectedAssigneeId ? data : null;
  const isDisplayFetching = isInitialFetching || (selectedAssigneeId ? isFetching : false);
  const displayError = initialError || (selectedAssigneeId ? error : null);
  const assignment = displayData?.success && displayData?.data ? displayData.data.assignment : null;

  // Access control – use assignment when available; grant access to questionApprovers from initial data
  const accessControl = useMemo(() => {
    const profileId = selectedProfile?._id;
    if (!profileId && !(user?.isAdmin)) return { canSubmit: false, isReadonly: false, hasAccess: false };
    if (!profileId && user?.isAdmin) {
      return {
        canSubmit: false,
        isReadonly: true,
        hasAccess: true,
      };
    }

    const hasAccessAsQuestionApprover = isInQuestionApprovers;
    if (!assignment) {
      return {
        canSubmit: false,
        isReadonly: true,
        hasAccess:
          hasAccessAsQuestionApprover ||
          (user?.isAdmin ?? false) ||
          hasAssociatedRoleForView,
      };
    }

    const isAdmin = user?.isAdmin || false;
    const assigneeSubmissionStatus = assignment.submissionStatus?.find(
      (status: { assignee: string | Profile }) => {
        const assigneeId = typeof status.assignee === 'string' ? status.assignee : (status.assignee as Profile)._id;
        return assigneeId === selectedAssigneeId;
      }
    );
    const submissionStatus = assigneeSubmissionStatus?.status;

    const isInApprovers = assignment.approvers?.some((approver) => {
      if (typeof approver === 'string') return approver === profileId;
      return (approver as Profile)._id === profileId;
    }) ?? false;

    const isInAssigneesForAssignment = assignment.assignees?.some((a: Profile) => a._id === profileId) ?? false;
    const isSelectedAssignee = selectedAssigneeId === profileId;
    const isAssigner = assignment.assigner?._id === profileId;
    const isInOmitSignatureApprovers = (profileId && assignment.omitSignatureApprovers?.includes(profileId)) ?? false;
    const isInSubjects = assignment.subjects?.some((s: Profile) => s._id === profileId) ?? false;

    // Submit when this profile is the selected assignee row and submission is open (no profile::isassignee).
    // Super admin on the assignment as assignee follows the same rule; auto-save in SubmitQueueComponent uses canSubmit.
    const canSubmit = isSelectedAssignee && submissionStatus !== 'submission_complete';

    const isReadonly =
      !canSubmit &&
      (submissionStatus === 'submission_complete' ||
        (isInQuestionApprovers && !isSelectedAssignee && submissionStatus !== 'submission_not_started') ||
        (isInSubjects && !isSelectedAssignee) ||
        ((isInApprovers || isInAssigneesForAssignment || isAdmin) &&
          !isSelectedAssignee &&
          !isAssigner &&
          !isInOmitSignatureApprovers &&
          !isInSubjects));

    const hasAccess = canSubmit || isReadonly || hasAccessAsQuestionApprover || isAdmin;

    return { canSubmit, isReadonly, hasAccess };
  }, [
    selectedProfile,
    assignment,
    selectedAssigneeId,
    user,
    isInQuestionApprovers,
    hasAssociatedRoleForView,
  ]);

  const showPreApprovalOnly =
    interactionMode === 'questionApprover' && submissionNotStartedForAll;
  const showRoleSelector =
    interactionMode === null &&
    isInQuestionApprovers &&
    isInAssignees &&
    submissionNotStartedForAll;

  if (isInitialFetching || (needAssigneeData && selectedAssigneeId && isFetching)) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Loading Queue..." />
      </div>
    );
  }

  if (displayError || !initialData?.success || !initialData?.data) {
    return (
      <Alert
        type="error"
        message="Failed to load queue data"
        action={<Button onClick={() => window.location.reload()}>Retry</Button>}
      />
    );
  }

  if (!accessControl.hasAccess) {
    return (
      <div>
        <Helmet>
          <title>Submit Queue - Eval Hero</title>
        </Helmet>
        <PageHeader
          title="Submit Queue"
          breadcrumbs={[
            { title: <><FormOutlined /><span>Forms</span></> },
            { title: 'Queues', path: '/forms/queues' },
            { title: 'Submit' },
          ]}
        />
        <Result
          icon={<StopOutlined style={{ color: token.colorError }} />}
          title="Access Denied"
          subTitle="You don't have access to view this page."
          style={{ padding: '80px 24px' }}
        />
      </div>
    );
  }

  if (showRoleSelector) {
    return (
      <div>
        <Helmet>
          <title>Submit Queue - Eval Hero</title>
        </Helmet>
        <PageHeader
          title="Submit Queue"
          breadcrumbs={[
            { title: <><FormOutlined /><span>Forms</span></> },
            { title: 'Queues', path: '/forms/queues' },
            { title: 'Submit' },
          ]}
        />
        <Modal
          open
          closable={false}
          footer={null}
          title="How do you want to interact?"
          width={400}
        >
          <p style={{ marginBottom: 16 }}>
            You are both an assignee and a question approver for this queue. Submission has not started yet.
          </p>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Button
              type="primary"
              block
              size="large"
              icon={<UserOutlined />}
              onClick={() => {
                setInteractionMode('assignee');
                if (selectedProfile?._id && initialAssignment?.assignees?.some((a: Profile) => a._id === selectedProfile._id)) {
                  setSelectedAssigneeId(selectedProfile._id);
                } else if (initialAssignment?.assignees?.length) {
                  setSelectedAssigneeId(initialAssignment.assignees[0]._id);
                }
              }}
            >
              As assignee – fill and submit the form
            </Button>
            <Button
              block
              size="large"
              icon={<SafetyCertificateOutlined />}
              onClick={() => setInteractionMode('questionApprover')}
            >
              As question approver – manage pre-approval grouping
            </Button>
          </Space>
        </Modal>
      </div>
    );
  }

  if (showPreApprovalOnly && initialAssignment) {
    return (
      <div>
        <Helmet>
          <title>Submit Queue - Pre-approval - Eval Hero</title>
        </Helmet>
        <PageHeader
          title="Submit Queue"
          breadcrumbs={[
            { title: <><FormOutlined /><span>Forms</span></> },
            { title: 'Queues', path: '/forms/queues' },
            { title: 'Submit' },
          ]}
        />
        <PreApprovalManager assignment={initialAssignment} refetch={refetchInitial} />
      </div>
    );
  }

  if (needAssigneeData && (!selectedAssigneeId || !displayData?.success || !displayData?.data)) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Loading Queue..." />
      </div>
    );
  }

  const assigneeSubmissionStatus = assignment?.submissionStatus?.find(
    (status: { assignee: string | Profile }) => {
      const assigneeId = typeof status.assignee === 'string' ? status.assignee : (status.assignee as Profile)._id;
      return assigneeId === selectedAssigneeId;
    }
  );
  const submissionStatus = assigneeSubmissionStatus?.status;
  const isSelectedAssignee = selectedProfile?._id === selectedAssigneeId;

  // Assignee must always see the form to start/update their submission. Question approver viewing another assignee sees the form only when that assignee's submission has started.
  const showSubmissionForm =
    assignment &&
    (isSelectedAssignee || submissionStatus === 'submission_in_progress' || submissionStatus === 'submission_complete');

  const showNotStartedMessage =
    assignment &&
    selectedAssigneeId &&
    submissionStatus === 'submission_not_started' &&
    !isSelectedAssignee;

  return (
    <div>
      <Helmet>
        <title>Submit Queue - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Submit Queue"
        breadcrumbs={[
          {
            title: (
              <>
                <FormOutlined />
                <span>Forms</span>
              </>
            ),
            // path: '/forms',
          },
          {
            title: 'Queues',
            path: '/forms/queues',
          },
          {
            title: 'Submit',
          },
        ]}
      />

      {assigneesToShow.length > 0 && (
        <Affix offsetTop={65}>
          <div
            style={{
              background: token.colorBgContainer,
              boxShadow: token.boxShadowTertiary,
              padding: '16px 24px',
              marginBottom: 16,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusLG,
              zIndex: 10,

            }}
          >
            <Space size="middle" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space size="small">
                <UserOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />
                <Text strong style={{ fontSize: 14, color: token.colorText }}>
                  Select Assignee:
                </Text>
              </Space>
              <Select
                value={selectedAssigneeId}
                onChange={(value) => setSelectedAssigneeId(value)}
                style={{ minWidth: 250 }}
                placeholder="Select an assignee"
                size="large"
                showSearch={assigneesToShow.length > 1}
                filterOption={
                  assigneesToShow.length > 1
                    ? (input, option) => {
                        const label =
                          typeof option?.label === 'string'
                            ? option.label
                            : typeof option?.children === 'string'
                              ? option.children
                              : '';
                        return label.toLowerCase().includes(input.toLowerCase());
                      }
                    : undefined
                }
              >
                {assigneesToShow.map((assignee: Profile) => {
                  const userName =
                    typeof assignee.user === 'object' && assignee.user
                      ? (assignee.user as User).name
                      : undefined;
                  const userEmail =
                    typeof assignee.user === 'object' && assignee.user
                      ? (assignee.user as User).email
                      : undefined;
                  const displayName = userName || userEmail || assignee._id;
                  return (
                    <Select.Option key={assignee._id} value={assignee._id}>
                      {displayName}
                    </Select.Option>
                  );
                })}
              </Select>
            </Space>
          </div>
        </Affix>
      )}

      {isInQuestionApprovers && initialAssignment && !submissionNotStartedForAll && (
        <div style={{ marginBottom: 24 }}>
          <PreApprovalManager
            assignment={initialAssignment}
            refetch={refetchInitial}
            submissionStatusByAssignee={initialAssignment.submissionStatus}
            controlledAssigneeId={selectedAssigneeId}
            embeddedWithPageSelect
          />
        </div>
      )}

      {showNotStartedMessage && (
        <Alert
          type="info"
          icon={<InfoCircleOutlined />}
          message="Submission not started"
          description="The selected assignee has not started this submission yet. You can select another assignee from the dropdown above to view their submission, or check back later."
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {showSubmissionForm && submissionStatus === 'submission_not_started' && isSelectedAssignee && (
        <Alert
          type="info"
          icon={<InfoCircleOutlined />}
          message="Get started"
          description="You haven't started this submission yet. Fill out the form below to begin."
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {showSubmissionForm && (
        <SubmitQueueComponent
          queue={assignment}
          refetchQueue={refetchQueue}
          queueLoading={!!isDisplayFetching}
          submissionStatus={submissionStatus}
          readonly={accessControl.isReadonly}
          canSubmit={accessControl.canSubmit}
          selectedAssigneeId={selectedAssigneeId}
          canOpenApprovalDrawer={accessControl.isReadonly && (isInQuestionApprovers || isInAssignees)}
        />
      )}
    </div>
  );
};

export { SubmitQueuePage };
