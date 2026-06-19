import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { hasPermission, hasAnyPermission, hasAllPermissions } from '../utils/rbac';

/**
 * Hook to check if the current user has a specific permission
 * @param permissionCode - The permission code to check (e.g., "organization::view")
 * @returns true if the user has the permission, false otherwise
 */
export function usePermission(permissionCode: string): boolean {
  const state = useSelector((state: RootState) => state);
  return hasPermission(permissionCode, state);
}

/**
 * Hook to check if the current user has any of the specified permissions
 * @param permissionCodes - Array of permission codes to check
 * @returns true if the user has at least one of the permissions, false otherwise
 */
export function useAnyPermission(permissionCodes: string[]): boolean {
  const state = useSelector((state: RootState) => state);
  return hasAnyPermission(permissionCodes, state);
}

/**
 * Hook to check if the current user has all of the specified permissions
 * @param permissionCodes - Array of permission codes to check
 * @returns true if the user has all of the permissions, false otherwise
 */
export function useAllPermissions(permissionCodes: string[]): boolean {
  const state = useSelector((state: RootState) => state);
  return hasAllPermissions(permissionCodes, state);
}

/**
 * Hook to get all permission codes for the current user
 * @returns Array of permission codes
 */
export function usePermissions(): string[] {
  const { selectedProfile } = useSelector((state: RootState) => state.auth);
  return selectedProfile?.permissionCodes || [];
}
