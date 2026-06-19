import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { FormOutlined } from '@ant-design/icons';
import { useParams, useSearchParams } from 'react-router-dom';
import { useGetQueueQuery } from '../../services/queueApi';
import { Alert, Button, Spin, theme, Result } from 'antd';
import { QueueSubmissionsComponent } from './QueuesComponents/QueueSubmissions';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Profile } from '../../features/auth/authSlice';
import { useState, useEffect, useMemo } from 'react';
import { StopOutlined } from '@ant-design/icons';

const QueueSubmissionsPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProfile = useSelector((state: RootState) => state.auth.selectedProfile);
  const user = useSelector((state: RootState) => state.auth.user);
  const assigneeIdFromUrl = searchParams.get('assigneeId');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | undefined>(assigneeIdFromUrl || undefined);
  const { token } = theme.useToken();

  const {
    data,
    isFetching,
    error,
    refetch: refetchQueue,
  } = useGetQueueQuery({ id: id || '' }, { skip: !id });

  const assignment = data?.data?.assignment;

  // Set default assignee when data loads (hooks must be called before early returns)
  useEffect(() => {
    if (assignment && !selectedAssigneeId) {
      // Check URL first, then default to selectedProfile if available, otherwise first assignee
      if (assigneeIdFromUrl && assignment.assignees?.some((a: Profile) => a._id === assigneeIdFromUrl)) {
        setSelectedAssigneeId(assigneeIdFromUrl);
      } else if (selectedProfile?._id && assignment.assignees?.some((a: Profile) => a._id === selectedProfile._id)) {
        setSelectedAssigneeId(selectedProfile._id);
      } else if (assignment.assignees?.length > 0) {
        setSelectedAssigneeId(assignment.assignees[0]._id);
      }
    }
  }, [assignment, selectedProfile, selectedAssigneeId, assigneeIdFromUrl]);

  // Update URL when assignee changes (only if different from current URL param)
  useEffect(() => {
    if (selectedAssigneeId && selectedAssigneeId !== assigneeIdFromUrl) {
      const next = new URLSearchParams(searchParams);
      next.set('assigneeId', selectedAssigneeId);
      setSearchParams(next, { replace: true });
    } else if (!selectedAssigneeId && assigneeIdFromUrl) {
      const next = new URLSearchParams(searchParams);
      next.delete('assigneeId');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssigneeId, assigneeIdFromUrl]);

  // Access control logic (hooks must be called before early returns)
  const accessControl = useMemo(() => {
    if (!selectedProfile || !assignment) {
      return {
        hasAccess: false,
        isInAssignees: false,
        isInSubjects: false,
        hasAssociatedRole: false,
        profileId: undefined as string | undefined,
      };
    }

    const profileId = selectedProfile._id;
    const isAdmin = user?.isAdmin || false;

    // Check if profile is in approvers (can be string[] or Profile[])
    const isInApprovers = assignment.approvers?.some((approver) => {
      if (typeof approver === 'string') {
        return approver === profileId;
      }
      return approver._id === profileId;
    }) || false;

    // Check if profile is in assignees
    const isInAssignees = assignment.assignees?.some((assignee) => assignee._id === profileId) || false;

    // Check if profile is the assigner
    const isAssigner = assignment.assigner?._id === profileId;

    // Check if profile is in omitSignatureApprovers
    const isInOmitSignatureApprovers = assignment.omitSignatureApprovers?.includes(profileId) || false;

    // Check if profile is in subjects
    const isInSubjects = assignment.subjects?.some((subject) => subject._id === profileId) || false;

    // Check if profile is in question approvers
    const questionApproverIds = (assignment.questionApprovers ?? []).map((p: Profile | string) =>
      typeof p === 'string' ? p : (p as Profile)._id
    );

    const isInQuestionApprovers = Boolean(profileId && questionApproverIds.includes(profileId));

    const hasAssociatedRole =
      isAdmin ||
      isInApprovers ||
      isAssigner ||
      isInOmitSignatureApprovers ||
      isInQuestionApprovers;

    // Has access: profile is in approvers, assignees, assigner, omitSignatureApprovers, subjects, OR user isAdmin
    const hasAccess = isInApprovers || isInAssignees || isAssigner || isInQuestionApprovers || isInOmitSignatureApprovers || isInSubjects || isAdmin;

    return {
      hasAccess,
      isInAssignees,
      isInSubjects,
      hasAssociatedRole,
      profileId,
    };
  }, [selectedProfile, assignment, user]);

  // Assignees to show: only-assignee sees just themselves; others see all
  const assigneesToShow = useMemo(() => {
    if (!assignment?.assignees?.length) return [];
    const onlyAssignee =
      accessControl.isInAssignees &&
      !accessControl.hasAssociatedRole &&
      !accessControl.isInSubjects;
    if (onlyAssignee && accessControl.profileId) {
      const me = assignment.assignees.find((a: Profile) => a._id === accessControl.profileId);
      return me ? [me] : assignment.assignees;
    }
    return assignment.assignees;
  }, [assignment, accessControl.isInAssignees, accessControl.hasAssociatedRole, accessControl.isInSubjects, accessControl.profileId]);

  // Subject options: only-subject sees just themselves; others see all
  const subjectOptions = useMemo(() => {
    if (!assignment?.subjects?.length) return [];
    const onlySubject =
      accessControl.isInSubjects &&
      !accessControl.hasAssociatedRole &&
      !accessControl.isInAssignees;
    const subjectsToUse = onlySubject && accessControl.profileId
      ? assignment.subjects.filter((s: Profile) => s._id === accessControl.profileId)
      : assignment.subjects;
    return subjectsToUse.map((s: Profile) => ({
      label: (s.user && typeof s.user === 'object' && (s.user as { name?: string }).name) || 'Unknown',
      value: s._id,
    }));
  }, [assignment, accessControl.isInSubjects, accessControl.hasAssociatedRole, accessControl.isInAssignees, accessControl.profileId]);

  // Keep selected assignee in sync when assigneesToShow is restricted (e.g. assignee-only sees just themselves)
  useEffect(() => {
    if (assigneesToShow.length === 0 || !selectedAssigneeId) return;
    const ids = assigneesToShow.map((a: Profile) => a._id);
    if (!ids.includes(selectedAssigneeId)) {
      setSelectedAssigneeId(assigneesToShow[0]._id);
    }
  }, [assigneesToShow, selectedAssigneeId]);

  if (isFetching) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Loading Queue..." />
      </div>
    );
  }

  if (error || !data?.success || !data?.data) {
    return (
      <Alert
        type="error"
        message="Failed to load queue data"
        action={<Button onClick={refetchQueue}>Retry</Button>}
      />
    );
  }

  if (!assignment) {
    return (
      <Alert
        type="error"
        message="Assignment not found"
      />
    );
  }

  // Show no access message if user doesn't have access
  if (!accessControl.hasAccess) {
    return (
      <div>
        <Helmet>
          <title>Queue Submissions - Eval Hero</title>
        </Helmet>
        <PageHeader
          title="Queue Submissions"
          breadcrumbs={[
            {
              title: (
                <>
                  <FormOutlined />
                  <span>Forms</span>
                </>
              ),
            },
            {
              title: 'Queues',
              path: '/forms/queues',
            },
            {
              title: 'Submissions',
            },
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

  return (
    <div>
      <Helmet>
        <title>Queue Submissions - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Queue Submissions"
        breadcrumbs={[
          {
            title: (
              <>
                <FormOutlined />
                <span>Forms</span>
              </>
            ),
          },
          {
            title: 'Queues',
            path: '/forms/queues',
          },
          {
            title: 'Submissions',
          },
        ]}
      />

      <QueueSubmissionsComponent
        queueId={id!}
        subjectOptions={subjectOptions}
        assignment={assignment}
        selectedAssigneeId={selectedAssigneeId}
        onAssigneeChange={(assigneeId) => setSelectedAssigneeId(assigneeId)}
        assignees={assigneesToShow}
      />
    </div>
  );
};

export { QueueSubmissionsPage };

