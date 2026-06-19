import { useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface PageHistoryItem {
  path: string;
  title: string;
  timestamp: number;
  icon?: string;
}

const MAX_HISTORY_ITEMS = 10;
const SESSION_STORAGE_KEY = 'page_history';

/**
 * Get page title from path
 */
const getPageTitle = (path: string): string => {
  const titleMap: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/profile': 'Profile',
    '/users': 'Users',
    '/forms/templates': 'Form Templates',
    '/forms/global-templates': 'Global Templates',
    '/forms/config-sets': 'Quick Settings',
    '/forms/config-sets/add': 'Add Quick Setting',
    '/forms/config-sets/edit': 'Edit Quick Setting',
    '/forms/schedules': 'Form Schedules',
    '/forms/queues': 'Form Queues',
    '/chat': 'Chat',
    '/tags': 'Tags',
    '/courses-management/courses': 'Courses',
    '/courses-management/enrollments': 'Enrollments',
    '/knowledge-base': 'Knowledge Base',
  };

  // Try exact match first
  if (titleMap[path]) {
    return titleMap[path];
  }

  // Try to match by prefix
  for (const [key, value] of Object.entries(titleMap)) {
    if (path.startsWith(key)) {
      return value;
    }
  }

  // Fallback: capitalize path segments
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ') || 'Home';
};

/**
 * Hook to manage page history
 */
export function usePageHistory() {
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * Get page history from sessionStorage
   */
  const getHistory = useCallback((): PageHistoryItem[] => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return [];
      const history: PageHistoryItem[] = JSON.parse(stored);
      
      // Filter out pages user no longer has access to
      return history.filter(() => {
        // Basic permission check - you may need to enhance this
        // For now, we'll keep all items as permission checking is complex
        return true;
      });
    } catch (error) {
      console.error('Error reading page history:', error);
      return [];
    }
  }, []);

  /**
   * Add page to history
   */
  const addToHistory = useCallback(
    (path: string, title?: string) => {
      try {
        const history = getHistory();
        const pageTitle = title || getPageTitle(path);

        // Remove if already exists
        const filtered = history.filter((item) => item.path !== path);

        // Add to beginning
        const newHistory: PageHistoryItem[] = [
          {
            path,
            title: pageTitle,
            timestamp: Date.now(),
          },
          ...filtered,
        ].slice(0, MAX_HISTORY_ITEMS);

        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newHistory));
      } catch (error) {
        console.error('Error saving page history:', error);
      }
    },
    [getHistory]
  );

  /**
   * Clear history
   */
  const clearHistory = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing page history:', error);
    }
  }, []);

  /**
   * Navigate to a page from history
   */
  const navigateToHistoryItem = useCallback(
    (item: PageHistoryItem) => {
      navigate(item.path);
      addToHistory(item.path, item.title);
    },
    [navigate, addToHistory]
  );

  // Track current page
  useEffect(() => {
    if (location.pathname) {
      addToHistory(location.pathname);
    }
  }, [location.pathname, addToHistory]);

  return {
    history: getHistory(),
    addToHistory,
    clearHistory,
    navigateToHistoryItem,
  };
}
