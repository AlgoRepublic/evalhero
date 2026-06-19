import React from 'react';
import { Button, Flex, Space, Input, Typography, theme, type UploadFile } from 'antd';
import { SendOutlined, FileOutlined, DeleteOutlined } from '@ant-design/icons';
import { formatFileSize } from './chatUtils';

const { Text } = Typography;
const { TextArea } = Input;

interface ChatInputAreaProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  fileList: UploadFile[];
  onRemoveFile: (file: UploadFile) => void;
  hasApproval: boolean;
  hasDisputes: boolean;
  isSending: boolean;
  isDark: boolean;
  token: ReturnType<typeof theme.useToken>['token'];
  inputRef?: React.RefObject<any>;
  onKeyPress?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const ChatInputArea: React.FC<ChatInputAreaProps> = ({
  inputValue,
  onInputChange,
  onSend,
  fileList,
  onRemoveFile,
  hasApproval,
  hasDisputes,
  isSending,
  isDark,
  token,
  inputRef,
  onKeyPress,
}) => {
  return (
    <div
      style={{
        padding: isDark ? '10px 14px' : '12px 16px',
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
    >
      {/* File List Preview */}
      {fileList.length > 0 && (
        <div
          style={{
            marginBottom: 8,
            padding: '8px',
            background: token.colorFillAlter,
            borderRadius: 6,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {fileList.map((file) => (
              <Flex
                key={file.uid}
                align="center"
                justify="space-between"
                style={{
                  padding: '4px 8px',
                  background: token.colorBgContainer,
                  borderRadius: 4,
                }}
              >
                <Space size={8}>
                  <FileOutlined style={{ color: token.colorPrimary }} />
                  <Text style={{ fontSize: 12 }}>{file.name}</Text>
                  {file.size && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {formatFileSize(file.size)}
                    </Text>
                  )}
                </Space>
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => onRemoveFile(file)}
                  danger
                  style={{ height: 24, padding: '0 4px' }}
                />
              </Flex>
            ))}
          </Space>
        </div>
      )}

      {/* Input and Send Button */}
      <Flex align="flex-end" gap={6}>
        <TextArea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            onInputChange(e.target.value);
          }}
          onKeyPress={onKeyPress}
          placeholder={`Message ${hasApproval && hasDisputes ? '#approvals-dispute' : hasApproval ? '#approvals' : hasDisputes ? '#dispute' : '#channel'}`}
          autoSize={{ minRows: 1, maxRows: 3 }}
          maxLength={5000}
          showCount={inputValue.length > 4000}
          disabled={isSending}
          style={{
            flex: 1,
            resize: 'none',
            borderRadius: 6,
            padding: isDark ? '6px 10px' : '8px 12px',
            fontSize: 14,
            lineHeight: 1.5,
            border: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
            boxShadow: 'none',
            transition: 'border-color 0.2s ease',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = token.colorPrimary;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = token.colorBorderSecondary;
          }}
        />

        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={onSend}
          disabled={(!inputValue.trim() && fileList.length === 0) || isSending}
          loading={isSending}
          style={{
            borderRadius: 6,
            height: 32,
            padding: '0 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          Send
        </Button>
      </Flex>
    </div>
  );
};

