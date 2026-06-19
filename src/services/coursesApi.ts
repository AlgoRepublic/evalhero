 
import { api } from './api';
import { toFormData } from '../utils/formDataHelper';
import type {
  CreateCourseDto,
  UpdateCourseDto,
  CreateCoursePageDto,
  UpdateCoursePageDto,
  CreateCohortDto,
  CreateCourseRoleDto,
  EnrollMemberDto,
  UpdateMemberDto,
  UpdateProgressDto,
  CourseResponse,
  CoursesResponse,
  CoursePageResponse,
  CoursePagesResponse,
  CohortResponse,
  CohortsResponse,
  CourseRoleResponse,
  CourseRolesResponse,
  CourseMemberResponse,
  CourseMembersResponse,
  CourseProgressResponse,
  MarkPageAsReadResponse,
  SubmitFormResponse,
  StoreFormSubmissionResponse,
  GetFormSubmissionResponse,
  CourseFormApprovalMessagesResponse,
  SendCourseFormApprovalPayload,
  CourseStatsResponse,
  CreateEnrollmentDto,
  UpdateEnrollmentDto,
  EnrollmentResponse,
  EnrollmentsResponse,
  EligibleProfilesResponse,
  CourseFolderListResponse,
  CourseFolderResponse,
  CreateCourseFolderDto,
  UpdateCourseFolderDto,
} from '../types/course';

// ======================
// 🔹 API Definition
// ======================

export const coursesApi = api.injectEndpoints({
  endpoints: (build) => ({
    // ======================
    // 🔹 Course Folders
    // ======================
    getCourseFolders: build.query<
      CourseFolderListResponse,
      { parent?: string; page?: number; perPage?: number; sortBy?: string; order?: 'asc' | 'desc' }
    >({
      query: ({ parent, page = 1, perPage = 100, sortBy = 'name', order = 'asc' }) => {
        const params: Record<string, string | number> = { page, perPage, sortBy, order };
        if (parent !== undefined) params.parent = parent;
        return { url: '/courses/folders', method: 'GET', params };
      },
      providesTags: (result) =>
        result?.data?.records?.length
          ? [
              ...result.data.records.map((r) => ({ type: 'Course' as const, id: `FOLDER_${r._id}` })),
              { type: 'Course', id: 'FOLDER_LIST' },
            ]
          : [{ type: 'Course', id: 'FOLDER_LIST' }],
    }),
    getCourseFolder: build.query<CourseFolderResponse, string>({
      query: (id) => ({ url: `/courses/folders/${id}`, method: 'GET' }),
      providesTags: (_r, _e, id) => [{ type: 'Course', id: `FOLDER_${id}` }],
    }),
    createCourseFolder: build.mutation<CourseFolderResponse, CreateCourseFolderDto>({
      query: ({ name, parent }) => {
        const body: Record<string, string | undefined> = { name };
        if (parent) body.parent = parent;
        return { url: '/courses/folders', method: 'POST', body: toFormData(body) };
      },
      invalidatesTags: [{ type: 'Course', id: 'FOLDER_LIST' }],
    }),
    updateCourseFolder: build.mutation<
      CourseFolderResponse,
      { id: string; body: UpdateCourseFolderDto }
    >({
      query: ({ id, body }) => ({
        url: `/courses/folders/${id}`,
        method: 'PUT',
        body: toFormData(body),
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Course', id: `FOLDER_${id}` },
        { type: 'Course', id: 'FOLDER_LIST' },
        { type: 'Course', id: 'LIST' },
      ],
    }),
    deleteCourseFolder: build.mutation<{ success: boolean; message?: string }, string>({
      query: (id) => ({ url: `/courses/folders/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Course', id: `FOLDER_${id}` },
        { type: 'Course', id: 'FOLDER_LIST' },
        { type: 'Course', id: 'LIST' },
      ],
    }),

    // ======================
    // 🔹 Course CRUD
    // ======================

    // 🟢 GET - List Courses (folder: filter by folder; all: true = ignore folder, show all)
    getCourses: build.query<
      CoursesResponse,
      {
        orgId?: string;
        status?: string;
        visibility?: string;
        page?: number;
        perPage?: number;
        sortBy?: string;
        order?: 'asc' | 'desc';
        folder?: string;
        all?: boolean;
      }
    >({
      query: ({
        orgId,
        status,
        visibility,
        page = 1,
        perPage = 50,
        sortBy = 'createdAt',
        order = 'desc',
        folder,
        all,
      }) => {
        const params: Record<string, string | number | boolean> = {
          page,
          perPage,
          sortBy,
          order,
        };
        if (orgId) params.orgId = orgId;
        if (status) params.status = status;
        if (visibility) params.visibility = visibility;
        if (folder) params.folder = folder;
        if (all) params.all = 'true';
        return { url: `/courses`, method: 'GET', params };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.records.map((item) => ({
                type: 'Course' as const,
                id: item._id,
              })),
              { type: 'Course', id: 'LIST' },
            ]
          : [{ type: 'Course', id: 'LIST' }],
    }),

    // 🟢 GET - Single Course
    getCourse: build.query<CourseResponse, string>({
      query: (id) => ({
        url: `/courses/${id}`,
        method: 'GET',
      }),
      providesTags: (_result, _error, id) => [{ type: 'Course', id }],
    }),

    // 🟡 POST - Create Course
    createCourse: build.mutation<CourseResponse, CreateCourseDto>({
      query: (body) => ({
        url: `/courses`,
        method: 'POST',
        body: toFormData(body),
      }),
      invalidatesTags: [{ type: 'Course', id: 'LIST' }],
    }),

    // 🟠 PUT - Update Course
    updateCourse: build.mutation<CourseResponse, { id: string; data: UpdateCourseDto }>({
      query: ({ id, data }) => ({
        url: `/courses/${id}`,
        method: 'PUT',
        body: toFormData({ ...data, _id: id }), // API requires _id in body
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Course', id },
        { type: 'Course', id: 'LIST' },
      ],
    }),

    // 🔴 DELETE - Course
    deleteCourse: build.mutation<{ success: boolean; id: string }, string>({
      query: (id) => ({
        url: `/courses/${id}`,
        method: 'DELETE',
        body: toFormData({ _id: id }), // API requires _id in body
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Course', id },
        { type: 'Course', id: 'LIST' },
      ],
    }),

    // Move course to folder (PUT /courses/:_id/folder)
    moveCourseToFolder: build.mutation<
      CourseResponse,
      { id: string; folder: string | null }
    >({
      query: ({ id, folder }) => ({
        url: `/courses/${id}/folder`,
        method: 'PUT',
        body: toFormData({ folder }),
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Course', id },
        { type: 'Course', id: 'LIST' },
        { type: 'Course', id: 'FOLDER_LIST' },
      ],
    }),

    // ======================
    // 🔹 Course Pages/Modules
    // ======================

    // 🟢 GET - List Course Pages
    getCoursePages: build.query<CoursePagesResponse, string>({
      query: (courseId) => ({
        url: `/courses/${courseId}/pages`,
        method: 'GET',
      }),
      providesTags: (_result, _error, courseId) => [
        { type: 'Course', id: courseId },
        { type: 'CoursePage', id: 'LIST' },
      ],
    }),

    // 🟢 GET - Single Course Page
    getCoursePage: build.query<CoursePageResponse, { courseId: string; pageId: string }>({
      query: ({ courseId, pageId }) => ({
        url: `/courses/${courseId}/pages/${pageId}`,
        method: 'GET',
      }),
      providesTags: (_result, _error, { pageId }) => [{ type: 'CoursePage', id: pageId }],
    }),

    // 🟡 POST - Create Course Page
    createCoursePage: build.mutation<CoursePageResponse, CreateCoursePageDto>({
      query: ({ courseId, ...rest }) => ({
        url: `/courses/${courseId}/pages`,
        method: 'POST',
        body: toFormData(rest), // courseId is extracted from URL, not sent in body
      }),
      invalidatesTags: (_result, _error, { courseId }) => [
        { type: 'Course', id: courseId },
        { type: 'CoursePage', id: 'LIST' },
      ],
    }),

    // 🟠 PUT - Update Course Page
    updateCoursePage: build.mutation<
      CoursePageResponse,
      { courseId: string; pageId: string; data: UpdateCoursePageDto }
    >({
      query: ({ courseId, pageId, data }) => ({
        url: `/courses/${courseId}/pages/${pageId}`,
        method: 'PUT',
        body: toFormData(data),
      }),
      invalidatesTags: (_result, _error, { courseId, pageId }) => [
        { type: 'Course', id: courseId },
        { type: 'CoursePage', id: pageId },
        { type: 'CoursePage', id: 'LIST' },
      ],
    }),

    // 🔴 DELETE - Course Page
    deleteCoursePage: build.mutation<
      { success: boolean },
      { courseId: string; pageId: string }
    >({
      query: ({ courseId, pageId }) => ({
        url: `/courses/${courseId}/pages/${pageId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { courseId, pageId }) => [
        { type: 'Course', id: courseId },
        { type: 'CoursePage', id: pageId },
        { type: 'CoursePage', id: 'LIST' },
      ],
    }),

    // 🟠 POST - Reorder Course Pages
    reorderCoursePages: build.mutation<
      CoursePagesResponse,
      { courseId: string; pageOrders: Array<{ _id: string; orderIndex: number }> }
    >({
      query: ({ courseId, pageOrders }) => ({
        url: `/courses/${courseId}/pages/reorder`,
        method: 'POST',
        body: toFormData({ pageOrders }),
      }),
      invalidatesTags: (_result, _error, { courseId }) => [
        { type: 'Course', id: courseId },
        { type: 'CoursePage', id: 'LIST' },
      ],
    }),

    // ======================
    // 🔹 Cohorts
    // ======================

    // 🟢 GET - List Course Cohorts
    getCourseCohorts: build.query<CohortsResponse, string>({
      query: (courseId) => ({
        url: `/courses/${courseId}/cohorts`,
        method: 'GET',
      }),
      providesTags: (_result, _error, courseId) => [
        { type: 'Course', id: courseId },
        { type: 'Cohort', id: 'LIST' },
      ],
    }),

    // 🟡 POST - Create Cohort
    createCohort: build.mutation<CohortResponse, CreateCohortDto>({
      query: (body) => ({
        url: `/courses/${body.courseId}/cohorts`,
        method: 'POST',
        body: toFormData(body),
      }),
      invalidatesTags: (_result, _error, { courseId }) => [
        { type: 'Course', id: courseId },
        { type: 'Cohort', id: 'LIST' },
      ],
    }),

    // 🟠 PUT - Update Cohort
    updateCohort: build.mutation<
      CohortResponse,
      { courseId: string; cohortId: string; data: Partial<CreateCohortDto> }
    >({
      query: ({ courseId, cohortId, data }) => ({
        url: `/courses/${courseId}/cohorts/${cohortId}`,
        method: 'PUT',
        body: toFormData(data),
      }),
      invalidatesTags: (_result, _error, { courseId, cohortId }) => [
        { type: 'Course', id: courseId },
        { type: 'Cohort', id: cohortId },
        { type: 'Cohort', id: 'LIST' },
      ],
    }),

    // 🔴 DELETE - Cohort
    deleteCohort: build.mutation<
      { success: boolean },
      { courseId: string; cohortId: string }
    >({
      query: ({ courseId, cohortId }) => ({
        url: `/courses/${courseId}/cohorts/${cohortId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { courseId, cohortId }) => [
        { type: 'Course', id: courseId },
        { type: 'Cohort', id: cohortId },
        { type: 'Cohort', id: 'LIST' },
      ],
    }),

    // ======================
    // 🔹 Course Roles
    // ======================

    // 🟢 GET - List Course Roles
    getCourseRoles: build.query<CourseRolesResponse, string>({
      query: (courseId) => ({
        url: `/courses/${courseId}/roles`,
        method: 'GET',
      }),
      providesTags: (_result, _error, courseId) => [
        { type: 'Course', id: courseId },
        { type: 'CourseRole', id: 'LIST' },
      ],
    }),

    // 🟡 POST - Create Course Role
    createCourseRole: build.mutation<CourseRoleResponse, CreateCourseRoleDto>({
      query: (body) => ({
        url: `/courses/${body.courseId}/roles`,
        method: 'POST',
        body: toFormData(body),
      }),
      invalidatesTags: (_result, _error, { courseId }) => [
        { type: 'Course', id: courseId },
        { type: 'CourseRole', id: 'LIST' },
      ],
    }),

    // 🟠 PUT - Update Course Role
    updateCourseRole: build.mutation<
      CourseRoleResponse,
      { courseId: string; roleId: string; data: Partial<CreateCourseRoleDto> }
    >({
      query: ({ courseId, roleId, data }) => ({
        url: `/courses/${courseId}/roles/${roleId}`,
        method: 'PUT',
        body: toFormData(data),
      }),
      invalidatesTags: (_result, _error, { courseId, roleId }) => [
        { type: 'Course', id: courseId },
        { type: 'CourseRole', id: roleId },
        { type: 'CourseRole', id: 'LIST' },
      ],
    }),

    // 🔴 DELETE - Course Role
    deleteCourseRole: build.mutation<
      { success: boolean },
      { courseId: string; roleId: string }
    >({
      query: ({ courseId, roleId }) => ({
        url: `/courses/${courseId}/roles/${roleId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { courseId, roleId }) => [
        { type: 'Course', id: courseId },
        { type: 'CourseRole', id: roleId },
        { type: 'CourseRole', id: 'LIST' },
      ],
    }),

    // ======================
    // 🔹 Course Members
    // ======================

    // 🟢 GET - List Course Members
    getCourseMembers: build.query<
      CourseMembersResponse,
      {
        courseId: string;
        cohortId?: string;
        roleId?: string;
        page?: number;
        perPage?: number;
      }
    >({
      query: ({ courseId, cohortId, roleId, page = 1, perPage = 50 }) => ({
        url: `/courses/${courseId}/members`,
        method: 'GET',
        params: { cohortId, roleId, page, perPage },
      }),
      providesTags: (_result, _error, { courseId }) => [
        { type: 'Course', id: courseId },
        { type: 'CourseMember', id: 'LIST' },
      ],
    }),

    // 🟡 POST - Enroll Member
    enrollMember: build.mutation<CourseMemberResponse, EnrollMemberDto>({
      query: (body) => ({
        url: `/courses/${body.courseId}/members`,
        method: 'POST',
        body: toFormData(body),
      }),
      invalidatesTags: (_result, _error, { courseId }) => [
        { type: 'Course', id: courseId },
        { type: 'CourseMember', id: 'LIST' },
      ],
    }),

    // 🟠 PUT - Update Member
    updateMember: build.mutation<
      CourseMemberResponse,
      { courseId: string; memberId: string; data: UpdateMemberDto }
    >({
      query: ({ courseId, memberId, data }) => ({
        url: `/courses/${courseId}/members/${memberId}`,
        method: 'PUT',
        body: toFormData(data),
      }),
      invalidatesTags: (_result, _error, { courseId, memberId }) => [
        { type: 'Course', id: courseId },
        { type: 'CourseMember', id: memberId },
        { type: 'CourseMember', id: 'LIST' },
      ],
    }),

    // 🔴 DELETE - Remove Member
    removeMember: build.mutation<
      { success: boolean },
      { courseId: string; memberId: string }
    >({
      query: ({ courseId, memberId }) => ({
        url: `/courses/${courseId}/members/${memberId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { courseId, memberId }) => [
        { type: 'Course', id: courseId },
        { type: 'CourseMember', id: memberId },
        { type: 'CourseMember', id: 'LIST' },
      ],
    }),

    // ======================
    // 🔹 Course Progress
    // ======================

    // 🟢 GET - Get Course Progress (new API with courseEnrolmentId)
    getCourseProgress: build.query<
      CourseProgressResponse,
      { courseId: string; courseEnrolmentId: string }
    >({
      query: ({ courseId, courseEnrolmentId }) => ({
        url: `/courses/${courseId}/progress`,
        method: 'GET',
        params: { courseEnrolmentId },
      }),
      providesTags: (_result, _error, { courseId, courseEnrolmentId }) => [
        { type: 'CourseProgress', id: `${courseId}-${courseEnrolmentId}` },
      ],
    }),

    // 🟡 POST - Mark Page as Read
    markPageAsRead: build.mutation<
      MarkPageAsReadResponse,
      {
        courseId: string;
        pageId: string;
        courseEnrolmentId: string;
        readDuration?: number;
        status?: 'in-progress' | undefined;
      }
    >({
      query: ({ courseId, pageId, courseEnrolmentId, readDuration, status }) => {
        const body: Record<string, number | string> = { };
        if (readDuration !== undefined) body.readDuration = readDuration;
        if (status) body.status = status;

        console.log("markPageAsRead", body);
        return {
          url: `/courses/${courseId}/progress/pages/${pageId}/read`,
          method: 'POST',
          params: { courseEnrolmentId },
          body: toFormData(body),
        };
      },
      invalidatesTags: (_result, _error, { courseId, courseEnrolmentId }) => [
        { type: 'CourseProgress', id: `${courseId}-${courseEnrolmentId}` },
        { type: 'Course', id: courseId },
      ],
    }),

    // 🟡 POST - Store form submission (save answers)
    storeFormSubmission: build.mutation<
      StoreFormSubmissionResponse,
      {
        courseId: string;
        pageId: string;
        formBlockId: string;
        courseEnrolmentId: string;
        formTemplateId: string | null;
        formTemplateSchemaId: string;
        answers: { type: string; content?: unknown };
      }
    >({
      query: (body) => ({
        url: `/courses/${body.courseId}/progress/pages/${body.pageId}/forms/${body.formBlockId}/store`,
        method: 'POST',
        body: toFormData(body),
      }),
      invalidatesTags: (_result, _error, { courseId, courseEnrolmentId }) => [
        { type: 'CourseProgress', id: `${courseId}-${courseEnrolmentId}` },
        { type: 'Course', id: courseId },
      ],
    }),

    // 🟢 GET - Get form submission (load answers for view/edit)
    getFormSubmission: build.query<
      GetFormSubmissionResponse,
      {
        courseId: string;
        courseEnrolmentId: string;
        pageId: string;
        formBlockId: string;
      }
    >({
      query: ({ courseId, courseEnrolmentId, pageId, formBlockId }) => ({
        url: `/courses/${courseId}/progress/submissions/current`,
        method: 'GET',
        params: { courseEnrolmentId, pageId, formBlockId },
      }),
      providesTags: (_result, _error, { courseId, courseEnrolmentId }) => [
        { type: 'CourseProgress', id: `${courseId}-${courseEnrolmentId}` },
      ],
    }),

    // 🟡 POST - Submit Form (Record form submission – score/completion)
    submitForm: build.mutation<
      SubmitFormResponse,
      {
        courseId: string;
        pageId: string;
        formBlockId: string;
        courseEnrolmentId: string;
        isFilled: boolean;
        score?: number;
        passed?: boolean;
        approvalStatus?: 'not-required' | 'pending' | 'approved' | 'rejected';
        approvalRequired?: boolean;
      }
    >({
      query: (body) => ({
        url: `/courses/${body.courseId}/progress/pages/${body.pageId}/forms/${body.formBlockId}/submit`,
        method: 'POST',
        body: toFormData({
          courseEnrolmentId: body.courseEnrolmentId,
          isFilled: body.isFilled,
          ...(body.score !== undefined && { score: body.score }),
          ...(body.passed !== undefined && { passed: body.passed }),
          ...(body.approvalStatus && { approvalStatus: body.approvalStatus }),
          ...(body.approvalRequired !== undefined && { approvalRequired: body.approvalRequired }),
        }),
      }),
      invalidatesTags: (_result, _error, { courseId, courseEnrolmentId }) => [
        { type: 'CourseProgress', id: `${courseId}-${courseEnrolmentId}` },
        { type: 'Course', id: courseId },
      ],
    }),

    // ======================
    // 🔹 Course Form Approval (form-level and question-level)
    // ======================

    // 🟢 GET - Get form-level approval messages and submission
    getCourseFormApprovalMessages: build.query<
      CourseFormApprovalMessagesResponse,
      { courseId: string; pageId: string; formBlockId: string; courseEnrolmentId: string }
    >({
      query: ({ courseId, pageId, formBlockId, courseEnrolmentId }) => ({
        url: `/courses/${courseId}/progress/pages/${pageId}/forms/${formBlockId}/approval/messages`,
        method: 'GET',
        params: { courseEnrolmentId },
      }),
      providesTags: (_result, _error, { courseId, courseEnrolmentId, pageId, formBlockId }) => [
        { type: 'CourseProgress', id: `${courseId}-${courseEnrolmentId}` },
        { type: 'CourseFormApproval', id: `${courseId}-${pageId}-${formBlockId}-${courseEnrolmentId}` },
      ],
    }),

    // 🟡 POST - Send form-level approval action (message, approve, reject)
    sendCourseFormApprovalAction: build.mutation<
      CourseFormApprovalMessagesResponse,
      { courseId: string; pageId: string; formBlockId: string; courseEnrolmentId: string; body: SendCourseFormApprovalPayload }
    >({
      query: ({ courseId, pageId, formBlockId, courseEnrolmentId, body }) => ({
        url: `/courses/${courseId}/progress/pages/${pageId}/forms/${formBlockId}/approval`,
        method: 'POST',
        params: { courseEnrolmentId },
        body: toFormData(body),
      }),
      invalidatesTags: (_result, _error, { courseId, courseEnrolmentId, pageId, formBlockId }) => [
        { type: 'CourseProgress', id: `${courseId}-${courseEnrolmentId}` },
        { type: 'CourseFormApproval', id: `${courseId}-${pageId}-${formBlockId}-${courseEnrolmentId}` },
      ],
    }),

    // 🟢 GET - Get question-level approval messages
    getCourseFormQuestionApprovalMessages: build.query<
      CourseFormApprovalMessagesResponse,
      { courseId: string; pageId: string; formBlockId: string; questionKey: string; courseEnrolmentId: string }
    >({
      query: ({ courseId, pageId, formBlockId, questionKey, courseEnrolmentId }) => ({
        url: `/courses/${courseId}/progress/pages/${pageId}/forms/${formBlockId}/questions/${questionKey}/approval/messages`,
        method: 'GET',
        params: { courseEnrolmentId },
      }),
      providesTags: (_result, _error, { courseId, courseEnrolmentId, pageId, formBlockId, questionKey }) => [
        { type: 'CourseProgress', id: `${courseId}-${courseEnrolmentId}` },
        { type: 'CourseFormApproval', id: `${courseId}-${pageId}-${formBlockId}-${questionKey}-${courseEnrolmentId}` },
      ],
    }),

    // 🟡 POST - Send question-level approval action
    sendCourseFormQuestionApprovalAction: build.mutation<
      CourseFormApprovalMessagesResponse,
      { courseId: string; pageId: string; formBlockId: string; questionKey: string; courseEnrolmentId: string; body: SendCourseFormApprovalPayload }
    >({
      query: ({ courseId, pageId, formBlockId, questionKey, courseEnrolmentId, body }) => ({
        url: `/courses/${courseId}/progress/pages/${pageId}/forms/${formBlockId}/questions/${questionKey}/approval`,
        method: 'POST',
        params: { courseEnrolmentId },
        body: toFormData(body),
      }),
      invalidatesTags: (_result, _error, { courseId, courseEnrolmentId, pageId, formBlockId, questionKey }) => [
        { type: 'CourseProgress', id: `${courseId}-${courseEnrolmentId}` },
        { type: 'CourseFormApproval', id: `${courseId}-${pageId}-${formBlockId}-${questionKey}-${courseEnrolmentId}` },
      ],
    }),

    // 🟠 PUT - Update Progress (legacy - kept for backward compatibility)
    updateProgress: build.mutation<CourseProgressResponse, UpdateProgressDto>({
      query: (body) => ({
        url: `/courses/${body.courseId}/progress`,
        method: 'PUT',
        body: toFormData(body),
      }),
      invalidatesTags: (_result, _error, { courseId, userId }) => [
        { type: 'CourseProgress', id: `${courseId}-${userId}` },
        { type: 'Course', id: courseId },
      ],
    }),

    // ======================
    // 🔹 Course Stats
    // ======================

    // 🟢 GET - Get Course Stats
    getCourseStats: build.query<CourseStatsResponse, string>({
      query: (courseId) => ({
        url: `/courses/${courseId}/stats`,
        method: 'GET',
      }),
      providesTags: (_result, _error, courseId) => [
        { type: 'CourseStats', id: courseId },
      ],
    }),

    // ======================
    // 🔹 Course Enrolments
    // ======================

    // 🟢 GET - Get Eligible Profiles for Enrolment
    getEligibleProfilesForEnrolment: build.query<
      EligibleProfilesResponse,
      string
    >({
      query: (courseId) => ({
        url: `/enrolments/eligible-profiles`,
        method: 'GET',
        params: { courseId },
      }),
      providesTags: (_result, _error, courseId) => [
        { type: 'Course', id: courseId },
      ],
    }),

    // 🟢 GET - List Course Enrolments
    getCourseEnrollments: build.query<
      EnrollmentsResponse,
      { courseId?: string; status?: string; page?: number; perPage?: number }
    >({
      query: ({ courseId, status, page, perPage }) => {
        const params: Record<string, string | number> = {};
        if (courseId) params.courseId = courseId;
        if (status) params.status = status;
        if (page) params.page = page;
        if (perPage) params.perPage = perPage;
        return {
          url: `/enrolments`,
          method: 'GET',
          params: Object.keys(params).length > 0 ? params : undefined,
        };
      },
      providesTags: (_result, _error, { courseId }) => [
        ...(courseId ? [{ type: 'Course' as const, id: courseId }] : []),
        { type: 'CourseEnrollment', id: 'LIST' },
      ],
    }),

    // 🟢 GET - Single Course Enrolment
    getCourseEnrollment: build.query<
      EnrollmentResponse,
      { enrollmentId: string; courseId?: string }
    >({
      query: ({ enrollmentId, courseId }) => {
        const params: Record<string, string> = {};
        if (courseId) params.courseId = courseId;
        return {
          url: `/enrolments/${enrollmentId}`,
          method: 'GET',
          params: Object.keys(params).length > 0 ? params : undefined,
        };
      },
      providesTags: (_result, _error, { enrollmentId }) => [
        { type: 'CourseEnrollment', id: enrollmentId },
      ],
    }),

    // 🟡 POST - Create Course Enrolments (creates one per enrollee)
    createCourseEnrollment: build.mutation<
      EnrollmentsResponse, // Returns array of enrolments
      CreateEnrollmentDto
    >({
      query: ({ courseId, ...rest }) => ({
        url: `/enrolments`,
        method: 'POST',
        params: { courseId },
        body: toFormData(rest), // Send as JSON, not FormData
      }),
      invalidatesTags: (_result, _error, { courseId }) => [
        { type: 'Course', id: courseId },
        { type: 'CourseEnrollment', id: 'LIST' },
      ],
    }),

    // 🟠 PUT - Update Course Enrolment
    updateCourseEnrollment: build.mutation<
      EnrollmentResponse,
      { enrollmentId: string; courseId?: string; data: UpdateEnrollmentDto }
    >({
      query: ({ enrollmentId, courseId, data }) => {
        const params: Record<string, string> = {};
        if (courseId) params.courseId = courseId;
        return {
          url: `/enrolments/${enrollmentId}`,
          method: 'PUT',
          params: Object.keys(params).length > 0 ? params : undefined,
          body: toFormData(data), // Send as JSON, not FormData
        };
      },
      invalidatesTags: (_result, _error, { enrollmentId, courseId }) => [
        ...(courseId ? [{ type: 'Course' as const, id: courseId }] : []),
        { type: 'CourseEnrollment', id: enrollmentId },
        { type: 'CourseEnrollment', id: 'LIST' },
      ],
    }),

    // 🔴 DELETE - Delete Course Enrolment
    deleteCourseEnrollment: build.mutation<
      { success: boolean },
      { enrollmentId: string; courseId?: string }
    >({
      query: ({ enrollmentId, courseId }) => {
        const params: Record<string, string> = {};
        if (courseId) params.courseId = courseId;
        return {
          url: `/enrolments/${enrollmentId}`,
          method: 'DELETE',
          params: Object.keys(params).length > 0 ? params : undefined,
        };
      },
      invalidatesTags: (_result, _error, { enrollmentId, courseId }) => [
        ...(courseId ? [{ type: 'Course' as const, id: courseId }] : []),
        { type: 'CourseEnrollment', id: enrollmentId },
        { type: 'CourseEnrollment', id: 'LIST' },
      ],
    }),
  }),

  overrideExisting: false,
});

// ======================
// 🔹 Export Hooks
// ======================

export const {
  // Course Folders
  useGetCourseFoldersQuery,
  useGetCourseFolderQuery,
  useCreateCourseFolderMutation,
  useUpdateCourseFolderMutation,
  useDeleteCourseFolderMutation,
  // Course CRUD
  useGetCoursesQuery,
  useGetCourseQuery,
  useCreateCourseMutation,
  useUpdateCourseMutation,
  useDeleteCourseMutation,
  useMoveCourseToFolderMutation,

  // Course Pages
  useGetCoursePagesQuery,
  useGetCoursePageQuery,
  useCreateCoursePageMutation,
  useUpdateCoursePageMutation,
  useDeleteCoursePageMutation,
  useReorderCoursePagesMutation,

  // Cohorts
  useGetCourseCohortsQuery,
  useCreateCohortMutation,
  useUpdateCohortMutation,
  useDeleteCohortMutation,

  // Course Roles
  useGetCourseRolesQuery,
  useCreateCourseRoleMutation,
  useUpdateCourseRoleMutation,
  useDeleteCourseRoleMutation,

  // Course Members
  useGetCourseMembersQuery,
  useEnrollMemberMutation,
  useUpdateMemberMutation,
  useRemoveMemberMutation,

  // Course Progress
  useGetCourseProgressQuery,
  useMarkPageAsReadMutation,
  useStoreFormSubmissionMutation,
  useGetFormSubmissionQuery,
  useSubmitFormMutation,
  useGetCourseFormApprovalMessagesQuery,
  useSendCourseFormApprovalActionMutation,
  useGetCourseFormQuestionApprovalMessagesQuery,
  useSendCourseFormQuestionApprovalActionMutation,
  useUpdateProgressMutation,

  // Course Stats
  useGetCourseStatsQuery,

  // Course Enrolments
  useGetEligibleProfilesForEnrolmentQuery,
  useGetCourseEnrollmentsQuery,
  useGetCourseEnrollmentQuery,
  useCreateCourseEnrollmentMutation,
  useUpdateCourseEnrollmentMutation,
  useDeleteCourseEnrollmentMutation,
} = coursesApi;
