import { Profile } from '../features/auth/authSlice';
import { toFormData } from '../utils/formDataHelper';
import { api } from './api';

// Types

export interface ProfilesMetadata {
  count: number;
  page: number;
  perPage: number;
}

export interface ProfilesData {
  metadata: ProfilesMetadata;
  records: Profile[];
}

export interface UsersResponse {
  success: boolean;
  message: string;
  data: {
    profiles: ProfilesData;
  };
}

export interface BulkUploadSuccessData {
  usersCreated: number;
  profilesCreated: number;
  updated: number;
  skipped: number;
  errors: BulkUploadValidationError[];
}

/** Per-row error from bulk upload (row numbers are 1-based; header = row 1). */
export interface BulkUploadValidationError {
  row: number;
  profileId?: string;
  email?: string;
  phone?: string;
  code: string;
  message: string;
}

export interface BulkUploadSuccessResponse {
  success: true;
  message: string;
  data: BulkUploadSuccessData;
}

export interface BulkUploadErrorResponse {
  success: false;
  message: string;
  /** Top-level errors (if API returns them here) */
  errors?: BulkUploadValidationError[];
  /** Errors nested under data (e.g. CSV validation failed response) */
  data?: {
    errors?: BulkUploadValidationError[];
  };
}

export type BulkUploadResponse = BulkUploadSuccessResponse | BulkUploadErrorResponse;

export interface GetProfileResponse {
  success: boolean;
  message: string;
  data: { profile: Profile };
}

/** Payload for PUT /users/:profileId (user::update, user::restore). When updating assignments, at least one of roleIds, departmentIds, locationIds. Optional name/avatar for identity updates. Pass restore: true to restore a deleted user (requires user::restore). */
export interface UpdateUserProfilePayload {
  profileId: string;
  roleIds?: string[];
  departmentIds?: string[];
  locationIds?: string[];
  /** Display name / username (user::update) */
  name?: string;
  /** Avatar image file (user::update) */
  avatar?: File;
  /** Set to true to restore a soft-deleted user (user::restore) */
  restore?: boolean;
}

/** Payload for POST /users/set-admin-status (Super Admin only). */
export interface SetAdminStatusPayload {
  userId: string;
  isAdmin: boolean;
  /** Optional profileId to invalidate cache after update */
  profileId?: string;
}

export interface SetAdminStatusResponse {
  success: boolean;
  message: string;
  data: { user: { _id: string; name?: string; email?: string; phone?: string | null; isAdmin: boolean } };
}

/** Payload for POST /users/impersonate (Super Admin only). */
export interface StartImpersonationPayload {
  userId: string;
  profileId: string;
}

/** Response from POST /users/impersonate. */
export interface StartImpersonationResponse {
  success: boolean;
  message: string;
  data: {
    impersonationToken: string;
    targetUser: { _id: string; name?: string; email?: string; phone?: string | null };
    targetProfile: { _id: string; organization: string };
  };
}

/** Response from POST /users/end-impersonation. */
export interface EndImpersonationResponse {
  success: boolean;
  message: string;
  data?: { message: string };
}

export interface UpdateUserProfileResponse {
  success: boolean;
  message: string;
  data: { profile: Profile };
}

export const usersApi = api.injectEndpoints({
  endpoints: (build) => ({
    // 🟢 GET - Profile by ID
    getProfile: build.query<Profile, string>({
      query: (id) => ({
        url: `/profiles/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: GetProfileResponse) => response.data.profile,
      providesTags: (_result, _err, id) => [{ type: 'Profile', id }],
    }),

    // 🟢 GET - List with Pagination
    getUsers: build.query<
      UsersResponse,
      { page?: number; perPage?: number; sortBy?: string; order?: 'asc' | 'desc' }
    >({
      query: ({ page = 1, perPage = 10, sortBy = 'name', order = 'asc' }) => ({
        url: '/users',
        method: 'GET',
        params: { page, perPage, sortBy, order },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.profiles.records.map((p) => ({
                type: 'Profile' as const,
                id: p._id,
              })),
              { type: 'Profile', id: 'LIST' },
            ]
          : [{ type: 'Profile', id: 'LIST' }],
    }),

    // 🟢 GET - Export profiles as CSV (download)
    exportProfiles: build.mutation<Blob, void>({
      query: () => ({
        url: '/users/bulk-upload/export',
        method: 'GET',
        responseHandler: (response) => response.blob(),
      }),
    }),

    // 🟢 POST - Bulk upload users via CSV
    bulkUploadUsers: build.mutation<BulkUploadResponse, File>({
      query: (file) => {
        const formData = new FormData();
        formData.append('csv', file);
        return {
          url: '/users/bulk-upload',
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: [{ type: 'Profile', id: 'LIST' }],
    }),

    // 🟢 PUT - Update user profile (roles, departments, locations, restore) — user::update or user::restore
    updateUserProfile: build.mutation<Profile, UpdateUserProfilePayload>({
      query: ({ profileId, ...body }) => ({
        url: `/users/${profileId}`,
        method: 'PUT',
        body: toFormData({ profileId, ...body }),
      }),
      transformResponse: (response: UpdateUserProfileResponse) => response.data.profile,
      invalidatesTags: (_result, _err, arg) => [
        { type: 'Profile', id: arg.profileId },
        { type: 'Profile', id: 'LIST' },
      ],
    }),

    // 🔴 DELETE - Soft-delete user (user::delete)
    deleteUser: build.mutation<{ success: boolean; message?: string }, string>({
      query: (profileId) => ({
        url: `/users/${profileId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _err, profileId) => [
        { type: 'Profile', id: profileId },
        { type: 'Profile', id: 'LIST' },
      ],
    }),

    // 🟢 POST - Set Super Admin status — Super Admin only (POST /users/set-admin-status)
    setAdminStatus: build.mutation<SetAdminStatusResponse['data'], SetAdminStatusPayload>({
      query: ({ userId, isAdmin }) => ({
        url: '/users/set-admin-status',
        method: 'POST',
        body: toFormData({ userId, isAdmin }),
      }),
      transformResponse: (response: SetAdminStatusResponse) => response.data,
      invalidatesTags: (_result, _err, arg) =>
        arg.profileId ? [{ type: 'Profile', id: arg.profileId }, { type: 'Profile', id: 'LIST' }] : [{ type: 'Profile', id: 'LIST' }],
    }),

    // 🟢 POST - Start impersonation (Super Admin only)
    startImpersonation: build.mutation<StartImpersonationResponse['data'], StartImpersonationPayload>({
      query: ({ userId, profileId }) => ({
        url: '/users/impersonate',
        method: 'POST',
        body: toFormData({ userId, profileId }),
      }),
      transformResponse: (response: StartImpersonationResponse) => response.data,
    }),

    // 🟢 POST - End impersonation (called with impersonation token)
    endImpersonation: build.mutation<EndImpersonationResponse, void>({
      query: () => ({
        url: '/users/end-impersonation',
        method: 'POST',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUsersQuery,
  useGetProfileQuery,
  useExportProfilesMutation,
  useBulkUploadUsersMutation,
  useUpdateUserProfileMutation,
  useDeleteUserMutation,
  useSetAdminStatusMutation,
  useStartImpersonationMutation,
  useEndImpersonationMutation,
} = usersApi;


