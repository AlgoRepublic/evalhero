import React from 'react';
import {
  Card,
  Table,
  Space,
  Typography,
  Button,
  message,
} from 'antd';
import { DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { Profile } from '../../../features/auth/authSlice';

const { Title } = Typography;

interface Certificate {
  _id: string;
  courseId: string;
  userId: string | Profile;
  templateId: string;
  issuedAt: string;
  issuedBy: string | Profile;
  pdfUrl?: string;
}

interface CertificatesTabProps {
  courseId: string;
}

const CertificatesTab: React.FC<CertificatesTabProps> = () => {
  // TODO: Implement API call to fetch certificates
  // const { data, isLoading } = useGetCourseCertificatesQuery(courseId);
  const certificates: Certificate[] = [];

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_: any, record: Certificate) => {
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
      render: (_: any, record: Certificate) => {
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
      render: (_: any, record: Certificate) => (
        <Space>
          {record.pdfUrl && (
            <>
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => window.open(record.pdfUrl, '_blank')}
              >
                View
              </Button>
              <Button
                type="link"
                icon={<DownloadOutlined />}
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = record.pdfUrl!;
                  link.download = `certificate-${record._id}.pdf`;
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
          <Title level={4}>Certificates</Title>
          <Button
            type="primary"
            onClick={() => {
              message.info('Issue certificate feature coming soon');
            }}
          >
            Issue Certificate
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={certificates}
          rowKey="_id"
          pagination={false}
        />
      </Space>
    </Card>
  );
};

export default CertificatesTab;
