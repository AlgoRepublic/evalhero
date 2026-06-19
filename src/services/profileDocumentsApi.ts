import { api } from './api';

// Document types per PROFILE_DOCUMENTS_API.md
export const PROFILE_DOCUMENT_TYPES = [
  'certificate',
  'license',
  'id',
  'passport',
  'visa',
  'insurance',
  'other',
] as const;
export type ProfileDocumentType = (typeof PROFILE_DOCUMENT_TYPES)[number];

export interface ProfileDocumentUser {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string | null;
}

export interface ProfileDocumentProfile {
  _id: string;
  user?: ProfileDocumentUser;
  organization?: string;
  roles?: unknown[];
  departments?: unknown[];
  locations?: unknown[];
}

export interface ProfileDocumentFile {
  key: string;
  bucket: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface ProfileDocumentRecord {
  _id: string;
  profile: ProfileDocumentProfile;
  organization: string;
  documentType: ProfileDocumentType;
  title: string;
  description?: string | null;
  file: ProfileDocumentFile;
  expirationDate?: string | null;
  isExpired: boolean;
  downloadUrl?: string;
  uploadedBy?: { _id: string; user?: { name?: string; email?: string } };
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ProfileDocumentsListMetadata {
  count: number;
  page: number;
  perPage: number;
}

export interface ProfileDocumentsListResponse {
  success: boolean;
  message: string;
  data: {
    metadata: ProfileDocumentsListMetadata;
    records: ProfileDocumentRecord[];
  };
}

export interface ProfileDocumentsCalendarResponse {
  success: boolean;
  message: string;
  data: ProfileDocumentRecord[];
}

export interface ProfileDocumentSingleResponse {
  success: boolean;
  message: string;
  data: ProfileDocumentRecord;
}

export interface CreateProfileDocumentInput {
  profileId: string;
  documentType: ProfileDocumentType;
  title: string;
  description?: string;
  expirationDate?: string | null;
  file: File;
}

export interface UpdateProfileDocumentInput {
  title?: string;
  description?: string;
  documentType?: ProfileDocumentType;
  expirationDate?: string | null;
  file?: File;
}

export const profileDocumentsApi = api.injectEndpoints({
  endpoints: (build) => ({
    listProfileDocuments: build.query<
      ProfileDocumentsListResponse,
      {
        profileId: string;
        documentType?: ProfileDocumentType;
        isExpired?: boolean;
        page?: number;
        perPage?: number;
        sortBy?: string;
        order?: 'asc' | 'desc';
      }
    >({
      query: ({
        profileId,
        documentType,
        isExpired,
        page = 1,
        perPage = 25,
        sortBy = 'createdAt',
        order = 'desc',
      }) => ({
        url: '/profile-documents',
        method: 'GET',
        params: {
          profileId,
          documentType,
          isExpired,
          page,
          perPage,
          sortBy,
          order,
        },
      }),
      providesTags: (result, _err, { profileId }) =>
        result
          ? [
              ...result.data.records.map((r) => ({ type: 'ProfileDocument' as const, id: r._id })),
              { type: 'ProfileDocument', id: `LIST-${profileId}` },
            ]
          : [{ type: 'ProfileDocument', id: `LIST-${profileId}` }],
    }),

    getProfileDocument: build.query<ProfileDocumentRecord, string>({
      query: (id) => ({
        url: `/profile-documents/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: ProfileDocumentSingleResponse) => response.data,
      providesTags: (_result, _err, id) => [{ type: 'ProfileDocument', id }],
    }),

    createProfileDocument: build.mutation<ProfileDocumentSingleResponse['data'], CreateProfileDocumentInput>({
      query: ({ profileId, documentType, title, description, expirationDate, file }) => {
        const formData = new FormData();
        formData.append('profileId', profileId);
        formData.append('documentType', documentType);
        formData.append('title', title);
        if (description != null) formData.append('description', description);
        if (expirationDate != null && expirationDate !== '')
          formData.append('expirationDate', new Date(expirationDate).toISOString());
        formData.append('file', file);
        return {
          url: '/profile-documents',
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: (_result, _err, { profileId }) => [{ type: 'ProfileDocument', id: `LIST-${profileId}` }],
    }),

    updateProfileDocument: build.mutation<
      ProfileDocumentSingleResponse['data'],
      { id: string; profileId: string } & UpdateProfileDocumentInput
    >({
      query: ({ id, file, title, description, documentType, expirationDate }) => {
        const formData = new FormData();
        if (title != null) formData.append('title', title);
        if (description != null) formData.append('description', description);
        if (documentType != null) formData.append('documentType', documentType);
        if (expirationDate != null && expirationDate !== '')
          formData.append('expirationDate', new Date(expirationDate).toISOString());
        if (file instanceof File) formData.append('file', file);
        return {
          url: `/profile-documents/${id}`,
          method: 'PUT',
          body: formData,
        };
      },
      invalidatesTags: (_result, _err, { id, profileId }) => [
        { type: 'ProfileDocument', id },
        { type: 'ProfileDocument', id: `LIST-${profileId}` },
      ],
    }),

    deleteProfileDocument: build.mutation<null, { id: string; profileId: string }>({
      query: ({ id }) => ({
        url: `/profile-documents/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _err, { id, profileId }) => [
        { type: 'ProfileDocument', id },
        { type: 'ProfileDocument', id: `LIST-${profileId}` },
      ],
    }),

    getCalendarDocuments: build.query<
      ProfileDocumentRecord[],
      {
        startDate: string;
        endDate: string;
        profileIds?: string[];
        roles?: string[];
        locations?: string[];
        departments?: string[];
      }
    >({
      query: ({ startDate, endDate, profileIds, roles, locations, departments }) => ({
        url: '/profile-documents/calendar',
        method: 'GET',
        params: {
          startDate,
          endDate,
          ...(profileIds?.length ? { profileIds: profileIds.join(',') } : {}),
          ...(roles?.length ? { roles: roles.join(',') } : {}),
          ...(locations?.length ? { locations: locations.join(',') } : {}),
          ...(departments?.length ? { departments: departments.join(',') } : {}),
        },
      }),
      transformResponse: (response: ProfileDocumentsCalendarResponse) => response.data ?? [],
      providesTags: (result) =>
        result
          ? [
              ...result.map((r) => ({ type: 'ProfileDocument' as const, id: r._id })),
              { type: 'ProfileDocument', id: 'CALENDAR' },
            ]
          : [{ type: 'ProfileDocument', id: 'CALENDAR' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListProfileDocumentsQuery,
  useGetProfileDocumentQuery,
  useLazyGetProfileDocumentQuery,
  useCreateProfileDocumentMutation,
  useUpdateProfileDocumentMutation,
  useDeleteProfileDocumentMutation,
  useLazyGetCalendarDocumentsQuery,
} = profileDocumentsApi;
