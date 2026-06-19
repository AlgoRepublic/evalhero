import { User } from '../features/auth/authSlice';
import { toFormData } from '../utils/formDataHelper';
import { api } from './api';
import { Department } from './departmentApi';
import { Organization } from './orgApi';

// ---------------- TYPES ---------------- //

export interface InviteCheckResponse {
  success: boolean;
  message: string;
  data?: {
    exists: boolean;
    user?: {
      id: string;
      name: string;
    };
  };
}

interface InviteValidateResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface InviteData {
  invite: Invite;
  user: User | null;
}

interface Invite {
  _id: string;
  roles: string[];
  departments: string[];
  locations: string[];
  status: 'pending' | 'accepted' | 'rejected' | string;
  deletedAt: string | null;
  organization: Organization;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

interface InviteAcceptBody {
  inviteId: string;
  body?: {
    name: string;
    email?: string;
    password?: string; // optional, deprecated (passwordless flow)
    avatar?: File;
  };
}

export interface InviteUserRequest {
  email?: string;
  phone?: string; // E.164 format, e.g. +15551234567
  departments?: string[];
  roles?: string[];
  locations?: string[];
}

export interface InviteMetadata {
  count: number;
  page: number;
  perPage: number;
}

export interface PendingInviteRecord {
  _id: string;
  roles: string[];
  departments: Department[];
  locations: Location[];
  status: 'pending' | 'accepted' | 'rejected' | string;
  deletedAt: string | null;
  organization: Organization;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PendingInvitesResponse {
  success: boolean;
  message: string;
  data: {
    invites: {
      metadata: InviteMetadata;
      records: PendingInviteRecord[];
    };
  };
}


// ---------------- ENDPOINTS ---------------- //

export const inviteApi = api.injectEndpoints({
  endpoints: (build) => ({
    // ✅ Step 1: Check if inviteable
    checkInviteable: build.mutation<InviteCheckResponse, { email: string }>({
      query: ({ email }) => ({
        url: '/invites/inviteable',
        method: 'POST',
        body: toFormData({ email }),
        cache: 'no-cache',
      }),
      //   invalidatesTags: [{ type: 'Invite', id: 'LIST' }],
    }),

    // ✅ Step 2: Send final invite
    sendInvite: build.mutation<
      { success: boolean; message: string },
      { items: InviteUserRequest[] }
    >({
      query: (body) => ({
        url: '/invites',
        method: 'POST',
        body: toFormData(body),
      }),
      // Automatically re-fetch pending invites after sending
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          // Refetch pending invites immediately after successful send
          dispatch(inviteApi.util.invalidateTags(['PendingInvites']));
        } catch {
          // Ignore error (silent fail)
        }
      },
    }),

    // ✅ Step 3: Validate invite
    validateInvite: build.query<
      InviteValidateResponse<InviteData>,
      { inviteId: string }
    >({
      query: ({ inviteId }) => `/invites/${inviteId}`,
      providesTags: ['Invite'],
    }),

    // ✅ Step 4: Accept/confirm invite
    confirmInvite: build.mutation<
      { success: boolean; message?: string },
      InviteAcceptBody
    >({
      query: ({ inviteId, body }) => ({
        url: `/invites/${inviteId}/accept`,
        method: 'POST',
        body: toFormData(body),
      }),
      invalidatesTags: ['Invite', 'PendingInvites'],
    }),

    // ✅ Step 5: Get all pending invites (no cache, auto refetch)
    getPendingInvites: build.query<PendingInvitesResponse, void>({
      query: () => ({
        url: '/invites/pending',
        method: 'GET',
        cache: 'no-cache',
      }),
      providesTags: ['PendingInvites'],
      keepUnusedDataFor: 0, // no caching
      // refetchOnMountOrArgChange: true, // always fetch fresh
      // pollingInterval: 10000, // optional: refresh every 10s
    }),
  }),
});

// ---------------- HOOK EXPORTS ---------------- //

export const {
  useCheckInviteableMutation,
  useSendInviteMutation,
  useValidateInviteQuery,
  useConfirmInviteMutation,
  useGetPendingInvitesQuery,
} = inviteApi;
