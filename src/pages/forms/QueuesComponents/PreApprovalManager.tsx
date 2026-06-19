/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tag,
  theme,
  Collapse,
  Switch,
  Affix,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Assignment } from '../../../services/assignmentsApi';
import { User, Profile } from '../../../features/auth/authSlice';
import { useUpdateQueueMutation } from '../../../services/queueApi';
import { getQuestionsRequiringApproval } from './questionApprovalUtils';
import { JSONContent } from '@tiptap/core';

const { Text } = Typography;

interface SubjectGroup {
  id: string;
  name: string;
  subjectIds: string[];
  locked?: boolean;
  /** Question approver has given pre-approval for this group */
  preApproved?: boolean;
  /** Required when preApproved; used in auto-approve message */
  preApprovalComment?: string;
}

/** Stable key for a question (used in preApprovalByQuestion) */
function getQuestionKey(node: any, path: number[]): string {
  const id = node?.attrs?.id || node?.attrs?.name;
  if (id) return String(id);
  return `path-${path.join('-')}`;
}

/** Extract question text from node content (first paragraph/heading). Falls back to attrs then type. */
function extractQuestionLabelFromNode(node: any): string {
  if (!node) return 'Question';
  const content = node.content;
  if (content && Array.isArray(content)) {
    const findLabelInContent = (arr: any[]): string | undefined => {
      for (const item of arr) {
        const type = item?.type?.name ?? item?.type;
        if (type === 'paragraph' || type === 'heading') {
          if (item.content && Array.isArray(item.content)) {
            const textParts = item.content
              .filter((c: any) => (c?.type?.name ?? c?.type) === 'text')
              .map((c: any) => (typeof c.text === 'string' ? c.text : '') || '')
              .join('');
            const trimmed = textParts.trim();
            if (trimmed) return trimmed;
          }
        }
        if (item.content && Array.isArray(item.content)) {
          const nested = findLabelInContent(item.content);
          if (nested) return nested;
        }
      }
      return undefined;
    };
    const fromContent = findLabelInContent(content);
    if (fromContent) return fromContent;
  }
  return node.attrs?.label || node.attrs?.name || node.type || 'Question';
}

/** Per-assignee submission status (same shape as assignment.submissionStatus) */
export type SubmissionStatusEntry = { assignee: string | Profile; status?: string };

export interface PreApprovalManagerProps {
  assignment: Assignment;
  refetch: () => void;
  /** When provided, pre-approval is read-only for the selected assignee if their submission has started or completed. */
  submissionStatusByAssignee?: SubmissionStatusEntry[];
  /** When provided, assignee is controlled by parent; do not render the assignee Select (single select at page level). */
  controlledAssigneeId?: string;
  /** When true, we are embedded in a page that has its own assignee select; never show our Select (use controlledAssigneeId). */
  embeddedWithPageSelect?: boolean;
}

export const PreApprovalManager: React.FC<PreApprovalManagerProps> = ({
  assignment,
  refetch,
  submissionStatusByAssignee,
  controlledAssigneeId,
  embeddedWithPageSelect,
}) => {
  const { token } = theme.useToken();
  const [updateQueue, { isLoading: isSaving }] = useUpdateQueueMutation();

  const subjects = assignment?.subjects ?? [];
  const assignees = assignment?.assignees ?? [];
  const subjectMode = assignment?.subjectMode ?? 'none';
  const schema = assignment?.formTemplateSchema?.formSchema ?? null;

  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | undefined>(undefined);
  const effectiveAssigneeId = embeddedWithPageSelect || controlledAssigneeId !== undefined ? controlledAssigneeId : selectedAssigneeId;

  const selectedAssigneeStatus = useMemo(() => {
    if (!effectiveAssigneeId || !submissionStatusByAssignee?.length) return undefined;
    const entry = submissionStatusByAssignee.find((e) => {
      const assigneeId = typeof e.assignee === 'string' ? e.assignee : (e.assignee as Profile)?._id;
      return assigneeId === effectiveAssigneeId;
    });
    return entry?.status;
  }, [effectiveAssigneeId, submissionStatusByAssignee]);

  const readOnlyForCurrentAssignee = useMemo(
    () =>
      selectedAssigneeStatus === 'submission_in_progress' || selectedAssigneeStatus === 'submission_complete',
    [selectedAssigneeStatus]
  );

  const assigneeOptions = useMemo(
    () =>
      assignees.map((profile: any) => ({
        label: (profile.user as User)?.name ?? profile.firstName ?? profile._id,
        value: profile._id,
      })),
    [assignees]
  );

  const subjectsOptions = useMemo(
    () =>
      subjects.map((profile: any) => ({
        label: (profile.user as User)?.name ?? profile.firstName ?? profile._id,
        value: profile._id,
      })),
    [subjects]
  );

  const questionsRequiringApproval = useMemo(() => {
    if (!schema?.content) return [];
    return getQuestionsRequiringApproval(schema as JSONContent);
  }, [schema]);

  /** Per-question groups: questionKey -> SubjectGroup[] */
  const [groupsByQuestion, setGroupsByQuestion] = useState<Record<string, SubjectGroup[]>>({});
  /** Per-question, per ungrouped subject: questionKey -> subjectId -> preApproved */
  const [ungroupedPreApproved, setUngroupedPreApproved] = useState<Record<string, Record<string, boolean>>>({});
  /** Per-question, per ungrouped subject: questionKey -> subjectId -> preApprovalComment (required when pre-approved) */
  const [ungroupedPreApprovalComments, setUngroupedPreApprovalComments] = useState<Record<string, Record<string, string>>>({});

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalQuestionKey, setGroupModalQuestionKey] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<SubjectGroup | null>(null);
  const [groupForm] = Form.useForm<{ name: string; subjectIds: string[] }>();

  // Initialize from assignment.submitMeta.preApprovalByAssignee[effectiveAssigneeId] (or legacy preApprovalByQuestion when no assignee selected)
  useEffect(() => {
    const meta = assignment?.submitMeta;
    const byQ =
      effectiveAssigneeId && meta?.preApprovalByAssignee?.[effectiveAssigneeId]?.preApprovalByQuestion
        ? meta.preApprovalByAssignee[effectiveAssigneeId].preApprovalByQuestion
        : meta?.preApprovalByQuestion;
    if (!byQ || typeof byQ !== 'object') {
      if (effectiveAssigneeId) {
        setGroupsByQuestion({});
        setUngroupedPreApproved({});
        setUngroupedPreApprovalComments({});
      }
      return;
    }
    const nextComments: Record<string, Record<string, string>> = {};
    const nextGroups: Record<string, SubjectGroup[]> = {};
    const nextUngrouped: Record<string, Record<string, boolean>> = {};
    const toBool = (v: unknown) => v === true || v === 'true';
    Object.keys(byQ).forEach((qKey) => {
      const gs = (byQ as any)[qKey]?.globalGroups ?? [];
      nextGroups[qKey] = gs.map((g: any) => ({
        id: g.id,
        name: g.name,
        subjectIds: g.subjectIds ?? [],
        locked: toBool(g.locked),
        preApproved: toBool(g.preApproved),
        preApprovalComment: typeof g.preApprovalComment === 'string' ? g.preApprovalComment : undefined,
      }));
      const ungrouped = (byQ as any)[qKey]?.ungroupedSubjects ?? [];
      nextUngrouped[qKey] = {};
      nextComments[qKey] = {};
      ungrouped.forEach((u: any) => {
        if (u.id) {
          nextUngrouped[qKey][u.id] = toBool(u.preApproved);
          if (typeof u.preApprovalComment === 'string') nextComments[qKey][u.id] = u.preApprovalComment;
        }
      });
    });
    setGroupsByQuestion(nextGroups);
    setUngroupedPreApproved(nextUngrouped);
    setUngroupedPreApprovalComments(nextComments);
  }, [assignment?.submitMeta?.preApprovalByQuestion, assignment?.submitMeta?.preApprovalByAssignee, effectiveAssigneeId]);

  const groupsForQuestion = useCallback(
    (questionKey: string): SubjectGroup[] => {
      return groupsByQuestion[questionKey] ?? [];
    },
    [groupsByQuestion]
  );

  const usedSubjectIdsForQuestion = useCallback(
    (questionKey: string): Set<string> => {
      const used = new Set<string>();
      groupsForQuestion(questionKey).forEach((g) => g.subjectIds.forEach((id) => used.add(id)));
      return used;
    },
    [groupsForQuestion]
  );

  const ungroupedSubjectsForQuestion = useCallback(
    (questionKey: string): Array<{ label: string; value: string }> => {
      const used = usedSubjectIdsForQuestion(questionKey);
      return subjectsOptions.filter((opt) => !used.has(opt.value));
    },
    [subjectsOptions, usedSubjectIdsForQuestion]
  );

  const openCreateGroup = (questionKey: string) => {
    setGroupModalQuestionKey(questionKey);
    setEditingGroup(null);
    groupForm.resetFields();
    setGroupModalOpen(true);
  };

  const openEditGroup = (questionKey: string, group: SubjectGroup) => {
    setGroupModalQuestionKey(questionKey);
    setEditingGroup(group);
    groupForm.setFieldsValue({
      name: group.name,
      subjectIds: group.subjectIds,
    });
    setGroupModalOpen(true);
  };

  const handleSaveGroup = () => {
    const qKey = groupModalQuestionKey;
    if (!qKey) return;
    groupForm.validateFields().then((values) => {
      const currentGroups = groupsByQuestion[qKey] ?? [];
      if (editingGroup) {
        const addedSubjectIds = values.subjectIds.filter(
          (id: string) => !editingGroup.subjectIds.includes(id)
        );
        const updated = currentGroups.map((g) => {
          if (g.id === editingGroup.id) {
            return { ...g, name: values.name, subjectIds: values.subjectIds };
          }
          const filtered = g.subjectIds.filter((id) => !addedSubjectIds.includes(id));
          return { ...g, subjectIds: filtered };
        });
        setGroupsByQuestion((prev) => ({ ...prev, [qKey]: updated }));
        message.success('Group updated');
      } else {
        const newId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? `group-${crypto.randomUUID()}`
            : `group-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        setGroupsByQuestion((prev) => ({
          ...prev,
          [qKey]: [...(prev[qKey] ?? []), { id: newId, name: values.name, subjectIds: values.subjectIds }],
        }));
        message.success('Group created');
      }
      setGroupModalOpen(false);
      groupForm.resetFields();
      setEditingGroup(null);
      setGroupModalQuestionKey(null);
    });
  };

  const handleDeleteGroup = (questionKey: string, groupId: string) => {
    const groups = groupsByQuestion[questionKey] ?? [];
    const group = groups.find((g) => g.id === groupId);
    Modal.confirm({
      title: 'Delete Group',
      content: `Are you sure you want to delete "${group?.name}"? Subjects will become ungrouped for this question.`,
      onOk: () => {
        setGroupsByQuestion((prev) => ({
          ...prev,
          [questionKey]: (prev[questionKey] ?? []).filter((g) => g.id !== groupId),
        }));
        message.success('Group deleted');
      },
    });
  };

  const setGroupPreApproved = (questionKey: string, groupId: string, preApproved: boolean) => {
    setGroupsByQuestion((prev) => ({
      ...prev,
      [questionKey]: (prev[questionKey] ?? []).map((g) =>
        g.id === groupId ? { ...g, preApproved, ...(preApproved ? {} : { preApprovalComment: undefined }) } : g
      ),
    }));
  };

  const setGroupPreApprovalComment = (questionKey: string, groupId: string, comment: string) => {
    setGroupsByQuestion((prev) => ({
      ...prev,
      [questionKey]: (prev[questionKey] ?? []).map((g) =>
        g.id === groupId ? { ...g, preApprovalComment: comment } : g
      ),
    }));
  };

  const setUngroupedSubjectPreApproved = (questionKey: string, subjectId: string, preApproved: boolean) => {
    setUngroupedPreApproved((prev) => ({
      ...prev,
      [questionKey]: {
        ...(prev[questionKey] ?? {}),
        [subjectId]: preApproved,
      },
    }));
    if (!preApproved) {
      setUngroupedPreApprovalComments((prev) => ({
        ...prev,
        [questionKey]: { ...(prev[questionKey] ?? {}), [subjectId]: '' },
      }));
    }
  };

  const setUngroupedPreApprovalComment = (questionKey: string, subjectId: string, comment: string) => {
    setUngroupedPreApprovalComments((prev) => ({
      ...prev,
      [questionKey]: { ...(prev[questionKey] ?? {}), [subjectId]: comment },
    }));
  };

  const handleSavePreApproval = async () => {
    if (!assignment?._id || !effectiveAssigneeId) {
      message.warning('Please select an assignee first.');
      return;
    }
    const ungroupedCommentsForQ = ungroupedPreApprovalComments ?? {};
    for (const { node, path } of questionsRequiringApproval) {
      const qKey = getQuestionKey(node, path);
      const groups = groupsByQuestion[qKey] ?? [];
      const used = new Set<string>();
      groups.forEach((g) => g.subjectIds.forEach((id: string) => used.add(id)));
      const ungroupedList = subjectsOptions.filter((o) => !used.has(o.value));
      const ungroupedPreForQ = ungroupedPreApproved[qKey] ?? {};
      for (const g of groups) {
        if (g.preApproved === true && (!g.preApprovalComment || !g.preApprovalComment.trim())) {
          message.warning(`Pre-approval comment is required for pre-approved group "${g.name}".`);
          return;
        }
      }
      for (const s of ungroupedList) {
        if (ungroupedPreForQ[s.value] === true) {
          const comment = ungroupedCommentsForQ[qKey]?.[s.value];
          if (!comment || !comment.trim()) {
            message.warning(`Pre-approval comment is required for pre-approved ungrouped subject "${typeof s.label === 'string' ? s.label : s.value}".`);
            return;
          }
        }
      }
    }
    const preApprovalByQuestion: Record<
      string,
      {
        globalGroups: Array<{ id: string; name: string; subjectIds: string[]; locked?: boolean; preApproved?: boolean; preApprovalComment?: string }>;
        ungroupedSubjects: Array<{ id: string; name: string; locked?: boolean; preApproved?: boolean; preApprovalComment?: string }>;
      }
    > = {};
    questionsRequiringApproval.forEach(({ node, path }) => {
      const qKey = getQuestionKey(node, path);
      const groups = groupsByQuestion[qKey] ?? [];
      const used = new Set<string>();
      groups.forEach((g) => g.subjectIds.forEach((id: string) => used.add(id)));
      const ungroupedList = subjectsOptions.filter((o) => !used.has(o.value));
      const ungroupedPreForQ = ungroupedPreApproved[qKey] ?? {};
      const ungroupedComments = ungroupedPreApprovalComments[qKey] ?? {};
      preApprovalByQuestion[qKey] = {
        globalGroups: groups.map((g) => ({
          id: g.id,
          name: g.name,
          subjectIds: g.subjectIds,
          locked: false,
          preApproved: g.preApproved === true,
          ...(g.preApproved === true && g.preApprovalComment ? { preApprovalComment: g.preApprovalComment.trim() } : {}),
        })),
        ungroupedSubjects: ungroupedList.map((s) => ({
          id: s.value,
          name: typeof s.label === 'string' ? s.label : s.value,
          locked: false,
          preApproved: ungroupedPreForQ[s.value] === true,
          ...(ungroupedPreForQ[s.value] === true && ungroupedComments[s.value]
            ? { preApprovalComment: ungroupedComments[s.value].trim() }
            : {}),
        })),
      };
    });
    const existingByAssignee = assignment.submitMeta?.preApprovalByAssignee ?? {};
    const preApprovalByAssignee  = {
      ...existingByAssignee,
      [effectiveAssigneeId]: { preApprovalByQuestion },
    }

    try {
      await updateQueue({
        id: assignment._id,
        // dueDate: assignment.dueDate ?? null,
        // timezone: assignment.timezone ?? '',
        submitMeta: {
          ...(assignment.submitMeta ?? {}),
          preApprovalByAssignee,
          isAllLocked: false,
        },
      }).unwrap();
      message.success(`Pre-approval saved for selected assignee.`);
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to save pre-approval data');
    }
  };

  if (subjectMode === 'none') {
    return (
      <Card>
        <Text type="secondary">
          This assignment has no subjects. Pre-approval grouping is not applicable.
        </Text>
      </Card>
    );
  }

  if (questionsRequiringApproval.length === 0) {
    return (
      <Card>
        <Text type="secondary">
          No questions in this form require approval. Pre-approval grouping is used only for questions marked as approval required.
        </Text>
      </Card>
    );
  }

  if (assignees.length === 0) {
    return (
      <Card>
        <Text type="secondary">This assignment has no assignees. Pre-approval cannot be configured.</Text>
      </Card>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {!embeddedWithPageSelect && controlledAssigneeId === undefined && (
        <Affix offsetTop={65}>
          <Card size="small" style={{ marginBottom: 16, boxShadow: token.boxShadowTertiary }}>
            <Space size="middle" style={{ width: '100%', flexWrap: 'wrap' }}>
              <Space size="small">
                <UserOutlined style={{ color: token.colorPrimary }} />
                <Text strong>Assign pre-approval for assignee:</Text>
              </Space>
              <Select
                value={selectedAssigneeId}
                onChange={setSelectedAssigneeId}
                style={{ minWidth: 260 }}
                placeholder="Select an assignee to add or update pre-approval"
                size="large"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                }
                options={assigneeOptions}
              />
              {selectedAssigneeId && (
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={isSaving}
                  onClick={handleSavePreApproval}
                  disabled={readOnlyForCurrentAssignee}
                >
                  Save pre-approval
                </Button>
              )}
            </Space>
          </Card>
        </Affix>
      )}

      {(embeddedWithPageSelect || controlledAssigneeId !== undefined) && effectiveAssigneeId && (
        <div style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={isSaving}
            onClick={handleSavePreApproval}
            disabled={readOnlyForCurrentAssignee}
          >
            Save pre-approval for this assignee
          </Button>
        </div>
      )}

      {!effectiveAssigneeId ? (
        <Card>
          <Text type="secondary">
            Select an assignee above to add or update pre-approval (groups, ungrouped subjects, and pre-approved flags) for that assignee.
          </Text>
        </Card>
      ) : (
        <Card
          title={
            <Space>
              <CheckCircleOutlined style={{ color: token.colorSuccess }} />
              <Text strong>Pre-approval: Groups & ungrouped subjects per question</Text>
              <Tag color="blue">Question approver</Tag>
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          {readOnlyForCurrentAssignee && (
            <Alert
              type="info"
              showIcon
              message="This assignee's submission has started or been completed. Pre-approval for this assignee cannot be changed. Select another assignee to edit their pre-approval."
              style={{ marginBottom: 16 }}
            />
          )}
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Your grouping here is independent of the assignee&apos;s own groups. Define groups and ungrouped subjects per question and optionally mark &quot;Pre-approved&quot;. When the assignee fills the form with their own groups/ungrouped, they will see which of their groups and ungrouped subjects have pre-approval (based on whether each subject is pre-approved here).
          </Text>

        <Collapse
          defaultActiveKey={questionsRequiringApproval.map((_, i) => String(i))}
          items={questionsRequiringApproval.map(({ node, path }, index) => {
            const questionKey = getQuestionKey(node, path);
            const label = extractQuestionLabelFromNode(node);
            const groups = groupsForQuestion(questionKey);
            const ungrouped = ungroupedSubjectsForQuestion(questionKey);
            return {
              key: String(index),
              label: (
                <Space>
                  <Text strong>{label}</Text>
                  <Tag>{groups.length} group(s)</Tag>
                  <Tag color="default">{ungrouped.length} ungrouped</Tag>
                </Space>
              ),
              children: (
                <div style={{ padding: '8px 0' }}>
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {/* <div> */}
                      <Space style={{ marginBottom: 8 }}>
                        <Text strong>Groups for this question</Text>
                        <Button
                          type="primary"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => openCreateGroup(questionKey)}
                          disabled={readOnlyForCurrentAssignee}
                        >
                          Create group
                        </Button>
                      </Space>
                      {groups.length === 0 ? (
                        <Text type="secondary"> No groups yet. Create a group to organize subjects for this question. Subjects not in any group will appear as ungrouped.</Text>
                      ) : (
                        <Space wrap style={{ marginTop: 8 }}>
                          {groups.map((group) => (
                            <Card
                              key={group.id}
                              size="small"
                              style={{ minWidth: 240 }}
                              title={
                                <Space>
                                  <span>{group.name}</span>
                                  {group.preApproved && (
                                    <Tag color="success" icon={<CheckOutlined />}>Pre-approved</Tag>
                                  )}
                                </Space>
                              }
                              actions={[
                                <Button
                                  key="edit"
                                  type="text"
                                  size="small"
                                  icon={<EditOutlined />}
                                  onClick={() => openEditGroup(questionKey, group)}
                                  disabled={readOnlyForCurrentAssignee}
                                />,
                                <Button
                                  key="delete"
                                  type="text"
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={() => handleDeleteGroup(questionKey, group.id)}
                                  disabled={readOnlyForCurrentAssignee}
                                />,
                              ]}
                            >
                              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {group.subjectIds.length} subject(s)
                                </Text>
                                <Space>
                                  <Text type="secondary" style={{ fontSize: 12 }}>Pre-approved</Text>
                                  <Switch
                                    size="small"
                                    checked={group.preApproved === true}
                                    onChange={(checked) => setGroupPreApproved(questionKey, group.id, checked)}
                                    disabled={readOnlyForCurrentAssignee}
                                  />
                                </Space>
                                {group.preApproved === true && (
                                  <div style={{ width: '100%' }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Comment (required for pre-approval)</Text>
                                    <Input.TextArea
                                      size="small"
                                      placeholder="Comment for auto-approve message"
                                      value={group.preApprovalComment ?? ''}
                                      onChange={(e) => setGroupPreApprovalComment(questionKey, group.id, e.target.value)}
                                      disabled={readOnlyForCurrentAssignee}
                                      rows={2}
                                      style={{ marginTop: 4 }}
                                    />
                                  </div>
                                )}
                              </Space>
                            </Card>
                          ))}
                        </Space>
                      )}
                    {/* </div> */}
                    <div>
                      <Text strong>Ungrouped subjects for this question</Text>
                      <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
                        Subjects not in any group. Optionally mark as pre-approved.
                      </Text>
                      {ungrouped.length === 0 ? (
                        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                          All subjects are in groups. Add a group or remove subjects from groups to see ungrouped here.
                        </Text>
                      ) : (
                        <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size="small">
                          {ungrouped.map((s) => {
                            const subjectId = s.value;
                            const label = typeof s.label === 'string' ? s.label : s.value;
                            const isPreApproved = ungroupedPreApproved[questionKey]?.[subjectId] === true;
                            const comment = ungroupedPreApprovalComments[questionKey]?.[subjectId] ?? '';
                            return (
                              <div
                                key={subjectId}
                                style={{
                                  padding: '8px 12px',
                                  background: token.colorFillAlter,
                                  borderRadius: token.borderRadiusSM,
                                  marginBottom: 8,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                  <Text>{label}</Text>
                                  <Space>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Pre-approved</Text>
                                    <Switch
                                      size="small"
                                      checked={isPreApproved}
                                      onChange={(checked) => setUngroupedSubjectPreApproved(questionKey, subjectId, checked)}
                                      disabled={readOnlyForCurrentAssignee}
                                    />
                                  </Space>
                                </div>
                                {isPreApproved && (
                                  <div style={{ marginTop: 8 }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Comment (required for pre-approval)</Text>
                                    <Input.TextArea
                                      size="small"
                                      placeholder="Comment for auto-approve message"
                                      value={comment}
                                      onChange={(e) => setUngroupedPreApprovalComment(questionKey, subjectId, e.target.value)}
                                      disabled={readOnlyForCurrentAssignee}
                                      rows={2}
                                      style={{ marginTop: 4 }}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </Space>
                      )}
                    </div>
                  </Space>
                </div>
              ),
            };
          })}
        />
      </Card>
      )}

      <Modal
        title={editingGroup ? 'Edit group' : 'Create group'}
        open={groupModalOpen}
        onOk={handleSaveGroup}
        onCancel={() => {
          setGroupModalOpen(false);
          groupForm.resetFields();
          setEditingGroup(null);
          setGroupModalQuestionKey(null);
        }}
        okText={editingGroup ? 'Update' : 'Create'}
      >
        <Form form={groupForm} layout="vertical">
          <Form.Item
            name="name"
            label="Group name"
            rules={[{ required: true, message: 'Enter group name' }]}
          >
            <Input placeholder="Group name" />
          </Form.Item>
          <Form.Item
            name="subjectIds"
            label="Subjects in this group"
            rules={[{ required: true, message: 'Select at least one subject', type: 'array', min: 1 }]}
          >
            <Select
              mode="multiple"
              placeholder="Select subjects"
              options={subjectsOptions}
              optionFilterProp="label"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
