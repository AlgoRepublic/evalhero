/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from './api';
import { toFormData } from '../utils/formDataHelper';
import { JSONContent } from '@tiptap/core';
import { Profile } from '../features/auth/authSlice';

// ======================
// 🔹 Types
// ======================

export interface FormVersionTemplate {
  _id: string;
  status: 'locked' | 'draft' | 'published' | string;
  lockedAt?: string | null;
  deletedAt?: string | null;
  validationRules: any[];
  conditionalLogic: any[];
  template: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  formSchema: JSONContent;
}

export interface FormTemplateSchema {
  _id: string;
  formSchema: JSONContent;
  deletedAt?: string | null;
  organization: string;
  formTemplate: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  totalScore?: number;
  totalPassFail?: number;
}

export interface ConfigSet {
  _id: string;
  name: string;
  hasApproval?: boolean;
  hasDisputes?: boolean;
  signatureRequired?: boolean;
  approvalRule?: 'ALL' | 'ANY' | 'MIN';
  approvalMinCount?: number;
  approvers?: string[] | Profile[]; // Can be Profile IDs (strings) or populated Profile objects
  questionApprovers?: string[] | Profile[]; // Profiles who can approve individual questions
  subjects?: string[] | Profile[]; // Can be Profile IDs (strings) or populated Profile objects
  omitSignatureAllowed?: boolean;
  omitSignatureApprovers?: string[] | Profile[]; // Can be Profile IDs (strings) or populated Profile objects
}

export interface FormTemplateConfigSet {
  _id: string;
  name: string;
  hasApproval?: boolean;
  hasDisputes?: boolean;
  signatureRequired?: boolean;
  approvalRule?: 'ALL' | 'ANY' | 'MIN';
  approvalMinCount?: number;
  approvers?: string[] | Profile[]; // Can be Profile IDs (strings) or populated Profile objects
  questionApprovers?: string[] | Profile[]; // Profiles who can approve individual questions
  subjects?: string[] | Profile[]; // Can be Profile IDs (strings) or populated Profile objects
  omitSignatureAllowed?: boolean;
  omitSignatureApprovers?: string[] | Profile[]; // Can be Profile IDs (strings) or populated Profile objects
}

export interface FormTemplate {
  _id: string;
  description: string;
  hasApproval: boolean;
  hasDisputes: boolean;
  signatureRequired: boolean;
  deletedAt?: string | null;
  organization: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
  currentFormTemplateVersion: string;
  configSets?: FormTemplateConfigSet[];
  currentFormTemplateSchema?: string;
}

export interface Assignment {
  _id: string;
  type: 'one_time' | 'recurrence';
  subjectMode: 'single' | 'multiple' | 'none';
  startDate: string;
  dueDate?: string | null;
  endDate?: string | null;
  recurrence?: string | null;
  timezone: string;
  deletedAt?: string | null;
  organization: string;
  createdAt: string;
  updatedAt: string;

  assignees: Profile[];
  subjects: Profile[];
  assigner: Profile;
  approvers?: string[] | Profile[]; // Can be Profile IDs (strings) or populated Profile objects
  questionApprovers?: string[] | Profile[]; // Profiles who can approve individual questions (direct override)

  hasApproval?: boolean;
  hasDisputes?: boolean;
  signatureRequired?: boolean;
  approvalRule?: 'ALL' | 'ANY' | 'MIN';
  approvalMinCount?: number;
  omitSignatureAllowed?: boolean;
  omitSignatureApprovers?: string[]; // Profile IDs that can omit signature
  submissionStatus: Array<{
    assignee: string | Profile; // Profile ID (string) or populated Profile object
    status: 'submission_not_started' | 'submission_in_progress' | 'submission_complete';
  }>;
  stages: string[];
  configSet?: ConfigSet;

  formTemplate: FormTemplate;
  formTemplateSchema?: FormTemplateSchema;
  passingScore?: number;
  passingPassFailCount?: number;

  submissions?: unknown[]; // Array of submission objects (structure may vary)
  submitMeta?: {
    globalGroups?: Array<{
      id: string;
      name: string;
      subjectIds: string[];
      locked?: boolean | string;
    }>;
    ungroupedSubjects?: Array<{
      id: string;
      name: string;
      locked?: boolean | string;
    }>;
    isAllLocked?: boolean | string;
    /** Per-question pre-approval: questionKey (node id/name) -> groups and ungrouped subjects (legacy, use preApprovalByAssignee per assignee) */
    preApprovalByQuestion?: Record<
      string,
      {
        globalGroups?: Array<{
          id: string;
          name: string;
          subjectIds: string[];
          locked?: boolean | string;
          preApproved?: boolean;
        }>;
        ungroupedSubjects?: Array<{
          id: string;
          name: string;
          locked?: boolean | string;
          preApproved?: boolean;
        }>;
      }
    >;
    /** Per-assignee pre-approval: assigneeId -> preApprovalByQuestion for that assignee */
    preApprovalByAssignee?: Record<
      string,
      {
        preApprovalByQuestion?: Record<
          string,
          {
            globalGroups?: Array<{
              id: string;
              name: string;
              subjectIds: string[];
              locked?: boolean | string;
              preApproved?: boolean;
            }>;
            ungroupedSubjects?: Array<{
              id: string;
              name: string;
              locked?: boolean | string;
              preApproved?: boolean;
            }>;
          }
        >;
      }
    >;
  };
}

export interface AssignmentsMetadata {
  count: number;
  page: number;
  perPage: number;
}

export interface AssignmentsData {
  metadata: AssignmentsMetadata;
  records: Assignment[];
}

export interface AssignmentsResponse {
  success: boolean;
  message: string;
  data: AssignmentsData;
}

export interface AssignmentResponse {
  success: boolean;
  message: string;
  data: { assignment: Assignment };
}

export interface CreateAssignmentDto {
  assigner: string;
  formTemplateId: string;
  formVersionTemplateId: string;
  assignees: string[];
  subjects: string[];
  subjectMode: 'single' | 'multiple' | 'none';
  type: 'one_time' | 'recurrence';
  dueDate: string | null;
  timezone: string;
  // Approvals & disputes configuration (set at scheduling time)
  hasApproval?: boolean;
  hasDisputes?: boolean;
  signatureRequired?: boolean;
  approvers?: string[]; // profile ids
  questionApprovers?: string[]; // profile ids who can approve individual questions
  approvalRule?: 'ALL' | 'ANY' | 'MIN';
  approvalMinCount?: number; // used when approvalRule === 'MIN'
  omitSignatureAllowed?: boolean;
  omitSignatureApprovers?: string[]; // profile ids that can omit signature
  passingScore?: number;
  passingPassFailCount?: number;
}

export interface UpdateAssignmentDto {
  id: string;
  // assigner: string;
  // formTemplateId: string;
  // formVersionTemplateId: string;
  // assignees: string[];
  // subjects: string[];
  // subjectMode: 'single' | 'multiple';
  // type: 'one_time' | 'recurrence';
  startDate?: string | null;
  endDate?: string | null;
  recurrence?: string | null;
  dueDate?: string | null;
  timezone?: string | null;
  // Approvals & disputes configuration (set at scheduling time)
  hasApproval?: boolean;
  hasDisputes?: boolean;
  signatureRequired?: boolean;
  approvers?: string[]; // profile ids
  questionApprovers?: string[]; // profile ids who can approve individual questions
  approvalRule?: 'ALL' | 'ANY' | 'MIN';
  approvalMinCount?: number;
  omitSignatureAllowed?: boolean;
  omitSignatureApprovers?: string[]; // profile ids that can omit signature
  passingScore?: number;
  passingPassFailCount?: number;
  // Pre-approval / submission meta (e.g. globalGroups and per-question pre-approval)
  submitMeta?: {
    globalGroups?: Array<{
      id: string;
      name: string;
      subjectIds: string[];
      locked?: boolean | string;
    }>;
    ungroupedSubjects?: Array<{
      id: string;
      name: string;
      locked?: boolean | string;
    }>;
    isAllLocked?: boolean | string;
    preApprovalByQuestion?: Record<string, unknown>;
    preApprovalByAssignee?: Record<string, { preApprovalByQuestion?: Record<string, unknown> }>;
  };
}

export interface UpcomingAssignmentsResponse {
  success: boolean;
  message: string;
  data: Assignment[];
}

export interface AssigneesResponse {
  success: boolean;
  message: string;
  data: Profile[];
}

export interface SubjectsResponse {
  success: boolean;
  message: string;
  data: Profile[];
}

export interface ApproversResponse {
  success: boolean;
  message: string;
  data: Profile[];
}

export interface OmitSignatureApproversResponse {
  success: boolean;
  message: string;
  data: Profile[];
}

// ======================
// 🔹 API Definition
// ======================

export const assignmentsApi = api.injectEndpoints({
  endpoints: (build) => ({
    // 🟢 GET - List Assignments
    getAssignments: build.query<
      AssignmentsResponse,
      {
        assignee?: string;
        subject?: string;
        type?: string;
        page?: number;
        perPage?: number;
        sortBy?: string;
        order?: 'asc' | 'desc';
      }
    >({
      query: ({
        assignee,
        subject,
        type = 'one_time',
        page = 1,
        perPage = 50,
        sortBy = 'dueDate',
        order = 'asc',
      }) => ({
        url: `/assignments`,
        method: 'GET',
        params: { assignee, subject, type, page, perPage, sortBy, order },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.records.map((item) => ({
                type: 'Assignment' as const,
                id: item._id,
              })),
              { type: 'Assignment', id: 'LIST' },
            ]
          : [{ type: 'Assignment', id: 'LIST' }],
    }),

    // 🟢 GET - Single Assignment
    getAssignment: build.query<AssignmentResponse, string>({
      query: (id) => ({
        url: `/assignments/${id}`,
        method: 'GET',
      }),
      providesTags: (_result, _error, id) => [{ type: 'Assignment', id }],
    }),

    // 🟡 POST - Create Assignment
    createAssignment: build.mutation<AssignmentResponse, CreateAssignmentDto>({
      query: (body) => ({
        url: `/assignments`,
        method: 'POST',
        body: toFormData(body),
      }),
      invalidatesTags: [
        { type: 'Assignment', id: 'LIST' },
        { type: 'Queue', id: 'LIST' },
      ],
    }),

    // 🟠 PUT - Update Assignment
    updateAssignment: build.mutation<AssignmentResponse, UpdateAssignmentDto>({
      query: (body) => ({
        url: `/assignments/${body.id}`,
        method: 'PUT',
        body: toFormData(body),
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Assignment', id },
        { type: 'Assignment', id: 'LIST' },
        { type: 'Queue', id: 'LIST' },
        { type: 'Queue', id },
      ],
    }),

    // 🔴 DELETE - Assignment
    deleteAssignment: build.mutation<{ success: boolean; id: string }, string>({
      query: (id) => ({
        url: `/assignments/${id}`,
        method: 'DELETE',
      }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data?.success) {
            dispatch(
              assignmentsApi.util.updateQueryData(
                'getAssignments',
                { page: 1, perPage: 10, sortBy: 'name', order: 'asc' },
                (draft) => {
                  if (!draft?.data?.records) return;
                  draft.data.records = draft.data.records.filter(
                    (o) => o._id !== id
                  );
                  draft.data.metadata.count -= 1;
                }
              )
            );
          }
        } catch (error) {
          console.error('Error deleting schedule:', error);
        }
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Assignment', id },
        { type: 'Assignment', id: 'LIST' },
        { type: 'Queue', id: 'LIST' },
        { type: 'Queue', id },
      ],
    }),

    // 🟣 GET - Upcoming Assignments (Calendar)
    getUpcomingAssignments: build.query<
      UpcomingAssignmentsResponse,
      { profileId: string; days?: number }
    >({
      query: ({ profileId, days = 30 }) => ({
        url: `/assignments/calendar/upcoming`,
        method: 'GET',
        params: { days, assignee: profileId },
      }),
      providesTags: [{ type: 'Assignment', id: 'UPCOMING' }],
    }),

    // 🟢 GET - Assignees
    getAssignees: build.query<AssigneesResponse, void>({
      query: () => ({
        url: `/assignments/assignees`,
        method: 'GET',
      }),
      providesTags: [{ type: 'Assignment', id: 'ASSIGNEES' }],
    }),

    // 🟢 GET - Subjects
    getSubjects: build.query<SubjectsResponse, void>({
      query: () => ({
        url: `/assignments/subjects`,
        method: 'GET',
      }),
      providesTags: [{ type: 'Assignment', id: 'SUBJECTS' }],
    }),

    // 🟢 GET - Approvers
    getApprovers: build.query<ApproversResponse, void>({
      query: () => ({
        url: `/assignments/approvers`,
        method: 'GET',
      }),
      providesTags: [{ type: 'Assignment', id: 'APPROVERS' }],
    }),

    // 🟢 GET - Omit Signature Approvers
    getOmitSignatureApprovers: build.query<OmitSignatureApproversResponse, void>({
      query: () => ({
        url: `/assignments/omit-signature-approvers`,
        method: 'GET',
      }),
      providesTags: [{ type: 'Assignment', id: 'OMIT_SIGNATURE_APPROVERS' }],
    }),
  }),

  overrideExisting: false,
});

// ======================
// 🔹 Export Hooks
// ======================

export const {
  useGetAssignmentsQuery,
  useGetAssignmentQuery,
  useCreateAssignmentMutation,
  useUpdateAssignmentMutation,
  useDeleteAssignmentMutation,
  useGetUpcomingAssignmentsQuery,
  useGetAssigneesQuery,
  useGetSubjectsQuery,
  useGetApproversQuery,
  useGetOmitSignatureApproversQuery,
} = assignmentsApi;
