// src/pages/schedules/SchedulesTable.tsx
import React, { useState, useMemo, useCallback } from 'react';
import type { TableColumnsType, MenuProps } from 'antd';
import {
  Table,
  Button,
  Space,
  Popconfirm,
  Tooltip,
  Tag,
  Typography,
  message,
  Grid,
  theme,
  Card,
  Dropdown,
  Empty,
} from 'antd';
import type { SorterResult } from 'antd/es/table/interface';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Assignment,
  useGetAssignmentsQuery,
  useDeleteAssignmentMutation,
} from '../../../services/assignmentsApi';
import { ResponsivePagination } from '../../../components/ResponsivePagination';
import {
  SyncOutlined,
  AuditOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  MoreOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { usePermission } from '../../../hooks/usePermission';

const { useBreakpoint } = Grid;
const { Text } = Typography;

const SchedulesTable: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isTablet = !screens.lg;
  const { token } = theme.useToken();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('assigner');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const { data, isFetching } = useGetAssignmentsQuery({
    page,
    perPage,
    sortBy,
    order,
  });

  const [deleteAssignment] = useDeleteAssignmentMutation();

  const navigate = useNavigate();

  // Permission checks
  const canEdit = usePermission('schedule::edit');
  const canDelete = usePermission('schedule::delete');

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteAssignment(id).unwrap();
        message.success('Schedule deleted');
      } catch {
        message.error('Failed to delete');
      }
    },
    [deleteAssignment]
  );

  const columns: TableColumnsType<Assignment> = useMemo(
    () => [
      {
        key: 'assigner',
        title: 'Assigned By',
        dataIndex: 'assigner',
        width: isMobile ? 130 : 130,
        sorter: true,
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
        width: isMobile ? 160 : 200,
        sorter: true,
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
        width: isMobile ? 90 : 140,
        responsive: ['md'],
        render: (_: unknown, record: Assignment) => {
          const a = record.assignees?.length || 0;
          const s = record.subjects?.length || 0;
          const p = record.approvers?.length || 0;
          const aNames =
            (record.assignees ?? [])
              .map((x) =>
                typeof x?.user === 'object' && x?.user && 'name' in x.user
                  ? (x.user as { name?: string }).name
                  : ''
              )
              .filter(Boolean)
              .join(', ') || '—';
          const sNames =
            (record.subjects ?? [])
              .map((x) =>
                typeof x?.user === 'object' && x?.user && 'name' in x.user
                  ? (x.user as { name?: string }).name
                  : ''
              )
              .filter(Boolean)
              .join(', ') || '—';
          const pNames =
            (record.approvers ?? [])
              .map((a) => {
                if (typeof a === 'string') return '';
                const u = (a as { user?: { name?: string } })?.user;
                return (
                  (typeof u === 'object' && u && 'name' in u
                    ? (u as { name: string }).name
                    : '') || ''
                );
              })
              .filter(Boolean)
              .join(', ') || '—';
          const pTip = record.configSet
            ? `Approvers: ${pNames}\n🔒 Config: ${record.configSet.name}`
            : `Approvers: ${pNames}`;
          if (a === 0 && s === 0 && p === 0)
            return <Text type="secondary">—</Text>;
          return (
            <Space size={4} wrap>
              <Tooltip title={`Assignees: ${aNames}`}>
                <Tag color="blue" style={{ margin: 0 }}>
                  {a}
                </Tag>
              </Tooltip>
              <Tooltip title={`Subjects: ${sNames}`}>
                <Tag color="purple" style={{ margin: 0 }}>
                  {s}
                </Tag>
              </Tooltip>
              <Tooltip title={pTip}>
                <Tag color="orange" style={{ margin: 0 }}>
                  {p}
                  {record.configSet ? ' 🔒' : ''}
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
        width: isMobile ? 100 : 150,
        align: 'center' as const,
        render: (_: unknown, record: Assignment) => (
          <Space
            size={isMobile ? 'small' : 'middle'}
            style={{ width: isMobile ? '100%' : 'auto' }}
            align={isMobile ? 'start' : 'center'}
          >
            {canEdit && (
              <Button
                type="primary"
                size={isMobile ? 'small' : 'middle'}
                block={isMobile}
                onClick={() => navigate(`/forms/schedules/edit/${record._id}`)}
                style={{ minWidth: isMobile ? 64 : 80 }}
              >
                Edit
              </Button>
            )}
            {canDelete && (
              <Popconfirm
                title="Are you sure you want to delete this schedule?"
                onConfirm={() => handleDelete(record._id)}
              >
                <Button
                  type="primary"
                  danger
                  size={isMobile ? 'small' : 'middle'}
                  block={isMobile}
                  style={{ minWidth: isMobile ? 64 : 80 }}
                >
                  Delete
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ],
    [isMobile, isTablet, canEdit, canDelete, navigate, handleDelete]
  );

  const mobileCards = useMemo(() => {
    const records = data?.data.records;
    if (!records || records.length === 0) {
      return <Empty description="No schedules" />;
    }
    return records.map((record) => {
      const user = record.assigner?.user;
      const assignerName =
        typeof user === 'object' && user !== null && 'name' in user
          ? user.name
          : '';

      const tpl = record.formTemplate?.name;
      const type = record.type;
      const rec = record?.recurrence ?? '';
      const recLabel = rec ? rec.charAt(0).toUpperCase() + rec.slice(1) : '—';

      const start = record.startDate ? dayjs(record.startDate) : null;
      const due = record.dueDate ? dayjs(record.dueDate) : null;
      const range =
        start && due
          ? `${start.format('MMM D')} – ${due.format('MMM D')}`
          : start
            ? `from ${start.format('MMM D')}`
            : '—';

      const a = record.assignees?.length || 0;
      const s = record.subjects?.length || 0;
      const p = record.approvers?.length || 0;

      const mode = record.subjectMode;
      const hasApproval = record.hasApproval ?? false;
      const hasDisputes = record.hasDisputes ?? false;
      const signatureRequired = record.signatureRequired ?? false;

      const dropdownItems: MenuProps['items'] = [];
      if (canEdit) {
        dropdownItems.push({
          key: 'edit',
          icon: <EditOutlined />,
          label: 'Edit',
          onClick: () => navigate(`/forms/schedules/edit/${record._id}`),
        });
      }
      if (canDelete) {
        dropdownItems.push({
          key: 'delete',
          icon: <DeleteOutlined />,
          label: (
            <Popconfirm
              title="Are you sure you want to delete this schedule?"
              onConfirm={(e) => {
                e?.stopPropagation();
                handleDelete(record._id);
              }}
              onCancel={(e) => e?.stopPropagation()}
            >
              <span>Delete</span>
            </Popconfirm>
          ),
          danger: true,
        });
      }

      return (
        <Card
          key={record._id}
          size="small"
          style={{ marginBottom: 8 }}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 8,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text
                strong
                delete={!!record.deletedAt}
                style={{ fontSize: 14, display: 'block' }}
              >
                {assignerName || '—'}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                {tpl || '—'}
              </Text>
            </div>
            {type === 'recurrence' ? (
              <Tag
                style={{ margin: 0, marginLeft: 8, flexShrink: 0 }}
                icon={<SyncOutlined spin />}
                color="blue"
              >
                {recLabel}
              </Tag>
            ) : (
              <Tag
                style={{ margin: 0, marginLeft: 8, flexShrink: 0 }}
                color="green"
              >
                One time
              </Tag>
            )}
          </div>

          <Text
            type="secondary"
            style={{ fontSize: 12, display: 'block', marginBottom: 8 }}
          >
            {range}
          </Text>

          <Space size={4} wrap style={{ marginBottom: 8 }}>
            {a > 0 && (
              <Tooltip title="Assignees">
                <Tag color="blue" style={{ margin: 0 }}>
                  {a}
                </Tag>
              </Tooltip>
            )}
            {s > 0 && (
              <Tooltip title="Subjects">
                <Tag color="purple" style={{ margin: 0 }}>
                  {s}
                </Tag>
              </Tooltip>
            )}
            {p > 0 && (
              <Tooltip title="Approvers">
                <Tag color="orange" style={{ margin: 0 }}>
                  {p}
                  {record.configSet ? ' 🔒' : ''}
                </Tag>
              </Tooltip>
            )}
            {mode && (
              <Tooltip
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
                <FileTextOutlined style={{ color: '#722ed1', fontSize: 14 }} />
              </Tooltip>
            )}
          </Space>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {canEdit && (
              <Button
                type="primary"
                size="small"
                block
                onClick={() => navigate(`/forms/schedules/edit/${record._id}`)}
              >
                Edit
              </Button>
            )}
            {canDelete && dropdownItems.length > 0 && (
              <Dropdown menu={{ items: dropdownItems }} trigger={['click']}>
                <Button size="small" icon={<MoreOutlined />} />
              </Dropdown>
            )}
          </div>
        </Card>
      );
    });
  }, [data, canEdit, canDelete, navigate, handleDelete]);

  return (
    <div style={{ padding: isMobile ? 0 : token.paddingMD }}>
      {!isMobile && (
        <Table<Assignment>
          columns={columns}
          dataSource={data?.data.records}
          loading={isFetching}
          rowKey="_id"
          pagination={false}
          scroll={{ x: true }}
          size="middle"
          onChange={(_, __, sorter) => {
            const s = Array.isArray(sorter)
              ? sorter[0]
              : (sorter as SorterResult<Assignment>);
            if (s && s.field) {
              setSortBy(String(s.field));
              setOrder(s.order === 'ascend' ? 'asc' : 'desc');
            }
          }}
          showSorterTooltip
        />
      )}
      {isMobile && (
        <div style={{ paddingBottom: 80 }}>
          {isFetching ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Text type="secondary">Loading...</Text>
            </div>
          ) : (
            mobileCards
          )}
        </div>
      )}
      <div style={{ marginTop: isMobile ? token.marginSM : token.marginMD }}>
        <ResponsivePagination
          page={page}
          perPage={perPage}
          total={data?.data.metadata.count || 0}
          onChange={(p, s) => {
            setPage(p);
            setPerPage(s);
          }}
          loading={isFetching}
        />
      </div>
    </div>
  );
};

export default SchedulesTable;
