import { JSONContent } from '@tiptap/core';
import { api } from './api';
import { toFormData } from '../utils/formDataHelper';

// Types (from global-form-templates-ui-guide.md)
export interface GlobalFormTemplateSchema {
  _id: string;
  organization?: string;
  globalFormTemplate?: string;
  version: number;
  formSchema: JSONContent;
  totalScore?: number;
  totalPassFail?: number;
}

export interface GlobalFormTemplateConfigSet {
  _id?: string;
  name: string;
  hasApproval?: boolean;
  hasDisputes?: boolean;
  signatureRequired?: boolean;
  omitSignatureAllowed?: boolean;
  approvers?: Array<{ _id: string; action?: 'add' | 'update' | 'remove' }>;
  omitSignatureApprovers?: Array<{ _id: string; action?: 'add' | 'update' | 'remove' }>;
  questionApprovers?: Array<{ _id: string; action?: 'add' | 'update' | 'remove' }>;
  subjects?: Array<{ _id: string; action?: 'add' | 'update' | 'remove' }>;
  approvalRule?: string;
  approvalMinCount?: number;
}

export interface GlobalFormTemplate {
  _id: string;
  organization: string;
  currentGlobalFormTemplateSchema?: GlobalFormTemplateSchema;
  name: string;
  description?: string | null;
  createdBy?: string;
  configSets?: GlobalFormTemplateConfigSet[];
  createdAt: string;
  updatedAt: string;
}

export interface GlobalFormTemplatesMetadata {
  count: number;
  page: number;
  perPage: number;
}

export interface GlobalFormTemplatesListResponse {
  success: boolean;
  message: string;
  data: {
    metadata: GlobalFormTemplatesMetadata;
    records: GlobalFormTemplate[];
  };
}

export interface GlobalFormTemplateDetailResponse {
  success: boolean;
  message: string;
  data: {
    globalFormTemplate: GlobalFormTemplate;
  };
}

export interface CreateGlobalFormTemplateBody {
  name: string;
  description?: string;
  formSchema?: JSONContent;
  totalScore?: number;
  totalPassFail?: number;
  configSets?: Array<{ action: 'add'; configSet?: GlobalFormTemplateConfigSet } | { action: 'add'; _id: string }>;
}

export interface UpdateGlobalFormTemplateBody {
  name?: string;
  description?: string;
  formSchema?: JSONContent;
  totalScore?: number;
  totalPassFail?: number;
  configSets?: Array<
    | { action: 'add'; configSet?: GlobalFormTemplateConfigSet }
    | { action: 'update'; _id: string; configSet?: Partial<GlobalFormTemplateConfigSet> }
    | { action: 'remove'; _id: string }
  >;
  restore?: boolean;
}

export const globalFormTemplatesApi = api.injectEndpoints({
  endpoints: (build) => ({
    listGlobalFormTemplates: build.query<
      GlobalFormTemplatesListResponse,
      { page?: number; perPage?: number; sortBy?: string; order?: 'asc' | 'desc'; name?: string }
    >({
      query: ({ page = 1, perPage = 50, sortBy = 'createdAt', order = 'asc', name }) => ({
        url: '/global-form-templates',
        method: 'GET',
        params: {
          page,
          perPage,
          sortBy,
          order,
          ...(name ? { name } : {}),
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.records.map((t) => ({
                type: 'GlobalFormTemplate' as const,
                id: t._id,
              })),
              { type: 'GlobalFormTemplate', id: 'LIST' },
            ]
          : [{ type: 'GlobalFormTemplate', id: 'LIST' }],
    }),

    getGlobalFormTemplate: build.query<GlobalFormTemplateDetailResponse, string>({
      query: (id) => `/global-form-templates/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'GlobalFormTemplate', id }],
    }),

    createGlobalFormTemplate: build.mutation<
      GlobalFormTemplateDetailResponse,
      CreateGlobalFormTemplateBody
    >({
      query: (body) => ({
        url: '/global-form-templates',
        method: 'POST',
        body: toFormData(body),
      }),
      invalidatesTags: [{ type: 'GlobalFormTemplate', id: 'LIST' }],
    }),

    updateGlobalFormTemplate: build.mutation<
      GlobalFormTemplateDetailResponse,
      { id: string; body: UpdateGlobalFormTemplateBody }
    >({
      query: ({ id, body }) => ({
        url: `/global-form-templates/${id}`,
        method: 'PUT',
        body: toFormData(body),
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'GlobalFormTemplate', id },
        { type: 'GlobalFormTemplate', id: 'LIST' },
      ],
    }),

    deleteGlobalFormTemplate: build.mutation<{ success: boolean; message?: string }, string>({
      query: (id) => ({
        url: `/global-form-templates/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'GlobalFormTemplate', id },
        { type: 'GlobalFormTemplate', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListGlobalFormTemplatesQuery,
  useGetGlobalFormTemplateQuery,
  useLazyGetGlobalFormTemplateQuery,
  useCreateGlobalFormTemplateMutation,
  useUpdateGlobalFormTemplateMutation,
  useDeleteGlobalFormTemplateMutation,
} = globalFormTemplatesApi;
