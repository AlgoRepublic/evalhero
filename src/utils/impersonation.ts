/**
 * LocalStorage keys and helpers for user impersonation (Super Admin feature).
 * See UI-IMPERSONATION.md for full flow.
 */

export const IMPERSONATION_KEYS = {
  active: 'impersonationActive',
  token: 'impersonationToken',
  userId: 'impersonatedUserId',
  profileId: 'impersonatedProfileId',
  userName: 'impersonatedUserName',
  userEmail: 'impersonatedUserEmail',
  originalAdminToken: 'originalAdminToken',
  originalAdminProfileId: 'originalAdminProfileId',
  originalAdminRefreshToken: 'originalAdminRefreshToken',
} as const;

const PERSIST_ROOT_KEY = 'persist:root';

export function isImpersonationActive(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(IMPERSONATION_KEYS.active) === 'true';
}

export function getImpersonatedDisplay(): { name: string; email: string } {
  if (typeof localStorage === 'undefined') return { name: '', email: '' };
  const name = localStorage.getItem(IMPERSONATION_KEYS.userName) ?? '';
  const email = localStorage.getItem(IMPERSONATION_KEYS.userEmail) ?? '';
  return { name, email };
}

export function setImpersonationState(data: {
  impersonationToken: string;
  targetUser: { _id: string; name?: string; email?: string; phone?: string | null };
  targetProfile: { _id: string };
  originalAccessToken: string;
  originalProfileId: string;
  originalRefreshToken?: string | null;
}): void {
  const {
    impersonationToken,
    targetUser,
    targetProfile,
    originalAccessToken,
    originalProfileId,
    originalRefreshToken,
  } = data;
  localStorage.setItem(IMPERSONATION_KEYS.token, impersonationToken);
  localStorage.setItem(IMPERSONATION_KEYS.userId, targetUser._id);
  localStorage.setItem(IMPERSONATION_KEYS.profileId, targetProfile._id);
  localStorage.setItem(IMPERSONATION_KEYS.userName, targetUser.name ?? '');
  localStorage.setItem(IMPERSONATION_KEYS.userEmail, targetUser.email ?? '');
  localStorage.setItem(IMPERSONATION_KEYS.active, 'true');
  localStorage.setItem(IMPERSONATION_KEYS.originalAdminToken, originalAccessToken);
  localStorage.setItem(IMPERSONATION_KEYS.originalAdminProfileId, originalProfileId);
  if (originalRefreshToken != null && originalRefreshToken !== '') {
    localStorage.setItem(IMPERSONATION_KEYS.originalAdminRefreshToken, originalRefreshToken);
  }
  // Use impersonation token as the main access token so after reload the app uses it
  localStorage.setItem('accessToken', impersonationToken);
}

/**
 * Minimal auth state to persist after ending impersonation so that on reload
 * the app doesn't redirect to signin/verify-otp (guards require user + otpVerified).
 * getUserInfo will replace user/profiles/selectedProfile after load.
 */
function getMinimalAuthPersistState(accessToken: string, refreshToken: string): string {
  const minimal = {
    user: {
      _id: '__restoring__',
      name: '',
      email: '',
      phone: null,
      isAdmin: false,
      deletedAt: null,
      createdAt: '',
      updatedAt: '',
    },
    accessToken,
    refreshToken,
    otpVerified: true,
    profiles: [],
    selectedProfile: null,
    permissions: [],
    permissionCodes: [],
  };
  return JSON.stringify(minimal);
}

/**
 * Restore admin tokens and clear impersonation. Writes a minimal auth state to
 * persist so on reload the app has valid tokens + otpVerified and a placeholder
 * user (getUserInfo will replace with real admin user) and doesn't redirect to
 * signin/verify-otp.
 */
export function clearImpersonationAndRestoreAdmin(): void {
  const originalToken = localStorage.getItem(IMPERSONATION_KEYS.originalAdminToken);
  const originalRefresh = localStorage.getItem(IMPERSONATION_KEYS.originalAdminRefreshToken);

  if (originalToken) localStorage.setItem('accessToken', originalToken);
  if (originalRefresh) localStorage.setItem('refreshToken', originalRefresh);

  // Write minimal auth state to persist so rehydration has tokens + otpVerified + placeholder user.
  // Route guards require user and otpVerified; getUserInfo will then replace user/profiles.
  try {
    const raw = localStorage.getItem(PERSIST_ROOT_KEY);
    if (raw && originalToken) {
      const payload = JSON.parse(raw) as { _persist?: { version: number; rehydrated?: boolean }; auth?: string; [key: string]: unknown };
      payload.auth = getMinimalAuthPersistState(originalToken, originalRefresh ?? '');
      localStorage.setItem(PERSIST_ROOT_KEY, JSON.stringify(payload));
    }
  } catch {
    // If parsing fails, leave persist as-is
  }

  Object.values(IMPERSONATION_KEYS).forEach((key) => localStorage.removeItem(key));
}
