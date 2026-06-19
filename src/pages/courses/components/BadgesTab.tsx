import React from 'react';
import {
  Card,
  Table,
  Space,
  Typography,
  Button,
  Image,
  message,
  theme,
} from 'antd';
import { DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { Profile } from '../../../features/auth/authSlice';

const { Title } = Typography;

interface Badge {
  _id: string;
  courseId: string;
  userId: string | Profile;
  templateId: string;
  issuedAt: string;
  issuedBy: string | Profile;
  imageUrl?: string;
}

interface BadgesTabProps {
  courseId: string;
}

const BadgesTab: React.FC<BadgesTabProps> = () => {
  const { token } = theme.useToken();
  // TODO: Implement API call to fetch badges
  // const { data, isLoading } = useGetCourseBadgesQuery(courseId);
  const badges: Badge[] = [];

  const columns = [
    {
      title: 'Badge',
      key: 'badge',
      render: (_: any, record: Badge) =>
        record.imageUrl ? (
          <Image
            src={record.imageUrl}
            alt="Badge"
            width={50}
            height={50}
            style={{ objectFit: 'contain' }}
          />
        ) : (
          <div
            style={{
              width: 50,
              height: 50,
              backgroundColor: token.colorFillTertiary,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 12, color: token.colorTextPlaceholder }}>No Image</span>
          </div>
        ),
    },
    {
      title: 'User',
      key: 'user',
      render: (_: any, record: Badge) => {
        const user = record.userId as Profile;
        const userName =
          typeof user?.user === 'object' && user?.user !== null
            ? user.user.name
            : user?._id || 'Unknown';
        return <span>{userName}</span>;
      },
    },
    {
      title: 'Issued At',
      dataIndex: 'issuedAt',
      key: 'issuedAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Issued By',
      key: 'issuedBy',
      render: (_: any, record: Badge) => {
        const issuer = record.issuedBy as Profile;
        const issuerName =
          typeof issuer?.user === 'object' && issuer?.user !== null
            ? issuer.user.name
            : issuer?._id || 'Unknown';
        return <span>{issuerName}</span>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Badge) => (
        <Space>
          {record.imageUrl && (
            <>
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => window.open(record.imageUrl, '_blank')}
              >
                View
              </Button>
              <Button
                type="link"
                icon={<DownloadOutlined />}
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = record.imageUrl!;
                  link.download = `badge-${record._id}.png`;
                  link.click();
                }}
              >
                Download
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Title level={4}>Badges</Title>
          <Button
            type="primary"
            onClick={() => {
              message.info('Issue badge feature coming soon');
            }}
          >
            Issue Badge
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={badges}
          rowKey="_id"
          pagination={false}
        />
      </Space>
    </Card>
  );
};

export default BadgesTab;
