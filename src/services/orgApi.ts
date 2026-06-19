import { toFormData } from '../utils/formDataHelper';
import { api } from './api';

// Types
export interface WasabiStorage {
  _id: string;
  id: string;
  organization: string;
  bucketName: string;
  iamUserName: string;
  limitMb: number;
  usedMb: number;
  lastReconciledAt: string;
  provisioningStatus: string;
  provisioningError: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isOverQuota: boolean;
}

export interface Organization {
  _id: string;
  icon?: string;
  deletedAt?: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  usersCount?: number;
  wasabiStorage?: WasabiStorage;
}

export interface OrganizationsMetadata {
  count: number;
  page: number;
  perPage: number;
}

export interface OrganizationsData {
  metadata: OrganizationsMetadata;
  records: Organization[];
}

export interface OrganizationsResponse {
  success: boolean;
  message: string;
  data: {
    organizations: OrganizationsData;
  };
}

export interface OrganizationResponse {
  success: boolean;
  message: string;
  data: {
    organization: Organization;
  };
}

export interface CreateOrganizationDto {
  name: string;
  icon?: File;
  /** Storage quota in MB (admin only; default: 100) */
  wasabiStorageLimit?: number;
}

export interface UpdateOrganizationDto {
  id: string;
  name: string;
  icon?: File;
  restore?: boolean;
  /** Storage quota in MB (admin only) */
  wasabiStorageLimit?: number;
}

export const orgApi = api.injectEndpoints({
  endpoints: (build) => ({
    // 🟢 GET - List with Pagination
    getOrganizations: build.query<
      OrganizationsResponse,
      {
        page?: number;
        perPage?: number;
        sortBy?: string;
        order?: 'asc' | 'desc';
        name?: string;
      }
    >({
      query: ({ page = 1, perPage = 10, sortBy = 'name', order = 'asc', name }) => ({
        url: '/organizations',
        method: 'GET',
        params: { page, perPage, sortBy, order, ...(name ? { name } : {}) },
      }),
      providesTags: (result) => {
        return result
          ? [
              ...result.data.organizations.records.map((org) => ({
                type: 'Organization' as const,
                id: org._id,
              })),
              { type: 'Organization', id: 'LIST' },
            ]
          : [{ type: 'Organization', id: 'LIST' }];
      },
    }),

    // 🟢 GET - Single
    getOrganization: build.query<OrganizationResponse, string>({
      query: (id) => `/organizations/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Organization', id }],
    }),

    // 🟡 POST - Create
    createOrganization: build.mutation<Organization, CreateOrganizationDto>({
      query: (body) => ({
        url: '/organizations',
        method: 'POST',
        body: toFormData(body),
      }),
      invalidatesTags: [{ type: 'Organization', id: 'LIST' }],
    }),

    // 🟡 PATCH - Update
    updateOrganization: build.mutation<Organization, UpdateOrganizationDto>({
      query: ({ id, ...body }) => ({
        url: `/organizations/${id}`,
        method: 'PUT',
        body: toFormData(body),
      }),
      // update single org cache on success
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Organization', id },
      ],
    }),

    // 🔴 DELETE
    deleteOrganization: build.mutation<
      { success: boolean; id: string },
      string
    >({
      query: (id) => ({
        url: `/organizations/${id}`,
        method: 'DELETE',
      }),
      // optimistic update example
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data?.success) {
            dispatch(
              orgApi.util.updateQueryData(
                'getOrganizations',
                { page: 1, perPage: 10, sortBy: 'name', order: 'asc' },
                (draft) => {
                  if (!draft?.data?.organizations) return;
                  draft.data.organizations.records =
                    draft.data.organizations.records.filter(
                      (o) => o._id !== id
                    );
                  draft.data.organizations.metadata.count -= 1;
                }
              )
            );
          }
        } catch (error) {
          console.error('Error deleting organization:', error);
        }

        // // pessimistic approach: remove from list cache optimistically
        // const patchResult = dispatch(
        //   orgApi.util.updateQueryData('getOrganizations', { page: 1, perPage: 10, sortBy: 'name', order: 'asc' }, (draft: { data: Organization[]; total: number }) => {
        //     if (!draft?.data) return;
        //     draft.data = draft.data.filter((o) => o._id !== id);
        //     draft.total = draft.total - 1;
        //   })
        // );
        // try {
        //   await queryFulfilled;
        // } catch {
        //   // rollback on failure
        //   patchResult.undo();
        // }
      },
      // invalidatesTags: [{ type: 'Organization', id: 'LIST' }],
      invalidatesTags: (_result, _error, id) => [
        { type: 'Organization', id },
        { type: 'Organization', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetOrganizationsQuery,
  useGetOrganizationQuery,
  useCreateOrganizationMutation,
  useUpdateOrganizationMutation,
  useDeleteOrganizationMutation,
} = orgApi;
