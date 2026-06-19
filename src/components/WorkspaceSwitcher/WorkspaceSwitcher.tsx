import React, { useMemo, useImperativeHandle, forwardRef } from 'react';
import {
  Select,
  Avatar,
  Typography,
  Space,
  Tag,
  theme,
} from 'antd';
import { CheckOutlined, TeamOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Profile } from '../../features/auth/authSlice';

const { Text } = Typography;

interface WorkspaceSwitcherProps {
  value?: string;
  onChange?: (profileId: string) => void;
  style?: React.CSSProperties;
  size?: 'small' | 'middle' | 'large';
  id?: string;
}

export interface WorkspaceSwitcherRef {
  open: () => void;
}

/**
 * Enhanced Workspace Switcher component
 */
export const WorkspaceSwitcher = forwardRef<WorkspaceSwitcherRef, WorkspaceSwitcherProps>(({
  value,
  onChange,
  style,
  size = 'middle',
  id,
}, ref) => {
  const { profiles, selectedProfile } = useSelector(
    (state: RootState) => state.auth
  );
  const currentTheme = useSelector((state: RootState) => state.theme.mytheme);
  const { token } = theme.useToken();

  // Get recent organizations (last 3)
  const recentOrganizations = useMemo(() => {
    try {
      const stored = localStorage.getItem('recent_organizations');
      if (!stored) return [];
      const recentIds: string[] = JSON.parse(stored);
      return recentIds
        .map((id) => profiles.find((p) => p._id === id))
        .filter((p): p is Profile => p !== undefined)
        .slice(0, 3);
    } catch {
      return [];
    }
  }, [profiles]);

  // Save to recent organizations
  const saveToRecent = (profileId: string) => {
    try {
      const stored = localStorage.getItem('recent_organizations');
      const recentIds: string[] = stored ? JSON.parse(stored) : [];
      const updated = [
        profileId,
        ...recentIds.filter((id) => id !== profileId),
      ].slice(0, 3);
      localStorage.setItem('recent_organizations', JSON.stringify(updated));
    } catch {
      // Ignore errors
    }
  };

  const handleChange = (profileId: string) => {
    saveToRecent(profileId);
    onChange?.(profileId);
  };

  const options = profiles.map((profile) => {
    const isRecent = recentOrganizations.some((p) => p._id === profile._id);
    const isSelected = profile._id === value || profile._id === selectedProfile?._id;

    return {
      value: profile._id,
      label: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 0',
          }}
        >
          <Space>
            <Avatar
              size="small"
              src={
                profile.organization?.icon
                  ? `${import.meta.env.VITE_API_URL}/${profile.organization.icon}`
                  : undefined
              }
              icon={<TeamOutlined />}
            />
            <div>
              <Text strong={isSelected} style={{ display: 'block' }}>
                {profile.organization?.name || 'Unknown Organization'}
              </Text>
            </div>
          </Space>
          <Space>
            {isRecent && (
              <Tag
                color="blue"
                style={{
                  fontSize: '10px',
                  margin: 0,
                  padding: '0 4px',
                }}
              >
                Recent
              </Tag>
            )}
            {isSelected && (
              <CheckOutlined
                style={{
                  color: token.colorPrimary,
                  fontSize: '14px',
                }}
              />
            )}
          </Space>
        </div>
      ),
    };
  });

  const selectRef = React.useRef<any>(null);
  const [open, setOpen] = React.useState<boolean | undefined>(undefined);
  const wasOpenedProgrammatically = React.useRef(false);
  const bodyScrollLockRef = React.useRef<{
    bodyOverflow: string;
    bodyOverflowY: string;
    htmlOverflow: string;
    htmlOverflowY: string;
  } | null>(null);

  // Lock/unlock body scroll based on open state - PRIMARY METHOD
  React.useEffect(() => {
    const isOpen = open === true;

    if (isOpen) {
      // Lock body scroll immediately when dropdown opens
      if (!bodyScrollLockRef.current) {
        const body = document.body;
        const html = document.documentElement;
        
        bodyScrollLockRef.current = {
          bodyOverflow: body.style.overflow,
          bodyOverflowY: body.style.overflowY,
          htmlOverflow: html.style.overflow,
          htmlOverflowY: html.style.overflowY,
        };

        // Apply to both body and html for maximum compatibility
        body.style.overflow = 'hidden';
        body.style.overflowY = 'hidden';
        html.style.overflow = 'hidden';
        html.style.overflowY = 'hidden';
      }
    } else {
      // Unlock body scroll when dropdown closes
      if (bodyScrollLockRef.current) {
        const body = document.body;
        const html = document.documentElement;
        const saved = bodyScrollLockRef.current;

        body.style.overflow = saved.bodyOverflow;
        body.style.overflowY = saved.bodyOverflowY;
        html.style.overflow = saved.htmlOverflow;
        html.style.overflowY = saved.htmlOverflowY;

        bodyScrollLockRef.current = null;
      }
    }

    return () => {
      // Cleanup: restore styles if component unmounts while open
      if (bodyScrollLockRef.current) {
        const body = document.body;
        const html = document.documentElement;
        const saved = bodyScrollLockRef.current;

        body.style.overflow = saved.bodyOverflow;
        body.style.overflowY = saved.bodyOverflowY;
        html.style.overflow = saved.htmlOverflow;
        html.style.overflowY = saved.htmlOverflowY;

        bodyScrollLockRef.current = null;
      }
    };
  }, [open]);

  // Prevent arrow keys from scrolling body - BACKUP METHOD
  React.useEffect(() => {
    const selectorId = id || 'workspace-switcher-select';

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
        return;
      }

      // Check if dropdown is open using both state and DOM
      const isOpen = open === true;
      const selectElement = document.querySelector(`#${selectorId}`) as HTMLElement;
      const isDropdownOpen = isOpen || 
        selectElement?.classList.contains('ant-select-open') ||
        document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)') !== null;

      if (!isDropdownOpen) {
        return;
      }

      const selectInput = selectElement?.querySelector('.ant-select-selection-search-input') as HTMLInputElement ||
        selectElement?.querySelector('input') as HTMLInputElement;
      
      // Check if the event target is the input or within the Select component
      const target = e.target as HTMLElement;
      const isEventOnSelect = 
        target === selectInput ||
        (selectInput && selectInput.contains(target)) ||
        (selectElement && selectElement.contains(target));

      // Only prevent default if event is NOT on the Select component
      // This allows Ant Design to handle navigation when input is focused
      if (!isEventOnSelect) {
        // Prevent default to stop scrolling
        e.preventDefault();
        
        // Focus the input so Ant Design can handle it
        if (selectInput && document.activeElement !== selectInput) {
          selectInput.focus({ preventScroll: true });
        }
      } else {
        // Event is on Select - prevent default to stop body scroll
        // but let the event continue so Ant Design can handle navigation
        e.preventDefault();
      }
    };

    // Use capture phase with highest priority
    window.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [id, open]);

  // Function to focus the Select input for keyboard navigation
  const focusSelectInput = React.useCallback(() => {
    const selectorId = id || 'workspace-switcher-select';
    const selectElement = document.querySelector(`#${selectorId}`) as HTMLElement;
    if (!selectElement) {
      // Retry if element not found yet
      setTimeout(() => focusSelectInput(), 50);
      return;
    }

    // Find the search input - this is critical for Ant Design Select keyboard navigation
    let input = selectElement.querySelector('.ant-select-selection-search-input') as HTMLInputElement;
    
    // Fallback: find input in the Select component
    if (!input) {
      input = selectElement.querySelector('input') as HTMLInputElement;
    }

    // If input not found, try again after a short delay
    if (!input) {
      setTimeout(() => focusSelectInput(), 50);
      return;
    }

    // Focus the input immediately
    if (input.isConnected) {
      try {
        // Focus with preventScroll to avoid any scrolling
        input.focus({ preventScroll: true });
        
        // Also try clicking to ensure it's active (for some browsers)
        input.click();
        
        // Set selection if possible
        if (typeof (input as any).setSelectionRange === 'function') {
          (input as any).setSelectionRange(0, 0);
        }
      } catch (e) {
        // Ignore focus errors, but retry
        setTimeout(() => {
          if (input.isConnected) {
            input.focus({ preventScroll: true });
          }
        }, 50);
      }
      
      // Clear any existing text to start fresh
      if (input.value) {
        input.value = '';
        // Trigger input event to ensure Select component is aware
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      // Verify focus was set and maintain it
      const verifyAndMaintainFocus = () => {
        if (input && input.isConnected) {
          const activeEl = document.activeElement;
          // If focus is not on input, refocus
          if (activeEl !== input) {
            input.focus({ preventScroll: true });
          }
        }
      };
      
      // Check and maintain focus multiple times
      setTimeout(verifyAndMaintainFocus, 10);
      setTimeout(verifyAndMaintainFocus, 50);
      setTimeout(verifyAndMaintainFocus, 100);
      setTimeout(verifyAndMaintainFocus, 200);
    }
  }, [id]);

  // Expose method to open dropdown programmatically
  useImperativeHandle(ref, () => ({
    open: () => {
      // Mark that we're opening programmatically
      wasOpenedProgrammatically.current = true;
      // Set open state to true to open the dropdown
      setOpen(true);
      
      // Try to focus immediately and with multiple retries
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        focusSelectInput();
        setTimeout(() => focusSelectInput(), 50);
        setTimeout(() => focusSelectInput(), 100);
        setTimeout(() => focusSelectInput(), 200);
        setTimeout(() => focusSelectInput(), 300);
      });
    },
  }), [focusSelectInput]);


  return (
    <Select
      ref={selectRef}
      id={id}
      value={value || selectedProfile?._id}
      onChange={handleChange}
      options={options}
      placeholder="Select Organization"
      style={style}
      size={size}
      showSearch
      open={open}
      onOpenChange={(visible) => {
        if (open !== undefined) {
          setOpen(visible);
        }
        
        // When dropdown becomes visible, ensure input is focused IMMEDIATELY for keyboard navigation
        if (visible) {
          // Use requestAnimationFrame to ensure dropdown is fully rendered
          requestAnimationFrame(() => {
            // Focus immediately
            focusSelectInput();
            
            // Use multiple attempts to ensure focus is set and stays set
            const focusAttempts = [10, 50, 100, 150, 200, 300, 400];
            focusAttempts.forEach((delay) => {
              setTimeout(() => {
                focusSelectInput();
              }, delay);
            });
          });
          
          // Also try after a longer delay as final fallback
          setTimeout(() => {
            focusSelectInput();
          }, 500);
          
          // Reset the flag
          if (wasOpenedProgrammatically.current) {
            wasOpenedProgrammatically.current = false;
          }
        }
      }}
      filterOption={(input, option) => {
        const profile = profiles.find((p) => p._id === option?.value);
        const orgName = profile?.organization?.name?.toLowerCase() || '';
        const roleName = profile?.roles?.[0]?.role?.toLowerCase() || '';
        const search = input.toLowerCase();
        return orgName.includes(search) || roleName.includes(search);
      }}
      optionRender={(option) => option.label}
      styles={{
        popup: {
          root: {
            backgroundColor:
              currentTheme === 'dark' ? token.colorBgElevated : '#fff',
          },
        },
      }}
    />
  );
});
