/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import {
  Drawer,
  Space,
  Typography,
  Tag,
  Alert,
  Spin,
} from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import {
  QuestionApprovalDrawerProps,
  // isQuestionApproved,
  // isQuestionApprovalPending,
  // isQuestionApprovalRejected,
} from './questionApprovalUtils';
import type { Profile } from '../../../features/auth/authSlice';
import { QuestionApprovalChat } from './QuestionApprovalChat';
import { useGetChannelMutation, useGetChannelMessagesQuery } from '../../../services/queueApi';
import { useSocketChannel } from '../../../hooks/useSocketChannel';
import { useSocket } from '../../../context/SocketContext';
import { skipToken } from '@reduxjs/toolkit/query';

const { Title, Text } = Typography;

/**
 * Helper function to create status keys with proper prefix handling
 * Prevents duplicate prefixes like "group-group-" or "ungrouped-ungrouped-"
 */
const createStatusKey = (type: 'group' | 'ungrouped', id: string): string => {
  if (!id) return '';
  
  const prefix = type === 'group' ? 'group-' : 'ungrouped-';
  
  // If the ID already starts with the prefix, return it as-is
  if (id.startsWith(prefix)) {
    return id;
  }
  
  // Otherwise, add the prefix
  return `${prefix}${id}`;
};

/**
 * QuestionApprovalDrawer Component
 * 
 * Displays a drawer on the right side for managing question-level approvals.
 * Includes question details, subject/group context, approval status, and chat interface.
 */
export const QuestionApprovalDrawer: React.FC<QuestionApprovalDrawerProps> = ({
  open,
  onClose,
  questionNode,
  subjectContext,
  formContext,
  updateNodeAttributes,
  currentUser,
  channelAssigneeId,
  label,
}) => {
  const { token } = theme.useToken();

  // Get stable question key - ALWAYS prioritize unique node ID from UniqueID extension
  // This ensures consistent identification across all operations
  // The UniqueID extension generates UUIDs for all nodes, which are preserved across saves/loads
  const questionKey = questionNode.attrs.id || questionNode.attrs.name || questionNode.attrs.label || questionNode.type;
  const assignmentId = formContext.assignmentId;
  
  // Get unique channel key - combines question/node identifier with group/subject ID
  // CRITICAL: Always use node ID (from UniqueID extension) as primary identifier for channel key
  // This ensures:
  // 1. Each question/node has a unique, stable channel per subject/group context
  // 2. Node IDs persist across saves/loads (handled by UniqueID extension)
  // 3. Socket.io channels are correctly keyed and messages persist correctly
  // Format: "{nodeId}-{groupId}" or "{nodeId}-{subjectId}"
  const questionKeyForChannel = useMemo(() => {
    // CRITICAL: Always prioritize node ID (from UniqueID extension) as the primary identifier
    // The UniqueID extension ensures all nodes have unique UUIDs that persist across operations
    // Fallback to name/label/type only if ID is not available (shouldn't happen in normal flow)
    const nodeIdentifier = questionNode.attrs.id || questionNode.attrs.name || questionNode.attrs.label || questionNode.type;
    
    // Validate that we have a valid identifier
    if (!nodeIdentifier) {
      console.error('[QuestionApprovalDrawer] No valid node identifier found', questionNode);
      return null;
    }
    
    if (subjectContext.type === 'group' && subjectContext.groupId) {
      // For groups, combine node identifier with groupId
      // This ensures each question/node has a unique channel per group
      // Format: "{nodeId}-{groupId}"
      return `${nodeIdentifier}-${subjectContext.groupId}`;
    } else {
      // For ungrouped subjects, combine node identifier with subjectId
      // This ensures each question/node has a unique channel per subject
      // Format: "{nodeId}-{subjectId}"
      const subjectId = Array.isArray(subjectContext.subjectId) 
        ? subjectContext.subjectId[0] 
        : subjectContext.subjectId;
      return subjectId ? `${nodeIdentifier}-${subjectId}` : nodeIdentifier;
    }
  }, [questionNode, subjectContext.type, subjectContext.groupId, subjectContext.subjectId]);

  
  // Get channel ID using useGetChannelMutation (changed from query to mutation for POST)
  // CRITICAL: questionKeyForChannel includes node ID + group/subject ID for uniqueness
  // This ensures each question/node has a unique channel per subject/group context
  const [getChannel, { data: channelResponse }] = useGetChannelMutation();
  const [channelId, setChannelId] = useState<string | undefined>(undefined);
  const lastRequestedParamsRef = useRef<string | null>(null);
  const socket = useSocket();
  const autoApprovalSentRef = useRef(false);

  // Socket.IO integration for real-time updates
  // Note: socketChannel is intentionally not stored in a variable as it's only used for side effects
  useSocketChannel({
    channelId: open && channelId ? channelId : null,
    channelType: 'question_approval',
    onMessage: (message) => {
      console.log('[QuestionApprovalDrawer] New message received via Socket.IO:', message);
      
      // Check if this is a non-message action (approval status change)
      const isNonMessageAction = message.message.action && message.message.action !== 'message';
      
      // If it's an approval action, update status immediately
      if (isNonMessageAction) {
        const action = message.message.action;
        let newStatus: 'requested' | 'approved' | 'rejected' | null = null;
        
        if (action === 'approval:requested') {
          newStatus = 'requested';
        } else if (action === 'approval:approved') {
          newStatus = 'approved';
        } else if (action === 'approval:rejected') {
          newStatus = 'rejected';
        }
        
        // Update approval status immediately if we have a valid status
        if (newStatus !== null) {
          // Use refs to get latest values (avoid stale closures)
          const currentQuestionNode = questionNodeRef.current;
          const currentUpdateNodeAttributes = updateNodeAttributesRef.current;
          const currentSubjectContext = subjectContextRef.current;
          
          // Determine the status key for this subject/group
          // CRITICAL: Use the same format as questionApprovalUtils.ts: `group-${groupId}`
          // This ensures consistency with how keys are stored in nodeGroupApprovalStatus
          let statusKey: string;
          if (currentSubjectContext.type === 'group' && currentSubjectContext.groupId) {
            // Always add "group-" prefix to match stored format (handles both prefixed and non-prefixed IDs)
            const groupId = currentSubjectContext.groupId;
            statusKey = `group-${groupId}`;
          } else {
            const subjectId = Array.isArray(currentSubjectContext.subjectId) 
              ? currentSubjectContext.subjectId[0] 
              : currentSubjectContext.subjectId;
            statusKey = `ungrouped-${subjectId}`;
          }
          
          // Get current node attributes
          const attrs = currentQuestionNode.attrs as any;
          const nodeGroupApprovalStatus = attrs.nodeGroupApprovalStatus || {};
          
          // Only update if status has changed
          if (nodeGroupApprovalStatus[statusKey] !== newStatus) {
            // Update nodeGroupApprovalStatus for this specific subject/group
            const updatedNodeGroupApprovalStatus = {
              ...nodeGroupApprovalStatus,
              [statusKey]: newStatus,
            };
            
            // Update node attributes immediately
            currentUpdateNodeAttributes({
              nodeGroupApprovalStatus: updatedNodeGroupApprovalStatus,
            });
            
            console.log('[QuestionApprovalDrawer] Updated approval status from socket message:', {
              statusKey,
              newStatus,
              action,
              subjectContext: currentSubjectContext,
            });
          }
        }
      }
      
      // Refetch messages when a new message arrives
      // Use longer delay for non-message actions to allow server to update status
      const delay = isNonMessageAction ? 1000 : 500;
      
      if (refetchMessagesRef.current) {
        console.log('[QuestionApprovalDrawer] Triggering refetch after socket message...');
        setTimeout(() => {
          try {
            // Force a fresh fetch by calling refetch with no cache
            refetchMessagesRef.current?.();
            console.log('[QuestionApprovalDrawer] Refetch triggered successfully');
          } catch (error) {
            console.error('[QuestionApprovalDrawer] Error calling refetch:', error);
          }
        }, delay);
      } else {
        console.warn('[QuestionApprovalDrawer] refetchMessagesRef.current is null, cannot refetch');
      }
      
      // Also refetch channel to get updated status from API (for non-message actions)
      if (isNonMessageAction && channelRequestParamsRef.current) {
        setTimeout(() => {
          console.log('[QuestionApprovalDrawer] Refetching channel to get updated status...');
          getChannelRef.current(channelRequestParamsRef.current).then((result) => {
            if ('data' in result && result.data?.data?._id) {
              // Channel response will trigger the useEffect that syncs status
              console.log('[QuestionApprovalDrawer] Channel refetched successfully');
            }
          }).catch((error) => {
            console.error('[QuestionApprovalDrawer] Failed to refetch channel:', error);
          });
        }, delay + 500); // Additional delay to ensure server has updated status
      }
    },
    onError: (error) => {
      console.error('[QuestionApprovalDrawer] Socket.IO error:', error);
    },
    enabled: open && !!channelId,
  });

  // Get channel messages using useGetChannelMessagesQuery
  const {
    data: messagesResponse,
    isLoading: isLoadingMessages,
    refetch: refetchChannelMessages,
  } = useGetChannelMessagesQuery(
    open && channelId ? { channelId } : skipToken,
    {
      skip: !open || !channelId,
      pollingInterval: 0, // Disable polling - rely on Socket.IO for real-time updates
      refetchOnMountOrArgChange: true, // Allow refetch when channelId changes
      refetchOnFocus: false,
      refetchOnReconnect: false,
    }
  );

  const refetchMessagesRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    refetchMessagesRef.current = refetchChannelMessages;
  }, [refetchChannelMessages]);

  // Store latest questionNode and updateNodeAttributes in refs to avoid stale closures in socket handler
  // Initialize refs with current values (channelRequestParams will be set later in useEffect)
  const questionNodeRef = useRef(questionNode);
  const updateNodeAttributesRef = useRef(updateNodeAttributes);
  const subjectContextRef = useRef(subjectContext);
  const channelRequestParamsRef = useRef<any>(null); // Will be set in useEffect after channelRequestParams is defined
  const getChannelRef = useRef(getChannel);
  
  useEffect(() => {
    questionNodeRef.current = questionNode;
    updateNodeAttributesRef.current = updateNodeAttributes;
    subjectContextRef.current = subjectContext;
    getChannelRef.current = getChannel;
  }, [questionNode, updateNodeAttributes, subjectContext, getChannel]);

  // Extract messages and meta from response (memoized to prevent unnecessary re-renders)
  const conversationMessages = useMemo(() => {
    return messagesResponse?.data?.records || [];
  }, [messagesResponse?.data?.records]);
  const questionConversationId = channelId;

  const lastUpdatedStatusRef = useRef<string | null>(null);
  
  console.log('hello formContext', formContext);
  // Merge form approvers and question approvers so both can open the drawer and approve/reject in chat
  const approversForChat = useMemo(() => {
    const byId = new Map<string, Profile>();
    // (formContext.formApprovers || []).forEach((p) => { if (p?._id) byId.set(p._id, p); });
    (formContext.questionApprovers || []).forEach((p) => { if (p?._id) byId.set(p._id, p); });
    return Array.from(byId.values());
  }, [formContext.questionApprovers]);
  // console.log('approvers', approvers);  
  // Get approval status
  // const isApproved = isQuestionApproved(questionNode);
  // const isPending = isQuestionApprovalPending(questionNode);
  // const isRejected = isQuestionApprovalRejected(questionNode);
  
  // Extract complete question data with all filled answer details (memoized)
  const questionData = useMemo(() => {
    // Extract complete question data with all filled answer details
    const attrs = questionNode.attrs;
    let questionValue = attrs.value;
    const answerData: any = {};
    
    // If grouping is enabled, extract subject-specific value and all group data
    const enableGrouping = attrs.enableGrouping === true || attrs.enableGrouping === 'true';
    const nodeGroupValues = attrs.nodeGroupValues as Record<string, any> | undefined;
    const nodeGroups = attrs.nodeGroups as Array<{ id: string; name: string; subjectIds: string[] }> | undefined;
    
    // Always check nodeGroupValues if they exist, even if enableGrouping is false
    // This handles cases where nodeGroupValues exist but enableGrouping flag is false
    const hasNodeGroupValues = nodeGroupValues && typeof nodeGroupValues === 'object' && Object.keys(nodeGroupValues).length > 0;
    
    if ((enableGrouping || hasNodeGroupValues) && nodeGroupValues) {
      // Always include both groupData and ungroupedData when grouping is enabled
      // This ensures filled values are available in both contexts
      
      // Extract group data if context is a group or if we can find a group for the subjects
      if (subjectContext.type === 'group' && subjectContext.groupId) {
        // Get value for the group
        const groupKey = createStatusKey('group', subjectContext.groupId);
        if (nodeGroupValues[groupKey] !== undefined) {
          questionValue = nodeGroupValues[groupKey];
        }
        // Store all group-specific data
        answerData.groupData = {
          groupId: subjectContext.groupId,
          groupName: subjectContext.groupName,
          groupValue: nodeGroupValues[groupKey],
          // Include all nodeGroupValues for reference
          allGroupValues: nodeGroupValues,
        };
        
        // Also include ungrouped data for all subjects in this group
        const subjectIds = Array.isArray(subjectContext.subjectId) 
          ? subjectContext.subjectId 
          : [subjectContext.subjectId].filter(Boolean);
        if (subjectIds.length > 0) {
          const ungroupedValues: Record<string, any> = {};
          subjectIds.forEach((subjectId: string) => {
            const ungroupedKey = createStatusKey('ungrouped', subjectId);
            if (nodeGroupValues[ungroupedKey] !== undefined) {
              ungroupedValues[subjectId] = nodeGroupValues[ungroupedKey];
            }
          });
          answerData.ungroupedData = {
            subjectIds: subjectIds,
            subjectName: subjectContext.subjectName,
            subjectValues: ungroupedValues,
            // Include all nodeGroupValues for reference
            allGroupValues: nodeGroupValues,
          };
        }
      } else if (subjectContext.type === 'ungrouped' && subjectContext.subjectId.length > 0) {
        // Get value for the ungrouped subject
        const subjectId = Array.isArray(subjectContext.subjectId) 
          ? subjectContext.subjectId[0] 
          : subjectContext.subjectId;
        const ungroupedKey = createStatusKey('ungrouped', subjectId);
        // Always try to get value from nodeGroupValues for ungrouped subjects
        // This ensures we get the subject-specific value even if it's empty
        if (nodeGroupValues && ungroupedKey in nodeGroupValues) {
          questionValue = nodeGroupValues[ungroupedKey];
        }
        // Store all ungrouped subject-specific data
        answerData.ungroupedData = {
          subjectId,
          subjectName: subjectContext.subjectName,
          subjectValue: nodeGroupValues[ungroupedKey],
          // Include all nodeGroupValues for reference
          allGroupValues: nodeGroupValues,
        };
        
        // Also include group data if this subject is part of a group
        if (nodeGroups && Array.isArray(nodeGroups)) {
          const subjectGroup = nodeGroups.find((g: any) => 
            g.subjectIds && g.subjectIds.includes(subjectId)
          );
          if (subjectGroup) {
            const groupKey = createStatusKey('group', subjectGroup.id);
            answerData.groupData = {
              groupId: subjectGroup.id,
              groupName: subjectGroup.name,
              groupValue: nodeGroupValues[groupKey],
              // Include all nodeGroupValues for reference
              allGroupValues: nodeGroupValues,
            };
          }
        }
      }
    } else if (hasNodeGroupValues && !enableGrouping) {
      // Handle case where nodeGroupValues exist but enableGrouping is false
      // Extract value based on subject context
      if (subjectContext.type === 'group' && subjectContext.groupId) {
        // Try to get value for the group
        const groupKey = createStatusKey('group', subjectContext.groupId);
        if (nodeGroupValues[groupKey] !== undefined && nodeGroupValues[groupKey] !== null && nodeGroupValues[groupKey] !== '') {
          questionValue = nodeGroupValues[groupKey];
        }
        // Also try ungrouped values for subjects in this group
        const subjectIds = Array.isArray(subjectContext.subjectId) 
          ? subjectContext.subjectId 
          : [subjectContext.subjectId].filter(Boolean);
        if (subjectIds.length > 0) {
          // Try first subject's ungrouped value if group value not found
          if (!questionValue || questionValue === attrs.value) {
            const firstSubjectId = subjectIds[0];
            const ungroupedKey = createStatusKey('ungrouped', firstSubjectId);
            if (nodeGroupValues[ungroupedKey] !== undefined && nodeGroupValues[ungroupedKey] !== null && nodeGroupValues[ungroupedKey] !== '') {
              questionValue = nodeGroupValues[ungroupedKey];
            }
          }
        }
        // Store group data
        answerData.groupData = {
          groupId: subjectContext.groupId,
          groupName: subjectContext.groupName,
          groupValue: nodeGroupValues[groupKey],
          allGroupValues: nodeGroupValues,
        };
        // Store ungrouped data
        if (subjectIds.length > 0) {
          const ungroupedValues: Record<string, any> = {};
          subjectIds.forEach((subjectId: string) => {
            const ungroupedKey = createStatusKey('ungrouped', subjectId);
            if (nodeGroupValues[ungroupedKey] !== undefined) {
              ungroupedValues[subjectId] = nodeGroupValues[ungroupedKey];
            }
          });
          answerData.ungroupedData = {
            subjectIds: subjectIds,
            subjectName: subjectContext.subjectName,
            subjectValues: ungroupedValues,
            allGroupValues: nodeGroupValues,
          };
        }
      } else if (subjectContext.type === 'ungrouped' && subjectContext.subjectId.length > 0) {
        // Get value for the ungrouped subject
        const subjectId = Array.isArray(subjectContext.subjectId) 
          ? subjectContext.subjectId[0] 
          : subjectContext.subjectId;
        const ungroupedKey = createStatusKey('ungrouped', subjectId);
        // Always try to get value from nodeGroupValues for ungrouped subjects
        // This ensures we get the subject-specific value even if it's empty
        if (nodeGroupValues && ungroupedKey in nodeGroupValues) {
          questionValue = nodeGroupValues[ungroupedKey];
        }
        // Store ungrouped data
        answerData.ungroupedData = {
          subjectId,
          subjectName: subjectContext.subjectName,
          subjectValue: nodeGroupValues[ungroupedKey],
          allGroupValues: nodeGroupValues,
        };
        // Try to find if this subject is in any group (check all group keys)
        // Find the first group value that exists
        Object.keys(nodeGroupValues).forEach((key) => {
          if (key.startsWith('group-') && !answerData.groupData) {
            const groupValue = nodeGroupValues[key];
            if (groupValue !== undefined && groupValue !== null && groupValue !== '') {
              // Extract group ID from key (format: "group-{groupId}")
              const groupId = key.replace('group-', '');
              // Store group data
              answerData.groupData = {
                groupId: groupId,
                groupValue: groupValue,
                allGroupValues: nodeGroupValues,
              };
            }
          }
        });
      }
    }
    
    // Extract node-type-specific answer details
    const nodeType = questionNode.type;
    switch (nodeType) {
      case 'shortText':
      case 'longText':
        answerData.textValue = questionValue;
        answerData.placeholder = attrs.placeholder;
        answerData.maxLength = attrs.maxLength;
        break;
      
      case 'numberField':
        answerData.numberValue = questionValue;
        answerData.min = attrs.min;
        answerData.max = attrs.max;
        answerData.step = attrs.step;
        answerData.unit = attrs.unit;
        answerData.prefix = attrs.prefix;
        answerData.suffix = attrs.suffix;
        break;
      
      case 'dateField':
        answerData.dateValue = questionValue;
        answerData.format = attrs.format;
        break;
      
      case 'dateTimeField':
        answerData.dateTimeValue = questionValue;
        answerData.format = attrs.format;
        break;
      
      case 'singleChoice': {
        // Helper function to extract text content from a node (same as submissionUtils)
        const extractTextFromContent = (contentNode: any): string => {
          if (!contentNode) return '';
          // First check for textContent property (available on TipTap ProseMirror nodes)
          if (contentNode.textContent) return contentNode.textContent;
          // Otherwise recursively extract from content array
          if (contentNode.content && Array.isArray(contentNode.content)) {
            const extractRecursive = (nodes: any[]): string => {
              let text = '';
              for (const node of nodes) {
                if (node.type === 'text' && node.text) {
                  text += node.text;
                } else if (node.content && Array.isArray(node.content)) {
                  text += extractRecursive(node.content);
                }
              }
              return text.trim();
            };
            return extractRecursive(contentNode.content);
          }
          return '';
        };
        
        // Get content array - handle both ProseMirror node (content.content) and JSONContent (content)
        let nodeContent: any[] | null = null;
        if (questionNode.content) {
          // Check if it's a ProseMirror Fragment (has .content property)
          const content = questionNode.content as any;
          if (content.content && Array.isArray(content.content)) {
            nodeContent = content.content;
          } 
          // Otherwise check if it's a direct array (JSONContent)
          else if (Array.isArray(questionNode.content)) {
            nodeContent = questionNode.content;
          }
        }
        
        // Find the matching option node from questionNode.content
        let selectedOptionDetails: any = null;
        
        if (questionValue && nodeContent && Array.isArray(nodeContent)) {
          // Handle "Other" option
          if (questionValue === '__other__' || questionValue === 'other') {
            const otherNode = nodeContent.find((child: any) => {
              // Handle both ProseMirror nodes (type.name) and JSONContent (type)
              return child?.type === 'singleChoiceOther' || child?.type?.name === 'singleChoiceOther';
            });
            
            if (otherNode) {
              // Extract text content from the other node
              let otherLabel = extractTextFromContent(otherNode);
              if (!otherLabel || otherLabel.trim() === '') {
                otherLabel = attrs.otherPlaceholder || 'Other…';
              }
              
              // Ensure we have a valid label before creating the object
              if (otherLabel) {
                // Extract points from node attribute or optionPoints
                let points = 0;
                if (otherNode.attrs?.points !== undefined && otherNode.attrs?.points !== null && otherNode.attrs?.points !== '') {
                  points = typeof otherNode.attrs.points === 'number' 
                    ? otherNode.attrs.points 
                    : (typeof otherNode.attrs.points === 'string' && !isNaN(Number(otherNode.attrs.points)) && otherNode.attrs.points.trim() !== ''
                        ? Number(otherNode.attrs.points)
                        : 0);
                } else if (attrs.optionPoints?.['__other__']?.points !== undefined && attrs.optionPoints['__other__'].points !== null && attrs.optionPoints['__other__'].points !== '') {
                  const pointsValue = attrs.optionPoints['__other__'].points;
                  points = typeof pointsValue === 'number' 
                    ? pointsValue 
                    : (typeof pointsValue === 'string' && !isNaN(Number(pointsValue)) && pointsValue.trim() !== ''
                        ? Number(pointsValue)
                        : 0);
                }
                
                // Extract isCorrect from node attribute or optionPoints
                let isCorrect = false;
                if (otherNode.attrs?.isCorrect !== undefined) {
                  isCorrect = otherNode.attrs.isCorrect === true || otherNode.attrs.isCorrect === 'true';
                } else if (attrs.optionPoints?.['__other__']?.isCorrect !== undefined) {
                  isCorrect = attrs.optionPoints['__other__'].isCorrect === true || attrs.optionPoints['__other__'].isCorrect === 'true';
                }
                
                selectedOptionDetails = {
                  id: otherNode.attrs?.id || null,
                  value: '__other__',
                  label: otherLabel,
                  points: points,
                  isCorrect: isCorrect,
                  imageUrl: null,
                };
              }
            } else {
              // Fallback for "Other" option if node not found
              const fallbackLabel = attrs.otherPlaceholder || 'Other…';
              if (fallbackLabel) {
                selectedOptionDetails = {
                  value: '__other__',
                  label: fallbackLabel,
                  points: attrs.optionPoints?.['__other__']?.points 
                    ? (typeof attrs.optionPoints['__other__'].points === 'number' 
                        ? attrs.optionPoints['__other__'].points 
                        : (typeof attrs.optionPoints['__other__'].points === 'string' && !isNaN(Number(attrs.optionPoints['__other__'].points)) && attrs.optionPoints['__other__'].points.trim() !== ''
                            ? Number(attrs.optionPoints['__other__'].points)
                            : 0))
                    : 0,
                  isCorrect: attrs.optionPoints?.['__other__']?.isCorrect === true || attrs.optionPoints?.['__other__']?.isCorrect === 'true' || false,
                  imageUrl: null,
                };
              }
            }
          } else {
            // Handle regular option
            const optionNode = nodeContent.find((child: any) => {
              // Handle both ProseMirror nodes (type.name) and JSONContent (type)
              const nodeType = child?.type?.name || child?.type;
              const nodeValue = child?.attrs?.value;
              return nodeType === 'singleChoiceOption' && nodeValue === questionValue;
            });
            
            if (optionNode) {
              // Extract text content from the option node using the helper function
              let optionLabel = extractTextFromContent(optionNode);
              // Fallback to attrs.value if no text content found
              if (!optionLabel || optionLabel.trim() === '') {
                optionLabel = optionNode.attrs?.value || questionValue || '';
              }
              
              // Ensure we have valid value and label before creating the object
              const optionValue = optionNode.attrs?.value || questionValue;
              if (optionValue && optionLabel) {
                // Extract points from node attribute or optionPoints
                let points = 0;
                if (optionNode.attrs?.points !== undefined && optionNode.attrs?.points !== null && optionNode.attrs?.points !== '') {
                  points = typeof optionNode.attrs.points === 'number' 
                    ? optionNode.attrs.points 
                    : (typeof optionNode.attrs.points === 'string' && !isNaN(Number(optionNode.attrs.points)) && optionNode.attrs.points.trim() !== ''
                        ? Number(optionNode.attrs.points)
                        : 0);
                } else if (attrs.optionPoints?.[optionValue]?.points !== undefined && attrs.optionPoints[optionValue].points !== null && attrs.optionPoints[optionValue].points !== '') {
                  const pointsValue = attrs.optionPoints[optionValue].points;
                  points = typeof pointsValue === 'number' 
                    ? pointsValue 
                    : (typeof pointsValue === 'string' && !isNaN(Number(pointsValue)) && pointsValue.trim() !== ''
                        ? Number(pointsValue)
                        : 0);
                }
                
                // Extract isCorrect from node attribute or optionPoints
                let isCorrect = false;
                if (optionNode.attrs?.isCorrect !== undefined) {
                  isCorrect = optionNode.attrs.isCorrect === true || optionNode.attrs.isCorrect === 'true';
                } else if (attrs.optionPoints?.[optionValue]?.isCorrect !== undefined) {
                  isCorrect = attrs.optionPoints[optionValue].isCorrect === true || attrs.optionPoints[optionValue].isCorrect === 'true';
                }
                
                selectedOptionDetails = {
                  id: optionNode.attrs?.id || null,
                  value: optionValue,
                  label: optionLabel,
                  points: points,
                  isCorrect: isCorrect,
                  imageUrl: optionNode.attrs?.imageUrl || null,
                };
              }
            }
          }
        }
        
        // If no option details found, create a basic object with the value
        // Only create if questionValue is not null/undefined/empty
        if (!selectedOptionDetails && questionValue !== null && questionValue !== undefined && questionValue !== '') {
          selectedOptionDetails = {
            value: questionValue,
            label: questionValue, // Fallback to value as label
            points: attrs.optionPoints?.[questionValue]?.points 
              ? (typeof attrs.optionPoints[questionValue].points === 'number' 
                  ? attrs.optionPoints[questionValue].points 
                  : (typeof attrs.optionPoints[questionValue].points === 'string' && !isNaN(Number(attrs.optionPoints[questionValue].points)) && attrs.optionPoints[questionValue].points.trim() !== ''
                      ? Number(attrs.optionPoints[questionValue].points)
                      : 0))
              : 0,
            isCorrect: attrs.optionPoints?.[questionValue]?.isCorrect === true || attrs.optionPoints?.[questionValue]?.isCorrect === 'true' || false,
            imageUrl: null,
          };
        }
        
        // Only set selectedOption if we have valid details
        if (selectedOptionDetails && selectedOptionDetails.value !== null && selectedOptionDetails.value !== undefined && selectedOptionDetails.label !== null && selectedOptionDetails.label !== undefined) {
          answerData.selectedOption = selectedOptionDetails;
        }
        answerData.options = attrs.options;
        answerData.otherValue = attrs.otherValue;
        break;
      }
      
      case 'multipleChoice':
        answerData.selectedOptions = Array.isArray(questionValue) ? questionValue : [];
        answerData.options = attrs.options;
        answerData.otherValue = attrs.otherValue;
        break;
      
      case 'ratingField':
        answerData.ratingValue = questionValue;
        answerData.maxRating = attrs.scale || attrs.maxRating || 5;
        answerData.ratingLabels = attrs.anchorLabels || attrs.ratingLabels;
        answerData.ratingVariant = attrs.variant || 'stars';
        answerData.allowHalf = attrs.allowHalf || false;
        break;
      
      case 'sliderRangeField':
        answerData.sliderValue = questionValue;
        answerData.min = attrs.min;
        answerData.max = attrs.max;
        answerData.step = attrs.step;
        answerData.unit = attrs.unit;
        break;
      
      case 'ranking':
        answerData.order = attrs.order || questionValue;
        answerData.options = attrs.options;
        break;
      
      case 'richText': {
        // Parse and store JSONContent directly (no HTML conversion)
        // Use questionValue if available, otherwise fallback to attrs.value
        // For ungrouped subjects, questionValue should come from nodeGroupValues
        let richTextValue = questionValue;
        
        // If questionValue is not set but we have nodeGroupValues, try to get it
        // This is important for ungrouped subjects where questionValue might not be set yet
        if ((richTextValue === undefined || richTextValue === null || richTextValue === '') && nodeGroupValues) {
          // Try to get from ungroupedData if available (this was set earlier in the code)
          if (answerData.ungroupedData?.subjectValue !== undefined && answerData.ungroupedData.subjectValue !== null && answerData.ungroupedData.subjectValue !== '') {
            richTextValue = answerData.ungroupedData.subjectValue;
          }
          // If still not found, try to get directly from nodeGroupValues for ungrouped subjects
          if ((richTextValue === undefined || richTextValue === null || richTextValue === '') && subjectContext.type === 'ungrouped' && subjectContext.subjectId) {
            const subjectId = Array.isArray(subjectContext.subjectId) 
              ? subjectContext.subjectId[0] 
              : subjectContext.subjectId;
            const ungroupedKey = createStatusKey('ungrouped', subjectId);
            if (nodeGroupValues[ungroupedKey] !== undefined && nodeGroupValues[ungroupedKey] !== null && nodeGroupValues[ungroupedKey] !== '') {
              richTextValue = nodeGroupValues[ungroupedKey];
            }
          }
          // If still not found, fallback to attrs.value
          if (richTextValue === undefined || richTextValue === null || richTextValue === '') {
            richTextValue = attrs.value || '<p></p>';
          }
        } else if (richTextValue === undefined || richTextValue === null || richTextValue === '') {
          richTextValue = attrs.value || '<p></p>';
        }
        
        // Parse JSONContent from various formats
        let jsonContent: any = null;
        
        // Check if it's already a JSONContent object
        if (typeof richTextValue === 'object' && richTextValue !== null && (richTextValue as any).type === 'doc') {
          jsonContent = richTextValue;
        } else if (typeof richTextValue === 'string') {
          // Try to parse as JSON string
          const trimmed = richTextValue.trim();
          
          // Strategy 1: Direct JSON parse if it starts with {
          if (trimmed.startsWith('{')) {
            try {
              const parsed = JSON.parse(richTextValue);
              if (parsed && parsed.type === 'doc') {
                jsonContent = parsed;
              }
            } catch {
              // Not valid JSON, continue
            }
          }
          
          // Strategy 2: If it's a quoted JSON string, unquote first
          if (!jsonContent && trimmed.startsWith('"') && trimmed.endsWith('"')) {
            try {
              const unquoted = JSON.parse(richTextValue);
              if (typeof unquoted === 'string' && unquoted.trim().startsWith('{')) {
                const parsed = JSON.parse(unquoted);
                if (parsed && parsed.type === 'doc') {
                  jsonContent = parsed;
                }
              }
            } catch {
              // Not valid, continue
            }
          }
          
          // Strategy 3: Try unescaping if it contains escaped quotes
          if (!jsonContent && (richTextValue.includes('\\"') || richTextValue.includes('\\{'))) {
            try {
              const parsedString = JSON.parse(richTextValue);
              if (typeof parsedString === 'string' && parsedString.trim().startsWith('{')) {
                const parsed = JSON.parse(parsedString);
                if (parsed && parsed.type === 'doc') {
                  jsonContent = parsed;
                }
              }
            } catch {
              // Try manual unescaping
              try {
                const unescaped = richTextValue
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, '\\')
                  .replace(/\\n/g, '\n')
                  .replace(/\\t/g, '\t')
                  .replace(/\\r/g, '\r');
                
                if (unescaped.trim().startsWith('{')) {
                  const parsed = JSON.parse(unescaped);
                  if (parsed && parsed.type === 'doc') {
                    jsonContent = parsed;
                  }
                }
              } catch {
                // Not valid JSON after unescaping
              }
            }
          }
          
          // If parsing failed, treat as HTML string (fallback)
          if (!jsonContent) {
            jsonContent = richTextValue;
          }
        }
        
        // Store JSONContent directly (will be rendered by RichTextRenderer component)
        answerData.jsonContent = jsonContent;
        break;
      }
      
      case 'addressNode': {
        // Address nodes store complex object data
        let addressData = questionValue;
        if (typeof questionValue === 'string') {
          try {
            addressData = JSON.parse(questionValue);
          } catch {
            // If parsing fails, use the string value
          }
        }
        answerData.addressData = {
          street: addressData?.street || '',
          apartment: addressData?.apartment || '',
          city: addressData?.city || '',
          state: addressData?.state || '',
          postalCode: addressData?.postalCode || '',
          country: addressData?.country || '',
          formatted: addressData?.formatted || '',
          lat: addressData?.lat,
          lng: addressData?.lng,
        };
        break;
      }
      
      default:
        // For any other node type, store the raw value
        answerData.rawValue = questionValue;
    }
    
    // Include common attributes
    answerData.required = attrs.required;
    answerData.enableGrouping = enableGrouping;
    answerData.nodeGroups = attrs.nodeGroups;
    
    return {
      // CRITICAL: Always prioritize node ID (from UniqueID extension) as questionId
      // This ensures consistent identification across all operations and socket.io channels
      questionId: attrs.id || attrs.name || questionKey,
      questionName: attrs.name || '',
      questionType: nodeType,
      questionLabel: attrs.label || label || attrs.name || '',
      questionValue,
      // Complete answer data with all details
      answerData,
      // Include tags in question attributes
      tags: attrs.tags || [],
    };
  }, [
    questionNode.attrs,
    questionNode.type,
    questionNode.content,
    questionKey,
    label,
    subjectContext.type,
    subjectContext.subjectId,
    subjectContext.groupId,
    subjectContext.groupName,
    subjectContext.subjectName,
  ]);

  // Prepare meta object with group/ungrouped subject details and questionData (memoized to prevent re-renders)
  const meta = useMemo(() => {
    // Ensure subjectId is always an array
    const subjectIds = Array.isArray(subjectContext.subjectId) 
      ? subjectContext.subjectId 
      : [subjectContext.subjectId].filter(Boolean);
    
    return {
      type: subjectContext.type,
      subjectId: subjectIds as string[],
      subjectName: subjectContext.subjectName,
      ...(subjectContext.type === 'group' && {
        groupId: subjectContext.groupId,
        groupName: subjectContext.groupName,
      }),
      // Include complete question data with all answer details
      questionData,
    };
  }, [subjectContext.type, subjectContext.subjectId, subjectContext.subjectName, subjectContext.groupId, subjectContext.groupName, questionData]);

  // Memoize channel request parameters (after meta is defined)
  // Use channelAssigneeId when provided (e.g. when a question approver opens the drawer) so we load the assignee's channel; otherwise currentUser._id for backward compat.
  const channelRequestParams = useMemo(() => {
    if (!open || !assignmentId || !questionKeyForChannel) return null;
    const assigneeId = channelAssigneeId ?? currentUser._id;
    return {
      channelType: 'question_approval' as const,
      assignmentId,
      questionKey: questionKeyForChannel, // Format: "{nodeId}-{groupId}" or "{nodeId}-{subjectId}"
      assigneeId,
      meta,
    };
  }, [open, assignmentId, questionKeyForChannel, channelAssigneeId, currentUser._id, meta]);

  // Update channelRequestParamsRef after channelRequestParams is defined
  useEffect(() => {
    channelRequestParamsRef.current = channelRequestParams;
  }, [channelRequestParams]);

  // Reset ref when drawer closes (so auto-approval can run once again on next open if conditions met)
  useEffect(() => {
    if (!open) {
      lastRequestedParamsRef.current = null;
      autoApprovalSentRef.current = false;
      setChannelId(undefined);
    }
  }, [open]);

  // Trigger channel fetch when params are ready
  useEffect(() => {
    if (!open || !channelRequestParams) {
      return;
    }
    
    // Create a unique key for these params to prevent duplicate calls
    const paramsKey = JSON.stringify(channelRequestParams);
    
    // Skip if we've already requested with these exact params
    if (lastRequestedParamsRef.current === paramsKey) {
      return;
    }
    
    // Mark these params as requested
    lastRequestedParamsRef.current = paramsKey;
    
    getChannel(channelRequestParams).then((result) => {
      if ('data' in result && result.data?.data?._id) {
        setChannelId(result.data.data._id);
      }
    }).catch((error) => {
      console.error('[QuestionApprovalDrawer] Failed to get channel:', error);
      // Reset the ref on error so we can retry if needed
      lastRequestedParamsRef.current = null;
    });
    // Note: getChannel is stable from RTK Query, so we don't need it in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelRequestParams, open]);

  // Update channelId when channelResponse changes
  useEffect(() => {
    if (channelResponse?.data?._id) {
      setChannelId(channelResponse.data._id);
    }
  }, [channelResponse?.data?._id]);

  // Reset auto-approval sent flag when status is not 'requested' (so we can auto-approve again when status becomes requested)
  useEffect(() => {
    const status = channelResponse?.data?.questionApprovalStatus;
    if (status !== 'requested') {
      autoApprovalSentRef.current = false;
    }
  }, [channelResponse?.data?.questionApprovalStatus]);

  // Auto-approve when status is 'requested' and context is fully pre-approved (not on drawer open)
  useEffect(() => {
    if (!open || !channelId || !channelResponse?.data) return;
    const status = channelResponse.data.questionApprovalStatus;
    if (status !== 'requested') return;
    if (!formContext.preApprovalForContext?.allPreApproved) return;
    if (autoApprovalSentRef.current) return;
    if (currentUser?._id !== channelAssigneeId) return;

    autoApprovalSentRef.current = true;
    const preComment = formContext.preApprovalForContext?.preApprovalComment?.trim();
    const comment = preComment
      ? `Auto approval: ${preComment}`
      : 'Auto approval: Pre-approved.';
    const localId = `local-${Date.now()}-${Math.random()}`;
    socket.sendMessage(
      channelId,
      comment,
      {
        action: 'approval:approved',
        actionData: { text: comment, isAutoApproval: true },
        localId,
      },
      'question_approval'
    );
  }, [
    open,
    channelId,
    channelResponse?.data,
    channelResponse?.data?.questionApprovalStatus,
    formContext.preApprovalForContext?.allPreApproved,
    formContext.preApprovalForContext?.preApprovalComment,
    socket,
    currentUser?._id,
    channelAssigneeId,
  ]);

  // CRITICAL: Sync questionApprovalStatus from channel API response to node attributes
  // This ensures the approval status from the channel is persisted in nodeGroupApprovalStatus
  // for the specific group/subject this channel represents
  useEffect(() => {
    const channelStatus = channelResponse?.data?.questionApprovalStatus;
    const channelMeta = channelResponse?.data?.meta;
    
    // Only proceed if we have a valid status from the channel
    if (!channelStatus || (channelStatus !== 'pending' && channelStatus !== 'approved' && channelStatus !== 'rejected')) {
      return;
    }

    // Determine the status key for this subject/group
    // CRITICAL: Use groupId/subjectId from channel meta if available (more reliable than subjectContext)
    // This ensures we use the exact IDs that the channel was created with
    // IMPORTANT: Match the format used in questionApprovalUtils.ts and submitUtils.ts
    // which use `group-${groupId}` format, so if groupId already has "group-" prefix,
    // we get "group-group-..." which matches the stored format in nodeGroupValues
    let statusKey: string;
    
    if (channelMeta?.type === 'group' && channelMeta?.groupId) {
      // CRITICAL: Use the same format as questionApprovalUtils.ts line 687: `group-${globalGroup.id}`
      // This always adds "group-" prefix, so:
      // - If groupId is "group-297df022-5f10-495b-b021-741432e32841" → "group-group-297df022-5f10-495b-b021-741432e32841" (matches stored format)
      // - If groupId is "297df022-5f10-495b-b021-741432e32841" → "group-297df022-5f10-495b-b021-741432e32841"
      const groupId = channelMeta.groupId;
      statusKey = `group-${groupId}`;
    } else if (channelMeta?.type === 'ungrouped' && channelMeta?.subjectId) {
      // Use subjectId from channel meta (can be array or single value)
      const subjectId = Array.isArray(channelMeta.subjectId) 
        ? channelMeta.subjectId[0] 
        : channelMeta.subjectId;
      statusKey = `ungrouped-${subjectId}`;
    } else {
      // Fallback to subjectContext if channel meta is not available
      if (subjectContext.type === 'group' && subjectContext.groupId) {
        // Use same format: `group-${groupId}` - always adds "group-" prefix
        // This matches the format used in questionApprovalUtils.ts and submitUtils.ts
        const groupId = subjectContext.groupId;
        statusKey = `group-${groupId}`;
      } else {
        const subjectId = Array.isArray(subjectContext.subjectId) 
          ? subjectContext.subjectId[0] 
          : subjectContext.subjectId;
        statusKey = `ungrouped-${subjectId}`;
      }
    }

    // Get current node attributes
    const attrs = questionNode.attrs as any;
    const nodeGroupApprovalStatus = attrs.nodeGroupApprovalStatus || {};

    // Debug: Log all existing keys to help identify the correct format
    const existingKeys = Object.keys(nodeGroupApprovalStatus);
    console.log('[QuestionApprovalDrawer] Syncing approval status from channel:', {
      statusKey,
      channelStatus,
      channelMeta,
      currentStatus: nodeGroupApprovalStatus[statusKey],
      existingKeys,
      nodeGroupApprovalStatus,
    });

    // Only update if status has changed
    if (nodeGroupApprovalStatus[statusKey] !== channelStatus) {
      // Update nodeGroupApprovalStatus for this specific subject/group
      const updatedNodeGroupApprovalStatus = {
        ...nodeGroupApprovalStatus,
        [statusKey]: channelStatus,
      };

      // Update node attributes
      // CRITICAL: Only update nodeGroupApprovalStatus, NOT global approvalStatus
      // This ensures each group/subject has its own approval status
      updateNodeAttributes({
        nodeGroupApprovalStatus: updatedNodeGroupApprovalStatus,
      });
      
      console.log('[QuestionApprovalDrawer] Updated approval status:', {
        statusKey,
        newStatus: channelStatus,
        updatedNodeGroupApprovalStatus,
      });
    } else {
      console.log('[QuestionApprovalDrawer] Status unchanged, skipping update:', {
        statusKey,
        currentStatus: nodeGroupApprovalStatus[statusKey],
        channelStatus,
      });
    }
  }, [channelResponse?.data?.questionApprovalStatus, channelResponse?.data?.meta, subjectContext.type, subjectContext.groupId, subjectContext.subjectId, questionNode.attrs, updateNodeAttributes]);

  console.log('[QuestionApprovalDrawer] Channel response:', {
    channelResponse,
    channelId,
    questionKeyForChannel,
    nodeId: questionNode.attrs.id,
    subjectContext: {
      type: subjectContext.type,
      groupId: subjectContext.groupId,
      subjectId: subjectContext.subjectId,
    },
    questionApprovalStatus: channelResponse?.data?.questionApprovalStatus,
  });

  // Function to get latest approval status from conversation messages
  const getLatestApprovalStatusFromMessages = useCallback((messages: any[]): 'requested' | 'approved' | 'rejected' | null => {
    if (!messages || messages.length === 0) {
      return null;
    }
    
    // Filter messages with approval actions and sort by timestamp (newest first)
    // Support both old format (approval:request, approval:approve, approval:reject) and new format (approval:requested, approval:approved, approval:rejected)
    const approvalMessages = messages
      .filter((msg) => {
        const action = msg.action;
        return action === 'approval:requested' ||
               action === 'approval:approved' ||
               action === 'approval:rejected';
      })
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA; // Newest first
      });
    
    if (approvalMessages.length === 0) {
      return null;
    }
    
    // Get the latest message with an approval action
    const latestMessage = approvalMessages[0];
    const action = latestMessage.action;
    
    // Map action to status (support both old and new formats)
    if (action === 'approval:approved') {
      return 'approved';
    } else if (action === 'approval:rejected') {
      return 'rejected';
    } else if (action === 'approval:requested') {
      return 'requested';
    }
    
    return null;
  }, []);

  // Update node attributes when messages change (from socket.io or initial fetch)
  useEffect(() => {
    if (conversationMessages && conversationMessages.length > 0) {
      const latestStatus = getLatestApprovalStatusFromMessages(conversationMessages);
      
      // Determine the key for this subject/group
      // CRITICAL: Use the same format as questionApprovalUtils.ts: `group-${groupId}`
      let statusKey: string;
      if (subjectContext.type === 'group' && subjectContext.groupId) {
        // Always add "group-" prefix to match stored format
        const groupId = subjectContext.groupId;
        statusKey = `group-${groupId}`;
      } else {
        const subjectId = Array.isArray(subjectContext.subjectId) 
          ? subjectContext.subjectId[0] 
          : subjectContext.subjectId;
        statusKey = `ungrouped-${subjectId}`;
      }
      
      // Create a unique key for this status update
      const statusUpdateKey = `${statusKey}-${latestStatus || 'null'}`;
      
      // Only update if status has actually changed
      if (lastUpdatedStatusRef.current !== statusUpdateKey) {
        lastUpdatedStatusRef.current = statusUpdateKey;
        
        if (latestStatus !== null) {
          const attrs = questionNode.attrs as any;
          const nodeGroupApprovalStatus = attrs.nodeGroupApprovalStatus || {};
          
          // Only update if status has changed
          if (nodeGroupApprovalStatus[statusKey] !== latestStatus) {
            // Update nodeGroupApprovalStatus for this specific subject/group
            const updatedNodeGroupApprovalStatus = {
              ...nodeGroupApprovalStatus,
              [statusKey]: latestStatus,
            };
            
            // Update node attributes
            // CRITICAL: Only update nodeGroupApprovalStatus, NOT global approvalStatus
            // Global approvalStatus should not be set as it causes status sharing between groups/subjects
            updateNodeAttributes({
              nodeGroupApprovalStatus: updatedNodeGroupApprovalStatus, // Per-subject/group status only
            });
          }
        } else {
          // If no approval action messages found, check if we should clear the status
          const attrs = questionNode.attrs as any;
          const nodeGroupApprovalStatus = attrs.nodeGroupApprovalStatus || {};
          
          // Only clear if there was a status before
          if (nodeGroupApprovalStatus[statusKey]) {
            // Remove status for this subject/group if no messages found
            const updatedNodeGroupApprovalStatus = { ...nodeGroupApprovalStatus };
            delete updatedNodeGroupApprovalStatus[statusKey];
            
            // Update node attributes
            // CRITICAL: Only update nodeGroupApprovalStatus, NOT global approvalStatus
            // Global approvalStatus should not be set as it causes status sharing between groups/subjects
            updateNodeAttributes({
              nodeGroupApprovalStatus: updatedNodeGroupApprovalStatus,
            });
          }
        }
      }
    }
    // Note: We intentionally exclude questionNode.attrs and updateNodeAttributes from deps
    // to prevent infinite loops. This effect only runs when conversationMessages change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationMessages, getLatestApprovalStatusFromMessages, subjectContext.type, subjectContext.subjectId, subjectContext.groupId]);

  // Memoized refresh function to refetch messages
  const handleRefreshConversation = useCallback(() => {
    if (refetchChannelMessages) {
      refetchChannelMessages();
    }
  }, [refetchChannelMessages]);

  // Memoized approval status calculation - prioritizes messages over node attributes
  // const currentApprovalStatus = useMemo(() => {
  //   // First, try to get status from conversation messages (most up-to-date)
  //   const latestStatusFromMessages = getLatestApprovalStatusFromMessages(conversationMessages);
  //   if (latestStatusFromMessages !== null) {
  //     return latestStatusFromMessages;
  //   }
    
  //   // Fallback to node attributes
  //   const attrs = questionNode.attrs as any;
  //   const nodeGroupApprovalStatus = attrs.nodeGroupApprovalStatus || {};
    
  //   // Determine the key for this subject/group
  //   // CRITICAL: Use the same format as questionApprovalUtils.ts: `group-${groupId}`
  //   let statusKey: string;
  //   if (subjectContext.type === 'group' && subjectContext.groupId) {
  //     // Always add "group-" prefix to match stored format
  //     const groupId = subjectContext.groupId;
  //     statusKey = `group-${groupId}`;
  //   } else {
  //     const subjectId = Array.isArray(subjectContext.subjectId) 
  //       ? subjectContext.subjectId[0] 
  //       : subjectContext.subjectId;
  //     statusKey = `ungrouped-${subjectId}`;
  //   }
    
  //   // CRITICAL: Only get status from nodeGroupApprovalStatus, do NOT fallback to global approvalStatus
  //   // Each subject/group must have its own approval status
  //   return nodeGroupApprovalStatus[statusKey];
  // }, [
  //   conversationMessages,
  //   getLatestApprovalStatusFromMessages,
  //   questionNode.attrs,
  //   subjectContext.type,
  //   subjectContext.groupId,
  //   subjectContext.subjectId,
  // ]);

  // Get status badge
  // const getStatusBadge = () => {
  //   if (isApproved) {
  //     return (
  //       <Tag icon={<CheckCircleOutlined />} color="success">
  //         Approved
  //       </Tag>
  //     );
  //   }
  //   if (isPending) {
  //     return (
  //       <Tag icon={<ClockCircleOutlined />} color="processing">
  //         Pending Approval
  //       </Tag>
  //     );
  //   }
  //   if (isRejected) {
  //     return (
  //       <Tag icon={<CloseCircleOutlined />} color="error">
  //         Rejected
  //       </Tag>
  //     );
  //   }
  //   return (
  //     <Tag color="default">
  //       Not Requested
  //     </Tag>
  //   );
  // };

  // Handle request approval
  const handleRequestApproval = () => {
    // Update node attributes to set status to pending
    // CRITICAL: Track approval status per subject/group using nodeGroupApprovalStatus
    const attrs = questionNode.attrs as any;
    const nodeGroupApprovalStatus = attrs.nodeGroupApprovalStatus || {};
    
    // Determine the key for this subject/group
    // CRITICAL: Use the same format as questionApprovalUtils.ts: `group-${groupId}`
    let statusKey: string;
    if (subjectContext.type === 'group' && subjectContext.groupId) {
      // Always add "group-" prefix to match stored format
      const groupId = subjectContext.groupId;
      statusKey = `group-${groupId}`;
    } else {
      // For ungrouped subjects, use ungrouped key
      const subjectId = Array.isArray(subjectContext.subjectId) 
        ? subjectContext.subjectId[0] 
        : subjectContext.subjectId;
      statusKey = `ungrouped-${subjectId}`;
    }
    
    // Update nodeGroupApprovalStatus for this specific subject/group
    const updatedNodeGroupApprovalStatus = {
      ...nodeGroupApprovalStatus,
      [statusKey]: 'requested',
    };

    // CRITICAL: Only update nodeGroupApprovalStatus, NOT global approvalStatus
    // Global approvalStatus should not be set as it causes status sharing between groups/subjects
    updateNodeAttributes({
      nodeGroupApprovalStatus: updatedNodeGroupApprovalStatus, // Per-subject/group status only
    });
  };

  // console.log('questionNode', questionNode);
  return (
    <Drawer
      title={
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Space>
            <Title level={5} style={{ margin: 0 }}>
              {label || questionNode.attrs.name || 'Question Approval'}
            </Title>
          </Space>
          <Space>
            {/* {getStatusBadge()} */}
            {questionNode.attrs.required && (
              <Tag color="orange">Required</Tag>
            )}
          </Space>
        </Space>
      }
      placement="right"
      width={600}
      open={open}
      onClose={onClose}
      styles={{
        body: { paddingTop: 16 },
      }}
      destroyOnHidden={true}
    >
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {/* Pre-approval from question approver (submitMeta.preApprovalByAssignee) */}
        {formContext.isPreApprovedForCurrentContext && (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message="Pre-approved"
            description="This group/ungrouped subject was marked as pre-approved by a question approver. You can still request approval or discuss in the chat below."
            style={{ marginBottom: 8 }}
          />
        )}
        {/* Question Details - Compact */}
        {/* <div
          style={{
            background: token.colorBgLayout,
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${token.colorBorder}`,
          }}
        >
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
            Question Details
          </Text>
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12, minWidth: 60 }}>Type:</Text>
              <Tag style={{ margin: 0, fontSize: 11 }}>{questionNode.type}</Tag>
            </div>
            {questionNode.attrs.name && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12, minWidth: 60 }}>Name:</Text>
                <Text style={{ fontSize: 12 }}>{questionNode.attrs.name}</Text>
              </div>
            )}
            {questionNode.attrs.required && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12, minWidth: 60 }}>Required:</Text>
                <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>Yes</Tag>
              </div>
            )}
            {questionNode.attrs.value && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Text type="secondary" style={{ fontSize: 12, minWidth: 60 }}>Value:</Text>
                <Text code style={{ fontSize: 11, wordBreak: 'break-all' }}>
                  {JSON.stringify(questionNode.attrs.value)}
                </Text>
              </div>
            )}
          </Space>
        </div> */}


        {/* Subject/Group Context - Compact */}
        <div
          style={{
            background: token.colorBgLayout,
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${token.colorBorder}`,
          }}
        >
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
            Subject Context
          </Text>
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12, minWidth: 60 }}>Type:</Text>
              <Tag 
                color={subjectContext.type === 'group' ? 'blue' : 'default'}
                style={{ margin: 0, fontSize: 11 }}
              >
                {subjectContext.type === 'group' ? 'Group' : 'Ungrouped'}
              </Tag>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Text type="secondary" style={{ fontSize: 12, minWidth: 60 }}>Subject:</Text>
              <Text 
                style={{ fontSize: 12, flex: 1, wordBreak: 'break-word' }}
                title={subjectContext.subjectName}
              >
                {subjectContext.subjectName}
              </Text>
            </div>
            {subjectContext.type === 'group' && subjectContext.groupName && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Text type="secondary" style={{ fontSize: 12, minWidth: 60 }}>Group:</Text>
                <Text 
                  style={{ fontSize: 12, flex: 1, wordBreak: 'break-word' }}
                  title={subjectContext.groupName}
                >
                  {subjectContext.groupName}
                </Text>
              </div>
            )}
            {/* Pre-approval: one line when assignee grouping matches QA; per-subject when it doesn't */}
            {formContext.preApprovalForContext?.allPreApproved === true ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12, minWidth: 60 }}>Pre-approval:</Text>
                <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0, fontSize: 11 }}>
                  Yes — this {subjectContext.type === 'group' ? 'group' : 'ungrouped subject'} was pre-approved by a question approver
                </Tag>
              </div>
            ) : formContext.preApprovalForContext?.subjectBreakdown?.length ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: 'column' }}>
                <Text type="secondary" style={{ fontSize: 12, minWidth: 60 }}>Pre-approval (by subject):</Text>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  {formContext.preApprovalForContext.subjectBreakdown.map((s) => (
                    <div key={s.subjectId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 12, flex: 1 }}>{s.subjectName || s.subjectId}</Text>
                      {s.preApproved ? (
                        <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0, fontSize: 11 }}>Pre-approved</Tag>
                      ) : (
                        <Tag color="default" style={{ margin: 0, fontSize: 11 }}>Not pre-approved</Tag>
                      )}
                    </div>
                  ))}
                </Space>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12, minWidth: 60 }}>Pre-approval:</Text>
                <Tag color="default" style={{ margin: 0, fontSize: 11 }}>No</Tag>
              </div>
            )}
          </Space>
        </div>

        {/* Approvers - Compact with Scrolling */}
        <div
          style={{
            background: token.colorBgLayout,
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${token.colorBorder}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text strong style={{ fontSize: 13 }}>
              Approvers
            </Text>
            {approversForChat.length > 0 && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {approversForChat.length} {approversForChat.length === 1 ? 'approver' : 'approvers'}
              </Text>
            )}
          </div>
          {approversForChat.length > 0 ? (
            <div
              style={{
                maxHeight: 120,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              <Space wrap size={[4, 4]}>
                {approversForChat.map((approver, index) => {
                  // Handle both string IDs and user objects
                  const approverDisplay = typeof approver === 'string' 
                    ? approver 
                    : (approver as any)?.user?.name || (approver as any)?.name || (approver as any)?._id || 'Unknown';
                  
                  return (
                    <Tag 
                      key={index} 
                      color="blue"
                      style={{ margin: 0, fontSize: 11, padding: '0 6px' }}
                    >
                      {approverDisplay}
                    </Tag>
                  );
                })}
              </Space>
            </div>
          ) : (
            <Alert
              message="No approvers assigned"
              type="warning"
              showIcon
              description="Please configure approvers for this question or at the form level."
              style={{ fontSize: 12 }}
            />
          )}
        </div>

        {/* <Divider /> */}

        {/* Rejection Message */}
        {/* {isRejected && questionNode.attrs.rejectionMessage && (
          <Alert
            message="Rejection Feedback"
            description={questionNode.attrs.rejectionMessage}
            type="error"
            showIcon
            icon={<CloseCircleOutlined />}
          />
        )} */}



        {/* Approval Status Info */}
        {/* {isPending && (
          <Alert
            message="Approval Pending"
            description="Your approval request has been sent to the approvers. They will review and respond shortly."
            type="info"
            showIcon
          />
        )} */}

        {/* {isApproved && (
          <Alert
            message="Approved"
            description="This question has been approved. You can proceed with the form."
            type="success"
            showIcon
          />
        )} */}

        {/* <Divider /> */}

        {/* Chat Interface */}
        <div>
          <Text strong style={{ fontSize: 16, marginBottom: 8, display: 'block' }}>
            Approval Discussion
          </Text>
          {/* Independent QuestionApprovalChat for question-level approval */}
          <div
            style={{
              background: token.colorBgLayout,
              borderRadius: 8,
              border: `1px solid ${token.colorBorder}`,
              overflow: 'hidden',
              position: 'relative',
              minHeight: 300,
            }}
          >
            {isLoadingMessages ? (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: 300,
                padding: 40 
              }}>
                <Spin size="large" />
              </div>
            ) : (
              <QuestionApprovalChat
              questionId={questionNode.attrs.name || questionNode.type}
              assignmentId={formContext.assignmentId}
              currentUserId={currentUser._id}
              currentUserName={currentUser.name}
              approvers={approversForChat.map(approver => {
                const name = (typeof approver.user === 'object' && approver.user !== null && 'name' in approver.user)
                  ? ((approver.user as { name?: string }).name ?? '')
                  : (approver as any).firstName
                    ? `${(approver as any).firstName} ${(approver as any).lastName || ''}`.trim()
                    : '';
                return { _id: approver._id, name: name || approver._id };
              })}
              approvalStatus={channelResponse?.data?.questionApprovalStatus || 'pending'}
              onRequestApproval={handleRequestApproval}
              onApprovalAction={(action, message) => {
                // Update approval status per subject/group
                const attrs = questionNode.attrs as any;
                const nodeGroupApprovalStatus = attrs.nodeGroupApprovalStatus || {};
                
                // Determine the key for this subject/group
                // CRITICAL: Use the same format as questionApprovalUtils.ts: `group-${groupId}`
                let statusKey: string;
                if (subjectContext.type === 'group' && subjectContext.groupId) {
                  // Always add "group-" prefix to match stored format
                  const groupId = subjectContext.groupId;
                  statusKey = `group-${groupId}`;
                } else {
                  const subjectId = Array.isArray(subjectContext.subjectId) 
                    ? subjectContext.subjectId[0] 
                    : subjectContext.subjectId;
                  statusKey = `ungrouped-${subjectId}`;
                }
                
                if (action === 'approve') {
                  const updatedNodeGroupApprovalStatus = {
                    ...nodeGroupApprovalStatus,
                    [statusKey]: 'approved',
                  };
                  // CRITICAL: Only update nodeGroupApprovalStatus, NOT global approvalStatus
                  // Global approvalStatus should not be set as it causes status sharing between groups/subjects
                  updateNodeAttributes({
                    nodeGroupApprovalStatus: updatedNodeGroupApprovalStatus, // Per-subject/group status only
                    rejectionMessage: undefined,
                  });
                } else if (action === 'reject') {
                  const updatedNodeGroupApprovalStatus = {
                    ...nodeGroupApprovalStatus,
                    [statusKey]: 'rejected',
                  };
                  // CRITICAL: Only update nodeGroupApprovalStatus, NOT global approvalStatus
                  // Global approvalStatus should not be set as it causes status sharing between groups/subjects
                  updateNodeAttributes({
                    nodeGroupApprovalStatus: updatedNodeGroupApprovalStatus, // Per-subject/group status only
                    rejectionMessage: message || 'Rejected',
                  });
                }
              }}
              questionConversationId={questionConversationId}
              initialMessages={conversationMessages}
              onRefreshConversation={handleRefreshConversation}
              questionKey={questionKey}
              subjects={Array.isArray(subjectContext.subjectId) 
                ? subjectContext.subjectId 
                : [subjectContext.subjectId].filter(Boolean)}
              questionLabel={label || questionNode.attrs.name || questionNode.attrs.label || 'this question'}
              formName={formContext.formName}
              meta={meta}
              questionData={questionData}
              questionApprovalStatus={channelResponse?.data?.questionApprovalStatus}
            />
            )}
          </div>
        </div>
      </Space>
    </Drawer>
  );
};
