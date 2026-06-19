import { Button, Tooltip, Space, theme } from 'antd';
import { Reaction } from '../types';
import { useState } from 'react';

interface MessageReactionsProps {
  reactions: Reaction[];
  messageId: string;
}

export const MessageReactions = ({ reactions }: MessageReactionsProps) => {
  const { token } = theme.useToken();
  const [localReactions, setLocalReactions] = useState<Reaction[]>(reactions);

  const handleReactionClick = (emoji: string) => {
    // In production, this would call an API to add/remove reaction
    setLocalReactions((prev) => {
      const existing = prev.find((r) => r.emoji === emoji);
      if (existing) {
        // Toggle reaction
        const isUserReacted = existing.users.includes('current-user'); // In production, get from auth
        if (isUserReacted) {
          if (existing.count === 1) {
            return prev.filter((r) => r.emoji !== emoji);
          }
          return prev.map((r) =>
            r.emoji === emoji
              ? {
                  ...r,
                  count: r.count - 1,
                  users: r.users.filter((u) => u !== 'current-user'),
                }
              : r
          );
        } else {
          return prev.map((r) =>
            r.emoji === emoji
              ? {
                  ...r,
                  count: r.count + 1,
                  users: [...r.users, 'current-user'],
                }
              : r
          );
        }
      } else {
        return [
          ...prev,
          {
            emoji,
            users: ['current-user'],
            count: 1,
          },
        ];
      }
    });
  };

  if (localReactions.length === 0) {
    return null;
  }

  return (
    <Space size="small" wrap>
      {localReactions.map((reaction) => {
        const isUserReacted = reaction.users.includes('current-user');
        return (
          <Tooltip
            key={reaction.emoji}
            title={`${reaction.users.join(', ')} reacted with ${reaction.emoji}`}
          >
            <Button
              size="small"
              type={isUserReacted ? 'primary' : 'default'}
              style={{
                borderRadius: '12px',
                fontSize: '12px',
                height: '24px',
                padding: '0 8px',
                borderColor: isUserReacted ? undefined : token.colorBorder,
                backgroundColor: isUserReacted ? token.colorPrimaryBg : token.colorBgContainer,
                transition: 'all 0.2s',
              }}
              onClick={() => handleReactionClick(reaction.emoji)}
              onMouseEnter={(e) => {
                if (!isUserReacted) {
                  e.currentTarget.style.borderColor = token.colorPrimary;
                  e.currentTarget.style.backgroundColor = token.colorFillTertiary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isUserReacted) {
                  e.currentTarget.style.borderColor = token.colorBorder;
                  e.currentTarget.style.backgroundColor = token.colorBgContainer;
                }
              }}
            >
              <span style={{ marginRight: '4px' }}>{reaction.emoji}</span>
              <span>{reaction.count}</span>
            </Button>
          </Tooltip>
        );
      })}
    </Space>
  );
};




