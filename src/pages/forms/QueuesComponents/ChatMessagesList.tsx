import React from 'react';
import { Space, Typography, theme } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { ChatMessage } from './types';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';

const { Text } = Typography;

interface ChatMessagesListProps {
  messages: ChatMessage[];
  currentUserId: string;
  isLoading: boolean;
  isDark: boolean;
  token: ReturnType<typeof theme.useToken>['token'];
  chatContainerRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

/**
 * ChatMessagesList Component
 * 
 * Renders a list of chat messages. Each message should have its own meta data
 * (especially for approval:requested messages) to ensure answers are displayed
 * correctly per message.
 * 
 * CRITICAL: Each message's meta.questionData.answerData should come from the
 * message itself, not from conversation-level meta. This ensures historical
 * accuracy - each approval request shows the answer that existed when it was sent.
 */
export const ChatMessagesList: React.FC<ChatMessagesListProps> = ({
  messages,
  currentUserId,
  // isLoading,
  isDark,
  token,
  // chatContainerRef,
  messagesEndRef,
}) => {
  // if (isLoading) {
  //   return (
  //     <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '32px', gap: 10 }}>
  //       <Spin tip="Loading messages..." />
  //       <Text type="secondary" style={{ fontSize: 11, opacity: 0.7 }}>Fetching conversation...</Text>
  //     </div>
  //   );
  // }

  if (messages.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: isDark ? token.colorFillTertiary : token.colorFillAlter,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}>
          <SendOutlined style={{ fontSize: 22, color: token.colorTextTertiary, opacity: 0.6 }} />
        </div>
        <Text strong style={{ fontSize: 14, color: token.colorText, marginBottom: 6 }}>
          No messages yet
        </Text>
        <Text type="secondary" style={{ fontSize: 12, maxWidth: 280, opacity: 0.7 }}>
          This is the beginning of your conversation. Start by sending a message below.
        </Text>
      </div>
    );
  }

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {messages.map((msg, index) => {
        const prevMessage = index > 0 ? messages[index - 1] : null;
        return (
          <ChatMessageComponent
            key={msg.id}
            message={msg}
            prevMessage={prevMessage}
            currentUserId={currentUserId}
            isDark={isDark}
            token={token}
          />
        );
      })}
      <div ref={messagesEndRef} style={{ height: '1px' }} />
    </Space>
  );
};

