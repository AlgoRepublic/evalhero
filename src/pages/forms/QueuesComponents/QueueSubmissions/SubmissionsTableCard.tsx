import React from 'react';
import { Button, Card, Flex, message, Space, Table, Tag, Typography, theme } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetQueueSubmissionsQuery, useGetChannelMutation, queueApi } from '../../../../services/queueApi';
import type { ChannelMessage } from '../../../../services/queueApi';
import { store } from '../../../../store';
import {
  downloadBulkSubmissionsAsZip,
  type SubmissionPdfExportInput,
  type FetchMessagesForSubmission,
  type ResolvePreApproval,
} from '../../../../utils/submissionPdfExport';
import type { Assignment } from '../../../../services/assignmentsApi';

const { Text } = Typography;

export interface SubmissionsTableCardProps {
  queueId: string;
  subjectId?: string | undefined;
  selectedAssigneeId?: string | undefined;
  assignment: Assignment;
}

export const SubmissionsTableCard: React.FC<SubmissionsTableCardProps> = ({
  queueId,
  assignment,
}) => {
  const { token } = theme.useToken();
  const [getChannel] = useGetChannelMutation();

  const { data: submissionsData } = useGetQueueSubmissionsQuery(
    {
      assignmentId: queueId,
      perPage: 10000,
      page: 1,
      sortBy: 'updatedAt',
      order: 'desc',
    },
    {
      skip: !queueId,
      refetchOnMountOrArgChange: true,
    }
  );

  const records = submissionsData?.data?.submissions?.records ?? [];
  const completedRecords = records.filter((r: { status?: string }) => r.status === 'complete');
  const [selectedRowKeys, setSelectedRowKeys] = React.useState<React.Key[]>([]);
  const [isBulkDownloading, setIsBulkDownloading] = React.useState(false);
  const [bulkProgress, setBulkProgress] = React.useState<{ current: number; total: number } | null>(null);

  const fetchMessagesForSubmission = React.useCallback<FetchMessagesForSubmission>(
    async (submissionId) => {
      const approvalChan = await getChannel({ submissionId, channelType: 'approval' }).unwrap();
      const approvalChannelId = (approvalChan as { data?: { _id?: string } })?.data?._id;
      let approvalMessages: Array<{
        action: string;
        comment?: string;
        text?: string;
        sentBy?: { user?: { name?: string } };
        createdAt?: string;
      }> = [];
      if (approvalChannelId) {
        const msgRes = await store.dispatch(
          queueApi.endpoints.getChannelMessages.initiate({ channelId: approvalChannelId })
        );
        const list =
          (msgRes as { data?: { data?: { records?: ChannelMessage[] } } })?.data?.data?.records ?? [];
        approvalMessages = list.map((msg: ChannelMessage) => ({
          action: msg.action ?? '',
          comment: msg.actionData?.comment ?? msg.actionData?.text,
          text: msg.actionData?.text,
          sentBy: msg.sentBy,
          createdAt: msg.createdAt,
        }));
      }
      const disputeChan = await getChannel({ submissionId, channelType: 'dispute' }).unwrap();
      const disputeChannelId = (disputeChan as { data?: { _id?: string } })?.data?._id;
      let disputeMessages: Array<{
        action: string;
        text?: string;
        comment?: string;
        signature?: { dataUrl?: string };
        sentBy?: { user?: { name?: string } };
        createdAt?: string;
      }> = [];
      if (disputeChannelId) {
        const msgRes = await store.dispatch(
          queueApi.endpoints.getChannelMessages.initiate({ channelId: disputeChannelId })
        );
        const list =
          (msgRes as { data?: { data?: { records?: ChannelMessage[] } } })?.data?.data?.records ?? [];
        const apiBase = import.meta.env.VITE_API_URL ?? '';
        disputeMessages = list.map((msg: ChannelMessage) => {
          const action = msg.action ?? '';
          let dataUrl: string | undefined;
          const fileData = msg.actionData?.file;
          if (
            (action === 'signature' || action === 'submission:signature') &&
            fileData
          ) {
            if (typeof fileData === 'string') {
              dataUrl = fileData.startsWith('http')
                ? fileData
                : fileData.startsWith('/')
                  ? `${apiBase}${fileData}`
                  : `${apiBase}/${fileData}`;
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
      return { approvalMessages, disputeMessages };
    },
    [getChannel]
  );

  const resolvePreApprovalForPdf = React.useCallback<ResolvePreApproval>(
    (_sub, subjectIdVal, assigneeIdVal) => {
      if (!subjectIdVal || !assigneeIdVal || !assignment?.submitMeta) return undefined;
      const submitMeta = assignment.submitMeta as {
        preApprovalByAssignee?: Record<
          string,
          {
            preApprovalByQuestion?: Record<
              string,
              {
                globalGroups?: Array<{
                  subjectIds?: string[];
                  preApproved?: boolean;
                  preApprovalComment?: string;
                }>;
                ungroupedSubjects?: Array<{
                  preApproved?: boolean;
                  preApprovalComment?: string;
                }>;
              }
            >;
          }
        >;
      };
      const byAssignee =
        submitMeta.preApprovalByAssignee?.[assigneeIdVal]?.preApprovalByQuestion;
      if (!byAssignee) return undefined;
      for (const q of Object.values(byAssignee)) {
        for (const g of q?.globalGroups ?? []) {
          if (g.subjectIds?.includes(subjectIdVal) && g.preApproved) {
            return { preApproved: true, preApprovalComment: g.preApprovalComment };
          }
        }
        for (const u of q?.ungroupedSubjects ?? []) {
          if (u.preApproved)
            return { preApproved: true, preApprovalComment: u.preApprovalComment };
        }
      }
      return undefined;
    },
    [assignment]
  );

  const handleBulkDownloadZip = React.useCallback(
    async (useSelected: boolean) => {
      const toDownload = useSelected
        ? completedRecords.filter(
            (r: { _id?: string }) => r._id && selectedRowKeys.includes(r._id)
          )
        : completedRecords;
      if (toDownload.length === 0) {
        message.warning(
          useSelected
            ? 'Select at least one submission'
            : 'No submissions to download'
        );
        return;
      }
      setIsBulkDownloading(true);
      setBulkProgress({ current: 0, total: toDownload.length });
      try {
        await downloadBulkSubmissionsAsZip(
          toDownload as SubmissionPdfExportInput['submission'][],
          assignment as unknown as SubmissionPdfExportInput['assignment'],
          fetchMessagesForSubmission,
          resolvePreApprovalForPdf,
          {
            onProgress: (current, total) =>
              setBulkProgress({ current, total }),
            zipFilename: `submissions-${queueId}-${dayjs().format('YYYY-MM-DD')}.zip`,
          }
        );
        message.success(`Downloaded ${toDownload.length} submission(s) as ZIP`);
        setSelectedRowKeys([]);
      } catch (e) {
        console.error('Bulk download failed:', e);
        message.error('Failed to download ZIP. Please try again.');
      } finally {
        setIsBulkDownloading(false);
        setBulkProgress(null);
      }
    },
    [
      completedRecords,
      selectedRowKeys,
      assignment,
      queueId,
      fetchMessagesForSubmission,
      resolvePreApprovalForPdf,
    ]
  );

  if (completedRecords.length === 0) return null;

  type SubmissionRecord = {
    _id: string;
    assignee?: { user?: { name?: string; email?: string } } | string;
    subject?: { user?: { name?: string; email?: string } } | string;
    status?: string;
    approvalStatus?: string;
    createdAt?: string;
    updatedAt?: string;
  };

  return (
    <Card
      style={{
        borderRadius: 12,
        boxShadow: token.boxShadowSecondary,
        background: token.colorBgContainer,
      }}
      title={
        <Flex align="center" justify="space-between" wrap>
          <Text strong>Submissions ({completedRecords.length})</Text>
          <Space>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleBulkDownloadZip(true)}
              loading={isBulkDownloading}
              disabled={
                selectedRowKeys.length === 0 || isBulkDownloading
              }
            >
              Download selected as ZIP
            </Button>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleBulkDownloadZip(false)}
              loading={isBulkDownloading}
              disabled={isBulkDownloading}
            >
              Download all as ZIP
            </Button>
            {bulkProgress && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Generating {bulkProgress.current}/{bulkProgress.total}…
              </Text>
            )}
          </Space>
        </Flex>
      }
    >
      <Table<SubmissionRecord>
        size="small"
        rowKey={(r) => r._id}
        dataSource={completedRecords as SubmissionRecord[]}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        columns={[
          {
            title: 'Assignee',
            key: 'assignee',
            width: 160,
            ellipsis: true,
            render: (_, record) => {
              const a = record.assignee;
              if (!a) return '—';
              if (typeof a === 'object' && a?.user) {
                const u = a.user;
                return typeof u === 'object' ? (u.name ?? u.email ?? '—') : String(u);
              }
              return typeof a === 'string' ? a : '—';
            },
          },
          {
            title: 'Subject',
            key: 'subject',
            width: 160,
            ellipsis: true,
            render: (_, record) => {
              const s = record.subject;
              if (!s) return '—';
              if (typeof s === 'object' && s?.user) {
                const u = s.user;
                return typeof u === 'object' ? (u.name ?? u.email ?? '—') : String(u);
              }
              return typeof s === 'string' ? s : '—';
            },
          },
          {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 140,
            render: (val: string) => (
              <Tag
                color={
                  val === 'complete'
                    ? 'green'
                    : val === 'rejected'
                      ? 'red'
                      : 'blue'
                }
              >
                {String(val ?? '').replace(/_/g, ' ')}
              </Tag>
            ),
          },
          {
            title: 'Approval',
            dataIndex: 'approvalStatus',
            key: 'approvalStatus',
            width: 100,
            render: (val: string) =>
              val ? (
                <Tag
                  color={
                    val === 'approved'
                      ? 'green'
                      : val === 'rejected'
                        ? 'red'
                        : 'default'
                  }
                >
                  {String(val)}
                </Tag>
              ) : null,
          },
          {
            title: 'Created',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 150,
            render: (val: string) =>
              val ? dayjs(val).format('MMM D, YY h:mm A') : '—',
          },
          {
            title: 'Updated',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            width: 150,
            render: (val: string) =>
              val ? dayjs(val).format('MMM D, YY h:mm A') : '—',
          },
        ]}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
};
