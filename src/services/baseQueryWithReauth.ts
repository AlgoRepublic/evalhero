import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query';
import { setCredentials, logout } from '../features/auth/authSlice';
import type { RootState } from '../store';
import { toFormData } from '../utils/formDataHelper';
import { PATH_AUTH } from '../constants';
import type { User } from '../features/auth/authSlice';
import type { Profile } from '../features/auth/authSlice';

interface RefreshResponse {
  data: {
    accessToken: string;
    refreshToken: string;
  };
}

interface UserInfoResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    profiles: Profile[];
  };
}

const tokenStorage = {
  getAccessToken: () => localStorage.getItem('accessToken'),
  getRefreshToken: () => localStorage.getItem('refreshToken'),
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },
  clear: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};

const IMPERSONATION_ACTIVE_KEY = 'impersonationActive';
const IMPERSONATION_TOKEN_KEY = 'impersonationToken';
const IMPERSONATED_PROFILE_ID_KEY = 'impersonatedProfileId';

function isImpersonating(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(IMPERSONATION_ACTIVE_KEY) === 'true';
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${import.meta.env.VITE_API_URL}/api/v1`,
  prepareHeaders: (headers, { getState }) => {
    if (isImpersonating()) {
      const impersonationToken = localStorage.getItem(IMPERSONATION_TOKEN_KEY);
      const impersonatedProfileId = localStorage.getItem(IMPERSONATED_PROFILE_ID_KEY);
      if (impersonationToken) headers.set('authorization', `Bearer ${impersonationToken}`);
      if (impersonatedProfileId) headers.set('x-profile-id', impersonatedProfileId);
      return headers;
    }

    const tokenFromState = (getState() as RootState).auth.accessToken;
    const token = tokenFromState || tokenStorage.getAccessToken();
    if (token) headers.set('authorization', `Bearer ${token}`);

    const selectedProfileId = (getState() as RootState).auth.selectedProfile?._id;
    if (selectedProfileId) headers.set('x-profile-id', selectedProfileId);

    return headers;
  },
});

const SIGNED_URL_PATH = '/org-storage/signed-url';

function isSignedUrlRequest(args: string | FetchArgs): boolean {
  const url = typeof args === 'string' ? args : (args as FetchArgs).url ?? '';
  return typeof url === 'string' && url.includes(SIGNED_URL_PATH);
}

/** For signed-url we use redirect: 'manual' so we get the URL from the Location header instead of following the redirect. */
function maybeNoRedirectArgs(args: string | FetchArgs): string | FetchArgs {
  if (!isSignedUrlRequest(args)) return args;
  const withRedirect = { redirect: 'manual' as RequestRedirect };
  return typeof args === 'string'
    ? { url: args, ...withRedirect }
    : { ...args, ...withRedirect };
}

/** If the result is a redirect (301/302) from signed-url, return the Location URL as data. */
function unwrapRedirectResult(result: { data?: unknown; error?: unknown; meta?: { response?: Response } }): typeof result {
  const response = result.meta?.response;
  if (!response || (response.status !== 301 && response.status !== 302)) return result;
  const location = response.headers.get('Location');
  if (location) return { ...result, data: location, error: undefined };
  return result;
}

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const finalArgs = maybeNoRedirectArgs(args);
  let result = await rawBaseQuery(finalArgs, api, extraOptions);

  if (isSignedUrlRequest(args)) result = unwrapRedirectResult(result) as typeof result;

  if (result.error && result.error.status === 401) {
    const authState = (api.getState() as RootState).auth;
    
    // Check both state and localStorage for refresh token (state might be empty on page refresh)
    const refreshToken = authState.refreshToken || tokenStorage.getRefreshToken();

    if (!refreshToken) {
      // Capture current location before logout
      const currentPath = window.location.pathname + window.location.search;
      // Don't add 'from' param if already on an auth page to avoid redirect loops
      const isAuthPage = currentPath.startsWith(PATH_AUTH.root);
      api.dispatch(logout());
      // Redirect to signin with 'from' parameter
      const signinPath = !isAuthPage && currentPath
        ? `${PATH_AUTH.signin}?from=${encodeURIComponent(currentPath)}`
        : PATH_AUTH.signin;
      window.location.href = signinPath;
      return result;
    }

    // Get access token from state or localStorage
    const accessToken = authState.accessToken || tokenStorage.getAccessToken();

    // Call refresh directly instead of using authApi
    const refreshResult = await rawBaseQuery(
      {
        url: '/auth/refresh',
        method: 'POST',
        body: toFormData({
          accessToken: accessToken || '',
          refreshToken: refreshToken,
        }),
      },
      api,
      extraOptions
    );

    if (refreshResult.data) {
      const { accessToken, refreshToken } = (
        refreshResult.data as RefreshResponse
      ).data;
      tokenStorage.setTokens(accessToken, refreshToken);
      api.dispatch(setCredentials({ accessToken, refreshToken }));

      // Fetch updated user and profile data after token refresh
      // Use the newly refreshed token explicitly in headers
      try {
        const authState = (api.getState() as RootState).auth;
        const infoResult = await rawBaseQuery(
          {
            url: '/auth/info',
            method: 'POST',
            headers: {
              authorization: `Bearer ${accessToken}`,
              ...(authState.selectedProfile?._id && {
                'x-profile-id': authState.selectedProfile._id,
              }),
            },
          },
          api,
          extraOptions
        );
        
        if (infoResult.data && !infoResult.error) {
          const infoData = infoResult.data as UserInfoResponse;
          if (infoData.success) {
            const { user, profiles } = infoData.data;
            api.dispatch(
              setCredentials({
                profiles,
                user,
              })
            );
          }
        } else if (infoResult.error) {
          // Log error but don't fail the refresh operation
          console.error('Failed to fetch user info after refresh:', infoResult.error);
        }
      } catch (infoErr) {
        // Log error but don't fail the refresh operation
        console.error('Failed to fetch user info after refresh:', infoErr);
      }

      // retry original request
      result = await rawBaseQuery(finalArgs, api, extraOptions);
      if (isSignedUrlRequest(args)) result = unwrapRedirectResult(result) as typeof result;
    } else {
      // Capture current location before logout
      const currentPath = window.location.pathname + window.location.search;
      // Don't add 'from' param if already on an auth page to avoid redirect loops
      const isAuthPage = currentPath.startsWith(PATH_AUTH.root);
      tokenStorage.clear();
      api.dispatch(logout());
      // Redirect to signin with 'from' parameter
      const signinPath = !isAuthPage && currentPath
        ? `${PATH_AUTH.signin}?from=${encodeURIComponent(currentPath)}`
        : PATH_AUTH.signin;
      window.location.href = signinPath;
    }
  }

  return result;
};
