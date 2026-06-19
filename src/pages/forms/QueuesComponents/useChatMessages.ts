import { useState, useEffect, useRef } from 'react';
import {
  useGetApprovalChatMessagesQuery,
  useGetDisputeChatMessagesQuery,
  useGetChannelMessagesQuery,
  ApprovalChatMessage,
  DisputeChatMessage,
  ChannelMessage,
} from '../../../services/queueApi';
import { ChatMessage } from './types';
import { useSocketChannel } from '../../../hooks/useSocketChannel';
import { skipToken } from '@reduxjs/toolkit/query';

interface UseChatMessagesProps {
  assignmentId: string;
  submissionId: string;
  hasApproval: boolean;
  hasDisputes: boolean;
  isActive: boolean;
  approvalChannelId?: string | null; // Channel ID for approval Socket.IO channel
  disputeChannelId?: string | null; // Channel ID for dispute Socket.IO channel
}

export const useChatMessages = ({
  assignmentId,
  submissionId,
  hasApproval,
  hasDisputes,
  isActive,
  approvalChannelId,
  disputeChannelId,
}: UseChatMessagesProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const optimisticMessagesRef = useRef<Set<string>>(new Set());
  const lastProcessedMessageIdsRef = useRef<Set<string>>(new Set());
  const lastProcessedDisputeMessageIdsRef = useRef<Set<string>>(new Set());

  // Create refs to store refetch functions (will be set after queries are created)
  const refetchApprovalRef = useRef<(() => void) | null>(null);
  const refetchDisputeRef = useRef<(() => void) | null>(null);

  // Socket.IO integration for approval channel
  const approvalSocketChannel = useSocketChannel({
    channelId: approvalChannelId || null,
    channelType: 'approval',
    onMessage: (message) => {
      // When a new message arrives via Socket.IO, refetch messages to get the latest state
      console.log('[useChatMessages] New approval message received via Socket.IO:', message);
      if (refetchApprovalRef.current) {
        refetchApprovalRef.current();
      }
    },
    onError: (error) => {
      console.error('[useChatMessages] Socket.IO error for approval channel:', error);
    },
    enabled: !!approvalChannelId && hasApproval && isActive,
  });

  // Socket.IO integration for dispute channel
  const disputeSocketChannel = useSocketChannel({
    channelId: disputeChannelId || null,
    channelType: 'dispute',
    onMessage: (message) => {
      // When a new message arrives via Socket.IO, refetch messages to get the latest state
      console.log('[useChatMessages] New dispute message received via Socket.IO:', message);
      if (refetchDisputeRef.current) {
        refetchDisputeRef.current();
      }
    },
    onError: (error) => {
      console.error('[useChatMessages] Socket.IO error for dispute channel:', error);
    },
    enabled: !!disputeChannelId && hasDisputes && isActive,
  });

  // Channel messages query (new endpoint using channelId) - preferred when channelId is available
  const {
    data: approvalChannelMessagesData,
    isLoading: isLoadingApprovalChannelMessages,
    isFetching: isFetchingApprovalChannelMessages,
    refetch: refetchApprovalChannelMessages,
  } = useGetChannelMessagesQuery(
    approvalChannelId && hasApproval ? { channelId: approvalChannelId } : skipToken,
    {
      skip: !hasApproval || !isActive || !approvalChannelId,
      // Disable polling when Socket.IO is connected (real-time updates via Socket.IO)
      // Keep polling as fallback when Socket.IO is not connected
      pollingInterval: hasApproval && isActive && !approvalSocketChannel.isConnected ? 10000 : 0,
      refetchOnMountOrArgChange: false,
    }
  );

  // Approval chat messages query (fallback when channelId is not available)
  const {
    data: approvalChatMessagesData,
    isLoading: isLoadingApprovalMessages,
    isFetching: isFetchingApprovalMessages,
    refetch: refetchApprovalMessages,
  } = useGetApprovalChatMessagesQuery(
    {
      assignmentId,
      submissionId,
    },
    {
      skip: !hasApproval || !isActive || !assignmentId || !submissionId || !!approvalChannelId, // Skip if channelId is available (use new endpoint)
      // Disable polling when Socket.IO is connected (real-time updates via Socket.IO)
      // Keep polling as fallback when Socket.IO is not connected
      pollingInterval: hasApproval && isActive && !approvalSocketChannel.isConnected ? 10000 : 0,
      refetchOnMountOrArgChange: false,
    }
  );

  // Store refetch function in ref (use channel messages refetch if available, otherwise fallback)
  useEffect(() => {
    if (approvalChannelId && refetchApprovalChannelMessages) {
      refetchApprovalRef.current = refetchApprovalChannelMessages;
    } else if (refetchApprovalMessages) {
      refetchApprovalRef.current = refetchApprovalMessages;
    }
  }, [approvalChannelId, refetchApprovalChannelMessages, refetchApprovalMessages]);

  // Dispute chat messages query
  const {
    data: disputeChatMessagesData,
    isLoading: isLoadingDisputeMessages,
    isFetching: isFetchingDisputeMessages,
    refetch: refetchDisputeMessages,
  } = useGetDisputeChatMessagesQuery(
    {
      assignmentId,
      submissionId,
    },
    {
      skip: !hasDisputes || !isActive || !assignmentId || !submissionId,
      // Disable polling when Socket.IO is connected (real-time updates via Socket.IO)
      // Keep polling as fallback when Socket.IO is not connected
      pollingInterval: hasDisputes && isActive && !disputeSocketChannel.isConnected ? 10000 : 0,
      refetchOnMountOrArgChange: false,
    }
  );

  // Store refetch function in ref
  useEffect(() => {
    if (refetchDisputeMessages) {
      refetchDisputeRef.current = refetchDisputeMessages;
    }
  }, [refetchDisputeMessages]);


  // Reset tracked message IDs when submission or mode changes
  useEffect(() => {
    lastProcessedMessageIdsRef.current.clear();
    lastProcessedDisputeMessageIdsRef.current.clear();
    optimisticMessagesRef.current.clear();
  }, [submissionId, hasApproval, hasDisputes]);

  // Helper function to transform ChannelMessage to ChatMessage
  const transformChannelMessageToChatMessage = (msg: ChannelMessage): ChatMessage => {
    const senderId = msg.sentBy?.user?._id || msg.sentBy?._id || '';
    const senderName = msg.sentBy?.user?.name || msg.sentBy?.user?.email || 'Unknown User';
    const timestamp = msg.createdAt || msg.updatedAt || new Date().toISOString();
    
    let actionType: 'approval' | 'dispute' | 'signature' | undefined;
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
      actionType = 'approval';
      text = msg.actionData?.text || msg.actionData?.text || '';
    }
    
    return {
      id: msg._id || Date.now().toString(),
      text,
      senderId,
      senderName,
      timestamp: new Date(timestamp),
      attachments: [],
      actionType,
      approvalStatus,
    };
  };

  // Sync approval messages from query to local state
  useEffect(() => {
    if (hasApproval) {
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
    }
  }, [
    hasApproval,
    approvalChannelId,
    approvalChannelMessagesData,
    approvalChatMessagesData,
    isLoadingApprovalChannelMessages,
    isFetchingApprovalChannelMessages,
    isLoadingApprovalMessages,
    isFetchingApprovalMessages,
  ]);

  // Sync dispute chat messages from query to local state
  useEffect(() => {
    if (hasDisputes) {
      if (disputeChatMessagesData?.data?.messages) {
        const apiMessages = disputeChatMessagesData.data.messages;
        
        const currentMessageIds = new Set(apiMessages.map((msg: DisputeChatMessage) => msg._id).filter(Boolean));
        const hasNewMessages = Array.from(currentMessageIds).some(id => !lastProcessedDisputeMessageIdsRef.current.has(id));
        
        if (hasNewMessages || lastProcessedDisputeMessageIdsRef.current.size === 0) {
          const formattedMessages: ChatMessage[] = apiMessages.map((msg: DisputeChatMessage) => {
            const senderId = msg.sentBy?.user?._id || msg.sentBy?._id || '';
            const senderName = msg.sentBy?.user?.name || msg.sentBy?.user?.email || msg.sentBy?.name || 'Unknown User';
            const timestamp = msg.createdAt || msg.updatedAt || new Date().toISOString();
            
            let actionType: 'approval' | 'dispute' | 'signature' | 'omit-signature-request' | 'omit-signature-request-approve' | 'omit-signature-request-reject' | undefined;
            let text = '';
            let attachments: Array<{ name: string; url: string; type: string; size: number }> = [];
            let signatureDataUrl: string | undefined;
            
            if (msg.action === 'message') {
              text = msg.actionData?.text || '';
            } else if (msg.action === 'dispute' || msg.action === 'submission:dispute') {
              actionType = 'dispute';
              text = msg.actionData?.text || ''; // Use text directly without prefix
            } else if (msg.action === 'omit-signature-request' || msg.action === 'submission:omit-signature-request') {
              actionType = 'omit-signature-request';
              text = msg.actionData?.text || '';
            } else if (msg.action === 'omit-signature-request-approve' || msg.action === 'submission:omit-signature-request-approve') {
              actionType = 'omit-signature-request-approve';
              text = msg.actionData?.text || '';
            } else if (msg.action === 'omit-signature-request-reject' || msg.action === 'submission:omit-signature-request-reject') {
              actionType = 'omit-signature-request-reject';
              text = msg.actionData?.text || '';
            } else if (msg.action === 'signature' || msg.action === 'submission:signature') {
              actionType = 'signature';
              text = ''; // Signature messages don't need text
              
              const fileData = msg.actionData?.file;
              if (fileData) {
                if (typeof fileData === 'string') {
                  const apiBaseUrl = import.meta.env.VITE_API_URL || '';
                  const basePath = apiBaseUrl ? `${apiBaseUrl}` : '';
                  const fileUrl = fileData.startsWith('http') 
                    ? fileData 
                    : fileData.startsWith('/') 
                      ? `${basePath}${fileData}` 
                      : `${basePath}/${fileData}`;
                  signatureDataUrl = fileUrl;
                  attachments = [{
                    name: fileData.split('/').pop() || 'signature.png',
                    url: fileUrl,
                    type: 'image/png',
                    size: 0,
                  }];
                } else {
                  signatureDataUrl = fileData.url;
                  attachments = [{
                    name: fileData.filename || 'signature',
                    url: fileData.url || '',
                    type: fileData.mimetype || 'image/png',
                    size: fileData.size || 0,
                  }];
                }
              }
            }
            
            return {
              id: msg._id || Date.now().toString(),
              text,
              senderId,
              senderName,
              timestamp: new Date(timestamp),
              attachments,
              actionType,
              signature: signatureDataUrl ? {
                dataUrl: signatureDataUrl,
                timestamp: new Date(timestamp),
              } : undefined,
            };
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
          
          lastProcessedDisputeMessageIdsRef.current = currentMessageIds;
        }
      } else if (!isLoadingDisputeMessages && !isFetchingDisputeMessages) {
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
    }
  }, [hasDisputes, disputeChatMessagesData, isLoadingDisputeMessages, isFetchingDisputeMessages]);

  return {
    messages,
    setMessages,
    optimisticMessagesRef,
    isLoadingMessages: isLoadingApprovalMessages || isLoadingDisputeMessages,
    isLoadingApprovalMessages,
    isLoadingDisputeMessages,
    approvalChatMessagesData,
    disputeChatMessagesData,
  };
};

