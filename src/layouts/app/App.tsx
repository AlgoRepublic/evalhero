import {
  Button,
  Dropdown,
  Drawer,
  Flex,
  FloatButton,
  Grid,
  Layout,
  MenuProps,
  message,
  theme,
  Tooltip,
  Typography,
  Switch,
  Tour,
} from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import React, { ReactNode, useRef, useState, useEffect } from 'react';
import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  // QuestionOutlined,
  // SettingOutlined,
  UserOutlined,
  MoonOutlined,
  SunOutlined,
  SyncOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import {
  CSSTransition,
  SwitchTransition,
  TransitionGroup,
} from 'react-transition-group';
import SideNav from './SideNav.tsx';
import HeaderNav from './HeaderNav.tsx';
import FooterNav from './FooterNav.tsx';
import {
  NProgress,
  TourButton,
  OfflineIndicator,
  KeyboardShortcuts,
  CommandPalette,
  SmartSearch,
  WorkspaceSwitcher,
  ActivityTimeline,
  NotificationsPanel,
  AccessibilityChecker,
  SidebarCustomizer,
  AssetAvatar,
  SUSPENDED_ORG_BANNER_HEIGHT,
} from '../../components';
import type { WorkspaceSwitcherRef } from '../../components/WorkspaceSwitcher/WorkspaceSwitcher';
import { PATH_AUTH } from '../../constants';
import { useSelector, useDispatch } from 'react-redux';
import { toggleTheme } from '../../features/theme/themeSlice.ts';
import { RootState, store } from '../../store.ts';
import { logout, setCredentials } from '../../features/auth/authSlice.ts';
import { api } from '../../services/api.ts';
import { useLazyGetUserInfoQuery } from '../../services/authApi.ts';
import { TourProvider, useTour } from '../../context/TourContext';
import { SidebarProvider, useSidebar } from '../../context/SidebarContext';
import { getTourSteps, TourStepConfig } from '../../config/tourSteps';
import { TourProps } from 'antd';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from '../../utils/rbac';
import { isImpersonationActive } from '../../utils/impersonation';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useActivityTracking } from '../../hooks/useActivityTracking';
import { useColorBlindness } from '../../hooks/useColorBlindness';
import { SearchOutlined, MoreOutlined } from '@ant-design/icons';
const { Content } = Layout;
const { useBreakpoint } = Grid;

type AppLayoutProps = {
  children: ReactNode;
};

// Component to handle tour logic and rendering
const TourHandler = () => {
  const {
    isRunning,
    currentStep,
    steps,
    setSteps,
    setCurrentStep,
    navigateToPage,
    stopTour,
    setSidebarResetCallback,
    setSidebarRestoreCallback,
  } = useTour();
  const { resetPreferences, updatePreferences } = useSidebar();

  // Set up sidebar reset and restore callbacks
  useEffect(() => {
    setSidebarResetCallback(() => {
      resetPreferences();
    });

    setSidebarRestoreCallback((savedPrefs) => {
      // Restore preferences from the saved preferences passed from TourContext
      if (savedPrefs) {
        updatePreferences(savedPrefs);
      }
    });

    return () => {
      setSidebarResetCallback(null);
      setSidebarRestoreCallback(null);
    };
  }, [
    resetPreferences,
    updatePreferences,
    setSidebarResetCallback,
    setSidebarRestoreCallback,
  ]);

  // Initialize tour steps when tour starts
  useEffect(() => {
    if (isRunning && steps?.length === 0) {
      // Wait a bit for DOM to be ready before initializing steps
      const timer = setTimeout(() => {
        // Get permission check functions inside useEffect to avoid dependency issues
        const state = store.getState();
        const checkPermission = (permission: string) =>
          hasPermission(permission, state);
        const checkAnyPermission = (permissions: string[]) =>
          hasAnyPermission(permissions, state);
        const checkAllPermissions = (permissions: string[]) =>
          hasAllPermissions(permissions, state);

        const tourSteps = getTourSteps({
          navigateToPage,
          hasPermission: checkPermission,
          hasAnyPermission: checkAnyPermission,
          hasAllPermissions: checkAllPermissions,
          isAdmin: state.auth.user?.isAdmin === true,
        });
        // Cast to TourProps['steps'] to handle string selectors which Ant Design supports at runtime
        // even though the types don't reflect it
        setSteps(tourSteps as unknown as TourProps['steps']);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isRunning, steps?.length, setSteps, navigateToPage]);

  // Helper function to expand a menu submenu
  const expandMenuSubmenu = (menuKey: string): Promise<void> => {
    return new Promise((resolve) => {
      // Find the submenu title element
      const submenuTitles = Array.from(
        document.querySelectorAll('.ant-menu-submenu-title')
      );
      const submenu = submenuTitles.find((el) => {
        const submenuElement = el.closest('.ant-menu-submenu');
        if (submenuElement) {
          const menuId = submenuElement.getAttribute('data-menu-id');
          return menuId === menuKey || menuId?.includes(menuKey);
        }
        return false;
      });

      if (submenu) {
        const submenuElement = submenu.closest('.ant-menu-submenu');
        const isOpen = submenuElement?.classList.contains(
          'ant-menu-submenu-open'
        );

        if (!isOpen) {
          // Click to expand the submenu
          (submenu as HTMLElement).click();
          // Wait for the menu to expand
          setTimeout(() => {
            resolve();
          }, 300);
        } else {
          resolve();
        }
      } else {
        // Try alternative method: find by text content
        const textSubmenu = submenuTitles.find((el) => {
          const text = el.textContent?.toLowerCase().trim();
          if (menuKey === 'forms') {
            return text === 'forms';
          }
          if (menuKey === 'courses-management') {
            return text === 'courses';
          }
          return false;
        });

        if (textSubmenu) {
          const submenuElement = textSubmenu.closest('.ant-menu-submenu');
          const isOpen = submenuElement?.classList.contains(
            'ant-menu-submenu-open'
          );

          if (!isOpen) {
            (textSubmenu as HTMLElement).click();
            setTimeout(() => {
              resolve();
            }, 300);
          } else {
            resolve();
          }
        } else {
          // Menu not found, resolve anyway
          resolve();
        }
      }
    });
  };

  // Handle navigation and menu expansion when step changes
  useEffect(() => {
    if (!isRunning || !steps || steps.length === 0) return;

    const currentStepConfig = steps[currentStep] as TourStepConfig;
    const prevStepConfig =
      currentStep > 0 ? (steps[currentStep - 1] as TourStepConfig) : null;
    const nextStepConfig =
      currentStep < steps.length - 1
        ? (steps[currentStep + 1] as TourStepConfig)
        : null;

    // Expand parent menu if the current step is a parent menu item
    // or if the next step requires a parent menu to be expanded
    const menuToExpand =
      currentStepConfig?.expandParentMenu || nextStepConfig?.expandParentMenu;
    if (menuToExpand) {
      expandMenuSubmenu(menuToExpand).catch(console.error);
    }

    // Only navigate if this step requires navigation and we're moving forward
    // Check if we just moved to this step (not if we're already here)
    if (
      currentStepConfig?.requiresNavigation &&
      currentStepConfig?.targetPath &&
      (!prevStepConfig ||
        prevStepConfig.targetPath !== currentStepConfig.targetPath)
    ) {
      navigateToPage(currentStepConfig.targetPath)
        .then(() => {
          // After navigation, ensure the target element exists before showing the step
          if (currentStepConfig.waitForSelector) {
            const selector = currentStepConfig.waitForSelector;
            const checkElement = (maxAttempts = 20, attempt = 0) => {
              const element = document.querySelector(selector);
              if (element || attempt >= maxAttempts) {
                // Element found or max attempts reached, tour will show the step
              } else {
                setTimeout(() => checkElement(maxAttempts, attempt + 1), 100);
              }
            };
            checkElement();
          }
        })
        .catch(console.error);
    }
  }, [currentStep, isRunning, steps, navigateToPage]);

  // Ensure target functions return valid elements
  const safeSteps = React.useMemo(() => {
    if (!steps || steps.length === 0) return [];

    return steps
      .map((step) => {
        // If target is a function, wrap it to ensure it returns HTMLElement
        if (typeof step.target === 'function') {
          const originalTarget = step.target;
          return {
            ...step,
            target: () => {
              try {
                const element = originalTarget();
                // Only return if it's a valid HTMLElement
                if (
                  element &&
                  element instanceof HTMLElement &&
                  typeof element.getBoundingClientRect === 'function'
                ) {
                  return element;
                }
                // Always return body as fallback to prevent errors
                return document.body;
              } catch (error) {
                console.warn('Tour step target error:', error, step);
                // Always return body as fallback to prevent errors
                return document.body;
              }
            },
          };
        }

        // For string selectors, validate and convert to function
        if (typeof step.target === 'string') {
          const selector = step.target;
          return {
            ...step,
            target: () => {
              try {
                if (selector === 'body') {
                  return document.body;
                }
                const element = document.querySelector(selector);
                if (
                  element &&
                  (element as HTMLElement).nodeType === Node.ELEMENT_NODE
                ) {
                  const htmlElement = element as HTMLElement;
                  if (typeof htmlElement.getBoundingClientRect === 'function') {
                    return htmlElement;
                  }
                }
                // Fallback to body
                return document.body;
              } catch (error) {
                console.warn('Tour step selector error:', error, step);
                return document.body;
              }
            },
          };
        }

        // If target is already an element, validate it
        if (
          step.target &&
          typeof step.target === 'object' &&
          'getBoundingClientRect' in step.target
        ) {
          const element = step.target as HTMLElement;
          if (typeof element.getBoundingClientRect === 'function') {
            return step;
          }
          // Invalid element, convert to body
          return {
            ...step,
            target: document.body,
          };
        }

        // Unknown type, use body as fallback
        return {
          ...step,
          target: document.body,
        };
      })
      .filter(() => {
        // Filter out steps that would definitely fail
        // But keep all steps since we're using body as fallback
        return true;
      });
  }, [steps]);

  // Only render Tour when DOM is ready and steps are valid
  const canRenderTour =
    isRunning &&
    safeSteps.length > 0 &&
    typeof document !== 'undefined' &&
    document.body;

  return (
    <>
      {canRenderTour && (
        <Tour
          open={isRunning}
          current={currentStep}
          steps={safeSteps}
          onClose={stopTour}
          onFinish={stopTour}
          onChange={(step) => {
            setCurrentStep(step);
          }}
        />
      )}
      <TourButton />
    </>
  );
};

// Inner component that uses tour hooks - now just wraps children
const AppLayoutContent = ({ children }: AppLayoutProps) => {
  return <>{children}</>;
};

export const AppLayout = ({ children }: AppLayoutProps) => {
  const {
    token: { borderRadius },
  } = theme.useToken();
  const screens = useBreakpoint();
  const isDesktop = screens.lg; // lg breakpoint is 992px (laptop and above)
  const [collapsed, setCollapsed] = useState(!isDesktop);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [navFill, setNavFill] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [smartSearchOpen, setSmartSearchOpen] = useState(false);
  const [activityTimelineOpen, setActivityTimelineOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const nodeRef = useRef(null);
  const floatBtnRef = useRef(null);
  const workspaceSwitcherRef = useRef<WorkspaceSwitcherRef | null>(null);
  const dispatch = useDispatch();
  const { token } = theme.useToken();
  const { mytheme } = useSelector((state: RootState) => state.theme);
  const { profiles, selectedProfile, user } = useSelector(
    (state: RootState) => state.auth
  );
  const impersonating = isImpersonationActive();
  const orgSuspended =
    selectedProfile?.organization != null &&
    selectedProfile.organization.deletedAt != null &&
    selectedProfile.organization.deletedAt !== '';
  const isDeactivatedNonAdmin =
    user != null &&
    !user.isAdmin &&
    selectedProfile != null &&
    selectedProfile.deletedAt != null &&
    selectedProfile.deletedAt !== '';
  const isSuperAdmin = user?.isAdmin === true;
  const bannerOffset =
    (impersonating ? 48 : 0) + (orgSuspended ? SUSPENDED_ORG_BANNER_HEIGHT : 0);
  const [getUserInfo] = useLazyGetUserInfoQuery();

  const items: MenuProps['items'] = [
    {
      key: 'user-profile-link',
      label: 'profile',
      icon: <UserOutlined />,
      onClick: () => navigate('/profile'),
    },
    // {
    //   key: 'user-settings-link',
    //   label: 'settings',
    //   icon: <SettingOutlined />,
    // },
    // {
    //   key: 'user-help-link',
    //   label: 'help center',
    //   icon: <QuestionOutlined />,
    // },
    {
      type: 'divider',
    },
    {
      key: 'user-logout-link',
      label: 'logout',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: () => {
        const currentPath = location.pathname + location.search;
        dispatch(logout());
        message.success('You have been logged out');
        dispatch(api.util.resetApiState());
        navigate(`${PATH_AUTH.signin}?from=${encodeURIComponent(currentPath)}`);
      },
    },
  ];

  // Handle responsive sidebar behavior
  useEffect(() => {
    if (isDesktop) {
      // Desktop: use collapsed state
      setCollapsed(false);
      setDrawerOpen(false);
    } else {
      // Mobile/Tablet: always collapse sidebar and use drawer
      setCollapsed(true);
      setDrawerOpen(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 5) {
        setNavFill(true);
      } else {
        setNavFill(false);
      }
    });
  }, []);

  const handleChangeOrganization = (id: string) => {
    const profile = profiles.find((p) => p._id === id);
    if (!profile) return;

    dispatch(setCredentials({ selectedProfile: profile }));

    // Force refetch of all queries (except auth)
    dispatch(api.util.resetApiState());

    // dispatch(api.util.invalidateTags(['Organization', 'Department', 'UserInfo']));
  };

  const handleSyncData = async () => {
    if (isSyncing) return; // Prevent multiple simultaneous syncs

    setIsSyncing(true);
    try {
      // Invalidate relevant cache tags
      dispatch(
        api.util.invalidateTags([
          'UserInfo',
          'Auth',
          'Profile',
          'Organization',
          'Department',
          'Permission',
          'Role',
        ])
      );

      // Explicitly refetch user info to ensure latest data
      const result = await getUserInfo();
      if (result.error) {
        throw new Error('Failed to fetch user info');
      }

      message.success('Data synced successfully');
    } catch (error) {
      console.error('Sync error:', error);
      message.error('Failed to sync data. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleTheme = () => {
    dispatch(toggleTheme());
  };

  const handleSwitchWorkspace = () => {
    // Try to use ref first (most reliable)
    if (workspaceSwitcherRef.current) {
      workspaceSwitcherRef.current.open();
      return;
    }

    // Fallback: Find and open the Select component manually
    const orgSelectorContainer = document.querySelector(
      '[data-tour="org-selector"]'
    );

    if (orgSelectorContainer) {
      // Find the Select component - try multiple approaches
      // Method 1: Find by ID
      const selectById = document.querySelector(
        '#workspace-switcher-select'
      ) as HTMLElement;
      if (selectById) {
        const selector = selectById.querySelector(
          '.ant-select-selector'
        ) as HTMLElement;
        if (selector) {
          selector.click();
          // Focus the input for keyboard navigation
          setTimeout(() => {
            const input = selectById.querySelector(
              '.ant-select-selection-search-input'
            ) as HTMLInputElement;
            if (input) {
              input.focus();
            }
          }, 50);
          return;
        }
      }

      // Method 2: Find within the container
      const selectElement = orgSelectorContainer.querySelector(
        '.ant-select'
      ) as HTMLElement;
      if (selectElement) {
        const selector = selectElement.querySelector(
          '.ant-select-selector'
        ) as HTMLElement;
        if (selector) {
          selector.click();
          // Focus the input for keyboard navigation
          setTimeout(() => {
            const input = selectElement.querySelector(
              '.ant-select-selection-search-input'
            ) as HTMLInputElement;
            if (input) {
              input.focus();
            }
          }, 50);
          return;
        }
      }

      // Method 3: Direct click on container (last resort)
      (orgSelectorContainer as HTMLElement).click();
    }
  };

  // Track activities
  useActivityTracking();

  // Get color blindness filter value to apply to content area
  const { filterValue } = useColorBlindness();

  // Setup keyboard shortcuts
  useKeyboardShortcuts(
    () => setShortcutsOpen(true),
    () => {
      // Toggle between command palette and smart search
      if (commandPaletteOpen) {
        setCommandPaletteOpen(false);
        setSmartSearchOpen(true);
      } else {
        setCommandPaletteOpen(true);
      }
    },
    handleSwitchWorkspace,
    handleSyncData,
    () => setCollapsed(!collapsed)
  );

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  // Close drawer when navigating on mobile/tablet
  useEffect(() => {
    if (!isDesktop) {
      setDrawerOpen(false);
    }
  }, [location.pathname, isDesktop]);

  // Redirect deactivated non-admin users to profile page
  useEffect(() => {
    if (isDeactivatedNonAdmin && location.pathname !== '/profile') {
      navigate('/profile');
    }
  }, [isDeactivatedNonAdmin, location.pathname, navigate]);

  const showSideNav = !isDeactivatedNonAdmin;

  return (
    <SidebarProvider>
      <TourProvider>
        <AppLayoutContent>
          <TourHandler />
          <NProgress isAnimating={isLoading} key={location.key} />
          <Layout
            style={{
              minHeight: '100vh',
              paddingTop: bannerOffset,
            }}
          >
            {/* Desktop: Fixed Sidebar (hidden when deactivated non-admin) */}
            {showSideNav && isDesktop && (
              <SideNav
                trigger={null}
                collapsible
                collapsed={collapsed}
                onCollapse={(value) => setCollapsed(value)}
                style={{
                  overflow: 'auto',
                  // overflowY: 'auto',
                  // overflowX: 'hidden',
                  position: 'fixed',
                  left: 0,
                  top: bannerOffset,
                  bottom: 0,
                  // height: '100vh',
                  // zIndex: 100,
                  background: 'none',
                  border: 'none',
                  transition: 'all .2s',
                }}
              />
            )}

            {/* Mobile/Tablet: Drawer for Sidebar (hidden when deactivated non-admin) */}
            {showSideNav && !isDesktop && (
              <Drawer
                title={null}
                placement="left"
                onClose={handleDrawerClose}
                open={drawerOpen}
                width={280}
                styles={{
                  body: {
                    padding: 0,
                  },
                }}
              >
                <SideNav
                  trigger={null}
                  collapsible={false}
                  collapsed={false}
                  style={{
                    overflow: 'auto',
                    height: '100%',
                    background: 'none',
                    border: 'none',
                  }}
                />
              </Drawer>
            )}

            <Layout>
              <HeaderNav
                style={{
                  marginLeft:
                    showSideNav && isDesktop ? (collapsed ? 0 : '200px') : 0,
                  padding: isDesktop ? '0 2rem 0 0' : '0 1rem 0 0',
                  background: navFill ? token.colorBgElevated : 'none',
                  backdropFilter: navFill ? 'blur(8px)' : 'none',
                  boxShadow: navFill ? token.boxShadowSecondary : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  position: 'sticky',
                  top: bannerOffset,
                  zIndex: 1000,
                  gap: 8,
                  transition: 'all .25s',
                }}
              >
                <Flex align="center" style={{ flex: 1, minWidth: 0 }}>
                  {showSideNav && (
                    <Tooltip
                      title={
                        isDesktop
                          ? `${collapsed ? 'Expand' : 'Collapse'} Sidebar`
                          : 'Open Menu'
                      }
                    >
                      <Button
                        type="text"
                        icon={
                          isDesktop ? (
                            collapsed ? (
                              <MenuUnfoldOutlined />
                            ) : (
                              <MenuFoldOutlined />
                            )
                          ) : (
                            <MenuUnfoldOutlined />
                          )
                        }
                        onClick={() => {
                          if (isDesktop) {
                            setCollapsed(!collapsed);
                          } else {
                            setDrawerOpen(true);
                          }
                        }}
                        style={{
                          fontSize: '16px',
                          width: 64,
                          height: 64,
                          flexShrink: 0,
                        }}
                      />
                    </Tooltip>
                  )}
                  <div
                    data-tour="org-selector"
                    style={{
                      width: isDesktop ? '400px' : '100%',
                      marginLeft: isDesktop ? '.5rem' : 0,
                      maxWidth: isDesktop ? '400px' : '100%',
                    }}
                  >
                    <WorkspaceSwitcher
                      ref={workspaceSwitcherRef}
                      value={selectedProfile?._id}
                      onChange={handleChangeOrganization}
                      style={{
                        width: '100%',
                      }}
                      size="middle"
                      id="workspace-switcher-select"
                    />
                  </div>
                </Flex>
                <Flex
                  align="center"
                  gap="small"
                  style={{ flexShrink: 0 }}
                  data-tour="header-actions"
                >
                  {/* Recent Pages – commented out
              <div data-tour="recent-pages">
                <RecentPages />
              </div>
              */}
                  {isDesktop ? (
                    <>
                      <Tooltip title="Smart Search (Ctrl+K)">
                        <Button
                          icon={<SearchOutlined />}
                          type="text"
                          size="large"
                          onClick={() => setSmartSearchOpen(true)}
                          data-tour="smart-search"
                        />
                      </Tooltip>
                      <Tooltip title="Activity Timeline">
                        <Button
                          icon={<HistoryOutlined />}
                          type="text"
                          size="large"
                          onClick={() => setActivityTimelineOpen(true)}
                          data-tour="activity-timeline"
                        />
                      </Tooltip>
                      <div data-tour="accessibility-checker">
                        <AccessibilityChecker />
                      </div>
                      <div data-tour="sidebar-customizer">
                        <SidebarCustomizer />
                      </div>
                      <NotificationsPanel />
                      {/* {user?.isAdmin && (
                    <Tooltip title="Admin">
                      <Button icon={<>👑</>} type="text" size="large" />
                    </Tooltip>
                  )} */}
                      <Tooltip title="Sync Data">
                        <Button
                          icon={<SyncOutlined spin={isSyncing} />}
                          type="text"
                          size="large"
                          loading={isSyncing}
                          onClick={handleSyncData}
                          disabled={isSyncing}
                          data-tour="sync-data"
                        />
                      </Tooltip>
                      <Tooltip title="Theme">
                        <Switch
                          checkedChildren={<MoonOutlined />}
                          unCheckedChildren={<SunOutlined />}
                          checked={mytheme === 'light' ? true : false}
                          onClick={() => dispatch(toggleTheme())}
                          data-tour="theme-toggle"
                        />
                      </Tooltip>
                    </>
                  ) : (
                    <>
                      <Tooltip title="Smart Search (Ctrl+K)">
                        <Button
                          icon={<SearchOutlined />}
                          type="text"
                          size="large"
                          onClick={() => setSmartSearchOpen(true)}
                          data-tour="smart-search"
                        />
                      </Tooltip>
                      <NotificationsPanel />
                      <Dropdown
                        menu={{
                          items: [
                            {
                              key: 'activity-timeline',
                              icon: <HistoryOutlined />,
                              label: 'Activity Timeline',
                              onClick: () => setActivityTimelineOpen(true),
                            },
                            {
                              key: 'sync-data',
                              icon: <SyncOutlined spin={isSyncing} />,
                              label: isSyncing ? 'Syncing…' : 'Sync Data',
                              disabled: isSyncing,
                              onClick: handleSyncData,
                            },
                            { type: 'divider' as const },
                            {
                              key: 'theme',
                              icon:
                                mytheme === 'light' ? (
                                  <MoonOutlined />
                                ) : (
                                  <SunOutlined />
                                ),
                              label:
                                mytheme === 'light'
                                  ? 'Dark Mode'
                                  : 'Light Mode',
                              onClick: handleToggleTheme,
                            },
                          ],
                        }}
                        trigger={['click']}
                        placement="bottomRight"
                      >
                        <Button
                          type="text"
                          size="large"
                          icon={<MoreOutlined />}
                        />
                      </Dropdown>
                    </>
                  )}
                  <Dropdown menu={{ items }} trigger={['click']}>
                    <Flex style={{ cursor: 'pointer' }} data-tour="profile">
                      <AssetAvatar
                        avatarKey={user?.avatar}
                        size={32}
                        fallback={
                          user?.name?.charAt(0)?.toUpperCase() || (
                            <UserOutlined />
                          )
                        }
                        style={{
                          borderRadius,
                          backgroundColor: token.colorPrimary,
                          color: '#fff',
                          fontSize: 16,
                          fontWeight: 500,
                        }}
                      />
                    </Flex>
                  </Dropdown>
                </Flex>
              </HeaderNav>
              <Content
                style={{
                  margin:
                    showSideNav && isDesktop
                      ? `0 0 0 ${collapsed ? 0 : '200px'}`
                      : 0,
                  borderRadius: isDesktop && !collapsed ? borderRadius : 0,
                  transition: 'all .25s',
                  padding: isDesktop ? '24px 32px' : '16px',
                  minHeight: 360,
                  filter: filterValue || undefined, // Apply color blindness filter to content only
                }}
              >
                <div style={{ position: 'relative', minHeight: '100%' }}>
                  {orgSuspended && !isSuperAdmin && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 10,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'auto',
                        borderRadius:
                          isDesktop && !collapsed ? borderRadius : 0,
                      }}
                      role="alert"
                    >
                      <Typography.Text
                        strong
                        style={{
                          color: '#fff',
                          fontSize: 16,
                          textAlign: 'center',
                          padding: 24,
                        }}
                      >
                        Contact with Admin. Your organization is suspended. You
                        cannot perform any actions.
                      </Typography.Text>
                    </div>
                  )}
                  <TransitionGroup>
                    <SwitchTransition>
                      <CSSTransition
                        key={`css-transition-${location.key}`}
                        nodeRef={nodeRef}
                        onEnter={() => {
                          setIsLoading(true);
                        }}
                        onEntered={() => {
                          setIsLoading(false);
                        }}
                        timeout={300}
                        classNames="bottom-to-top"
                        unmountOnExit
                      >
                        {() => (
                          <div ref={nodeRef} style={{ background: 'none' }}>
                            {children}
                          </div>
                        )}
                      </CSSTransition>
                    </SwitchTransition>
                  </TransitionGroup>
                  <div ref={floatBtnRef}>
                    <FloatButton.BackTop />
                  </div>
                </div>
              </Content>
              <FooterNav
                style={{
                  textAlign: 'center',
                  marginLeft:
                    showSideNav && isDesktop ? (collapsed ? 0 : '200px') : 0,
                  background: 'none',
                  padding: isDesktop ? undefined : '16px',
                }}
              />
            </Layout>
          </Layout>
          <OfflineIndicator />
          <KeyboardShortcuts
            open={shortcutsOpen}
            onClose={() => setShortcutsOpen(false)}
          />
          <CommandPalette
            open={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            onSyncData={handleSyncData}
            onToggleTheme={handleToggleTheme}
            onSwitchWorkspace={handleSwitchWorkspace}
          />
          <SmartSearch
            open={smartSearchOpen}
            onClose={() => setSmartSearchOpen(false)}
            onSyncData={handleSyncData}
            onToggleTheme={handleToggleTheme}
            onSwitchWorkspace={handleSwitchWorkspace}
          />
          <ActivityTimeline
            open={activityTimelineOpen}
            onClose={() => setActivityTimelineOpen(false)}
          />
        </AppLayoutContent>
      </TourProvider>
    </SidebarProvider>
  );
};
