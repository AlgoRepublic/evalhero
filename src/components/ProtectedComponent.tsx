import React, { ReactNode } from 'react';
import { usePermission, useAnyPermission, useAllPermissions } from '../hooks/usePermission';

type ProtectedComponentProps = {
  children: ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  fallback?: ReactNode;
};

/**
 * Component that conditionally renders children based on user permissions
 * 
 * @example
 * // Single permission
 * <ProtectedComponent permission="organization::view">
 *   <OrganizationsPage />
 * </ProtectedComponent>
 * 
 * @example
 * // Multiple permissions (any)
 * <ProtectedComponent permissions={["organization::view", "organization::create"]}>
 *   <Button>Add Organization</Button>
 * </ProtectedComponent>
 * 
 * @example
 * // Multiple permissions (all required)
 * <ProtectedComponent permissions={["organization::view", "organization::edit"]} requireAll>
 *   <EditButton />
 * </ProtectedComponent>
 */
export const ProtectedComponent: React.FC<ProtectedComponentProps> = ({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback = null,
}) => {
  const hasSinglePermission = usePermission(permission || '');
  const hasAny = useAnyPermission(permissions || []);
  const hasAll = useAllPermissions(permissions || []);

  // Single permission check
  if (permission) {
    return hasSinglePermission ? <>{children}</> : <>{fallback}</>;
  }

  // Multiple permissions check
  if (permissions && permissions.length > 0) {
    const hasRequiredPermissions = requireAll ? hasAll : hasAny;
    return hasRequiredPermissions ? <>{children}</> : <>{fallback}</>;
  }

  // If no permission specified, render children (backward compatibility)
  return <>{children}</>;
};
