import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { hasPermission, hasAnyPermission, hasAllPermissions } from '../utils/rbac';

/**
 * Protects a route so only admin users (user.isAdmin === true) can access.
 * Redirects to 403 if the current user is not an admin.
 */
export const AdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAdmin = useSelector((state: RootState) => state.auth.user?.isAdmin === true);
  if (!isAdmin) {
    return <Navigate to="/errors/403" replace />;
  }
  return <>{children}</>;
};

type PermissionProtectedRouteProps = {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
};

/**
 * Component that protects a route based on permissions
 * Redirects to 403 if user doesn't have required permissions
 */
export const PermissionProtectedRoute: React.FC<PermissionProtectedRouteProps> = ({
  children,
  permission,
  permissions,
  requireAll = false,
}) => {
  const state = useSelector((state: RootState) => state);

  // Single permission check
  if (permission) {
    if (!hasPermission(permission, state)) {
      return <Navigate to="/errors/403" replace />;
    }
  }

  // Multiple permissions check
  if (permissions && permissions.length > 0) {
    const hasRequiredPermissions = requireAll
      ? hasAllPermissions(permissions, state)
      : hasAnyPermission(permissions, state);

    if (!hasRequiredPermissions) {
      return <Navigate to="/errors/403" replace />;
    }
  }

  return <>{children}</>;
};
