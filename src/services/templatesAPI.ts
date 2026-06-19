import { JSONContent } from '@tiptap/core';
import { api } from './api';
import { toFormData } from '../utils/formDataHelper';

// 🧱 Types
export interface FormTemplateSchema {
  formSchema: JSONContent;
  _id: string;
  deletedAt: string | null;
  organization: string;
  formTemplate: string;
  version: number;
  totalScore?: number;
  totalPassFail?: number;
  createdAt: string;
  updatedAt: string;
}

/** Folder ref for parent/parents (breadcrumbs) */
export interface FormTemplateFolderRef {
  _id: string;
  name: string;
}

/** Form template folder (hierarchical) */
export interface FormTemplateFolder {
  _id: string;
  organization: string;
  name: string;
  parent: FormTemplateFolderRef | null;
  parents: FormTemplateFolderRef[];
}

export interface Template {
  _id: string;
  name: string;
  description?: string;
  deletedAt: string | null;
  organization: string;
  folder: FormTemplateFolder | null;
  createdAt: string;
  updatedAt: string;
  configSets?: ConfigSet[];
  currentFormTemplateSchema?: FormTemplateSchema;
  /** Default minimum score required to pass (optional, default 0). */
  passingScore?: number;
  /** Default minimum number of pass outcomes required for pass/fail items (optional, default 0). */
  passingPassFailCount?: number;
}

export interface TemplatesMetadata {
  count: number;
  page: number;
  perPage: number;
}

export interface TemplatesData {
  metadata: TemplatesMetadata;
  records: Template[];
}

export interface TemplatesResponse {
  success: boolean;
  message: string;
  data: TemplatesData
}

export interface TemplateResponse {
  success: boolean;
  message: string;
  data: {
    formTemplate: Template;
  };
}

// Config Set interface
export interface ApproverOrSubject {
  _id: string;
  action?: 'add' | 'update' | 'remove';
}

export interface ConfigSet {
  _id?: string; // For updates, to track existing configSets
  action?: 'add' | 'update' | 'remove';
  name: string;
  hasApproval?: boolean;
  hasDisputes?: boolean;
  signatureRequired?: boolean;
  approvers?: ApproverOrSubject[];
  questionApprovers?: ApproverOrSubject[]; // Profiles who can approve individual questions
  approvalRule?: 'ALL' | 'ANY' | 'MIN';
  approvalMinCount?: number;
  subjects?: ApproverOrSubject[];
  omitSignatureAllowed?: boolean;
  omitSignatureApprovers?: ApproverOrSubject[]; // Approvers that can omit signature
}

// DTOs
export interface CreateTemplateDto {
  name: string;
  description?: string;
  folder?: string | null;
  configSets?: ConfigSet[];
  schema: JSONContent;
}

export interface CreateFormTemplateResponse {
  success: boolean;
  message: string;
  data: {
    formTemplate: Template;
  };
}

export interface UpdateTemplateDto extends Partial<CreateTemplateDto> {
  id: string;
  restore?: boolean;
  folder?: string | null;
  schema?: JSONContent; // Optional schema - included if builder has changes
}

// ─── Form template folder types (same shape as Knowledge Base folders) ───
export interface FormTemplateFolderListResponse {
  success: boolean;
  message: string;
  data: { metadata: TemplatesMetadata; records: FormTemplateFolder[] };
}
export interface FormTemplateFolderResponse {
  success: boolean;
  message: string;
  data: { folder: FormTemplateFolder };
}
export interface CreateFormTemplateFolderDto {
  name: string;
  parent?: string | null;
}
export interface UpdateFormTemplateFolderDto {
  name?: string;
  parent?: string | null;
  restore?: boolean;
}

export const templateApi = api.injectEndpoints({
  endpoints: (build) => ({
    // ─── Form template folders ───
    getFormTemplateFolders: build.query<
      FormTemplateFolderListResponse,
      { parent?: string; page?: number; perPage?: number; sortBy?: string; order?: 'asc' | 'desc' }
    >({
      query: ({ parent, page = 1, perPage = 100, sortBy = 'name', order = 'asc' }) => {
        const params: Record<string, string | number> = { page, perPage, sortBy, order };
        if (parent !== undefined) params.parent = parent;
        return { url: '/form-templates/folders', method: 'GET', params };
      },
      providesTags: (result) =>
        result?.data?.records?.length
          ? [
              ...result.data.records.map((r) => ({ type: 'Template' as const, id: `FOLDER_${r._id}` })),
              { type: 'Template', id: 'FOLDER_LIST' },
            ]
          : [{ type: 'Template', id: 'FOLDER_LIST' }],
    }),
    getFormTemplateFolder: build.query<FormTemplateFolderResponse, string>({
      query: (id) => ({ url: `/form-templates/folders/${id}`, method: 'GET' }),
      providesTags: (_r, _e, id) => [{ type: 'Template', id: `FOLDER_${id}` }],
    }),
    createFormTemplateFolder: build.mutation<FormTemplateFolderResponse, CreateFormTemplateFolderDto>({
      query: ({ name, parent }) => {
        const body: Record<string, string | undefined> = { name };
        if (parent) body.parent = parent;
        return { url: '/form-templates/folders', method: 'POST', body: toFormData(body) };
      },
      invalidatesTags: [{ type: 'Template', id: 'FOLDER_LIST' }],
    }),
    updateFormTemplateFolder: build.mutation<
      FormTemplateFolderResponse,
      { id: string; body: UpdateFormTemplateFolderDto }
    >({
      query: ({ id, body }) => ({
        url: `/form-templates/folders/${id}`,
        method: 'PUT',
        body: toFormData(body),
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Template', id: `FOLDER_${id}` },
        { type: 'Template', id: 'FOLDER_LIST' },
        { type: 'Template', id: 'LIST' },
      ],
    }),
    deleteFormTemplateFolder: build.mutation<{ success: boolean; message?: string }, string>({
      query: (id) => ({ url: `/form-templates/folders/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Template', id: `FOLDER_${id}` },
        { type: 'Template', id: 'FOLDER_LIST' },
        { type: 'Template', id: 'LIST' },
      ],
    }),

    // 🟢 GET - List with Pagination (folder: filter by folder; all: true = ignore folder, show all)
    getTemplates: build.query<
      TemplatesResponse,
      {
        page?: number;
        perPage?: number;
        sortBy?: string;
        order?: 'asc' | 'desc';
        folder?: string;
        all?: boolean;
      }
    >({
      query: ({ page = 1, perPage = 10, sortBy = 'name', order = 'asc', folder, all }) => {
        const params: Record<string, string | number | boolean> = { page, perPage, sortBy, order };
        if (folder) params.folder = folder;
        else if (all) params.all = 'true';
        return { url: '/form-templates', method: 'GET', params };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.records.map((t) => ({
                type: 'Template' as const,
                id: t._id,
              })),
              { type: 'Template', id: 'LIST' },
            ]
          : [{ type: 'Template', id: 'LIST' }],
    }),

    // 🟢 GET - Single
    getTemplate: build.query<TemplateResponse, string>({
      query: (id) => `/form-templates/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Template', id }],
    }),

    // 🟡 POST - Create
    createTemplate: build.mutation<CreateFormTemplateResponse, Record<string, unknown>>({
      query: (body) => ({
        url: '/form-templates',
        method: 'POST',
        body: toFormData(body),
      }),
      invalidatesTags: [{ type: 'Template', id: 'LIST' }],
    }),

    // 🟡 PUT - Update
    updateTemplate: build.mutation<Template, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({
        url: `/form-templates/${id}`,
        method: 'PUT',
        body: toFormData(body),
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Template', id },
        { type: 'Template', id: 'LIST' },
      ],
    }),

    // 🔴 DELETE
    deleteTemplate: build.mutation<{ success: boolean; id: string }, string>({
      query: (id) => ({
        url: `/form-templates/${id}`,
        method: 'DELETE',
      }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data?.success) {
            dispatch(
              templateApi.util.updateQueryData(
                'getTemplates',
                { page: 1, perPage: 10, sortBy: 'name', order: 'asc' },
                (draft) => {
                  if (!draft?.data?.records) return;
                  draft.data.records = draft.data.records.filter(
                    (t) => t._id !== id
                  );
                  draft.data.metadata.count -= 1;
                }
              )
            );
          }
        } catch (error) {
          console.error('Error deleting template:', error);
        }
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Template', id },
        { type: 'Template', id: 'LIST' },
      ],
    }),

    // Move form template to folder (PUT /form-templates/:_id/folder)
    moveFormTemplateToFolder: build.mutation<
      TemplateResponse,
      { id: string; folder: string | null }
    >({
      query: ({ id, folder }) => ({
        url: `/form-templates/${id}/folder`,
        method: 'PUT',
        body: toFormData({ folder }),
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Template', id },
        { type: 'Template', id: 'LIST' },
        { type: 'Template', id: 'FOLDER_LIST' },
      ],
    }),
  }),
  overrideExisting: false,
});


export const {
  useGetFormTemplateFoldersQuery,
  useGetFormTemplateFolderQuery,
  useCreateFormTemplateFolderMutation,
  useUpdateFormTemplateFolderMutation,
  useDeleteFormTemplateFolderMutation,
  useGetTemplatesQuery,
  useGetTemplateQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
  useMoveFormTemplateToFolderMutation,
} = templateApi;
