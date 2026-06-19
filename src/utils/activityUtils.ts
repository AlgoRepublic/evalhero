export type ActivityType =
  | 'navigation'
  | 'action'
  | 'form'
  | 'settings'
  | 'organization'
  | 'impersonation';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  description: string;
  timestamp: number;
  path?: string;
  icon?: string;
  /** Optional metadata (e.g. impersonated user name, target path) */
  meta?: Record<string, string>;
}

const SESSION_STORAGE_KEY = 'activity_timeline';
const MAX_ACTIVITIES = 50;

/**
 * Get activities from sessionStorage
 */
export function getActivities(): ActivityItem[] {
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Add activity to timeline
 */
export function addActivity(activity: Omit<ActivityItem, 'id' | 'timestamp'>): void {
  try {
    const activities = getActivities();
    const newActivity: ActivityItem = {
      ...activity,
      id: `activity-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };

    const updated = [newActivity, ...activities].slice(0, MAX_ACTIVITIES);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving activity:', error);
  }
}

/**
 * Clear all activities
 */
export function clearActivities(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing activities:', error);
  }
}

/**
 * Filter activities by type
 */
export function filterActivitiesByType(
  activities: ActivityItem[],
  type: ActivityType
): ActivityItem[] {
  return activities.filter((activity) => activity.type === type);
}
