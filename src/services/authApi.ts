import { Profile, setCredentials, User } from '../features/auth/authSlice';
import type { OtpDeliveryChannel, OtpDeliveryPreference, OtpDeliveryTargets } from '../types/auth';
import { toFormData } from '../utils/formDataHelper';
import { api } from './api';

// User type with tokens for login response
export interface UserWithTokens extends User {
  accessToken: string;
  refreshToken: string;
}

// Response from POST /auth/login (request OTP)
export interface RequestOtpResponse {
  success: boolean;
  message: string;
  data: {
    message: string;
    sessionKey: string;
    deliveryChannels?: OtpDeliveryChannel[];
    deliveryTargets?: OtpDeliveryTargets;
  };
}

// Response from POST /auth/otp/verify (only accessToken; user/profiles from /auth/info)
export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  data: { accessToken: string };
}

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Passwordless: request OTP by email or phone (E.164). Returns sessionKey for verification.
    requestOtp: build.mutation<RequestOtpResponse, { identifier: string }>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body: toFormData(body),
        cache: 'no-cache',
      }),
    }),

    verifyOtp: build.mutation<
      VerifyOtpResponse,
      { identifier: string; code: string; sessionKey: string }
    >({
      query: (body) => ({
        url: '/auth/otp/verify',
        method: 'POST',
        body: toFormData(body),
        cache: 'no-cache',
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.success) {
            const { accessToken } = data.data;
            localStorage.setItem('accessToken', accessToken);
            dispatch(
              setCredentials({
                accessToken,
                otpVerified: true,
              })
            );
          }
        } catch (err) {
          console.error('Verify OTP error', err);
        }
      },
      invalidatesTags: ['Auth'],
    }),

    refresh: build.mutation<
      { data: {accessToken: string; refreshToken: string;} },
      { refreshToken: string; accessToken: string }
    >({
      query: (body) => ({
        url: '/auth/refresh',
        method: 'POST',
        body: toFormData(body)
      }),
      invalidatesTags: ['Auth'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const respe = await queryFulfilled;

          const { accessToken, refreshToken } = respe.data.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          
          dispatch(
            setCredentials({
              accessToken,
              refreshToken
            })
          );

          // Fetch updated user and profile data after token refresh
          try {
            const infoApiRes = await dispatch(authApi.endpoints.getUserInfo.initiate()).unwrap();
            if (infoApiRes.success) {
              const { user, profiles } = infoApiRes.data;
              dispatch(
                setCredentials({
                  profiles,
                  user,
                })
              );
            }
          } catch (infoErr) {
            // Log error but don't fail the refresh operation
            console.error('Failed to fetch user info after refresh:', infoErr);
          }

        } catch (err) {
          console.log('err', err)
        }
      },
    }),

    getUserInfo: build.query<{ message: string; success: boolean; data:{user: User, profiles: Profile[]}}, void>({
      query: () => ({
        url: "/auth/info",
        method: "POST",
        cache: 'no-cache',
      }),
      providesTags: ["UserInfo"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const { user, profiles } = data.data;

          if (data.success) {
            dispatch(
              setCredentials({
                user: user as User,
                profiles: profiles as Profile[],
              })
            );
          }
        } catch (e) {
          console.error('Get user info error', e);
        }
      },
    }),

    checkInviteEmail: build.query<
      { exists: boolean; user?: { id: string; name: string } },
      { email: string }
    >({
      query: ({ email }) => `/auth/exists?email=${email}`,
    }),

    updateUser: build.mutation<
      { message: string; success: boolean; data: { user: User } },
      { name?: string; avatar?: File; otpDeliveryPreference?: OtpDeliveryPreference }
    >({
      query: (body) => ({
        url: '/auth/update',
        method: 'PUT',
        body: toFormData(body),
      }),
      invalidatesTags: ['UserInfo', 'Auth'],
    }),
    // Contact verification: send code to email or phone (E.164). One at a time.
    sendContactVerification: build.mutation<
      { success: boolean; message: string; data: { sessionKey: string; expiresAt: string } },
      { email?: string; phone?: string }
    >({
      query: (body) => ({
        url: '/auth/contact/send',
        method: 'POST',
        body: toFormData(body),
      }),
    }),

    // Verify OTP and update user's email or phone. Use sessionKey from send response.
    verifyContactVerification: build.mutation<
      { success: boolean; message: string; data: { user: User } },
      { sessionKey: string; code: string }
    >({
      query: (body) => ({
        url: '/auth/contact/verify',
        method: 'POST',
        body: toFormData(body),
      }),
      invalidatesTags: ['UserInfo', 'Auth'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data?.success && data?.data?.user) {
            dispatch(setCredentials({ user: data.data.user as User }));
          }
        } catch (e) {
          console.error('Verify contact error', e);
        }
      },
    }),
  }),
  overrideExisting: false,
});

export const {
  useRequestOtpMutation,
  useVerifyOtpMutation,
  useRefreshMutation,
  useGetUserInfoQuery,
  useLazyGetUserInfoQuery,
  useUpdateUserMutation,
  useSendContactVerificationMutation,
  useVerifyContactVerificationMutation,
} = authApi;
