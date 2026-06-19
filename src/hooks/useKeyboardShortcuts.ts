import { useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { toggleTheme } from '../features/theme/themeSlice';

// interface ShortcutAction {
//   action: string;
//   handler: () => void;
// }

/**
 * Hook to handle keyboard shortcuts globally
 */
export function useKeyboardShortcuts(
  onShowShortcuts: () => void,
  onOpenCommandPalette: () => void,
  onSwitchWorkspace?: () => void,
  onSyncData?: () => void,
  onToggleSidebar?: () => void
) {
  const dispatch = useDispatch();

  const handleShortcut = useCallback(
    (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      // Don't trigger if user is typing in an input or if a Select dropdown is open
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }
      
      // Also don't trigger if a Select dropdown is open (allow arrow keys to work)
      // Check for workspace switcher dropdown specifically
      const selectorId = 'workspace-switcher-select';
      const selectElement = document.querySelector(`#${selectorId}`) as HTMLElement;
      const isWorkspaceSelectOpen = selectElement?.classList.contains('ant-select-open') ||
        document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)') !== null;
      
      if (isWorkspaceSelectOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape')) {
        // Don't prevent default here - let the WorkspaceSwitcher component handle it
        // This prevents conflicts between handlers
        return;
      }

      // Ctrl+K or Cmd+K - Command Palette (only if not in input)
      if (ctrlKey && e.key === 'k' && !e.shiftKey) {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      // Ctrl+/ or Cmd+/ - Show Shortcuts
      if (ctrlKey && e.key === '/') {
        e.preventDefault();
        onShowShortcuts();
        return;
      }

      // Ctrl+Shift+O or Cmd+Shift+O - Switch Workspace
      // COMMENTED OUT: Change organization feature with shortcut is disabled
      // Handle both uppercase and lowercase 'O'
      // if (ctrlKey && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
      //   e.preventDefault();
      //   onSwitchWorkspace?.();
      //   return;
      // }

      // Ctrl+B or Cmd+B - Toggle Sidebar
      if (ctrlKey && e.key === 'b') {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }

      // Ctrl+Shift+D or Cmd+Shift+D - Toggle Theme
      if (ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        dispatch(toggleTheme());
        return;
      }

      // Ctrl+R or Cmd+R - Sync Data (prevent default browser refresh)
      if (ctrlKey && e.key === 'r' && !e.shiftKey) {
        e.preventDefault();
        onSyncData?.();
        return;
      }

      // F11 - Toggle Fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {
            // Ignore errors
          });
        } else {
          document.exitFullscreen().catch(() => {
            // Ignore errors
          });
        }
        return;
      }
    },
    [
      onShowShortcuts,
      onOpenCommandPalette,
      onSwitchWorkspace,
      onSyncData,
      onToggleSidebar,
      dispatch,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [handleShortcut]);
}
