import { Modal, Table, Button, Typography, Grid, theme, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useGetPendingInvitesQuery } from '../../../services/inviteApi';

const { useBreakpoint } = Grid;

const { Text } = Typography;

interface PendingUsersModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PendingUsersModal({
  open,
  onClose,
}: PendingUsersModalProps) {
  const screens = useBreakpoint();
  const isMobile = !screens.md; // Below md (768px) is mobile
  const { token } = theme.useToken();
  const { data: pendingInvites, isFetching } = useGetPendingInvitesQuery();

  const handleCopy = (email: string) => {
    navigator.clipboard.writeText(email);
    message.success(`Copied ${email}`);
  };

  const columns = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => (
        <Text style={{ fontSize: isMobile ? '13px' : undefined }}>
          {email}
        </Text>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      align: 'center' as const,
      render: (_: unknown, record: { email: string }) => (
        <Button
          type="primary"
          icon={<CopyOutlined />}
          onClick={() => handleCopy(record.email)}
          size={isMobile ? 'small' : 'middle'}
        >
          Copy
        </Button>
      ),
    },
  ];

  const dataSource = pendingInvites?.data?.invites?.records?.map((invite) => ({ email: invite.email ?? invite.phone ?? '' })) || [];

  return (
    <Modal
      open={open}
      title="Pending Users"
      onCancel={onClose}
      footer={[
        <Button 
          key="close" 
          type="primary" 
          onClick={onClose}
          block={isMobile}
          size={isMobile ? 'middle' : 'large'}
        >
          Close
        </Button>,
      ]}
      centered
      width={isMobile ? '95%' : 600}
      styles={{
        body: {
          background: token.colorBgContainer,
          padding: isMobile ? token.paddingXS : undefined,
        },
      }}
    >
      <Table
        rowKey="email"
        columns={columns}
        dataSource={dataSource}
        loading={isFetching}
        pagination={false}
        bordered={false}
        size={isMobile ? 'small' : 'middle'}
        scroll={isMobile ? { x: 'max-content' } : undefined}
        style={{
          //   borderRadius: token.borderRadiusLG,
          overflow: 'hidden',
        }}
      />
    </Modal>
  );
}
