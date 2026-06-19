/**
 * ConfigSets API – organization-scoped CRUD for reusable assignment/form config sets.
 * @see CONFIGSETS_API.md
 */
import { Profile } from '../features/auth/authSlice';
import { toFormData } from '../utils/formDataHelper';
import { api } from './api';

// --- Types (aligned with CONFIGSETS_API.md and API response with populated profiles) ---

export type ConfigSetApprovalRule = 'NONE' | 'ALL' | 'ANY' | 'MIN';

export interface ConfigSet {
  _id: string;
  organization: string;
  name: string;
  hasApproval?: boolean;
  hasDisputes?: boolean;
  signatureRequired?: boolean;
  omitSignatureAllowed?: boolean;
  omitSignatureApprovers?: Profile[];
  approvalRule?: ConfigSetApprovalRule;
  approvalMinCount?: number;
  approvers?: Profile[];
  questionApprovers?: Profile[];
  subjects?: Profile[];
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Normalize profile refs (or raw IDs) to ID strings for form Select values.
 */
export function getConfigSetProfileIds(
  items: (string | Profile)[] | undefined
): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => (typeof item === 'string' ? item : item._id));
}

export interface ConfigSetsListParams {
  page?: number;
  perPage?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  name?: string;
}

export interface ConfigSetsMetadata {
  count: number;
  page: number;
  perPage: number;
}

export interface ConfigSetsListResponse {
  success: boolean;
  message: string;
  data: {
    configSets: {
      metadata: ConfigSetsMetadata;
      records: ConfigSet[];
    };
  };
}

export interface ConfigSetDetailResponse {
  success: boolean;
  message: string;
  data: {
    configSet: ConfigSet;
  };
}

/** Create body: do not send organization; backend derives from profile. */
export interface CreateConfigSetBody {
  name: string;
  hasApproval?: boolean;
  hasDisputes?: boolean;
  signatureRequired?: boolean;
  omitSignatureAllowed?: boolean;
  omitSignatureApprovers?: string[];
  approvalRule?: ConfigSetApprovalRule;
  approvalMinCount?: number;
  approvers?: string[];
  questionApprovers?: string[];
  subjects?: string[];
}

/** Update body: any subset of fields, or restore. */
export interface UpdateConfigSetBody {
  name?: string;
  hasApproval?: boolean;
  hasDisputes?: boolean;
  signatureRequired?: boolean;
  omitSignatureAllowed?: boolean;
  omitSignatureApprovers?: string[];
  approvalRule?: ConfigSetApprovalRule;
  approvalMinCount?: number;
  approvers?: string[];
  questionApprovers?: string[];
  subjects?: string[];
  restore?: boolean;
}

export interface ConfigSetDeleteResponse {
  success: boolean;
  message: string;
  data: null;
}

// --- API ---

export const configSetsApi = api.injectEndpoints({
  endpoints: (build) => ({
    listConfigSets: build.query<ConfigSetsListResponse, ConfigSetsListParams | void>({
      query: (arg) => {
        const p = arg ?? {};
        return {
          url: '/config-sets',
          method: 'GET',
          params: {
            page: p.page ?? 1,
            perPage: p.perPage ?? 25,
            sortBy: p.sortBy ?? 'createdAt',
            order: p.order ?? 'asc',
            ...(p.name ? { name: p.name } : {}),
          },
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.configSets.records.map((c) => ({
                type: 'ConfigSet' as const,
                id: c._id,
              })),
              { type: 'ConfigSet', id: 'LIST' },
            ]
          : [{ type: 'ConfigSet', id: 'LIST' }],
    }),

    getConfigSet: build.query<ConfigSetDetailResponse, string>({
      query: (id) => ({
        url: `/config-sets/${id}`,
        method: 'GET',
      }),
      providesTags: (_result, _error, id) => [{ type: 'ConfigSet', id }],
    }),

    createConfigSet: build.mutation<ConfigSetDetailResponse, CreateConfigSetBody>({
      query: (body) => ({
        url: '/config-sets',
        method: 'POST',
        body: toFormData(body),
      }),
      invalidatesTags: [{ type: 'ConfigSet', id: 'LIST' }],
    }),

    updateConfigSet: build.mutation<
      ConfigSetDetailResponse,
      { id: string; body: UpdateConfigSetBody }
    >({
      query: ({ id, body }) => ({
        url: `/config-sets/${id}`,
        method: 'PUT',
        body: toFormData(body),
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'ConfigSet', id },
        { type: 'ConfigSet', id: 'LIST' },
      ],
    }),

    deleteConfigSet: build.mutation<ConfigSetDeleteResponse, string>({
      query: (id) => ({
        url: `/config-sets/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'ConfigSet', id },
        { type: 'ConfigSet', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListConfigSetsQuery,
  useGetConfigSetQuery,
  useLazyGetConfigSetQuery,
  useCreateConfigSetMutation,
  useUpdateConfigSetMutation,
  useDeleteConfigSetMutation,
} = configSetsApi;
