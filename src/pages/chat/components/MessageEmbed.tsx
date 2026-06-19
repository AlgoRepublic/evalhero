import { Card, Typography, Space, Button, theme } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { Embed } from '../types';
import { useNavigate } from 'react-router-dom';

const { Text, Title } = Typography;

interface MessageEmbedProps {
  embed: Embed;
}

export const MessageEmbed = ({ embed }: MessageEmbedProps) => {
  const { token } = theme.useToken();
  const navigate = useNavigate();

  const getEmbedIcon = () => {
    switch (embed.type) {
      case 'evaluation':
        return '📊';
      case 'form':
        return '📝';
      case 'taskbook':
        return '📚';
      case 'checklist':
        return '✅';
      case 'kb_doc':
        return '📖';
      default:
        return '🔗';
    }
  };

  const handleClick = () => {
    navigate(embed.url);
  };

  return (
    <Card
      size="small"
      style={{
        marginTop: '8px',
        cursor: 'pointer',
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadius,
        backgroundColor: token.colorBgContainer,
        transition: 'all 0.2s',
      }}
      onClick={handleClick}
      hoverable
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = token.colorPrimary;
        e.currentTarget.style.boxShadow = `0 2px 8px ${token.colorPrimaryBg}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = token.colorBorder;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Space>
          <span style={{ fontSize: '20px' }}>{getEmbedIcon()}</span>
          <Title level={5} style={{ margin: 0, fontSize: '14px', color: token.colorText }}>
            {embed.title}
          </Title>
        </Space>
        {embed.description && (
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {embed.description}
          </Text>
        )}
        {embed.thumbnail && (
          <img
            src={embed.thumbnail}
            alt={embed.title}
            style={{
              width: '100%',
              maxHeight: '200px',
              objectFit: 'cover',
              borderRadius: token.borderRadius,
            }}
          />
        )}
        <Button
          type="link"
          size="small"
          icon={<LinkOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          style={{ padding: 0 }}
        >
          View {embed.type}
        </Button>
      </Space>
    </Card>
  );
};

