import { RootState } from '../store';

/**
 * Check if the current user is an admin
 * @param state - The Redux root state
 * @returns true if the user is an admin, false otherwise
 */
function isUserAdmin(state: RootState): boolean {
  const { user, selectedProfile } = state.auth;

  // Check if user is admin
  if (user?.isAdmin) {
    return true;
  }

  // Check if selectedProfile's user is admin
  if (selectedProfile?.user && typeof selectedProfile.user === 'object') {
    return selectedProfile.user.isAdmin === true;
  }

  return false;
}

/**
 * Check if the current user has a specific permission
 * @param permissionCode - The permission code to check (e.g., "organization::view")
 * @param state - The Redux root state
 * @returns true if the user has the permission, false otherwise
 */
export function hasPermission(
  permissionCode: string,
  state: RootState
): boolean {
  // Admin users have all permissions
  if (isUserAdmin(state)) {
    return true;
  }

  const { selectedProfile } = state.auth;

  if (!selectedProfile?.permissionCodes) {
    return false;
  }

  return selectedProfile?.permissionCodes?.includes(permissionCode);
}

/**
 * Check if the current user has any of the specified permissions
 * @param permissionCodes - Array of permission codes to check
 * @param state - The Redux root state
 * @returns true if the user has at least one of the permissions, false otherwise
 */
export function hasAnyPermission(
  permissionCodes: string[],
  state: RootState
): boolean {
  // Admin users have all permissions
  if (isUserAdmin(state)) {
    return true;
  }

  const { selectedProfile } = state.auth;

  if (!selectedProfile?.permissionCodes) {
    return false;
  }

  return permissionCodes.some((code) =>
    selectedProfile.permissionCodes.includes(code)
  );
}

/**
 * Check if the current user has all of the specified permissions
 * @param permissionCodes - Array of permission codes to check
 * @param state - The Redux root state
 * @returns true if the user has all of the permissions, false otherwise
 */
export function hasAllPermissions(
  permissionCodes: string[],
  state: RootState
): boolean {
  // Admin users have all permissions
  if (isUserAdmin(state)) {
    return true;
  }

  const { selectedProfile } = state.auth;

  if (!selectedProfile?.permissionCodes) {
    return false;
  }

  return permissionCodes.every((code) =>
    selectedProfile.permissionCodes.includes(code)
  );
}

// Legacy function for backward compatibility
export function hasPerm(): boolean {
  return true;
}

export function isMember(): boolean {
  return true;
}
