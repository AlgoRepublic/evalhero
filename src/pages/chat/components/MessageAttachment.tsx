import { Card, Typography, Space, Button, theme } from 'antd';
import { DownloadOutlined, FileOutlined, FileImageOutlined, FilePdfOutlined } from '@ant-design/icons';
import { Attachment } from '../types';

const { Text } = Typography;

interface MessageAttachmentProps {
  attachment: Attachment;
}

export const MessageAttachment = ({ attachment }: MessageAttachmentProps) => {
  const { token } = theme.useToken();

  const getFileIcon = () => {
    if (attachment.type.startsWith('image/')) {
      return <FileImageOutlined style={{ fontSize: '24px', color: token.colorPrimary }} />;
    }
    if (attachment.type === 'application/pdf') {
      return <FilePdfOutlined style={{ fontSize: '24px', color: token.colorError }} />;
    }
    return <FileOutlined style={{ fontSize: '24px', color: token.colorTextSecondary }} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.name;
    link.click();
  };

  return (
    <Card
      size="small"
      style={{
        marginTop: '8px',
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadius,
        backgroundColor: token.colorBgContainer,
      }}
      hoverable
    >
      <Space style={{ width: '100%' }} size="middle">
        {getFileIcon()}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text strong style={{ fontSize: '13px', display: 'block', color: token.colorText }}>
            {attachment.name}
          </Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {formatFileSize(attachment.size)}
          </Text>
        </div>
        <Button
          type="link"
          size="small"
          icon={<DownloadOutlined />}
          onClick={handleDownload}
          style={{ flexShrink: 0 }}
        >
          Download
        </Button>
      </Space>
    </Card>
  );
};




