import { Layout, Typography, Button, Space, Divider, theme, Grid } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Message, Thread } from '../types';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useState, useEffect, useRef } from 'react';
import { ChannelData } from '../../../services/queueApi';

const { Header, Content, Footer } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

interface ThreadViewProps {
  thread: Thread;
  parentMessage: Message;
  channel: ChannelData;
  onBack: () => void;
}

export const ThreadView = ({
  thread,
  parentMessage,
  channel,
  onBack,
}: ThreadViewProps) => {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isMd = screens.md || screens.lg || screens.xl || screens.xxl;
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mock thread messages - in production, this would come from API
  useEffect(() => {
    const mockThreadMessages: Message[] = [
      {
        id: 't1',
        channelId: channel.id,
        threadId: thread.id,
        userId: 'user3',
        userName: 'Bob Johnson',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
        content: 'What specific aspects would you like me to clarify?',
        contentType: 'text',
        createdAt: new Date(Date.now() - 2400000).toISOString(),
      },
      {
        id: 't2',
        channelId: channel.id,
        threadId: thread.id,
        userId: 'user1',
        userName: 'John Doe',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
        content: 'I can explain the evaluation criteria and scoring methodology.',
        contentType: 'text',
        createdAt: new Date(Date.now() - 2100000).toISOString(),
      },
      {
        id: 't3',
        channelId: channel.id,
        threadId: thread.id,
        userId: 'user4',
        userName: 'Alice Brown',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
        content: 'That would be helpful, thanks!',
        contentType: 'text',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
      },
    ];
    setThreadMessages(mockThreadMessages);
  }, [thread.id, channel.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  const handleSendMessage = (content: string, attachments?: File[]) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      channelId: channel.id,
      threadId: thread.id,
      userId: 'current-user',
      userName: 'You',
      content,
      contentType: 'text',
      createdAt: new Date().toISOString(),
      attachments: attachments?.map((file, idx) => ({
        id: `att-${idx}`,
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type,
        size: file.size,
      })),
    };
    setThreadMessages([...threadMessages, newMessage]);
  };

  return (
    <Layout style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header
        style={{
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorder}`,
          padding: isMd ? '0 16px' : '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: isMd ? '64px' : '56px',
        }}
      >
        <Space wrap>
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={onBack}
            size={isMd ? 'middle' : 'small'}
          />
          <Divider type="vertical" />
          <Text strong style={{ fontSize: isMd ? '16px' : '14px' }}>Thread</Text>
          <Text type="secondary" style={{ fontSize: isMd ? '12px' : '11px' }}>
            ({thread.messageCount} messages)
          </Text>
        </Space>
      </Header>
      <Content
        style={{
          flex: 1,
          overflow: 'auto',
          padding: isMd ? '16px' : '12px',
          background: token.colorBgLayout,
        }}
      >
        <div
          style={{
            background: token.colorBgContainer,
            padding: isMd ? '12px' : '10px',
            borderRadius: token.borderRadius,
            marginBottom: '16px',
            border: `1px solid ${token.colorBorder}`,
          }}
        >
          <Text type="secondary" style={{ fontSize: isMd ? '12px' : '11px' }}>
            Replying to:
          </Text>
          <div style={{ marginTop: '8px' }}>
            <Text strong style={{ fontSize: isMd ? '14px' : '13px' }}>
              {parentMessage.userName}
            </Text>
            <Text 
              style={{ 
                marginLeft: '8px',
                fontSize: isMd ? '14px' : '13px',
                wordBreak: 'break-word',
              }}
            >
              {parentMessage.content}
            </Text>
          </div>
        </div>
        <MessageList
          messages={threadMessages}
          threads={[]}
          onThreadClick={() => {}}
        />
        <div ref={messagesEndRef} />
      </Content>
      <Footer
        style={{
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorder}`,
          padding: isMd ? '12px 16px' : '8px 12px',
        }}
      >
        <MessageInput
          onSend={handleSendMessage}
          placeholder="Reply in thread..."
        />
      </Footer>
    </Layout>
  );
};

