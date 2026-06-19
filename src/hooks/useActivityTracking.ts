import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { addActivity } from '../utils/activityUtils';

/**
 * Hook to track user activities
 */
export function useActivityTracking() {
  const location = useLocation();

  // Track page navigation
  useEffect(() => {
    if (location.pathname) {
      const pageTitle = getPageTitle(location.pathname);
      addActivity({
        type: 'navigation',
        description: `Navigated to ${pageTitle}`,
        path: location.pathname,
      });
    }
  }, [location.pathname]);
}

/**
 * Get page title from path
 */
function getPageTitle(path: string): string {
  const titleMap: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/profile': 'Profile',
    '/users': 'Users',
    '/forms/templates': 'Form Templates',
    '/forms/global-templates': 'Global Templates',
    '/forms/config-sets': 'Quick Settings',
    '/forms/schedules': 'Form Schedules',
    '/forms/queues': 'Form Queues',
    '/chat': 'Chat',
    '/tags': 'Tags',
    '/courses-management/courses': 'Courses',
    '/courses-management/enrollments': 'Enrollments',
    '/knowledge-base': 'Knowledge Base',
  };

  if (titleMap[path]) {
    return titleMap[path];
  }

  // Try to match by prefix
  for (const [key, value] of Object.entries(titleMap)) {
    if (path.startsWith(key)) {
      return value;
    }
  }

  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ') || 'Home';
}
