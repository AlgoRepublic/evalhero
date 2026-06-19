/* eslint-disable @typescript-eslint/no-explicit-any */
import { JSONContent } from '@tiptap/core';
import { Profile } from '../../../features/auth/authSlice';

/**
 * Question node attributes for approval tracking
 */
export interface QuestionNodeAttrs {
  name?: string;
  label?: string;
  required?: boolean;
  requiresApproval?: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvers?: string[]; // Config set approvers (takes precedence)
  rejectionMessage?: string;
  value?: any;
  [key: string]: any; // Allow other attributes
}

/**
 * Question node structure
 */
export interface QuestionNode {
  type: string;
  attrs: QuestionNodeAttrs;
  content?: JSONContent[];
}

/**
 * Subject/Group context for approval
 */
export interface SubjectContext {
  type: 'group' | 'ungrouped';
  subjectId: string[];
  subjectName: string;
  groupId?: string;
  groupName?: string;
  subjects: string[]; // Array of Profile objects for all subjects in the group or single subject for ungrouped
}

/**
 * Form context for approval
 */
export interface FormContext {
  assignmentId: string;
  formTemplateId: string;
  formName: string;
  formApprovers: Profile[]; // Form-level approvers (fallback)
  /** Question-level approvers; both approvers and questionApprovers can open the drawer and approve. */
  questionApprovers?: Profile[];
  /** When false, template/ConfigSet has approval disabled; question-level approval is not used. */
  templateHasApproval?: boolean;
  /** When true, this group/ungrouped subject has pre-approval from question approver for this question (from submitMeta.preApprovalByAssignee). */
  isPreApprovedForCurrentContext?: boolean;
  /** Pre-approval for current context: when assignee grouping matches QA, allPreApproved is true; else subjectBreakdown shows per-subject pre-approval. */
  preApprovalForContext?: PreApprovalForContext;
}

/**
 * Current user information
 */
export interface CurrentUser {
  _id: string;
  name: string;
  email: string;
}

/**
 * Props for QuestionApprovalDrawer component
 */
export interface QuestionApprovalDrawerProps {
  label: string;
  // Visibility control
  open: boolean;
  onClose: () => void;

  // Question data
  questionNode: QuestionNode;

  // Subject/Group context
  subjectContext: SubjectContext;

  // Form context
  formContext: FormContext;

  // Update function to modify node attributes
  updateNodeAttributes: (attrs: Partial<QuestionNodeAttrs>) => void;

  /** Logged-in user (for chat: who is viewing; isApprover is true when this user is in questionApprovers). */
  currentUser: CurrentUser;
  /** Assignee profile id for the channel request. When provided, getChannel uses this so the correct assignee channel is loaded (e.g. when a question approver opens the drawer). */
  channelAssigneeId?: string;
}

/**
 * Approval request data structure
 */
export interface QuestionApprovalRequest {
  questionId: string;
  questionName: string;
  questionType: string;
  formId: string;
  formName: string;
  subjectId: string;
  subjectName: string;
  groupId?: string;
  groupName?: string;
  requesterId: string;
  requesterName: string;
  approvers: string[]; // Resolved from config or form-level
  timestamp: Date;
  questionValue?: any;
}

/**
 * Approval response data structure
 */
export interface QuestionApprovalResponse {
  questionId: string;
  approverId: string;
  approverName: string;
  status: 'approved' | 'rejected';
  message?: string; // Required for rejection
  timestamp: Date;
}

/**
 * Resolve approvers for a question
 * Priority: Config set approvers > Form-level approvers
 */
export const resolveQuestionApprovers = (
  questionNode: QuestionNode,
  formApprovers: string[]
): string[] => {
  // Use config set approvers if defined
  if (questionNode.attrs.approvers && questionNode.attrs.approvers.length > 0) {
    return questionNode.attrs.approvers;
  }

  // Fallback to form-level approvers
  return formApprovers;
};

/**
 * Check if a question requires approval
 */
export const questionRequiresApproval = (questionNode: QuestionNode): boolean => {
  return questionNode.attrs.requiresApproval === true;
};

/**
 * Check if a question is approved
 */
export const isQuestionApproved = (questionNode: QuestionNode): boolean => {
  return questionNode.attrs.approvalStatus === 'approved';
};

/**
 * Check if a question approval is pending
 */
export const isQuestionApprovalPending = (questionNode: QuestionNode): boolean => {
  return questionNode.attrs.approvalStatus === 'pending';
};

/**
 * Check if a question approval is rejected
 */
export const isQuestionApprovalRejected = (questionNode: QuestionNode): boolean => {
  return questionNode.attrs.approvalStatus === 'rejected';
};

/**
 * Validate all questions requiring approval are approved
 * Returns validation result with details
 * In submit mode with groups, validates each subject/group individually
 */
export const validateQuestionApprovals = (
  doc: JSONContent,
  subjectGroups?: Array<{ id: string; name: string; subjectIds: string[] }>,
  availableSubjects?: Array<{ label: string; value: string }>,
  isSubmitMode?: boolean
): {
  ok: boolean;
  message?: string;
  pendingQuestions?: Array<{ 
    name?: string; 
    type: string;
    subjectId?: string;
    subjectName?: string;
    groupId?: string;
    groupName?: string;
  }>;
  rejectedQuestions?: Array<{ 
    name?: string; 
    type: string;
    rejectionMessage?: string;
    subjectId?: string;
    subjectName?: string;
    groupId?: string;
    groupName?: string;
  }>;
} => {
  const pendingQuestions: Array<{ 
    name?: string; 
    type: string;
    subjectId?: string;
    subjectName?: string;
    groupId?: string;
    groupName?: string;
  }> = [];
  const rejectedQuestions: Array<{ 
    name?: string; 
    type: string;
    rejectionMessage?: string;
    subjectId?: string;
    subjectName?: string;
    groupId?: string;
    groupName?: string;
  }> = [];

  // Helper to check approval status for a specific subject/group
  const checkApprovalForSubject = (
    node: JSONContent,
    attrs: any,
    subjectId: string,
    globalGroups?: Array<{ id: string; name: string; subjectIds: string[] }>
  ) => {
    // Get approval status for this specific subject/group
    const status = getApprovalStatusForSubject(
      node,
      subjectId,
      globalGroups || []
    );

    // Find subject/group info for error messages
    const globalGroup = globalGroups?.find((g) => g.subjectIds.includes(subjectId));
    const subject = availableSubjects?.find((s) => s.value === subjectId);

    if (status === 'pending' || !status) {
      pendingQuestions.push({
        name: attrs.name || attrs.label,
        type: node.type || 'unknown',
        subjectId,
        subjectName: subject?.label || 'Unknown',
        groupId: globalGroup?.id,
        groupName: globalGroup?.name,
      });
    } else if (status === 'rejected') {
      // Get rejection message from nodeGroupApprovalStatus if available
      const enableGrouping = attrs.enableGrouping === true || attrs.enableGrouping === 'true';
      const nodeGroupApprovalStatus = attrs.nodeGroupApprovalStatus || {};
      
      // Try to get rejection message from nodeGroupApprovalStatus
      let rejectionMessage = attrs.rejectionMessage;
      
      if (enableGrouping && attrs.nodeGroups && Array.isArray(attrs.nodeGroups)) {
        const nodeGroups = attrs.nodeGroups as Array<{ id: string; name: string; subjectIds: string[] }>;
        const nodeGroup = nodeGroups.find((g) => g.subjectIds.includes(subjectId));
        if (nodeGroup) {
          const groupKey = `group-${nodeGroup.id}`;
          // Get rejection message from nodeGroupApprovalStatus if available
          const groupRejectionMessage = (nodeGroupApprovalStatus[groupKey] as any)?.rejectionMessage;
          if (groupRejectionMessage) {
            rejectionMessage = groupRejectionMessage;
          }
        } else {
          const ungroupedKey = `ungrouped-${subjectId}`;
          // Get rejection message from nodeGroupApprovalStatus if available
          const ungroupedRejectionMessage = (nodeGroupApprovalStatus[ungroupedKey] as any)?.rejectionMessage;
          if (ungroupedRejectionMessage) {
            rejectionMessage = ungroupedRejectionMessage;
          }
        }
      } else if (globalGroup) {
        const globalGroupKey = `group-${globalGroup.id}`;
        // Get rejection message from nodeGroupApprovalStatus if available
        const globalGroupRejectionMessage = (nodeGroupApprovalStatus[globalGroupKey] as any)?.rejectionMessage;
        if (globalGroupRejectionMessage) {
          rejectionMessage = globalGroupRejectionMessage;
        }
      } else {
        const ungroupedKey = `ungrouped-${subjectId}`;
        // Get rejection message from nodeGroupApprovalStatus if available
        const ungroupedRejectionMessage = (nodeGroupApprovalStatus[ungroupedKey] as any)?.rejectionMessage;
        if (ungroupedRejectionMessage) {
          rejectionMessage = ungroupedRejectionMessage;
        }
      }

      rejectedQuestions.push({
        name: attrs.name || attrs.label,
        type: node.type || 'unknown',
        rejectionMessage,
        subjectId,
        subjectName: subject?.label || 'Unknown',
        groupId: globalGroup?.id,
        groupName: globalGroup?.name,
      });
    }
  };

  const walk = (node?: JSONContent) => {
    if (!node) return;

    const attrs = node.attrs as QuestionNodeAttrs | undefined;

    // Check if this node requires approval (support both attribute names)
    // Handle both boolean and string values (for runtime flexibility)
    const approvalRequired = attrs?.approvalRequired;
    const requiresApprovalAttr = attrs?.requiresApproval;
    const requiresApproval = 
      approvalRequired === true || 
      (typeof approvalRequired === 'string' && approvalRequired === 'true') ||
      requiresApprovalAttr === true ||
      (typeof requiresApprovalAttr === 'string' && requiresApprovalAttr === 'true');
    
    if (requiresApproval && attrs) {
      // In submit mode with groups, check each subject/group individually
      if (isSubmitMode && subjectGroups && availableSubjects) {
        // Get all subject IDs
        const allSubjectIds: string[] = [];
        subjectGroups.forEach((group) => {
          allSubjectIds.push(...group.subjectIds);
        });
        availableSubjects.forEach((subject) => {
          allSubjectIds.push(subject.value);
        });
        const uniqueSubjectIds = Array.from(new Set(allSubjectIds));

        // Check approval status for each subject
        uniqueSubjectIds.forEach((subjectId) => {
          checkApprovalForSubject(node, attrs, subjectId, subjectGroups);
        });
      } else {
        // Original validation logic for non-submit mode or when no groups
        const status = attrs.approvalStatus;

        if (status === 'pending' || !status) {
          pendingQuestions.push({
            name: attrs.name || attrs.label,
            type: node.type || 'unknown',
          });
        } else if (status === 'rejected') {
          rejectedQuestions.push({
            name: attrs.name || attrs.label,
            type: node.type || 'unknown',
            rejectionMessage: attrs.rejectionMessage,
          });
        }
      }
    }

    // Recurse through children
    if (Array.isArray(node.content)) {
      node.content.forEach((child) => walk(child));
    }
  };

  walk(doc);

  if (pendingQuestions.length > 0) {
    // Build detailed error message
    const pendingCount = pendingQuestions.length;
    const uniqueQuestions = new Set(pendingQuestions.map(q => q.name || q.type));
    const uniqueCount = uniqueQuestions.size;
    
    let message = `${pendingCount} approval request(s) are pending for ${uniqueCount} question(s). `;
    if (isSubmitMode && subjectGroups) {
      message += 'Please ensure all questions are approved for all subjects/groups before submission.';
    } else {
      message += 'Please ensure all questions are approved before submission.';
    }

    return {
      ok: false,
      message,
      pendingQuestions,
    };
  }

  if (rejectedQuestions.length > 0) {
    // Build detailed error message
    const rejectedCount = rejectedQuestions.length;
    const uniqueQuestions = new Set(rejectedQuestions.map(q => q.name || q.type));
    const uniqueCount = uniqueQuestions.size;
    
    let message = `${rejectedCount} question(s) have been rejected for ${uniqueCount} question(s). `;
    if (isSubmitMode && subjectGroups) {
      message += 'Please address the feedback and re-request approval for all subjects/groups.';
    } else {
      message += 'Please address the feedback and re-request approval.';
    }

    return {
      ok: false,
      message,
      rejectedQuestions,
    };
  }

  return { ok: true };
};

/** Stable key for a question (matches PreApprovalManager and preApprovalByQuestion keys) */
export function getQuestionKeyFromNode(node: QuestionNode, path: number[]): string {
  const id = node?.attrs?.id || node?.attrs?.name;
  if (id) return String(id);
  return `path-${path.join('-')}`;
}

/**
 * Get all questions requiring approval from a document
 */
export const getQuestionsRequiringApproval = (
  doc: JSONContent
): Array<{ node: QuestionNode; path: number[] }> => {
  const questions: Array<{ node: QuestionNode; path: number[] }> = [];

  const walk = (node?: JSONContent, path: number[] = []) => {
    if (!node) return;

    const attrs = node.attrs as QuestionNodeAttrs | undefined;
    const requiresApproval =
      attrs?.requiresApproval === true ||
      attrs?.approvalRequired === true ||
      (typeof attrs?.approvalRequired === 'string' && attrs.approvalRequired === 'true');

    if (requiresApproval) {
      questions.push({
        node: node as QuestionNode,
        path,
      });
    }

    // Recurse through children
    if (Array.isArray(node.content)) {
      node.content.forEach((child, index) => walk(child, [...path, index]));
    }
  };

  walk(doc);

  return questions;
};

/**
 * Get approval status summary for a form
 */
export const getApprovalStatusSummary = (doc: JSONContent) => {
  const questions = getQuestionsRequiringApproval(doc);
  const total = questions.length;
  const approved = questions.filter((q) => isQuestionApproved(q.node)).length;
  const pending = questions.filter((q) => isQuestionApprovalPending(q.node)).length;
  const rejected = questions.filter((q) => isQuestionApprovalRejected(q.node)).length;
  const notRequested = total - approved - pending - rejected;

  return {
    total,
    approved,
    pending,
    rejected,
    notRequested,
    allApproved: total > 0 && approved === total,
    canSubmit: total === 0 || approved === total,
  };
};

/**
 * Validate if a node's requirements are fulfilled for a specific subject/group
 * This checks if the field has a valid value according to its type and required status
 */
export const validateNodeRequirements = (
  node: JSONContent,
  subjectId: string,
  globalGroups: Array<{ id: string; name: string; subjectIds: string[] }>,
  availableSubjects: Array<{ label: string; value: string }>
): { ok: boolean; message?: string } => {
  if (!node || !node.attrs) {
    console.log('availableSubjects', availableSubjects);
    return { ok: false, message: 'Invalid node' };
  }

  const attrs = node.attrs as any;
  const nodeType = node.type;
  const enableGrouping = attrs.enableGrouping === true || attrs.enableGrouping === 'true';
  const nodeGroupValues = attrs.nodeGroupValues || {};
  
  // Find which group this subject belongs to (in global groups)
  const globalGroup = globalGroups.find((g) => g.subjectIds.includes(subjectId));
  // const isUngrouped = !globalGroup && availableSubjects.some((s) => s.value === subjectId);
  
  // Get the value for this specific subject/group
  // Matrix nodes use 'cells' instead of 'value'
  let value: any = nodeType === 'matrixField' ? (attrs.cells || {}) : attrs.value;
  
  if (enableGrouping && attrs.nodeGroups && Array.isArray(attrs.nodeGroups)) {
    // Node has node-based grouping
    const nodeGroups = attrs.nodeGroups as Array<{ id: string; name: string; subjectIds: string[] }>;
    const nodeGroup = nodeGroups.find((g) => g.subjectIds.includes(subjectId));
    
    if (nodeGroup) {
      // Subject is in a node group - use group value
      const groupKey = `group-${nodeGroup.id}`;
      value = nodeGroupValues[groupKey];
    } else {
      // Subject is not in any node group - check if it's ungrouped
      const ungroupedKey = `ungrouped-${subjectId}`;
      value = nodeGroupValues[ungroupedKey];
    }
  } else if (nodeGroupValues && typeof nodeGroupValues === 'object' && Object.keys(nodeGroupValues).length > 0) {
    // Node has nodeGroupValues (even if enableGrouping is false)
    if (globalGroup) {
      // Try global group key first
      const globalGroupKey = `group-${globalGroup.id}`;
      value = nodeGroupValues[globalGroupKey];
    }
    
    // Check for ungrouped value
    const ungroupedKey = `ungrouped-${subjectId}`;
    const ungroupedValue = nodeGroupValues[ungroupedKey];
    if (ungroupedValue !== undefined && ungroupedValue !== null && ungroupedValue !== '') {
      value = ungroupedValue;
    }
  }

  // Check if field is required
  const required = attrs.required === true || attrs.required === 'true';
  
  if (!required) {
    // If not required, any value (including empty) is valid
    return { ok: true };
  }

  // Validate based on node type
  switch (nodeType) {
    case 'shortText':
    case 'longText':
      if (!value || (typeof value === 'string' && value.trim().length === 0)) {
        return { ok: false, message: 'This field is required' };
      }
      break;
    
    case 'numberField':
      if (value == null || value === '') {
        return { ok: false, message: 'This field is required' };
      }
      break;
    
    case 'dateField':
    case 'dateTimeField':
      if (!value || value === '') {
        return { ok: false, message: 'This field is required' };
      }
      break;
    
    case 'singleChoice':
      if (!value || value === '') {
        return { ok: false, message: 'This field is required' };
      }
      // Check if "Other" is selected and has value
      if (value === '__other__') {
        const otherNode = (node.content || []).find((c: any) => c?.type === 'singleChoiceOther');
        if (otherNode) {
          const hasText = (n?: JSONContent): boolean => {
            if (!n) return false;
            if (n.type === 'text' && typeof (n as any).text === 'string') {
              return ((n as any).text || '').trim().length > 0;
            }
            if (Array.isArray(n.content)) {
              return n.content.some((c) => hasText(c));
            }
            return false;
          };
          if (!hasText(otherNode)) {
            return { ok: false, message: 'Please provide a value for "Other"' };
          }
        }
      }
      break;
    
    case 'multipleChoice':
      if (!value || !Array.isArray(value) || value.length === 0) {
        return { ok: false, message: 'This field is required' };
      }
      // Check if "Other" is selected and has value
      if (value.includes('__other__')) {
        const otherNode = (node.content || []).find((c: any) => c?.type === 'multipleChoiceOther');
        if (otherNode) {
          const hasText = (n?: JSONContent): boolean => {
            if (!n) return false;
            if (n.type === 'text' && typeof (n as any).text === 'string') {
              return ((n as any).text || '').trim().length > 0;
            }
            if (Array.isArray(n.content)) {
              return n.content.some((c) => hasText(c));
            }
            return false;
          };
          if (!hasText(otherNode)) {
            return { ok: false, message: 'Please provide a value for "Other"' };
          }
        }
      }
      break;
    
    case 'ratingField':
      if (value == null || value === '') {
        return { ok: false, message: 'This field is required' };
      }
      break;
    
    case 'sliderRangeField':
      if (value == null || value === '') {
        return { ok: false, message: 'This field is required' };
      }
      break;
    
    case 'richText': {
      if (!value || value === '<p></p>') {
        return { ok: false, message: 'This field is required' };
      }
      // Check if it has actual text content
      const hasText = (n?: JSONContent): boolean => {
        if (!n) return false;
        if (n.type === 'text' && typeof (n as any).text === 'string') {
          return ((n as any).text || '').trim().length > 0;
        }
        if (Array.isArray(n.content)) {
          return n.content.some((c) => hasText(c));
        }
        return false;
      };
      // If value is a string (HTML), check if it has text
      if (typeof value === 'string') {
        const textOnly = value.replace(/<[^>]*>/g, '').trim().length === 0;
        if (textOnly) {
          return { ok: false, message: 'This field is required' };
        }
      } else if (typeof value === 'object') {
        // If value is JSONContent, check if it has text
        if (!hasText(value as JSONContent)) {
          return { ok: false, message: 'This field is required' };
        }
      }
      break;
    }
    
    case 'ranking': {
      const order = attrs.order || value;
      if (!order || !Array.isArray(order) || order.length === 0) {
        return { ok: false, message: 'This field is required' };
      }
      break;
    }
    
    case 'addressNode':
      if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
        return { ok: false, message: 'This field is required' };
      }
      break;
    
    case 'matrixField': {
      // For matrix, value is the cells object (or from nodeGroupValues)
      const cells = value && typeof value === 'object' ? value : {};
      const columns = Array.isArray(attrs?.columns) ? attrs.columns : [];
      const rows = Array.isArray(attrs?.rows) ? attrs.rows : [];
      
      // Check if any required column has missing values for any row
      for (const col of columns) {
        if (col.required === true || col.required === 'true') {
          for (const row of rows) {
            const rowId = row.id;
            const colId = col.id;
            const cellValue = cells[rowId] && cells[rowId][colId];
            
            // Check if cell is empty
            const isEmpty = 
              cellValue === null ||
              cellValue === undefined ||
              (typeof cellValue === 'string' && cellValue.trim().length === 0) ||
              (Array.isArray(cellValue) && cellValue.length === 0);
            
            if (isEmpty) {
              return { ok: false, message: `Required cell is missing for row "${row.label || rowId}" and column "${col.label || colId}"` };
            }
          }
        }
      }
      break;
    }
    
    default:
      // For unknown types, just check if value exists
      if (value == null || value === '') {
        return { ok: false, message: 'This field is required' };
      }
  }

  return { ok: true };
};

/**
 * Get approval status for a specific subject/group from nodeGroupApprovalStatus
 * Falls back to global approvalStatus if per-subject status doesn't exist
 */
export const getApprovalStatusForSubject = (
  node: JSONContent,
  subjectId: string,
  globalGroups: Array<{ id: string; name: string; subjectIds: string[] }>
): 'pending' | 'requested' | 'approved' | 'rejected' | undefined => {
  if (!node || !node.attrs) return undefined;

  const attrs = node.attrs as any;
  const enableGrouping = attrs.enableGrouping === true || attrs.enableGrouping === 'true';
  const nodeGroupApprovalStatus = attrs.nodeGroupApprovalStatus || {};
  
  // Find which group this subject belongs to
  const globalGroup = globalGroups.find((g) => g.subjectIds.includes(subjectId));
  
  // Get status for this specific subject/group
  if (enableGrouping && attrs.nodeGroups && Array.isArray(attrs.nodeGroups)) {
    // Node has node-based grouping
    const nodeGroups = attrs.nodeGroups as Array<{ id: string; name: string; subjectIds: string[] }>;
    const nodeGroup = nodeGroups.find((g) => g.subjectIds.includes(subjectId));
    
    if (nodeGroup) {
      // Subject is in a node group - use group status
      const groupKey = `group-${nodeGroup.id}`;
      return nodeGroupApprovalStatus[groupKey];
    } else {
      // Subject is ungrouped for this node
      const ungroupedKey = `ungrouped-${subjectId}`;
      return nodeGroupApprovalStatus[ungroupedKey];
    }
  } else if (nodeGroupApprovalStatus && typeof nodeGroupApprovalStatus === 'object' && Object.keys(nodeGroupApprovalStatus).length > 0) {
    // Node has nodeGroupApprovalStatus (even if enableGrouping is false)
    if (globalGroup) {
      // Try global group key first
      const globalGroupKey = `group-${globalGroup.id}`;
      if (nodeGroupApprovalStatus[globalGroupKey] !== undefined) {
        return nodeGroupApprovalStatus[globalGroupKey];
      }
    }
    
    // Check for ungrouped value
    const ungroupedKey = `ungrouped-${subjectId}`;
    if (nodeGroupApprovalStatus[ungroupedKey] !== undefined) {
      return nodeGroupApprovalStatus[ungroupedKey];
    }
  }
  
  // CRITICAL: Do NOT fall back to global approvalStatus
  // Each subject/group must have its own approval status
  // Returning undefined means no approval status exists for this specific subject/group
  return undefined;
};

/** QA pre-approval entry for one question (from submitMeta.preApprovalByAssignee[assigneeId].preApprovalByQuestion[questionKey]) */
export interface PreApprovalQuestionEntry {
  globalGroups?: Array<{
    id: string;
    name: string;
    subjectIds: string[];
    preApproved?: boolean | string;
    /** Required when preApproved; used in auto-approve message */
    preApprovalComment?: string;
  }>;
  ungroupedSubjects?: Array<{
    id: string;
    name: string;
    preApproved?: boolean | string;
    /** Required when preApproved; used in auto-approve message */
    preApprovalComment?: string;
  }>;
}

/** API may return booleans as strings; normalize to boolean */
export function toBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

/**
 * Get the set of subject IDs that have pre-approval for one question from the question approver's entry.
 * Pre-approval is independent of assignee grouping: a subject is pre-approved if it is in a QA group
 * with preApproved true OR in QA's ungrouped list with preApproved true.
 * Handles preApproved/locked coming from API as string "true"/"false".
 */
export function getPreApprovedSubjectIdsForQuestion(entry: PreApprovalQuestionEntry | undefined): Set<string> {
  const set = new Set<string>();
  if (!entry) return set;
  (entry.globalGroups ?? []).forEach((g) => {
    if (toBoolean(g.preApproved) && g.subjectIds) g.subjectIds.forEach((id) => set.add(id));
  });
  (entry.ungroupedSubjects ?? []).forEach((u) => {
    if (toBoolean(u.preApproved) && u.id) set.add(u.id);
  });
  return set;
}

/**
 * Check if a single subject is pre-approved for all approval questions.
 * Used to show pre-approval on assignee's ungrouped subjects.
 */
export function isSubjectPreApprovedForAllQuestions(
  subjectId: string,
  preApprovalByQuestion: Record<string, PreApprovalQuestionEntry> | undefined,
  questionKeys: string[]
): boolean {
  if (!preApprovalByQuestion || questionKeys.length === 0) return false;
  return questionKeys.every((qKey) => {
    const set = getPreApprovedSubjectIdsForQuestion(preApprovalByQuestion[qKey]);
    return set.has(subjectId);
  });
}

/**
 * Check if an assignee group (set of subject IDs) is fully pre-approved for all approval questions.
 * Every subject in the group must be pre-approved for every question.
 * Used to visualize "whole group has pre-approval" in assignee's view.
 */
export function isAssigneeGroupFullyPreApproved(
  groupSubjectIds: string[],
  preApprovalByQuestion: Record<string, PreApprovalQuestionEntry> | undefined,
  questionKeys: string[]
): boolean {
  if (!preApprovalByQuestion || questionKeys.length === 0 || groupSubjectIds.length === 0) return false;
  return questionKeys.every((qKey) => {
    const set = getPreApprovedSubjectIdsForQuestion(preApprovalByQuestion[qKey]);
    return groupSubjectIds.every((id) => set.has(id));
  });
}

/**
 * Check if the current drawer context (one group or one ungrouped subject) has pre-approval for a single question.
 * Used in Question Approval Drawer to show "Pre-approved" when the opened group/ungrouped has pre-approval.
 */
export function isPreApprovedForContext(
  questionKey: string,
  subjectContext: { type: 'group' | 'ungrouped'; groupId?: string; subjectId: string | string[] },
  preApprovalByQuestion: Record<string, PreApprovalQuestionEntry> | undefined
): boolean {
  if (!preApprovalByQuestion) return false;
  const set = getPreApprovedSubjectIdsForQuestion(preApprovalByQuestion[questionKey]);
  if (subjectContext.type === 'group') {
    const subjectIds = Array.isArray(subjectContext.subjectId) ? subjectContext.subjectId : [subjectContext.subjectId];
    return subjectIds.length > 0 && subjectIds.every((id) => set.has(id));
  }
  const subjectId = Array.isArray(subjectContext.subjectId) ? subjectContext.subjectId[0] : subjectContext.subjectId;
  return !!subjectId && set.has(subjectId);
}

/** Per-subject pre-approval for drawer when assignee's grouping doesn't match QA's (show which subjects have pre-approval) */
export interface PreApprovalSubjectItem {
  subjectId: string;
  subjectName: string;
  preApproved: boolean;
}

export interface PreApprovalForContext {
  /** True only when every subject in this context is pre-approved for this question (assignee group matches QA). */
  allPreApproved: boolean;
  /** Per-subject breakdown; when allPreApproved is false, use this to show which subjects have pre-approval. */
  subjectBreakdown: PreApprovalSubjectItem[];
  /** Comment for the current context (group or ungrouped) when pre-approved; used in auto-approve message. */
  preApprovalComment?: string;
}

/**
 * Get pre-approval for the current drawer context (assignee's group or ungrouped).
 * - If all subjects in context are pre-approved → allPreApproved true (show one line).
 * - If grouping mismatches → allPreApproved false and subjectBreakdown lists each subject's pre-approval.
 */
export function getPreApprovalForContext(
  questionKey: string,
  subjectContext: { type: 'group' | 'ungrouped'; groupId?: string; subjectId: string | string[]; subjectName?: string },
  preApprovalByQuestion: Record<string, PreApprovalQuestionEntry> | undefined,
  subjectsOptions: Array<{ label: string | undefined; value: string }>
): PreApprovalForContext | undefined {
  if (!preApprovalByQuestion) return undefined;
  const entry = preApprovalByQuestion[questionKey];
  const set = getPreApprovedSubjectIdsForQuestion(entry);
  const subjectIds: string[] = subjectContext.type === 'group'
    ? (Array.isArray(subjectContext.subjectId) ? subjectContext.subjectId : [subjectContext.subjectId].filter(Boolean))
    : [Array.isArray(subjectContext.subjectId) ? subjectContext.subjectId[0] : subjectContext.subjectId].filter(Boolean);
  if (subjectIds.length === 0) return undefined;
  const subjectBreakdown: PreApprovalSubjectItem[] = subjectIds.map((subjectId) => ({
    subjectId,
    subjectName: subjectsOptions.find((o) => o.value === subjectId)?.label ?? subjectId,
    preApproved: set.has(subjectId),
  }));
  const allPreApproved = subjectBreakdown.every((s) => s.preApproved);
  let preApprovalComment: string | undefined;
  if (allPreApproved && entry) {
    if (subjectContext.type === 'group') {
      const contextIds = new Set(subjectIds);
      const group = entry.globalGroups?.find(
        (g) =>
          toBoolean(g.preApproved) &&
          g.subjectIds &&
          g.subjectIds.length === contextIds.size &&
          g.subjectIds.every((id) => contextIds.has(id))
      );
      if (group?.preApprovalComment) preApprovalComment = group.preApprovalComment;
    } else {
      const subjectId = Array.isArray(subjectContext.subjectId) ? subjectContext.subjectId[0] : subjectContext.subjectId;
      const ungrouped = entry.ungroupedSubjects?.find((u) => u.id === subjectId && toBoolean(u.preApproved));
      if (ungrouped?.preApprovalComment) preApprovalComment = ungrouped.preApprovalComment;
    }
  }
  return { allPreApproved, subjectBreakdown, preApprovalComment };
}

