import React from 'react';
import {
  DashboardOutlined,
  UserOutlined,
  FormOutlined,
  MessageOutlined,
  TagsOutlined,
  BookOutlined,
  FolderOpenOutlined,
  SyncOutlined,
  SunOutlined,
  PlayCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { PATH_FORMS, PATH_CHAT, PATH_TAGS, PATH_COURSES, PATH_KNOWLEDGE_BASE } from '../constants/routes';

export interface Command {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  category: 'navigation' | 'action' | 'quick';
  action: () => void;
  keywords: string[];
  permission?: string;
}

export interface CommandGroup {
  name: string;
  commands: Command[];
}

/**
 * Get all commands based on user permissions
 */
export const getCommands = (
  navigate: (path: string) => void,
  hasPermission: (permission: string) => boolean,
  actions: {
    toggleTheme: () => void;
    syncData: () => void;
    startTour: () => void;
    switchWorkspace?: () => void;
  }
): CommandGroup[] => {
  const groups: CommandGroup[] = [];

  // Navigation commands
  const navigationCommands: Command[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      description: 'Go to dashboard',
      icon: React.createElement(DashboardOutlined),
      category: 'navigation',
      action: () => navigate('/dashboard'),
      keywords: ['dashboard', 'home', 'main'],
    },
    {
      id: 'profile',
      title: 'Profile',
      description: 'View your profile',
      icon: React.createElement(UserOutlined),
      category: 'navigation',
      action: () => navigate('/profile'),
      keywords: ['profile', 'user', 'account', 'settings'],
    },
  ];

  if (hasPermission('user::view')) {
    navigationCommands.push({
      id: 'users',
      title: 'Users',
      description: 'Manage users',
      icon: React.createElement(TeamOutlined),
      category: 'navigation',
      action: () => navigate('/users'),
      keywords: ['users', 'user management', 'team'],
      permission: 'user::view',
    });
  }

  if (hasPermission('form::view')) {
    navigationCommands.push(
      {
        id: 'forms-templates',
        title: 'Form Templates',
        description: 'Manage form templates',
        icon: React.createElement(FormOutlined),
        category: 'navigation',
        action: () => navigate(PATH_FORMS.templates),
        keywords: ['forms', 'templates', 'form templates'],
        permission: 'form::view',
      },
      {
        id: 'forms-schedules',
        title: 'Form Schedules',
        description: 'Manage form schedules',
        icon: React.createElement(FormOutlined),
        category: 'navigation',
        action: () => navigate(PATH_FORMS.schedules),
        keywords: ['forms', 'schedules', 'form schedules'],
        permission: 'form::view',
      }
    );
  }

  if (hasPermission('queue::view') || hasPermission('queue::viewall')) {
    navigationCommands.push({
      id: 'forms-queues',
      title: 'Form Queues',
      description: 'Manage form queues',
      icon: React.createElement(FormOutlined),
      category: 'navigation',
      action: () => navigate(PATH_FORMS.queues),
      keywords: ['forms', 'queues', 'form queues'],
      permission: 'queue::view',
    });
  }

  navigationCommands.push({
    id: 'chat',
    title: 'Chat',
    description: 'Open chat',
    icon: React.createElement(MessageOutlined),
    category: 'navigation',
    action: () => navigate(PATH_CHAT.root),
    keywords: ['chat', 'messages', 'communication'],
  });

  if (hasPermission('tag::view')) {
    navigationCommands.push({
      id: 'tags',
      title: 'Tags',
      description: 'Manage tags',
      icon: React.createElement(TagsOutlined),
      category: 'navigation',
      action: () => navigate(PATH_TAGS.root),
      keywords: ['tags', 'tag management'],
      permission: 'tag::view',
    });
  }

  if (hasPermission('course::view')) {
    navigationCommands.push({
      id: 'courses',
      title: 'Courses',
      description: 'Manage courses',
      icon: React.createElement(BookOutlined),
      category: 'navigation',
      action: () => navigate(PATH_COURSES.courses),
      keywords: ['courses', 'course management', 'learning'],
      permission: 'course::view',
    });
  }

  if (hasPermission('knowledgeBase::view')) {
    navigationCommands.push({
      id: 'knowledge-base',
      title: 'Knowledge Base',
      description: 'Browse knowledge base',
      icon: React.createElement(FolderOpenOutlined),
      category: 'navigation',
      action: () => navigate(PATH_KNOWLEDGE_BASE.root),
      keywords: ['knowledge base', 'kb', 'docs', 'documentation'],
      permission: 'knowledgeBase::view',
    });
  }

  if (navigationCommands.length > 0) {
    groups.push({
      name: 'Navigation',
      commands: navigationCommands,
    });
  }

  // Action commands
  const actionCommands: Command[] = [
    {
      id: 'sync-data',
      title: 'Sync Data',
      description: 'Refresh and sync all data',
      icon: React.createElement(SyncOutlined),
      category: 'action',
      action: actions.syncData,
      keywords: ['sync', 'refresh', 'reload', 'update'],
    },
    {
      id: 'toggle-theme',
      title: 'Toggle Theme',
      description: 'Switch between light and dark mode',
      icon: React.createElement(SunOutlined),
      category: 'action',
      action: actions.toggleTheme,
      keywords: ['theme', 'dark mode', 'light mode', 'toggle theme'],
    },
    {
      id: 'start-tour',
      title: 'Start Tour',
      description: 'Begin the application tour',
      icon: React.createElement(PlayCircleOutlined),
      category: 'action',
      action: actions.startTour,
      keywords: ['tour', 'guide', 'help', 'onboarding'],
    },
  ];

  // COMMENTED OUT: Change organization feature with shortcut is disabled
  // if (actions.switchWorkspace) {
  //   actionCommands.push({
  //     id: 'switch-workspace',
  //     title: 'Switch Workspace',
  //     description: 'Change organization',
  //     icon: React.createElement(TeamOutlined),
  //     category: 'action',
  //     action: actions.switchWorkspace,
  //     keywords: ['workspace', 'organization', 'switch org'],
  //   });
  // }

  groups.push({
    name: 'Actions',
    commands: actionCommands,
  });

  return groups;
};
