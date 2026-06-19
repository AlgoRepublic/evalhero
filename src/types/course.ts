/* eslint-disable @typescript-eslint/no-explicit-any */
import { JSONContent } from '@tiptap/core';
import { Profile, User } from '../features/auth/authSlice';
import { Template } from '../services/templatesAPI';

/**
 * Course Type Definitions
 * Based on the Course feature specification
 */

// ======================
// 🔹 Core Course Types
// ======================

export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseVisibility = 'open' | 'invite-only';
export type EnrollmentPolicy = 'auto-join' | 'request-join' | 'invite-only';
export type SequencingMode = 'linearStrict' | 'linearSoft' | 'clustered';
export type ModuleStatus = 'not-started' | 'in-progress' | 'passed' | 'failed' | 'locked' | 'completed';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'not-required' | 'requested';

// ======================
// 🔹 Progression Logic Types
// ======================

export type ConditionType =
  | 'moduleCompleted'
  | 'inlineFormPassed'
  | 'approvalGranted'
  | 'timeSpent'
  | 'dateWindow';

export interface ModuleCompletedCondition {
  type: 'moduleCompleted';
  moduleId: string;
}

export interface InlineFormPassedCondition {
  type: 'inlineFormPassed';
  formId: string;
  minScore?: number;
}

export interface ApprovalGrantedCondition {
  type: 'approvalGranted';
  byRole?: string[];
  byUser?: string[];
}

export interface TimeSpentCondition {
  type: 'timeSpent';
  moduleId: string;
  minutes: number;
}

export interface DateWindowCondition {
  type: 'dateWindow';
  start?: string; // ISO date string
  end?: string; // ISO date string
}

export type ConditionRef =
  | ModuleCompletedCondition
  | InlineFormPassedCondition
  | ApprovalGrantedCondition
  | TimeSpentCondition
  | DateWindowCondition;

export type ConditionOperator = 'AND' | 'OR';

export interface ConditionTree {
  operator: ConditionOperator;
  conditions: (ConditionRef | ConditionTree)[];
}

export type SpecialNodeRuleType = 'AdvanceGate' | 'ModuleCompleteGate';

export interface SpecialNodeRules {
  type: SpecialNodeRuleType;
  conditions: ConditionRef | ConditionTree;
  outcome: 'unlockNext' | 'markComplete' | 'requireRetake';
}

export interface GateCondition {
  conditions: ConditionRef | ConditionTree;
  unlockTarget: string; // moduleId or 'next'
}

// ======================
// 🔹 Inline Form Builder Types
// ======================

/** ConfigSet for course inline forms (aligned with Assignment model). Approval settings moved from options. */
export interface CourseInlineFormConfigSet {
  _id?: string;
  name?: string | null;
  hasApproval?: boolean;
  hasDisputes?: boolean;
  signatureRequired?: boolean;
  omitSignatureAllowed?: boolean;
  omitSignatureApprovers?: string[] | Profile[]; // ObjectIds or populated Profile
  approvalRule?: 'NONE' | 'ALL' | 'ANY' | 'MIN';
  approvalMinCount?: number;
  approvers?: string[] | Profile[]; // ObjectIds or populated Profile
  questionApprovers?: string[] | Profile[]; // ObjectIds or populated Profile; who can approve individual questions
}

export interface InlineFormBlock {
  _id?: string; // Added by API when saved
  formBlockId: string; // Required identifier for the form block
  formTemplateSchema?: string; // ObjectId reference to FormTemplateSchema
  /** ObjectId when editing; populated Template when from GET course page */
  formTemplate?: string | Template;
  /** Approval configuration (replaces options.proctorOrApprovalRequired). Can be null if no approval. */
  configSet?: CourseInlineFormConfigSet | null;
  /** Optional extra options (no requiredToAdvance, requirePassingScore, passingScore, attemptsAllowed). */
  options?: Record<string, unknown>;
  /** Schedule-like defaults sent to API only (hidden in UI). type: one_time; startDate: only on create; timezone: UTC; subjectMode: single; subjects: filled per enrollee by backend. */
  type?: 'one_time' | 'recurrence';
  startDate?: string; // ISO; send only on create, omit on update
  timezone?: string;
  subjectMode?: 'single' | 'multiple' | 'none';
  subjects?: string[]; // e.g. [enrolleeId]; backend may fill per enrollee when not provided
}

// ======================
// 🔹 Page/Module Types
// ======================

export interface CompletionCriteria {
  required: boolean;
  minScore?: number;
  requireAllInlineForms: boolean;
  customConditions?: ConditionRef[];
}

export interface PageRef {
  _id: string;
  title: string;
  orderIndex: number;
}

export interface CanvasDoc {
  _id: string;
  canvasSchema: JSONContent;
  version: number;
  deletedAt?: string | null;
  organization?: string;
  coursePage?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Document file metadata for document-type course pages. Presigned URL is added at runtime. */
export interface CoursePageDocument {
  key: string;
  bucket: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  /** Presigned URL (generated on show/list, not stored in DB). Valid ~7 days. */
  url?: string;
}

export type CoursePageType = 'builder' | 'document';

export interface CoursePage {
  _id: string;
  organization: string;
  course: string;
  title: string;
  orderIndex: number;
  /** 'builder' = tiptap editor, 'document' = file-based. Defaults to 'builder'. */
  pageType?: CoursePageType;
  canvasDocId: CanvasDoc | string | null; // Canvas document object (with _id, canvasSchema, version) or ID
  /** Present only when pageType === 'document'. */
  document?: CoursePageDocument | null;
  inlineForms: InlineFormBlock[];
  completionCriteria: CompletionCriteria;
  nextUnlockedBy?: Array<{
    type: ConditionType;
    params: Record<string, any>;
  }> | GateCondition[]; // API format or our internal format
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// ======================
// 🔹 Cohort Types
// ======================

export interface Cohort {
  _id: string;
  courseId: string;
  name: string;
  visibility: 'private' | 'public';
  defaultThreadAssignments?: string[]; // threadIds
  defaultModulePacing?: {
    startDate?: string;
    endDate?: string;
    windows?: Array<{
      moduleId: string;
      startDate?: string;
      endDate?: string;
    }>;
  };
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// ======================
// 🔹 Course Role Types
// ======================

export interface CourseRolePermissions {
  manageCourse: boolean; // settings/pages/roles
  manageMembers: boolean; // enroll/invite/assign roles
  manageCohorts: boolean;
  manageChat: boolean; // create threads, assign (excluded from this implementation)
  gradeApprove: boolean; // forms & gates
  viewAllSubmissions: boolean;
  viewCohortOnly: boolean;
  issueCertificates: boolean;
  issueBadges: boolean;
}

export interface CourseRole {
  _id: string;
  courseId: string;
  name: string; // Owner, Instructor, TA, Student, Observer, etc.
  parentRoleId?: string; // For sub-roles
  permissions: CourseRolePermissions;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// ======================
// 🔹 Course Member Types
// ======================

export interface CourseMember {
  _id: string;
  courseId: string;
  userId: string | Profile;
  roles: string[]; // CourseRole IDs
  cohorts: string[]; // Cohort IDs
  threads: string[]; // Thread IDs (for chat, excluded from this implementation)
  enrolledAt: string;
  enrolledBy?: string | Profile;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// ======================
// 🔹 Course Progress Types
// ======================

export interface ModuleProgress {
  moduleId: string;
  status: ModuleStatus;
  startedAt?: string;
  completedAt?: string;
  timeSpent: number; // minutes
  lastAccessedAt?: string;
}

export interface FormAttempt {
  formId: string;
  count: number;
  lastScore?: number;
  passed: boolean;
  lastAttemptAt?: string;
}

export interface GateApproval {
  gateId: string;
  status: ApprovalStatus;
  actor?: string | Profile;
  actedAt?: string;
  notes?: string;
}

// New API structure for inline form progress
export interface InlineFormProgress {
  formBlockId: string;
  formTemplate?: string; // ObjectId
  formTemplateSchema?: string; // ObjectId
  configSet?: CourseInlineFormConfigSet | null;
  isFilled: boolean;
  filledAt?: string | null;
  score?: number | null;
  passed?: boolean | null;
  attempts: number;
  lastAttemptAt?: string | null;
  approvalStatus: ApprovalStatus;
  approvalRequired: boolean;
  submissionId?: string | null;
  options?: Record<string, unknown>;
}

// New API structure for page progress
export interface PageProgress {
  pageId: string;
  title: string;
  orderIndex: number;
  status: ModuleStatus;
  isRead: boolean;
  readAt?: string | null;
  readDuration: number; // seconds
  timeOnTask: number; // seconds
  startedAt?: string | null;
  completedAt?: string | null;
  isUnlocked: boolean;
  unlockedAt?: string | null;
  inlineForms: InlineFormProgress[];
}

// New API structure for course progress
export interface CourseProgress {
  _id: string;
  course: string; // Course ObjectId
  enrollee: string; // Profile ObjectId
  courseEnrolment: string; // CourseEnrolment ObjectId
  completionPercentage: number;
  totalPages: number;
  completedPages: number;
  isCourseCompleted: boolean;
  pages: PageProgress[];
  createdAt: string;
  updatedAt: string;
}

// Legacy structure (kept for backward compatibility)
export interface LegacyCourseProgress {
  _id: string;
  courseId: string;
  userId: string | Profile;
  moduleStatus: Record<string, ModuleStatus>; // moduleId -> status
  attempts: Record<string, FormAttempt>; // formId -> FormAttempt
  timeOnTask: Record<string, number>; // moduleId -> minutes
  approvals: Record<string, GateApproval>; // gateId -> GateApproval
  currentModuleId?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ======================
// 🔹 Course Stats Types
// ======================

export interface CourseStats {
  courseId: string;
  completionRate: number; // 0-1
  averageScore: number;
  medianTimeToComplete: number; // minutes
  moduleDropoffCurve: Array<{
    moduleId: string;
    moduleTitle: string;
    dropoffRate: number;
  }>;
  attemptsDistribution: Array<{
    formId: string;
    formTitle: string;
    averageAttempts: number;
    passRate: number;
  }>;
  cohortComparisons?: Array<{
    cohortId: string;
    cohortName: string;
    completionRate: number;
    averageScore: number;
  }>;
}

// ======================
// 🔹 Course Thread Types (for future chat integration)
// ======================

export interface CourseThread {
  _id: string;
  courseId: string;
  title: string;
  purpose?: string; // Q&A, Team A, Unit 2, etc.
  memberScope?: {
    userIds?: string[];
    roleIds?: string[];
    cohortIds?: string[];
  };
  moderation?: {
    canLock: boolean;
    canArchive: boolean;
  };
  linkage?: {
    moduleId?: string;
    inlineFormId?: string;
  };
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// ======================
// 🔹 Course folders (hierarchical, same pattern as Knowledge Base)
// ======================

export interface CourseFolderRef {
  _id: string;
  name: string;
}

export interface CourseFolder {
  _id: string;
  organization: string;
  name: string;
  parent: CourseFolderRef | null;
  parents: CourseFolderRef[];
}

export interface CourseFolderListResponse {
  success: boolean;
  message?: string;
  data: { metadata: { count: number; page: number; perPage: number }; records: CourseFolder[] };
}

export interface CourseFolderResponse {
  success: boolean;
  message?: string;
  data: { folder: CourseFolder };
}

export interface CreateCourseFolderDto {
  name: string;
  parent?: string | null;
}

export interface UpdateCourseFolderDto {
  name?: string;
  parent?: string | null;
  restore?: boolean;
}

// ======================
// 🔹 Course Entity
// ======================

export interface ChatParentChannel {
  _id: string;
  name: string;
  channelType: 'course';
  description?: string;
}

export interface Course {
  _id: string;
  organization: string; // Owner organization (MongoDB ObjectId)
  title: string;
  status: CourseStatus;
  visibility: CourseVisibility;
  description?: string;
  coverImage?: string;
  // tags?: string[]; // Array of tag ObjectIds - commented out per requirements
  enrollmentPolicy: EnrollmentPolicy;
  sequencing: {
    enabled: boolean;
    strict: boolean; // must pass each module
    allowRetake: boolean;
    mode?: SequencingMode;
  };
  progressionRules: SpecialNodeRules[];
  pages: string[]; // Array of CoursePage ObjectIds
  chatParentId?: ChatParentChannel | string; // Channel object or ObjectId
  threads?: CourseThread[]; // For future chat integration
  cohorts: Cohort[];
  roles: CourseRole[];
  members: CourseMember[];
  nonOrgGuestsAllowed: boolean;
  certificateTemplateId?: string | null; // Optional override
  badgeTemplateId?: string | null; // Optional override
  folder: CourseFolder | null; // Optional folder (null = uncategorized)
  createdBy?: string; // Creator profile ObjectId
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// ======================
// 🔹 Certificate & Badge Types
// ======================

export interface Certificate {
  _id: string;
  courseId: string;
  userId: string | Profile;
  templateId: string;
  issuedAt: string;
  issuedBy: string | Profile;
  snapshot: {
    schema: any; // Immutable snapshot
    conditions: string[]; // Conditions that were met
  };
  pdfUrl?: string;
  createdAt: string;
}

export interface Badge {
  _id: string;
  courseId: string;
  userId: string | Profile;
  templateId: string;
  issuedAt: string;
  issuedBy: string | Profile;
  snapshot: {
    schema: any; // Immutable snapshot
    conditions: string[]; // Conditions that were met
  };
  imageUrl?: string;
  jsonLd?: any; // JSON-LD metadata
  createdAt: string;
}

// ======================
// 🔹 API Request/Response Types
// ======================

export interface CreateCourseDto {
  title: string;
  status?: CourseStatus;
  visibility?: CourseVisibility;
  description?: string;
  coverImage?: string;
  folder?: string | null;
  // tags?: string[];
  enrollmentPolicy?: EnrollmentPolicy;
  sequencing?: {
    enabled?: boolean;
    strict?: boolean;
    allowRetake?: boolean;
    mode?: SequencingMode;
  };
  nonOrgGuestsAllowed?: boolean;
  certificateTemplateId?: string;
  badgeTemplateId?: string;
}

export interface UpdateCourseDto {
  _id?: string; // Required for PUT requests, must match URL parameter
  title?: string;
  status?: CourseStatus;
  visibility?: CourseVisibility;
  description?: string;
  coverImage?: string;
  folder?: string | null;
  // tags?: string[]; // Array of tag ObjectIds - commented out per requirements
  enrollmentPolicy?: EnrollmentPolicy;
  sequencing?: {
    enabled?: boolean;
    strict?: boolean;
    allowRetake?: boolean;
    mode?: SequencingMode;
  };
  progressionRules?: SpecialNodeRules[];
  nonOrgGuestsAllowed?: boolean;
  certificateTemplateId?: string;
  badgeTemplateId?: string;
  restore?: boolean; // Restore soft-deleted course
}

export interface CreateCoursePageDto {
  courseId: string; // Not sent in body, extracted from URL
  title: string;
  orderIndex: number;
  /** 'builder' (default) or 'document'. When 'document', `document` (File) is required. */
  pageType?: CoursePageType;
  /** Required when pageType === 'document'. File to upload. */
  document?: File;
  canvasSchema?: JSONContent; // Creates first version if provided (builder)
  inlineForms?: InlineFormBlock[];
  completionCriteria?: CompletionCriteria;
  nextUnlockedBy?: GateCondition[];
}

export interface UpdateCoursePageDto {
  title?: string;
  orderIndex?: number;
  /** Change type: 'builder' | 'document'. Converting to document requires `document` file. */
  pageType?: CoursePageType;
  /** New file when updating/replacing document page or converting builder → document. */
  document?: File;
  canvasSchema?: JSONContent; // Creates new version if provided (builder)
  inlineForms?: InlineFormBlock[];
  completionCriteria?: CompletionCriteria;
  nextUnlockedBy?: GateCondition[];
  restore?: boolean; // Restore soft-deleted page
}

export interface CreateCohortDto {
  courseId: string;
  name: string;
  visibility?: 'private' | 'public';
  defaultThreadAssignments?: string[];
  defaultModulePacing?: Cohort['defaultModulePacing'];
}

export interface CreateCourseRoleDto {
  courseId: string;
  name: string;
  parentRoleId?: string;
  permissions: CourseRolePermissions;
}

export interface EnrollMemberDto {
  courseId: string;
  userId: string;
  roles?: string[];
  cohorts?: string[];
}

export interface UpdateMemberDto {
  roles?: string[];
  cohorts?: string[];
  threads?: string[];
}

export interface UpdateProgressDto {
  courseId: string;
  userId: string;
  moduleId?: string;
  status?: ModuleStatus;
  formId?: string;
  formScore?: number;
  passed?: boolean;
  timeSpent?: number; // minutes
  gateId?: string;
  approvalStatus?: ApprovalStatus;
}

// ======================
// 🔹 Response Types
// ======================

export interface CourseResponse {
  success: boolean;
  message?: string;
  data: { course: Course };
}

export interface CoursesResponse {
  success: boolean;
  message?: string;
  data: {
    metadata: {
      count: number;
      page: number;
      perPage: number;
    };
    records: Course[];
  };
}

export interface CoursePageResponse {
  success: boolean;
  message?: string;
  data: { page: CoursePage };
}

export interface CoursePagesResponse {
  success: boolean;
  message?: string;
  data: {
    pages: CoursePage[];
  };
}

export interface CohortResponse {
  success: boolean;
  message?: string;
  data: { cohort: Cohort };
}

export interface CohortsResponse {
  success: boolean;
  message?: string;
  data: {
    cohorts: Cohort[];
  };
}

export interface CourseRoleResponse {
  success: boolean;
  message?: string;
  data: { role: CourseRole };
}

export interface CourseRolesResponse {
  success: boolean;
  message?: string;
  data: {
    roles: CourseRole[];
  };
}

export interface CourseMemberResponse {
  success: boolean;
  message?: string;
  data: { member: CourseMember };
}

export interface CourseMembersResponse {
  success: boolean;
  message?: string;
  data: {
    members: CourseMember[];
    metadata?: {
      count: number;
      page: number;
      perPage: number;
    };
  };
}

export interface CourseProgressResponse {
  success: boolean;
  message?: string;
  data: { progress: CourseProgress };
}

export interface MarkPageAsReadResponse {
  success: boolean;
  message?: string;
  data: CourseProgress; // Returns updated progress
}

export interface SubmitFormResponse {
  success: boolean;
  message?: string;
  data: CourseProgress; // Returns updated progress
}

/** Populated refs as returned by getFormSubmission (GET_FORM_SUBMISSION_RESPONSE.json) */
export interface FormSubmissionFormTemplateSchemaRef {
  _id: string;
  formSchema: JSONContent;
  formTemplate?: string;
  version?: number;
  deletedAt?: string | null;
  organization?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FormSubmissionFormTemplateRef {
  _id: string;
  name?: string;
  description?: string;
  deletedAt?: string | null;
  organization?: string;
  currentFormTemplateSchema?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Inline form data on submission (form block + template + schema + progress). Returned in getFormSubmission. */
export interface SubmissionInlineFormData {
  formBlockId: string;
  formTemplate: FormSubmissionFormTemplateRef;
  formTemplateSchema: FormSubmissionFormTemplateSchemaRef;
  configSet?: CourseInlineFormConfigSet | null;
  courseFormSubmission: string;
  isFilled: boolean;
  filledAt?: string | null;
  score?: number | null;
  passed?: boolean | null;
  attempts: number;
  lastAttemptAt?: string | null;
  approvalStatus: ApprovalStatus;
  approvalRequired: boolean;
  options?: Record<string, unknown>;
}

/** Course form submission (store/get APIs). GET returns populated course, courseEnrolment, coursePage, formTemplate, formTemplateSchema, enrollee, and optionally inlineFormData. */
export interface CourseFormSubmissionRecord {
  _id: string;
  organization: string;
  /** Populated Course when from getFormSubmission */
  course: string | Course;
  /** Populated enrolment ref when from getFormSubmission */
  courseEnrolment: string | { _id: string; course: string; enrollee: string; [key: string]: any };
  /** Populated page ref when from getFormSubmission */
  coursePage: string | { _id: string; title: string; orderIndex: number; inlineForms?: InlineFormBlock[]; [key: string]: any };
  formBlockId: string;
  /** Populated Profile when from getFormSubmission */
  enrollee: string | Profile;
  /** Populated template ref when from getFormSubmission */
  formTemplate: string | FormSubmissionFormTemplateRef;
  /** Populated schema ref (with formSchema) when from getFormSubmission */
  formTemplateSchema: string | FormSubmissionFormTemplateSchemaRef;
  answers: { type: string; content?: unknown };
  /** Inline form block + template + schema + isFilled etc. when from getFormSubmission */
  inlineFormData?: SubmissionInlineFormData;
  /** Submission lifecycle status (approval flow) */
  status?: 'submission_not_started' | 'submission_in_progress' | 'submission_completed' | 'approval_in_progress' | 'approval_completed' | 'rejected' | 'complete';
  /** Form-level approval status */
  approvalStatus?: ApprovalStatus;
  /** Form-level approval chat channel ID */
  approvalChannel?: string;
  /** Question-level approval tracking (from Course Form Approval API) */
  questionApprovals?: Array<{ questionKey: string; approvalStatus: ApprovalStatus; approvalChannel?: string }>;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Single message in course form approval conversation */
export interface CourseFormApprovalMessage {
  _id: string;
  action: 'message' | 'approval:requested' | 'approval:approved' | 'approval:rejected';
  actionData?: { text?: string; comment?: string; [key: string]: unknown };
  sentBy?: string | Profile;
  createdAt?: string;
}

/** Response for GET course form approval messages (form-level) */
export interface CourseFormApprovalMessagesResponse {
  success: boolean;
  message?: string;
  data: {
    channel?: { _id: string; channelType: string; courseFormApprovalStatus?: ApprovalStatus; [key: string]: unknown };
    submission?: CourseFormSubmissionRecord;
    messages: CourseFormApprovalMessage[];
  };
}

/** Payload for POST course form approval action (form-level or question-level) */
export interface SendCourseFormApprovalPayload {
  action: 'message' | 'approve' | 'reject';
  actionData?: { text?: string; comment?: string };
}

export interface StoreFormSubmissionResponse {
  success: boolean;
  message?: string;
  data: { submission: CourseFormSubmissionRecord };
}

export interface GetFormSubmissionResponse {
  success: boolean;
  message?: string;
  data: { submission: CourseFormSubmissionRecord };
}

export interface CourseStatsResponse {
  success: boolean;
  message?: string;
  data: { stats: CourseStats };
}

// ======================
// 🔹 Course Enrollment (Assignment) Types
// ======================

export type EnrollmentStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';

/**
 * Simplified Profile structure as returned in enrollment API responses
 * Contains only _id and user (not the full Profile with roles, departments, etc.)
 */
export interface EnrollmentProfile {
  _id: string;
  user: User;
}

export interface CourseEnrollment {
  _id: string;
  organization: string;
  course: Course | string;
  enroller: EnrollmentProfile | Profile | string; // Profile who created the enrolment (can be simplified object, full Profile, or ID)
  enrollee: EnrollmentProfile | Profile | string; // Single enrolled profile (NOT an array) (can be simplified object, full Profile, or ID)
  dueDate: string | null;
  startDate: string | null;
  endDate: string | null;
  status: EnrollmentStatus;
  instructions: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CreateEnrollmentDto {
  courseId: string; // Not sent in body, extracted from URL
  enrollees: string[]; // Array of Profile IDs (minimum 1). Each enrollee gets a separate enrolment record.
  dueDate?: string; // ISO 8601 date string
  startDate?: string; // ISO 8601 date string
  endDate?: string; // ISO 8601 date string
  status?: EnrollmentStatus;
  instructions?: string;
  notes?: string;
}

export interface UpdateEnrollmentDto {
  enrollee?: string; // Single Profile ID (not an array)
  dueDate?: string; // ISO 8601 date string
  startDate?: string; // ISO 8601 date string
  endDate?: string; // ISO 8601 date string
  status?: EnrollmentStatus;
  instructions?: string;
  notes?: string;
  restore?: boolean; // Restore soft-deleted enrolment
}

export interface EnrollmentResponse {
  success: boolean;
  message?: string;
  data: { enrolment: CourseEnrollment };
}

export interface EnrollmentsResponse {
  success: boolean;
  message?: string;
  data: {
    enrolments: {
      records: CourseEnrollment[]; // Array of enrolments (one per enrollee)
      metadata?: {
        count: number;
        page: number;
        perPage: number;
      };
    }
  };
}

export interface EligibleProfilesResponse {
  success: boolean;
  message?: string;
  data: {
    profiles: Profile[];
  };
}
