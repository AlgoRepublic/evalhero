import { useState, useEffect, useRef, useCallback } from 'react';
import {
  useGetApprovalChatMessagesQuery,
  useGetChannelMessagesQuery,
  ApprovalChatMessage,
  ChannelMessage,
} from '../../../services/queueApi';
import { ChatMessage } from './types';
import { useSocketChannel } from '../../../hooks/useSocketChannel';
import { skipToken } from '@reduxjs/toolkit/query';

interface UseApprovalMessagesProps {
  assignmentId: string;
  submissionId: string;
  isActive: boolean;
  approvalChannelId?: string | null;
}

export const useApprovalMessages = ({
  assignmentId,
  submissionId,
  isActive,
  approvalChannelId,
}: UseApprovalMessagesProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const optimisticMessagesRef = useRef<Set<string>>(new Set());
  const lastProcessedMessageIdsRef = useRef<Set<string>>(new Set());
  const refetchApprovalRef = useRef<(() => void) | null>(null);

  // Memoize callbacks to prevent unnecessary reconnections
  const handleApprovalMessage = useCallback((message: any) => {
    console.log('[useApprovalMessages] New approval message received via Socket.IO:', message);
    if (refetchApprovalRef.current) {
      refetchApprovalRef.current();
    }
  }, []);

  const handleApprovalError = useCallback((error: any) => {
    console.error('[useApprovalMessages] Socket.IO error for approval channel:', error);
  }, []);

  // Socket.IO integration for approval channel - only connect when step is active
  const approvalSocketChannel = useSocketChannel({
    channelId: isActive ? (approvalChannelId || null) : null,
    channelType: 'approval',
    onMessage: handleApprovalMessage,
    onError: handleApprovalError,
    enabled: !!approvalChannelId && isActive, // Only enable when step is active and channelId exists
  });

  // Channel messages query (new endpoint using channelId) - preferred when channelId is available
  const {
    data: approvalChannelMessagesData,
    isLoading: isLoadingApprovalChannelMessages,
    isFetching: isFetchingApprovalChannelMessages,
    refetch: refetchApprovalChannelMessages,
  } = useGetChannelMessagesQuery(
    approvalChannelId && isActive ? { channelId: approvalChannelId } : skipToken,
    {
      skip: !isActive || !approvalChannelId,
      pollingInterval: 0, // Disable polling - rely on Socket.IO for real-time updates
      refetchOnMountOrArgChange: false, // Only fetch once when step becomes active
      refetchOnFocus: false, // Don't refetch on window focus
      refetchOnReconnect: false, // Don't refetch on reconnect (Socket.IO handles this)
    }
  );

  // Approval chat messages query (fallback when channelId is not available)
  const {
    data: approvalChatMessagesData,
    isLoading: isLoadingApprovalMessages,
    isFetching: isFetchingApprovalMessages,
    refetch: refetchApprovalMessages,
  } = useGetApprovalChatMessagesQuery(
    isActive && !approvalChannelId ? {
      assignmentId,
      submissionId,
    } : skipToken,
    {
      skip: !isActive || !assignmentId || !submissionId || !!approvalChannelId,
      pollingInterval: 0, // Disable polling - rely on Socket.IO for real-time updates
      refetchOnMountOrArgChange: false, // Only fetch once when step becomes active
      refetchOnFocus: false, // Don't refetch on window focus
      refetchOnReconnect: false, // Don't refetch on reconnect (Socket.IO handles this)
    }
  );

  // Store refetch function in ref
  useEffect(() => {
    if (approvalChannelId && refetchApprovalChannelMessages) {
      refetchApprovalRef.current = refetchApprovalChannelMessages;
    } else if (refetchApprovalMessages) {
      refetchApprovalRef.current = refetchApprovalMessages;
    }
  }, [approvalChannelId, refetchApprovalChannelMessages, refetchApprovalMessages]);

  // Reset tracked message IDs when submission changes
  useEffect(() => {
    lastProcessedMessageIdsRef.current.clear();
    optimisticMessagesRef.current.clear();
  }, [submissionId]);

  // Helper function to transform ChannelMessage to ChatMessage (avatar is S3 key or URL; resolved in UI via AssetAvatar)
  const transformChannelMessageToChatMessage = useCallback((msg: ChannelMessage): ChatMessage => {
    const senderId = msg.sentBy?.user?._id || msg.sentBy?._id || '';
    const senderName = msg.sentBy?.user?.name || msg.sentBy?.user?.email || 'Unknown User';
    const senderAvatar = msg.sentBy?.user?.avatar;
    const timestamp = msg.createdAt || msg.updatedAt || new Date().toISOString();
    
    let actionType: ChatMessage['actionType'];
    let approvalStatus: 'approved' | 'rejected' | undefined;
    let text = '';
    
    if (msg.action === 'message') {
      text = msg.actionData?.text || '';
    } else if (msg.action === 'approval:approved') {
      actionType = 'approval';
      approvalStatus = 'approved';
      text = msg.actionData?.text || '';
    } else if (msg.action === 'approval:rejected') {
      actionType = 'approval';
      approvalStatus = 'rejected';
      text = msg.actionData?.text || '';
    } else if (msg.action === 'approval:requested') {
      actionType = 'approval-request';
      text = msg.actionData?.text || 'Requested approval';
    }
    
    return {
      id: msg._id || Date.now().toString(),
      text,
      senderId,
      senderName,
      senderAvatar,
      timestamp: new Date(timestamp),
      attachments: [],
      actionType,
      approvalStatus,
    };
  }, []);

  // Sync approval messages from query to local state
  useEffect(() => {
    // Prefer new channel messages endpoint if channelId is available
    let apiMessages: (ApprovalChatMessage | ChannelMessage)[] = [];
    let isLoading = false;
    let isFetching = false;

    if (approvalChannelId && approvalChannelMessagesData) {
      // Use new channel messages endpoint
      if (approvalChannelMessagesData.data?.records) {
        apiMessages = approvalChannelMessagesData.data.records;
      }
      isLoading = isLoadingApprovalChannelMessages;
      isFetching = isFetchingApprovalChannelMessages;
    } else if (approvalChatMessagesData?.data?.messages) {
      // Fallback to old endpoint
      apiMessages = approvalChatMessagesData.data.messages;
      isLoading = isLoadingApprovalMessages;
      isFetching = isFetchingApprovalMessages;
    }

    if (apiMessages.length > 0) {
      // Check if messages are ChannelMessage (new endpoint) or ApprovalChatMessage (old endpoint)
      const isChannelMessage = approvalChannelId && apiMessages.length > 0 && 'channel' in apiMessages[0];
      
      const currentMessageIds = new Set(
        apiMessages.map((msg: ApprovalChatMessage | ChannelMessage) => msg._id).filter(Boolean)
      );
      const hasNewMessages = Array.from(currentMessageIds).some(id => !lastProcessedMessageIdsRef.current.has(id));
      
      if (hasNewMessages || lastProcessedMessageIdsRef.current.size === 0) {
        const formattedMessages: ChatMessage[] = apiMessages.map((msg: ApprovalChatMessage | ChannelMessage) => {
          // Use appropriate transformer based on message type
          if (isChannelMessage) {
            return transformChannelMessageToChatMessage(msg as ChannelMessage);
          } else {
            // Transform ApprovalChatMessage (old format)
            const approvalMsg = msg as ApprovalChatMessage;
            const senderId = approvalMsg.sentBy?.user?._id || approvalMsg.sentBy?._id || '';
            const senderName = approvalMsg.sentBy?.user?.name || approvalMsg.sentBy?.user?.email || approvalMsg.sentBy?.name || 'Unknown User';
            // Extract avatar from sentBy.user (avatar may not be in type definition but exists in API response)
            const userAvatar = (approvalMsg.sentBy?.user as { avatar?: string } | undefined)?.avatar;
            const senderAvatar = userAvatar;
            const timestamp = approvalMsg.createdAt || approvalMsg.updatedAt || new Date().toISOString();
            
            let actionType: 'approval' | 'dispute' | 'signature' | undefined;
            let approvalStatus: 'approved' | 'rejected' | undefined;
            let text = '';
            
            if (approvalMsg.action === 'message') {
              text = approvalMsg.actionData?.text || '';
            } else if (approvalMsg.action === 'approval:approve') {
              actionType = 'approval';
              approvalStatus = 'approved';
              text = approvalMsg.actionData?.text || '';
            } else if (approvalMsg.action === 'approval:reject') {
              actionType = 'approval';
              approvalStatus = 'rejected';
              text = approvalMsg.actionData?.text || '';
            }
            
            return {
              id: approvalMsg._id || Date.now().toString(),
              text,
              senderId,
              senderName,
              senderAvatar,
              timestamp: new Date(timestamp),
              attachments: [],
              actionType,
              approvalStatus,
            };
          }
        });
        
        setMessages((prev) => {
          const optimisticMessages = prev.filter((msg) => 
            msg.id.startsWith('temp-') && optimisticMessagesRef.current.has(msg.id)
          );
          const serverMessageKeys = new Set(formattedMessages.map(m => `${m.senderId}:${m.text}:${m.actionType || ''}`));
          const filteredOptimistic = optimisticMessages.filter((msg) => {
            if (msg.id.startsWith('temp-')) {
              const key = `${msg.senderId}:${msg.text}:${msg.actionType || ''}`;
              return !serverMessageKeys.has(key);
            }
            return true;
          });
          
          const merged = [...formattedMessages, ...filteredOptimistic].sort((a, b) => 
            a.timestamp.getTime() - b.timestamp.getTime()
          );
          
          return merged;
        });
        
        lastProcessedMessageIdsRef.current = currentMessageIds;
      }
    } else if (!isLoading && !isFetching) {
      setMessages((prev) => {
        const optimisticMessages = prev.filter((msg) => 
          msg.id.startsWith('temp-') && optimisticMessagesRef.current.has(msg.id)
        );
        if (optimisticMessages.length === prev.length) {
          return prev;
        }
        return optimisticMessages.length > 0 ? optimisticMessages : [];
      });
    }
  }, [
    approvalChannelId,
    approvalChannelMessagesData,
    approvalChatMessagesData,
    isLoadingApprovalChannelMessages,
    isFetchingApprovalChannelMessages,
    isLoadingApprovalMessages,
    isFetchingApprovalMessages,
  ]);

  return {
    messages,
    setMessages,
    optimisticMessagesRef,
    isLoadingMessages: isLoadingApprovalMessages || isLoadingApprovalChannelMessages,
    socketChannel: approvalSocketChannel,
  };
};

