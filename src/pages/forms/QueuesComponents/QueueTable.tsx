// src/pages/queue/QueueTable.tsx
import React, { useState, useMemo, useCallback } from 'react';
import type { TableColumnsType } from 'antd';
import {
  Table,
  Tag,
  Space,
  DatePicker,
  Select,
  Badge,
  Typography,
  Card,
  Row,
  Col,
  Tooltip,
  Button,
  Grid,
  theme,
  Drawer,
  Empty,
} from 'antd';
import {
  FilterOutlined,
  SyncOutlined,
  AuditOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  QueueFilters,
  useGetQueuesQuery,
  //   useBulkRemindMutation,
  //   useBulkCancelMutation,
  //   useBulkReassignMutation,
} from '../../../services/queueApi.ts';
import { ResponsivePagination } from '../../../components/ResponsivePagination';
import { Assignment } from '../../../services/assignmentsApi.ts';
import { useGetTemplatesQuery } from '../../../services/templatesAPI.ts';
import type { Profile } from '../../../features/auth/authSlice';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';

const { useBreakpoint } = Grid;
const { Text } = Typography;
const { RangePicker } = DatePicker;

const getParticipantName = (x: unknown): string => {
  if (typeof x === 'string') return x;
  if (x && typeof x === 'object' && 'user' in x) {
    const u = (x as { user?: unknown }).user;
    if (u && typeof u === 'object' && u !== null && 'name' in u)
      return String((u as { name?: string }).name ?? '');
  }
  return '';
};

const getParticipantId = (x: string | Profile): string => {
  if (typeof x === 'string') return x;
  return (x as Profile)._id ?? '';
};

interface QueueTableProps {
  profileId?: string;
}

const QueueTable: React.FC<QueueTableProps> = ({
  profileId: profileIdProp,
}) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isTablet = !screens.lg;
  const { token } = theme.useToken();
  const selectedProfileId = useSelector(
    (state: RootState) => state.auth?.selectedProfile?._id
  );
  const profileId = profileIdProp ?? selectedProfileId ?? undefined;

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  //   const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [filters, setFilters] = useState<QueueFilters>({});
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const { data, isFetching } = useGetQueuesQuery({
    ...filters,
    ...(profileIdProp ? { profileId: profileIdProp } : {}),
    page,
    perPage,
  });
  //   const [bulkRemind] = useBulkRemindMutation();
  //   const [bulkCancel] = useBulkCancelMutation();
  //   const [bulkReassign] = useBulkReassignMutation();

  const { data: templatesRes, isFetching: isTemplatesFetching } =
    useGetTemplatesQuery({
      page: 1,
      perPage: 1000,
      // sortBy,
      // order,
    });

  const templatesOptions = templatesRes?.data?.records
    .filter((t) => !!t.currentFormTemplateSchema)
    .map((d) => ({
      label: d.name,
      value: d._id,
      formVersionTemplateId: d?.currentFormTemplateSchema?._id,
    }));

  const navigate = useNavigate();

  const records = data?.data.records || [];
  const total = data?.data.metadata.count || 0;

  //   const rowSelection = {
  //     selectedRowKeys,
  //     onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]),
  //   };

  //   const handleBulkAction = async (
  //     action: 'remind' | 'cancel' | 'reassign',
  //     assigneeId?: string
  //   ) => {
  //     if (selectedRowKeys.length === 0) return;

  //     try {
  //       if (action === 'remind') await bulkRemind(selectedRowKeys).unwrap();
  //       if (action === 'cancel') await bulkCancel(selectedRowKeys).unwrap();
  //       if (action === 'reassign' && assigneeId)
  //         await bulkReassign({ ids: selectedRowKeys, assigneeId }).unwrap();

  //       message.success(`${selectedRowKeys.length} items updated`);
  //       setSelectedRowKeys([]);
  //     } catch {
  //       message.error('Bulk action failed');
  //     }
  //   };

  const handleSubmit = useCallback(
    (id: string) => {
      navigate(`/forms/queues/${id}/submit`);
    },
    [navigate]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.formId && filters.formId.length > 0) count++;
    if (filters.dueRange) count++;
    if (filters.responsibilityStatuses) count++;
    return count;
  }, [filters]);

  const clearAllFilters = useCallback(() => {
    setFilters({});
  }, []);

  // 🔹 Table Columns (responsive: xs / sm / md / lg per Ant Design)
  const columns: TableColumnsType<Assignment> = useMemo(
    () => [
      {
        key: 'assigner',
        title: 'Assigned By',
        dataIndex: 'assigner',
        width: isMobile ? 120 : 130,
        render: (_: unknown, record: Assignment) => {
          const user = record.assigner?.user;
          const name =
            typeof user === 'object' && user !== null && 'name' in user
              ? user.name
              : '';
          const contact =
            typeof user === 'object' && user !== null
              ? ((user as { email?: string; phone?: string }).email ??
                (user as { email?: string; phone?: string }).phone)
              : '';
          return (
            <Tooltip title={contact || undefined}>
              <Text
                strong
                delete={!!record.deletedAt}
                style={{ fontSize: isMobile ? 12 : undefined }}
                ellipsis
              >
                {name || '—'}
              </Text>
            </Tooltip>
          );
        },
      },
      {
        key: 'schedule',
        title: 'Schedule',
        dataIndex: 'startDate',
        width: isMobile ? 150 : 200,
        render: (_: unknown, record: Assignment) => {
          const tpl = record.formTemplate?.name;
          const ver = record.formTemplateSchema?.version;
          const type = record.type;
          const rec = record?.recurrence ?? '';
          const recLabel = rec
            ? rec.charAt(0).toUpperCase() + rec.slice(1)
            : '—';
          const start = record.startDate ? dayjs(record.startDate) : null;
          const due = record.dueDate ? dayjs(record.dueDate) : null;
          const range =
            start && due
              ? isMobile
                ? `${start.format('MMM D')} – ${due.format('MMM D')}`
                : `${start.format('MMM DD')} – ${due.format('MMM DD, YYYY')}`
              : due
                ? isMobile
                  ? `Due: ${due.format('MMM D')}`
                  : `Due: ${due.format('MMM DD, YYYY')}`
                : start
                  ? isMobile
                    ? `from ${start.format('MMM D')}`
                    : `from ${start.format('MMM DD, YYYY')}`
                  : '—';
          const tip = [
            tpl && (ver ? `${tpl} (v${ver})` : tpl),
            start && `Start: ${start.format('MMM DD, YYYY HH:mm')}`,
            due && `Due: ${due.format('MMM DD, YYYY HH:mm')}`,
          ]
            .filter(Boolean)
            .join('\n');
          return (
            <Tooltip title={tip || undefined}>
              <div>
                <Text style={{ fontSize: isMobile ? 12 : undefined }} ellipsis>
                  {tpl || '—'}
                </Text>
                <br />
                <Space size={4} wrap style={{ marginTop: 2 }}>
                  {type === 'recurrence' ? (
                    <Tag
                      style={{ margin: 0 }}
                      icon={!isMobile ? <SyncOutlined spin /> : undefined}
                      color="blue"
                    >
                      {recLabel}
                    </Tag>
                  ) : (
                    <Tag style={{ margin: 0 }} color="green">
                      One time
                    </Tag>
                  )}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {range}
                  </Text>
                </Space>
              </div>
            </Tooltip>
          );
        },
      },
      {
        key: 'participants',
        title: 'Participants',
        width: isMobile ? 140 : 220,
        responsive: ['md'],
        render: (_: unknown, record: Assignment) => {
          const assignees = record.assignees ?? [];
          const subjects = record.subjects ?? [];
          const approvers = record.approvers ?? [];
          const questionApprovers = record.questionApprovers ?? [];
          const omitSignatureApprovers = record.omitSignatureApprovers ?? [];
          const isInAssignees =
            profileId &&
            assignees.some((a) => getParticipantId(a) === profileId);
          const isInSubjects =
            profileId &&
            subjects.some((s) => getParticipantId(s) === profileId);
          const isInApprovers =
            profileId &&
            approvers.some(
              (a) => getParticipantId(a as string | Profile) === profileId
            );
          const isInQApprovers =
            profileId &&
            questionApprovers.some(
              (a) => getParticipantId(a as string | Profile) === profileId
            );
          const isInOmit =
            profileId &&
            omitSignatureApprovers.some(
              (a) => getParticipantId(a as string | Profile) === profileId
            );
          const asgNames =
            assignees
              .map((a) =>
                getParticipantId(a) === profileId
                  ? 'You'
                  : getParticipantName(a)
              )
              .filter(Boolean)
              .join(', ') || '—';
          const subNames =
            subjects
              .map((s) =>
                getParticipantId(s) === profileId
                  ? 'You'
                  : getParticipantName(s)
              )
              .filter(Boolean)
              .join(', ') || '—';
          const appNames =
            approvers
              .map((a) =>
                getParticipantId(a as string | Profile) === profileId
                  ? 'You'
                  : getParticipantName(a)
              )
              .filter(Boolean)
              .join(', ') || '—';
          const qAppNames =
            questionApprovers
              .map((a) =>
                getParticipantId(a as string | Profile) === profileId
                  ? 'You'
                  : getParticipantName(a)
              )
              .filter(Boolean)
              .join(', ') || '—';
          const omitNames =
            omitSignatureApprovers
              .map((item: string | Profile) =>
                getParticipantId(item) === profileId
                  ? 'You'
                  : getParticipantName(item)
              )
              .filter(Boolean)
              .join(', ') || '—';
          const total =
            assignees.length +
            subjects.length +
            approvers.length +
            questionApprovers.length +
            omitSignatureApprovers.length;
          if (total === 0) return <Text type="secondary">—</Text>;

          const youLabel = profileId ? ' (You)' : '';
          return (
            <Space size={4} wrap>
              <Tooltip title={`Assignees: ${asgNames}`}>
                <Tag color="blue" style={{ margin: 0 }}>
                  {assignees.length}
                  {isInAssignees ? youLabel : ''}
                </Tag>
              </Tooltip>
              <Tooltip title={`Subjects: ${subNames}`}>
                <Tag color="purple" style={{ margin: 0 }}>
                  {subjects.length}
                  {isInSubjects ? youLabel : ''}
                </Tag>
              </Tooltip>
              <Tooltip title={`Approvers: ${appNames}`}>
                <Tag color="cyan" style={{ margin: 0 }}>
                  {approvers.length}
                  {isInApprovers ? youLabel : ''}
                </Tag>
              </Tooltip>
              <Tooltip title={`Question Approvers: ${qAppNames}`}>
                <Tag color="orange" style={{ margin: 0 }}>
                  {questionApprovers.length}
                  {isInQApprovers ? youLabel : ''}
                </Tag>
              </Tooltip>
              <Tooltip title={`Omit Signature Approvers: ${omitNames}`}>
                <Tag color="green" style={{ margin: 0 }}>
                  {omitSignatureApprovers.length}
                  {isInOmit ? youLabel : ''}
                </Tag>
              </Tooltip>
            </Space>
          );
        },
      },
      {
        key: 'features',
        title: 'Features',
        width: isMobile ? 80 : 110,
        align: 'center' as const,
        responsive: ['md'],
        render: (_: unknown, record: Assignment) => {
          const mode = record.subjectMode;
          const hasApproval = record.hasApproval ?? false;
          const hasDisputes = record.hasDisputes ?? false;
          const signatureRequired = record.signatureRequired ?? false;
          const approvalRule = record.approvalRule;
          const approvalMinCount = record.approvalMinCount;
          const iconSize = isTablet ? 14 : 16;
          const items: React.ReactNode[] = [];
          if (mode) {
            items.push(
              <Tooltip
                key="mode"
                title={
                  mode === 'single' ? 'Single subject' : 'Multiple subjects'
                }
              >
                <Tag
                  color={mode === 'single' ? 'green' : 'purple'}
                  style={{ margin: 0 }}
                >
                  {String(mode).toUpperCase().slice(0, 1)}
                </Tag>
              </Tooltip>
            );
          }
          if (hasApproval) {
            const t = approvalRule
              ? `Approval (${approvalRule}${approvalRule === 'MIN' && approvalMinCount != null ? ` min ${approvalMinCount}` : ''})`
              : 'Approval';
            items.push(
              <Tooltip key="approval" title={t}>
                <AuditOutlined
                  style={{
                    color: '#52c41a',
                    fontSize: iconSize,
                    margin: '0 2px',
                  }}
                />
              </Tooltip>
            );
          }
          if (hasDisputes) {
            items.push(
              <Tooltip key="disputes" title="Disputes">
                <ExclamationCircleOutlined
                  style={{
                    color: '#1890ff',
                    fontSize: iconSize,
                    margin: '0 2px',
                  }}
                />
              </Tooltip>
            );
          }
          if (signatureRequired) {
            items.push(
              <Tooltip key="signature" title="Signature">
                <FileTextOutlined
                  style={{
                    color: '#722ed1',
                    fontSize: iconSize,
                    margin: '0 2px',
                  }}
                />
              </Tooltip>
            );
          }
          if (items.length === 0) return <Text type="secondary">—</Text>;
          return <Space size={4}>{items}</Space>;
        },
      },
      {
        key: 'actions',
        title: 'Actions',
        width: isMobile ? 90 : 120,
        align: 'center' as const,
        render: (_: unknown, record: Assignment) => (
          <Space
            size={isMobile ? 'small' : 'middle'}
            style={{ width: isMobile ? '100%' : 'auto' }}
            align={isMobile ? 'start' : 'center'}
          >
            <Button
              type="primary"
              size={isMobile ? 'small' : 'middle'}
              block={isMobile}
              onClick={() => handleSubmit(record._id)}
              style={{ minWidth: isMobile ? 70 : 80 }}
            >
              Submit
            </Button>
          </Space>
        ),
      },
    ],
    [isMobile, isTablet, navigate, handleSubmit, profileId]
  );

  const renderFilterControls = () => (
    <>
      <Row
        gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}
        style={{ marginBottom: isMobile ? 12 : 16 }}
      >
        <Col xs={24} sm={12} md={8} lg={8}>
          <Select
            placeholder="Filter by Form"
            allowClear
            mode="multiple"
            style={{ width: '100%' }}
            showSearch
            loading={isTemplatesFetching}
            optionFilterProp="label"
            filterSort={(a, b) =>
              (a?.label ?? '')
                .toLowerCase()
                .localeCompare((b?.label ?? '').toLowerCase())
            }
            options={templatesOptions}
            onChange={(val) => setFilters((f) => ({ ...f, formId: val }))}
            size="middle"
            maxTagCount="responsive"
            value={filters.formId}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={8}>
          <RangePicker
            style={{ width: '100%' }}
            onChange={(dates) =>
              setFilters((f) => ({
                ...f,
                dueRange:
                  dates && dates[0] && dates[1]
                    ? [dates[0].toISOString(), dates[1].toISOString()]
                    : undefined,
              }))
            }
            size="middle"
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={8}>
          <Select
            placeholder="Status"
            allowClear
            mode="multiple"
            style={{ width: '100%' }}
            value={
              Array.isArray(filters.responsibilityStatuses)
                ? filters.responsibilityStatuses
                : filters.responsibilityStatuses
                  ? [filters.responsibilityStatuses]
                  : []
            }
            onChange={(val) =>
              setFilters((f) => ({
                ...f,
                responsibilityStatuses: val.length > 0 ? val : undefined,
              }))
            }
            size="middle"
            maxTagCount="responsive"
          >
            <Select.Option value="pending_submission">
              Pending Submission
            </Select.Option>
            <Select.Option value="pending_approval">
              Pending Approval
            </Select.Option>
            <Select.Option value="pending_signature">
              Pending Signature
            </Select.Option>
            <Select.Option value="pending_question_approval">
              Question Approval
            </Select.Option>
            <Select.Option value="pending_omit_signature_approval">
              Omit Signature Approval
            </Select.Option>
            <Select.Option value="completed">Completed</Select.Option>
            <Select.Option value="not_applicable">Not Applicable</Select.Option>
          </Select>
        </Col>
      </Row>
    </>
  );

  const renderActiveFilterChips = () => {
    if (activeFilterCount === 0) return null;
    const chips: React.ReactNode[] = [];

    if (filters.formId && filters.formId.length > 0) {
      chips.push(
        <Tag
          key="form"
          closable
          onClose={() => setFilters((f) => ({ ...f, formId: undefined }))}
          color="blue"
        >
          Form: {filters.formId.length} selected
        </Tag>
      );
    }
    if (filters.dueRange) {
      chips.push(
        <Tag
          key="date"
          closable
          onClose={() => setFilters((f) => ({ ...f, dueRange: undefined }))}
          color="blue"
        >
          Date range
        </Tag>
      );
    }
    if (filters.responsibilityStatuses) {
      chips.push(
        <Tag
          key="status"
          closable
          onClose={() =>
            setFilters((f) => ({ ...f, responsibilityStatuses: undefined }))
          }
          color="blue"
        >
          Status:{' '}
          {Array.isArray(filters.responsibilityStatuses)
            ? filters.responsibilityStatuses.length
            : 1}{' '}
          selected
        </Tag>
      );
    }

    if (chips.length === 0) return null;

    return (
      <Space wrap style={{ marginBottom: 12 }}>
        {chips}
        {chips.length > 1 && (
          <Tag
            closable
            closeIcon={<ClearOutlined />}
            onClose={clearAllFilters}
            color="red"
          >
            Clear all
          </Tag>
        )}
      </Space>
    );
  };

  const renderMobileCard = (record: Assignment) => {
    const tpl = record.formTemplate?.name || '—';
    const type = record.type;
    const rec = record?.recurrence ?? '';
    const recLabel = rec ? rec.charAt(0).toUpperCase() + rec.slice(1) : '—';
    const start = record.startDate ? dayjs(record.startDate) : null;
    const due = record.dueDate ? dayjs(record.dueDate) : null;
    const dueSummary =
      start && due
        ? `${start.format('MMM D')} – ${due.format('MMM D')}`
        : due
          ? `Due: ${due.format('MMM D')}`
          : start
            ? `from ${start.format('MMM D')}`
            : '—';

    const assignees = record.assignees ?? [];
    const subjects = record.subjects ?? [];
    const approvers = record.approvers ?? [];
    const questionApprovers = record.questionApprovers ?? [];
    const omitSignatureApprovers = record.omitSignatureApprovers ?? [];

    const isInAssignees =
      profileId && assignees.some((a) => getParticipantId(a) === profileId);
    const isInSubjects =
      profileId && subjects.some((s) => getParticipantId(s) === profileId);
    const isInApprovers =
      profileId &&
      approvers.some(
        (a) => getParticipantId(a as string | Profile) === profileId
      );

    const mode = record.subjectMode;
    const hasApproval = record.hasApproval ?? false;
    const hasDisputes = record.hasDisputes ?? false;
    const signatureRequired = record.signatureRequired ?? false;

    const responsibilityStatus = (record as unknown as Record<string, unknown>)
      .responsibilityStatus as string | undefined;

    return (
      <Card
        key={record._id}
        size="small"
        style={{ marginBottom: 8 }}
        styles={{ body: { padding: 12 } }}
      >
        <div style={{ marginBottom: 8 }}>
          <Text strong ellipsis style={{ fontSize: 14, display: 'block' }}>
            {tpl}
          </Text>
          <Space size={4} style={{ marginTop: 4 }}>
            {type === 'recurrence' ? (
              <Tag style={{ margin: 0 }} color="blue">
                {recLabel}
              </Tag>
            ) : (
              <Tag style={{ margin: 0 }} color="green">
                One time
              </Tag>
            )}
          </Space>
        </div>

        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dueSummary}
          </Text>
        </div>

        {responsibilityStatus && (
          <div style={{ marginBottom: 8 }}>
            <Tag
              color={
                responsibilityStatus === 'completed'
                  ? 'green'
                  : responsibilityStatus === 'pending_submission'
                    ? 'blue'
                    : responsibilityStatus === 'pending_approval'
                      ? 'orange'
                      : 'default'
              }
              style={{ margin: 0 }}
            >
              {responsibilityStatus.replace(/_/g, ' ')}
            </Tag>
          </div>
        )}

        {assignees.length + subjects.length + approvers.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <Space size={4} wrap>
              {assignees.length > 0 && (
                <Tooltip
                  title={`Assignees: ${assignees
                    .map((a) =>
                      getParticipantId(a) === profileId
                        ? 'You'
                        : getParticipantName(a)
                    )
                    .filter(Boolean)
                    .join(', ')}`}
                >
                  <Tag color="blue" style={{ margin: 0 }}>
                    A:{assignees.length}
                    {isInAssignees ? '*' : ''}
                  </Tag>
                </Tooltip>
              )}
              {subjects.length > 0 && (
                <Tooltip
                  title={`Subjects: ${subjects
                    .map((s) =>
                      getParticipantId(s) === profileId
                        ? 'You'
                        : getParticipantName(s)
                    )
                    .filter(Boolean)
                    .join(', ')}`}
                >
                  <Tag color="purple" style={{ margin: 0 }}>
                    S:{subjects.length}
                    {isInSubjects ? '*' : ''}
                  </Tag>
                </Tooltip>
              )}
              {approvers.length > 0 && (
                <Tooltip
                  title={`Approvers: ${approvers
                    .map((a) =>
                      getParticipantId(a as string | Profile) === profileId
                        ? 'You'
                        : getParticipantName(a)
                    )
                    .filter(Boolean)
                    .join(', ')}`}
                >
                  <Tag color="cyan" style={{ margin: 0 }}>
                    Ap:{approvers.length}
                    {isInApprovers ? '*' : ''}
                  </Tag>
                </Tooltip>
              )}
              {questionApprovers.length > 0 && (
                <Tag color="orange" style={{ margin: 0 }}>
                  QA:{questionApprovers.length}
                </Tag>
              )}
              {omitSignatureApprovers.length > 0 && (
                <Tag color="green" style={{ margin: 0 }}>
                  OS:{omitSignatureApprovers.length}
                </Tag>
              )}
            </Space>
          </div>
        )}

        {(mode || hasApproval || hasDisputes || signatureRequired) && (
          <div style={{ marginBottom: 8 }}>
            <Space size={4} wrap>
              {mode && (
                <Tag
                  color={mode === 'single' ? 'green' : 'purple'}
                  style={{ margin: 0 }}
                >
                  {String(mode).toUpperCase().slice(0, 1)}
                </Tag>
              )}
              {hasApproval && (
                <Tooltip title="Approval">
                  <AuditOutlined style={{ color: '#52c41a', fontSize: 14 }} />
                </Tooltip>
              )}
              {hasDisputes && (
                <Tooltip title="Disputes">
                  <ExclamationCircleOutlined
                    style={{ color: '#1890ff', fontSize: 14 }}
                  />
                </Tooltip>
              )}
              {signatureRequired && (
                <Tooltip title="Signature">
                  <FileTextOutlined
                    style={{ color: '#722ed1', fontSize: 14 }}
                  />
                </Tooltip>
              )}
            </Space>
          </div>
        )}

        <Button
          type="primary"
          block
          onClick={() => handleSubmit(record._id)}
          style={{ marginTop: 4 }}
        >
          Submit
        </Button>
      </Card>
    );
  };

  if (isMobile) {
    return (
      <>
        <div style={{ marginBottom: 12 }}>
          <Space size={8} align="center">
            <Button
              icon={<FilterOutlined />}
              onClick={() => setFilterDrawerOpen(true)}
              size="middle"
            >
              Filters
              {activeFilterCount > 0 && (
                <Badge
                  count={activeFilterCount}
                  size="small"
                  style={{ marginLeft: 4 }}
                />
              )}
            </Button>
            <Badge count={total} style={{ backgroundColor: '#52c41a' }} />
          </Space>
          {renderActiveFilterChips()}
        </div>

        <div style={{ paddingBottom: 80 }}>
          {records.length === 0 && !isFetching ? (
            <Empty description="No queue items" />
          ) : (
            records.map(renderMobileCard)
          )}
        </div>

        <ResponsivePagination
          page={page}
          perPage={perPage}
          total={total}
          onChange={(p, s) => {
            setPage(p);
            setPerPage(s);
          }}
          loading={isFetching}
        />

        <Drawer
          title="Filters"
          placement="bottom"
          open={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
          height="auto"
          extra={
            activeFilterCount > 0 ? (
              <Button
                type="text"
                danger
                icon={<ClearOutlined />}
                onClick={clearAllFilters}
                size="small"
              >
                Clear all
              </Button>
            ) : undefined
          }
        >
          {renderFilterControls()}
          <Button
            type="primary"
            block
            onClick={() => setFilterDrawerOpen(false)}
            style={{ marginTop: 8 }}
          >
            Apply Filters
          </Button>
        </Drawer>
      </>
    );
  }

  return (
    <Card
      title={
        <Space size="middle">
          <FilterOutlined />
          <Text>Queue / Status</Text>
          <Badge count={total} style={{ backgroundColor: '#52c41a' }} />
        </Space>
      }
      styles={{ body: { padding: token.paddingMD } }}
    >
      {/* Filters - Desktop */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8} lg={8}>
          <Select
            placeholder="Filter by Form"
            allowClear
            mode="multiple"
            style={{ width: '100%' }}
            showSearch
            loading={isTemplatesFetching}
            optionFilterProp="label"
            filterSort={(a, b) =>
              (a?.label ?? '')
                .toLowerCase()
                .localeCompare((b?.label ?? '').toLowerCase())
            }
            options={templatesOptions}
            onChange={(val) => setFilters((f) => ({ ...f, formId: val }))}
            size="middle"
            maxTagCount="responsive"
            value={filters.formId}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={8}>
          <RangePicker
            style={{ width: '100%' }}
            onChange={(dates) =>
              setFilters((f) => ({
                ...f,
                dueRange:
                  dates && dates[0] && dates[1]
                    ? [dates[0].toISOString(), dates[1].toISOString()]
                    : undefined,
              }))
            }
            size="middle"
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={8}>
          <Select
            placeholder="Status"
            allowClear
            mode="multiple"
            style={{ width: '100%' }}
            value={
              Array.isArray(filters.responsibilityStatuses)
                ? filters.responsibilityStatuses
                : filters.responsibilityStatuses
                  ? [filters.responsibilityStatuses]
                  : []
            }
            onChange={(val) =>
              setFilters((f) => ({
                ...f,
                responsibilityStatuses: val.length > 0 ? val : undefined,
              }))
            }
            size="middle"
            maxTagCount="responsive"
          >
            <Select.Option value="pending_submission">
              Pending Submission
            </Select.Option>
            <Select.Option value="pending_approval">
              Pending Approval
            </Select.Option>
            <Select.Option value="pending_signature">
              Pending Signature
            </Select.Option>
            <Select.Option value="pending_question_approval">
              Question Approval
            </Select.Option>
            <Select.Option value="pending_omit_signature_approval">
              Omit Signature Approval
            </Select.Option>
            <Select.Option value="completed">Completed</Select.Option>
            <Select.Option value="not_applicable">Not Applicable</Select.Option>
          </Select>
        </Col>
      </Row>

      <Table<Assignment>
        columns={columns}
        dataSource={records}
        loading={isFetching}
        rowKey="_id"
        pagination={false}
        scroll={{ x: true }}
        size="middle"
      />

      <div style={{ marginTop: token.marginMD }}>
        <ResponsivePagination
          page={page}
          perPage={perPage}
          total={total}
          onChange={(p, s) => {
            setPage(p);
            setPerPage(s);
          }}
          loading={isFetching}
        />
      </div>
    </Card>
  );
};

export default QueueTable;
