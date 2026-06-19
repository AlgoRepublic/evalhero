import React from 'react';
import { Avatar, Flex, Space, Typography, Affix, theme } from 'antd';

const { Text } = Typography;

interface ChatHeaderProps {
  otherUserName: string;
  hasApproval: boolean;
  hasDisputes: boolean;
  formName?: string;
  submissionTitle?: string;
  isDark: boolean;
  token: ReturnType<typeof theme.useToken>['token'];
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  otherUserName,
  hasApproval,
  hasDisputes,
  formName,
  submissionTitle,
  isDark,
  token,
}) => {
  return (
    <Affix offsetTop={127}>
      <div
        style={{
          padding: isDark ? '10px 16px' : '12px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
          boxShadow: isDark ? 'none' : '0 1px 0 rgba(0,0,0,0.04)',
          zIndex: 10,
        }}
      >
        <Flex align="center" justify="space-between">
          <Space size={10}>
            <Avatar
              size={32}
              style={{
                backgroundColor: token.colorPrimary,
                color: 'white',
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              {otherUserName.charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <Text strong style={{ fontSize: 14, display: 'block', fontWeight: 600, lineHeight: 1.4, color: token.colorText }}>
                {hasApproval && hasDisputes ? 'Approvals & Dispute' : hasApproval ? 'Approvals' : hasDisputes ? 'Dispute' : 'Chat'} Channel
              </Text>
              <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.4, color: token.colorTextTertiary }}>
                {formName || 'Form'} • {submissionTitle || 'Submission'} • with {otherUserName}
              </Text>
            </div>
          </Space>
        </Flex>
      </div>
    </Affix>
  );
};

