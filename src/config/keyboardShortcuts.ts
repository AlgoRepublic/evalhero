import { KeyboardShortcut } from '../components/KeyboardShortcuts/KeyboardShortcuts';

export interface ShortcutCategory {
  name: string;
  shortcuts: KeyboardShortcut[];
}

/**
 * Get all keyboard shortcuts based on user permissions
 */
export const getKeyboardShortcuts = (
  hasPermission: (permission: string) => boolean
): ShortcutCategory[] => {
  const categories: ShortcutCategory[] = [
    {
      name: 'Navigation',
      shortcuts: [
        {
          keys: ['Ctrl', 'K'],
          description: 'Open command palette',
          action: 'command-palette',
        },
        {
          keys: ['Ctrl', '/'],
          description: 'Show keyboard shortcuts',
          action: 'show-shortcuts',
        },
        // COMMENTED OUT: Change organization feature with shortcut is disabled
        // {
        //   keys: ['Ctrl', 'Shift', 'O'],
        //   description: 'Switch workspace',
        //   action: 'switch-workspace',
        // },
      ],
    },
    {
      name: 'General',
      shortcuts: [
        {
          keys: ['Ctrl', 'B'],
          description: 'Toggle sidebar',
          action: 'toggle-sidebar',
        },
        {
          keys: ['Ctrl', 'Shift', 'D'],
          description: 'Toggle theme',
          action: 'toggle-theme',
        },
        {
          keys: ['Ctrl', 'R'],
          description: 'Sync data',
          action: 'sync-data',
        },
        {
          keys: ['F11'],
          description: 'Toggle fullscreen',
          action: 'toggle-fullscreen',
        },
      ],
    },
  ];

  // Add permission-based shortcuts
  const permissionShortcuts: KeyboardShortcut[] = [];

  // COMMENTED OUT: Change organization feature with shortcut is disabled
  // if (hasPermission('organization::view')) {
  //   permissionShortcuts.push({
  //     keys: ['Ctrl', 'Shift', 'O'],
  //     description: 'Switch organization',
  //     action: 'switch-organization',
  //   });
  // }

  if (hasPermission('form::view')) {
    permissionShortcuts.push({
      keys: ['Ctrl', 'F'],
      description: 'Go to Forms',
      action: 'navigate-forms',
    });
  }

  if (hasPermission('user::view')) {
    permissionShortcuts.push({
      keys: ['Ctrl', 'U'],
      description: 'Go to Users',
      action: 'navigate-users',
    });
  }

  if (permissionShortcuts.length > 0) {
    categories.push({
      name: 'Actions',
      shortcuts: permissionShortcuts,
    });
  }

  return categories;
};
