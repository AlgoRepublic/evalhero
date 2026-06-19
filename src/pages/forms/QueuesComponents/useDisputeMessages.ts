import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  useGetDisputeChatMessagesQuery,
  useGetChannelMessagesQuery,
  DisputeChatMessage,
  ChannelMessage,
  queueApi,
} from '../../../services/queueApi';
import { AppDispatch } from '../../../store';
import { ChatMessage } from './types';
import { useSocketChannel } from '../../../hooks/useSocketChannel';
import { skipToken } from '@reduxjs/toolkit/query';

const QUEUE_INVALIDATE_ACTIONS = [
  'submission:signature',
  'submission:dispute',
  'submission:omit-signature-request',
  'submission:omit-signature-request-approve',
  'submission:omit-signature-request-reject',
] as const;

interface UseDisputeMessagesProps {
  assignmentId: string;
  submissionId: string;
  isActive: boolean;
  disputeChannelId?: string | null;
}

export const useDisputeMessages = ({
  assignmentId,
  submissionId,
  isActive,
  disputeChannelId,
}: UseDisputeMessagesProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const optimisticMessagesRef = useRef<Set<string>>(new Set());
  const lastProcessedDisputeMessageIdsRef = useRef<Set<string>>(new Set());
  const refetchDisputeRef = useRef<(() => void) | null>(null);

  // Memoize callbacks to prevent unnecessary reconnections
  const handleDisputeMessage = useCallback(
    (message: unknown) => {
      console.log('[useDisputeMessages] New dispute message received via Socket.IO:', message);
      const data = message as { message?: { action?: string }; channelId?: string };
      const action = data?.message?.action;
      if (action && QUEUE_INVALIDATE_ACTIONS.includes(action as (typeof QUEUE_INVALIDATE_ACTIONS)[number])) {
        dispatch(
          queueApi.util.invalidateTags([{ type: 'Queue', id: assignmentId }])
        );
      }
      // Refetch messages to get the latest state from server
      if (refetchDisputeRef.current) {
        console.log('[useDisputeMessages] Triggering refetch...');
        try {
          refetchDisputeRef.current();
          console.log('[useDisputeMessages] Refetch triggered');
        } catch (error) {
          console.error('[useDisputeMessages] Error calling refetch:', error);
        }
      } else {
        console.warn('[useDisputeMessages] refetchDisputeRef.current is null, cannot refetch');
      }
    },
    [assignmentId, dispatch]
  );

  const handleDisputeError = useCallback((error: unknown) => {
    console.error('[useDisputeMessages] Socket.IO error for dispute channel:', error);
  }, []);

  // Socket.IO integration for dispute channel - only connect when step is active
  const disputeSocketChannel = useSocketChannel({
    channelId: isActive ? (disputeChannelId || null) : null,
    channelType: 'dispute',
    onMessage: handleDisputeMessage,
    onError: handleDisputeError,
    enabled: !!disputeChannelId && isActive, // Only enable when step is active and channelId exists
  });

  // Channel messages query (new endpoint using channelId) - preferred when channelId is available
  const {
    data: disputeChannelMessagesData,
    isLoading: isLoadingDisputeChannelMessages,
    isFetching: isFetchingDisputeChannelMessages,
    refetch: refetchDisputeChannelMessages,
  } = useGetChannelMessagesQuery(
    disputeChannelId && isActive ? { channelId: disputeChannelId } : skipToken,
    {
      skip: !isActive || !disputeChannelId,
      pollingInterval: 0, // Disable polling - rely on Socket.IO for real-time updates
      refetchOnMountOrArgChange: false, // Only fetch once when step becomes active
      refetchOnFocus: false, // Don't refetch on window focus
      refetchOnReconnect: false, // Don't refetch on reconnect (Socket.IO handles this)
    }
  );

  // Dispute chat messages query (fallback when channelId is not available)
  const {
    data: disputeChatMessagesData,
    isLoading: isLoadingDisputeMessages,
    isFetching: isFetchingDisputeMessages,
    refetch: refetchDisputeMessages,
  } = useGetDisputeChatMessagesQuery(
    isActive && !disputeChannelId ? {
      assignmentId,
      submissionId,
    } : skipToken,
    {
      skip: !isActive || !assignmentId || !submissionId || !!disputeChannelId,
      pollingInterval: 0, // Disable polling - rely on Socket.IO for real-time updates
      refetchOnMountOrArgChange: false, // Only fetch once when step becomes active
      refetchOnFocus: false, // Don't refetch on window focus
      refetchOnReconnect: false, // Don't refetch on reconnect (Socket.IO handles this)
    }
  );

  // Store refetch function in ref (use channel messages refetch if available, otherwise fallback)
  useEffect(() => {
    if (disputeChannelId && refetchDisputeChannelMessages) {
      refetchDisputeRef.current = refetchDisputeChannelMessages;
    } else if (refetchDisputeMessages) {
      refetchDisputeRef.current = refetchDisputeMessages;
    }
  }, [disputeChannelId, refetchDisputeChannelMessages, refetchDisputeMessages]);

  // Reset tracked message IDs when submission changes
  useEffect(() => {
    lastProcessedDisputeMessageIdsRef.current.clear();
    optimisticMessagesRef.current.clear();
  }, [submissionId]);

  // Helper function to transform ChannelMessage to ChatMessage (avatar is S3 key or URL; resolved in UI via AssetAvatar)
  const transformChannelMessageToChatMessage = useCallback((msg: ChannelMessage): ChatMessage => {
    const senderId = msg.sentBy?.user?._id || msg.sentBy?._id || '';
    const senderName = msg.sentBy?.user?.name || msg.sentBy?.user?.email || 'Unknown User';
    const senderAvatar = msg.sentBy?.user?.avatar;
    const timestamp = msg.createdAt || msg.updatedAt || new Date().toISOString();
    
    let actionType: 'approval' | 'dispute' | 'signature' | 'omit-signature-request' | 'omit-signature-request-approve' | 'omit-signature-request-reject' | undefined;
    let text = '';
    let attachments: Array<{ name: string; url: string; type: string; size: number }> = [];
    let signatureDataUrl: string | undefined;
    
    const action = String(msg.action);
    if (action === 'message') {
      text = msg.actionData?.text || '';
    } else if (action === 'dispute:open' || action === 'dispute' || action === 'submission:dispute') {
      actionType = 'dispute';
      text = msg.actionData?.text || '';
    } else if (action === 'omit-signature:requested' || action === 'omit-signature-request' || action === 'submission:omit-signature-request') {
      actionType = 'omit-signature-request';
      text = msg.actionData?.text || '';
    } else if (action === 'omit-signature:approved' || action === 'omit-signature-request-approve' || action === 'submission:omit-signature-request-approve') {
      actionType = 'omit-signature-request-approve';
      text = msg.actionData?.text || '';
    } else if (action === 'omit-signature:rejected' || action === 'omit-signature-request-reject' || action === 'submission:omit-signature-request-reject') {
      actionType = 'omit-signature-request-reject';
      text = msg.actionData?.text || '';
    } else if (action === 'signature' || action === 'submission:signature') {
      actionType = 'signature';
      text = '';
      
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
      senderAvatar,
      timestamp: new Date(timestamp),
      attachments,
      actionType,
      signature: signatureDataUrl ? {
        dataUrl: signatureDataUrl,
        timestamp: new Date(timestamp),
      } : undefined,
    };
  }, []);

  // Sync dispute chat messages from query to local state
  useEffect(() => {
    // Prefer new channel messages endpoint if channelId is available
    let apiMessages: (DisputeChatMessage | ChannelMessage)[] = [];

    if (disputeChannelId && disputeChannelMessagesData) {
      // Use new channel messages endpoint
      if (disputeChannelMessagesData.data?.records) {
        apiMessages = disputeChannelMessagesData.data.records;
      }
    } else if (disputeChatMessagesData?.data?.messages) {
      // Fallback to old endpoint
      apiMessages = disputeChatMessagesData.data.messages;
    }

    if (apiMessages.length > 0) {
      // Check if messages are ChannelMessage (new endpoint) or DisputeChatMessage (old endpoint)
      const isChannelMessage = disputeChannelId && apiMessages.length > 0 && 'channel' in apiMessages[0];
      
      const currentMessageIds = new Set(
        apiMessages.map((msg: DisputeChatMessage | ChannelMessage) => msg._id).filter(Boolean)
      );
      const hasNewMessages = Array.from(currentMessageIds).some(id => !lastProcessedDisputeMessageIdsRef.current.has(id));
      
      if (hasNewMessages || lastProcessedDisputeMessageIdsRef.current.size === 0) {
        const formattedMessages: ChatMessage[] = apiMessages.map((msg: DisputeChatMessage | ChannelMessage) => {
          // Use appropriate transformer based on message type
          if (isChannelMessage) {
            return transformChannelMessageToChatMessage(msg as ChannelMessage);
          } else {
            // Transform DisputeChatMessage (old format)
            const disputeMsg = msg as DisputeChatMessage;
            const senderId = disputeMsg.sentBy?.user?._id || disputeMsg.sentBy?._id || '';
            const senderName = disputeMsg.sentBy?.user?.name || disputeMsg.sentBy?.user?.email || disputeMsg.sentBy?.name || 'Unknown User';
            // Extract avatar from sentBy.user (avatar may not be in type definition but exists in API response)
            const userAvatar = (disputeMsg.sentBy?.user as { avatar?: string } | undefined)?.avatar;
            const senderAvatar = userAvatar;
            const timestamp = disputeMsg.createdAt || disputeMsg.updatedAt || new Date().toISOString();
            
            let actionType: 'approval' | 'dispute' | 'signature' | 'omit-signature-request' | 'omit-signature-request-approve' | 'omit-signature-request-reject' | undefined;
            let text = '';
            let attachments: Array<{ name: string; url: string; type: string; size: number }> = [];
            let signatureDataUrl: string | undefined;
            
            const action = String(disputeMsg.action);
            if (action === 'message') {
              text = disputeMsg.actionData?.text || '';
            } else if (action === 'dispute:open' || action === 'dispute' || action === 'submission:dispute') {
              actionType = 'dispute';
              text = disputeMsg.actionData?.text || '';
            } else if (action === 'omit-signature:requested' || action === 'omit-signature-request' || action === 'submission:omit-signature-request') {
              actionType = 'omit-signature-request';
              text = disputeMsg.actionData?.text || '';
            } else if (action === 'omit-signature:approved' || action === 'omit-signature-request-approve' || action === 'submission:omit-signature-request-approve') {
              actionType = 'omit-signature-request-approve';
              text = disputeMsg.actionData?.text || '';
            } else if (action === 'omit-signature:rejected' || action === 'omit-signature-request-reject' || action === 'submission:omit-signature-request-reject') {
              actionType = 'omit-signature-request-reject';
              text = disputeMsg.actionData?.text || '';
            } else if (action === 'signature' || action === 'submission:signature') {
              actionType = 'signature';
              text = '';
              
              const fileData = disputeMsg.actionData?.file;
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
              id: disputeMsg._id || Date.now().toString(),
              text,
              senderId,
              senderName,
              senderAvatar,
              timestamp: new Date(timestamp),
              attachments,
              actionType,
              signature: signatureDataUrl ? {
                dataUrl: signatureDataUrl,
                timestamp: new Date(timestamp),
              } : undefined,
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
  }, [
    disputeChannelId,
    disputeChannelMessagesData,
    disputeChatMessagesData,
    isLoadingDisputeChannelMessages,
    isFetchingDisputeChannelMessages,
    isLoadingDisputeMessages,
    isFetchingDisputeMessages,
    transformChannelMessageToChatMessage,
  ]);

  return {
    messages,
    setMessages,
    optimisticMessagesRef,
    isLoadingMessages: isLoadingDisputeMessages || isLoadingDisputeChannelMessages,
    socketChannel: disputeSocketChannel,
  };
};

