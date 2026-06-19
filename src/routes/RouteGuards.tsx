import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { hasPermission } from '../utils/rbac';
import { PATH_AUTH } from '../constants';

type ProtectedRouteProps = {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  permission,
  permissions,
  requireAll = false,
}) => {
  const { user, otpVerified } = useSelector((state: RootState) => state.auth);
  const location = useLocation();
  const state = useSelector((state: RootState) => state);

  if (!user) {
    // Don't add 'from' param if already on an auth page to avoid redirect loops
    const isAuthPage = location.pathname.startsWith(PATH_AUTH.root);
    const currentPath = location.pathname + location.search;
    const signinPath = !isAuthPage && currentPath
      ? `${PATH_AUTH.signin}?from=${encodeURIComponent(currentPath)}`
      : PATH_AUTH.signin;
    return (
      <Navigate to={signinPath} replace />
    );
  }

  if (!otpVerified) {
    // Don't add 'from' param if already on an auth page to avoid redirect loops
    const isAuthPage = location.pathname.startsWith(PATH_AUTH.root);
    const currentPath = location.pathname + location.search;
    const otpPath = !isAuthPage && currentPath
      ? `${PATH_AUTH.verifyOtp}?from=${encodeURIComponent(currentPath)}`
      : PATH_AUTH.verifyOtp;
    return (
      <Navigate to={otpPath} replace />
    );
  }

  // Check permissions if specified
  if (permission) {
    if (!hasPermission(permission, state)) {
      return <Navigate to="/errors/403" replace />;
    }
  }

  if (permissions && permissions.length > 0) {
    const hasRequiredPermissions = requireAll
      ? permissions.every((perm) => hasPermission(perm, state))
      : permissions.some((perm) => hasPermission(perm, state));

    if (!hasRequiredPermissions) {
      return <Navigate to="/errors/403" replace />;
    }
  }

  return <Outlet />;
};

export const PublicRoute: React.FC = () => {
  const { user, otpVerified } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  if (user) {
    if (!otpVerified) {
      const isOtpRoute = location.pathname.includes('verify-otp');
      if (!isOtpRoute) {
        // Don't add 'from' param if already on an auth page to avoid redirect loops
        const isAuthPage = location.pathname.startsWith(PATH_AUTH.root);
        const currentPath = location.pathname + location.search;
        const otpPath = !isAuthPage && currentPath
          ? `${PATH_AUTH.verifyOtp}?from=${encodeURIComponent(currentPath)}`
          : PATH_AUTH.verifyOtp;
        return (
          <Navigate
            to={otpPath}
            replace
          />
        );
      }
      return <Outlet />;
    }
    // If user is logged in and OTP verified
    // If on verify-otp page, let the OtpPage component handle the redirect
    // Otherwise, redirect to dashboard or 'from' param
    const isOtpRoute = location.pathname.includes('verify-otp');
    if (isOtpRoute) {
      // Let OtpPage handle the redirect after OTP verification
      return <Outlet />;
    }
    // If user is on another auth page and OTP is verified, redirect
    const searchParams = new URLSearchParams(location.search);
    const fromParam = searchParams.get('from');
    let redirectPath = '/dashboard';
    
    if (fromParam) {
      try {
        const decodedPath = decodeURIComponent(fromParam);
        // Only redirect to internal paths (starting with /)
        // Prevent redirect to external URLs for security
        if (decodedPath.startsWith('/') && !decodedPath.startsWith('//')) {
          redirectPath = decodedPath;
        }
      } catch (e) {
        console.error('Error decoding from parameter:', e);
      }
    }
    
    return <Navigate to={redirectPath} replace />;
  }

  return <Outlet />;
};
