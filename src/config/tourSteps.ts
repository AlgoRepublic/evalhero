import { TourProps } from 'antd';
import { PATH_FORMS, PATH_CHAT, PATH_TAGS, PATH_COURSES, PATH_KNOWLEDGE_BASE, PATH_CALENDAR, PATH_ANALYTICS } from '../constants/routes';

type TourStepBase = NonNullable<TourProps['steps']>[0];

export interface TourStepConfig extends Omit<TourStepBase, 'target'> {
  // Override target to allow string selectors and functions that return null
  target?: string | HTMLElement | (() => HTMLElement | null) | (() => HTMLElement);
  requiresNavigation?: boolean;
  targetPath?: string;
  waitForSelector?: string;
  expandParentMenu?: string; // Key of parent menu to expand (e.g., 'forms', 'courses-management')
  requiredPermission?: string; // Permission required to show this step (e.g., 'user::view')
  requiredPermissions?: string[]; // Multiple permissions (user needs at least one)
  requireAllPermissions?: boolean; // If true, user needs all permissions in requiredPermissions array
  requiresAdmin?: boolean; // If true, step is shown only for admin users
}

export interface TourStepsOptions {
  navigateToPage: (path: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  isAdmin: boolean;
}

export const getTourSteps = (options: TourStepsOptions): TourStepConfig[] => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isAdmin } = options;

  const getMenuTarget = (...keys: string[]) => () => {
    for (const key of keys) {
      const element =
        document.querySelector(`[data-tour="menu-item-${key}"]`) ||
        document.querySelector(`a[href="${key}"]`) ||
        document.querySelector(`.ant-menu-item[data-menu-id*="${key}"]`);
      if (element) return element as HTMLElement;
    }
    return null;
  };

  const allSteps: TourStepConfig[] = [
    // Step 1: Welcome and Overview
    {
      target: 'body',
      title: 'Welcome to the Website Tour!',
      description: 'This tour will guide you through all the main features of the application. Click Next to continue or Skip to exit.',
      placement: 'center',
      mask: true,
    },
    // Step 2: Sidebar Navigation
    {
      target: '[data-tour="sidebar"]',
      title: 'Navigation Sidebar',
      description: 'Use the sidebar to navigate between different sections of the application. You can collapse it on desktop or access it via the menu button on mobile.',
      placement: 'right',
    },
    // Step 3: Organization Selector
    {
      target: '[data-tour="org-selector"]',
      title: 'Organization Selector',
      description: 'Switch between different organizations you belong to. Your data and permissions may vary based on the selected organization.',
      placement: 'bottom',
    },
    // Step 4: Header Actions
    {
      target: '[data-tour="header-actions"]',
      title: 'Header Actions',
      description: 'Access recent pages, smart search, activity timeline, accessibility tools, sidebar customization, sync data, theme toggle, and profile management from the header.',
      placement: 'bottom',
    },
     // Step 5: Profile
     {
      target: getMenuTarget('/profile'),
      title: 'Profile',
      description: 'Access and manage your personal profile information, preferences, and account settings.',
      placement: 'right',
      requiresNavigation: true,
      targetPath: '/profile',
    },
    // Step 6: Dashboard
    {
      target: getMenuTarget('/dashboard'),
      title: 'Dashboard',
      description: 'The dashboard provides an overview of your organization, including user management, roles, departments, and locations.',
      placement: 'right',
      requiresNavigation: true,
      targetPath: "/dashboard",
      waitForSelector: '[data-tour="dashboard-content"]',
    },
    // {
    //   target: '[data-tour="dashboard-content"]',
    //   title: 'Dashboard Overview',
    //   description: 'Here you can manage organizations, invite users, configure roles and departments, and view important information at a glance.',
    //   placement: 'left',
    // },
     // Step 7: Analytics (if accessible)
     {
      target: getMenuTarget(PATH_ANALYTICS.root, '/analytics'),
      title: 'Analytics',
      description: 'Track key metrics and trends with analytics dashboards for better decision making.',
      placement: 'right',
      requiresNavigation: true,
      targetPath: PATH_ANALYTICS.root,
      requiresAdmin: true,
    },
    // Step 8: Users (if accessible)
    {
      target: getMenuTarget('/users'),
      title: 'User Management',
      description: 'View and manage all users in your organization. You can see user details, roles, and permissions.',
      placement: 'right',
      requiresNavigation: true,
      targetPath: '/users',
      requiredPermission: 'user::view',
    },
    // Step 9: Chat
    {
      target: getMenuTarget(PATH_CHAT.root, '/chat'),
      title: 'Chat',
      description: 'Communicate with team members through real-time chat. Create channels, send messages, and collaborate effectively.',
      placement: 'right',
      requiresNavigation: true,
      targetPath: PATH_CHAT.root,
    },
    // Step 10: Calendar
    {
      target: getMenuTarget(PATH_CALENDAR.root, '/calendar'),
      title: 'Calendar',
      description: 'Plan and track events, schedules, and important dates from the calendar workspace.',
      placement: 'right',
      requiresNavigation: true,
      targetPath: PATH_CALENDAR.root,
    },
    // Step 11: Tags (if accessible)
    {
      target: getMenuTarget(PATH_TAGS.root, '/tags'),
      title: 'Tags',
      description: 'Organize and categorize content using tags. Tags help you filter, search, and group related items across the platform.',
      placement: 'right',
      requiresNavigation: true,
      targetPath: PATH_TAGS.root,
      requiredPermission: 'tag::view',
    },
    // Step 12: Knowledge Base (if accessible)
    {
      target: getMenuTarget(PATH_KNOWLEDGE_BASE.root, '/knowledge-base'),
      title: 'Knowledge Base',
      description: 'Store and organize documents, articles, and resources in folders. Create a centralized repository of information for your team.',
      placement: 'right',
      requiresNavigation: true,
      targetPath: PATH_KNOWLEDGE_BASE.root,
      requiredPermission: 'knowledgebase::view',
    },
    // Step 13: Courses Management (if accessible)
    {
      target: () => {
        // Try to find the Courses submenu
        const submenu = Array.from(document.querySelectorAll('.ant-menu-submenu-title')).find(
          (el) => el.textContent?.includes('Courses')
        ) as HTMLElement | undefined;
        const element =
          document.querySelector('[data-tour="menu-item-courses-management"]') ||
          submenu ||
          document.querySelector('.ant-menu-submenu[title*="Courses"]');
        return element as HTMLElement | null;
      },
      title: 'Courses Management',
      description: 'Manage courses and enrollments. Create educational content, track progress, and manage student enrollments.',
      placement: 'right',
      expandParentMenu: 'courses-management', // Expand Courses menu when this step is shown
      requiredPermission: 'course::view',
    },
    {
      target: getMenuTarget(PATH_COURSES.courses, '/courses-management/courses'),
      title: 'Courses',
      description: 'Create and manage courses with pages, content, and progression logic. Set up learning paths for your organization.',
      placement: 'right',
      requiresNavigation: true,
      targetPath: PATH_COURSES.courses,
      expandParentMenu: 'courses-management',
      requiredPermission: 'course::view',
    },
    {
      target: getMenuTarget(PATH_COURSES.enrollments, '/courses-management/enrollments'),
      title: 'Enrollments',
      description: 'View and manage course enrollments. Track student progress, assign roles, and monitor completion status.',
      placement: 'right',
      requiresNavigation: true,
      targetPath: PATH_COURSES.enrollments,
      expandParentMenu: 'courses-management',
      requiredPermission: 'course::view',
    },
    {
      target: getMenuTarget(PATH_COURSES.approvals, '/courses-management/approvals'),
      title: 'Course Approvals',
      description: 'Review and approve course-related submissions and requests from one place.',
      placement: 'right',
      requiresNavigation: true,
      targetPath: PATH_COURSES.approvals,
      expandParentMenu: 'courses-management',
      requiredPermission: 'course::view',
    },
    // Step 14: Forms - Templates
    {
      target: () => {
        // Try to find the Forms submenu
        const submenu = Array.from(document.querySelectorAll('.ant-menu-submenu-title')).find(
          (el) => el.textContent?.includes('Forms')
        ) as HTMLElement | undefined;
        const element =
          document.querySelector('[data-tour="menu-item-forms"]') ||
          submenu ||
          document.querySelector('.ant-menu-submenu[title*="Forms"]');
        return element as HTMLElement | null;
      },
      title: 'Forms Section',
      description: 'The Forms section contains Templates, Global Templates, Quick Settings, Schedules, and My Forms. Click to expand and see the options.',
      placement: 'right',
      expandParentMenu: 'forms', // Expand Forms menu when this step is shown
      requiredPermissions: ['formtemplate::view', 'configset::view', 'schedule::view', 'queue::view', 'queue::viewall'], // Show if user has any form permission
    },
    {
      target: getMenuTarget(PATH_FORMS.templates, '/forms/templates'),
      title: 'Form Templates',
      description: 'Create and manage form templates that can be reused across your organization. Templates define the structure and fields of your forms.',
      placement: 'right',
      requiresNavigation: true,
      targetPath: PATH_FORMS.templates,
      expandParentMenu: 'forms',
      requiredPermission: 'formtemplate::view',
    },
    {
      target: getMenuTarget(PATH_FORMS.globalTemplates, '/forms/global-templates'),
      title: 'Global Templates',
      description: 'Access organization-wide templates managed at admin level for standardization.',
      placement: 'right',
      requiresNavigation: true,
      targetPath: PATH_FORMS.globalTemplates,
      expandParentMenu: 'forms',
      requiresAdmin: true,
    },
    {
      target: getMenuTarget(PATH_FORMS.configSets, '/forms/config-sets'),
      title: 'Quick Settings',
      description: 'Manage reusable configuration sets to speed up form setup and keep standards consistent.',
      placement: 'right',
      requiresNavigation: true,
      targetPath: PATH_FORMS.configSets,
      expandParentMenu: 'forms',
      requiredPermission: 'configset::view',
    },
    // Step 15: Forms - Schedules
    {
      target: getMenuTarget(PATH_FORMS.schedules, '/forms/schedules'),
      title: 'Form Schedules',
      description: 'Schedule forms to be sent automatically at specific times or intervals. Great for recurring assessments and surveys.',
      placement: 'right',
      requiresNavigation: true,
      targetPath: PATH_FORMS.schedules,
      expandParentMenu: 'forms',
      requiredPermission: 'schedule::view',
    },
    // Step 16: Forms - Queues
    {
      target: getMenuTarget(PATH_FORMS.queues, '/forms/queues'),
      title: 'My Forms',
      description: 'View and manage forms assigned to you, including submission status, reviews, and follow-up actions.',
      placement: 'right',
      requiresNavigation: true,
      targetPath: PATH_FORMS.queues,
      expandParentMenu: 'forms',
      requiredPermissions: ['queue::view', 'queue::viewall'],
    },
    // Step 15: Recent Pages
    // {
    //   target: '[data-tour="recent-pages"]',
    //   title: 'Recent Pages',
    //   description: 'Quickly access your recently visited pages. Click to see your browsing history and navigate back to pages you\'ve visited.',
    //   placement: 'bottom',
    // },
    // Step 17: Smart Search
    {
      target: '[data-tour="smart-search"]',
      title: 'Smart Search',
      description: 'Quickly find anything in the application using smart search. Press Ctrl+K or click here to open the search. Search for pages, features, and content.',
      placement: 'bottom',
    },
    // Step 18: Activity Timeline
    {
      target: '[data-tour="activity-timeline"]',
      title: 'Activity Timeline',
      description: 'View your activity history and track what you\'ve been working on. See a timeline of your recent actions and interactions.',
      placement: 'bottom',
    },
    // Step 19: Accessibility Checker
    {
      target: '[data-tour="accessibility-checker"]',
      title: 'Accessibility Checker',
      description: 'Check and improve the accessibility of the current page. Get suggestions for better color contrast, keyboard navigation, and screen reader support.',
      placement: 'bottom',
    },
    // Step 20: Sidebar Customizer
    {
      target: '[data-tour="sidebar-customizer"]',
      title: 'Sidebar Customizer',
      description: 'Customize your sidebar navigation. Hide, reorder, or pin menu items to create a personalized navigation experience that suits your workflow.',
      placement: 'bottom',
    },
    // Step 21: Notifications
    {
      target: '[data-tour="notifications"]',
      title: 'Notifications',
      description: 'Check alerts and updates so you can quickly respond to changes that need your attention.',
      placement: 'bottom',
    },
    // Step 22: Sync Data
    {
      target: '[data-tour="sync-data"]',
      title: 'Sync Data',
      description: 'Manually sync your data to get the latest information from the server. Useful when you need to refresh your data or after making changes elsewhere.',
      placement: 'bottom',
    },
    // Step 23: Theme Toggle
    {
      target: '[data-tour="theme-toggle"]',
      title: 'Theme Toggle',
      description: 'Switch between light and dark themes to match your preference. The theme preference is saved automatically.',
      placement: 'bottom',
    },
    // Step 24: Profile Dropdown
    {
      target: '[data-tour="profile"]',
      title: 'Profile Menu',
      description: 'Access your profile, account settings, and logout option. Click on your avatar to open the menu.',
      placement: 'bottom',
    },
    // Step 25: Final Step
    {
      target: 'body',
      title: 'Tour Complete!',
      description: "You've completed the tour! You can restart it anytime by clicking the demo button. Explore the features and enjoy using the application.",
      placement: 'center',
      mask: true,
    },
  ];

  // Filter steps based on permissions
  return allSteps.filter((step) => {
    // If step requires admin access
    if (step.requiresAdmin) {
      return isAdmin;
    }

    // If step has a single required permission
    if (step.requiredPermission) {
      return hasPermission(step.requiredPermission);
    }
    
    // If step has multiple required permissions
    if (step.requiredPermissions && step.requiredPermissions.length > 0) {
      if (step.requireAllPermissions) {
        return hasAllPermissions(step.requiredPermissions);
      } else {
        return hasAnyPermission(step.requiredPermissions);
      }
    }
    
    // If no permission requirement, show the step
    return true;
  });
};
