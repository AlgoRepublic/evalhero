/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ConfigProvider, Layout, Menu, MenuProps, SiderProps } from 'antd';
import {
  BarChartOutlined,
  CalendarOutlined,
  FormOutlined,
  MessageOutlined,
  SafetyOutlined,
  TeamOutlined,
  UserOutlined,
  TagsOutlined,
  BookOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import { Logo } from '../../components';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  // PATH_ABOUT,
  // PATH_AUTH,
  // PATH_CORPORATE,
  // PATH_DASHBOARD,
  // PATH_DOCS,
  // PATH_ERROR,
  // PATH_GITHUB,
  PATH_LANDING,
  // PATH_SITEMAP,
  // PATH_USER_PROFILE,
} from '../../constants';
import { COLOR } from '../../App.tsx';
import { Link } from 'react-router-dom';
import { PATH_FORMS, PATH_CHAT, PATH_CALENDAR, PATH_TAGS, PATH_COURSES, PATH_KNOWLEDGE_BASE, PATH_ANALYTICS } from '../../constants/routes.ts';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { usePermission, useAnyPermission } from '../../hooks/usePermission';
import { useSidebar } from '../../context/SidebarContext';

const { Sider } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

const getItem = (
  label: React.ReactNode,
  key: React.Key,
  icon?: React.ReactNode,
  children?: MenuItem[],
  type?: 'group'
): MenuItem => {
  // Add data-tour attribute to menu items for tour targeting
  const labelWithDataAttr = React.isValidElement(label)
    ? React.cloneElement(label as React.ReactElement, {
        'data-tour': `menu-item-${key}`,
      })
    : (
        <span data-tour={`menu-item-${key}`}>{label}</span>
      );

  return {
    key,
    icon,
    children,
    label: labelWithDataAttr,
    type,
  } as MenuItem;
};

// Menu items configuration with permission requirements
const getMenuItems = ({
  hasUserView,
  hasFormTemplateView,
  hasConfigSetView,
  hasScheduleView,
  hasQueueView,
  hasTagView,
  hasCourseView,
  hasKnowledgeBaseView,
  isAdmin,
}: {
  hasUserView: boolean;
  hasFormTemplateView: boolean;
  hasConfigSetView: boolean;
  hasScheduleView: boolean;
  hasQueueView: boolean;
  hasTagView: boolean;
  hasCourseView: boolean;
  hasKnowledgeBaseView: boolean;
  isAdmin: boolean;
}): MenuProps['items'] => {
  const items: MenuProps['items'] = [
    getItem(<Link to={'/profile'}>Profile</Link>, '/profile', <UserOutlined />),
    getItem(
      <Link to={'/dashboard'}>Dashboard</Link>,
      '/dashboard',
      <SafetyOutlined />
    ),
  ];

  // Analytics: super admin only
  if (isAdmin) {
    items.push(
      getItem(
        <Link to={PATH_ANALYTICS.root}>Analytics</Link>,
        PATH_ANALYTICS.root,
        <BarChartOutlined />
      )
    );
  }

  // Add Users menu item only if user has user::view permission
  if (hasUserView) {
    items.push(
      getItem(<Link to={'/users'}>Users</Link>, '/users', <TeamOutlined />)
    );
  }

  // Add Organizations menu item only if user has organization::view permission
  // if (hasOrgView) {
  //   items.push(
  //     getItem(
  //       <Link to={'/dashboard/organizations'}>Organizations</Link>,
  //       '/dashboard/organizations',
  //       <SafetyOutlined />
  //     )
  //   );
  // }

  items.push(
    getItem(
      <Link to={PATH_CHAT.root}>Chat</Link>,
      PATH_CHAT.root,
      <MessageOutlined />
    )
  );

  items.push(
    getItem(
      <Link to={PATH_CALENDAR.root}>Calendar</Link>,
        PATH_CALENDAR.root,
      <CalendarOutlined />
    )
  );

  if (hasTagView) {
    items.push(
      getItem(
        <Link to={PATH_TAGS.root}>Tags</Link>,
        PATH_TAGS.root,
        <TagsOutlined />
      )
    );
  }

  if (hasKnowledgeBaseView) {
    items.push(
      getItem(
        <Link to={PATH_KNOWLEDGE_BASE.root}>Knowledge Base</Link>,
          PATH_KNOWLEDGE_BASE.root,
        <FolderOpenOutlined />
      )
    );
  }

  // Build Course Management submenu items
  const courseManagementSubmenuItems: MenuItem[] = [];

  if (hasCourseView) {
    courseManagementSubmenuItems.push(
      getItem(
        <Link to={PATH_COURSES.courses}>Courses</Link>,
        PATH_COURSES.courses,
        null
      )
    );
    courseManagementSubmenuItems.push(
      getItem(
        <Link to={PATH_COURSES.enrollments}>Enrollments</Link>,
        PATH_COURSES.enrollments,
        null
      )
    );
    courseManagementSubmenuItems.push(
      getItem(
        <Link to={PATH_COURSES.approvals}>Course Approvals</Link>,
        PATH_COURSES.approvals,
        null
      )
    );
  }

  // Only add Course Management menu if there are submenu items
  if (courseManagementSubmenuItems.length > 0) {
    items.push(getItem('Courses', 'courses-management', <BookOutlined />, courseManagementSubmenuItems));
  }

  // Build Forms submenu items based on permissions
  const formsSubmenuItems: MenuItem[] = [];

  if (hasFormTemplateView) {
    formsSubmenuItems.push(
      getItem(
        <Link to={PATH_FORMS.templates}>Templates</Link>,
        PATH_FORMS.templates,
        null
      )
    );
  }

  if (isAdmin) {
    formsSubmenuItems.push(
      getItem(
        <Link to={PATH_FORMS.globalTemplates}>Global Templates</Link>,
        PATH_FORMS.globalTemplates,
        null
      )
    );
  }

  if (hasConfigSetView) {
    formsSubmenuItems.push(
      getItem(
        <Link to={PATH_FORMS.configSets}>Quick Settings</Link>,
        PATH_FORMS.configSets,
        null
      )
    );
  }

  if (hasScheduleView) {
    formsSubmenuItems.push(
      getItem(
        <Link to={PATH_FORMS.schedules}>Schedules</Link>,
        PATH_FORMS.schedules,
        null
      )
    );
  }

  // Add My Forms menu item only if user has queue::view or queue::viewall permission
  if (hasQueueView) {
    formsSubmenuItems.push(
      getItem(
        <Link to={PATH_FORMS.queues}>My Forms</Link>,
        PATH_FORMS.queues,
        null
      )
    );
  }

  // Only add Forms menu if there are submenu items
  if (formsSubmenuItems.length > 0) {
    items.push(getItem('Forms', 'forms', <FormOutlined />, formsSubmenuItems));
  }

  return items;
};
// getItem(
//   <Link to={PATH_DASHBOARD.ecommerce}>eCommerce</Link>,
//   'ecommerce',
//   null
// ),
// getItem(
//   <Link to={PATH_DASHBOARD.marketing}>Marketing</Link>,
//   'marketing',
//   null
// ),
// getItem(<Link to={PATH_DASHBOARD.social}>Social</Link>, 'social', null),
// getItem(<Link to={PATH_DASHBOARD.bidding}>Bidding</Link>, 'bidding', null),
// getItem(
//   <Link to={PATH_DASHBOARD.learning}>Learning</Link>,
//   'learning',
//   null
// ),
// getItem(
//   <Link to={PATH_DASHBOARD.logistics}>Logistics</Link>,
//   'logistics',
//   null
// ),
// ]),
// getItem(
//   <Link to={PATH_ABOUT.root}>About</Link>,
//   'about',
//   <InfoCircleOutlined />
// ),
// getItem(
//   <Link to={PATH_SITEMAP.root}>Sitemap</Link>,
//   'sitemap',
//   <BranchesOutlined />
// ),

// getItem('Pages', 'pages', null, [], 'group'),

// getItem('Corporate', 'corporate', <IdcardOutlined />, [
//   getItem(<Link to={PATH_CORPORATE.about}>About</Link>, 'about', null),
//   getItem(<Link to={PATH_CORPORATE.team}>Team</Link>, 'team', null),
//   getItem(<Link to={PATH_CORPORATE.faqs}>FAQ</Link>, 'faqs', null),
//   getItem(
//     <Link to={PATH_CORPORATE.contact}>Contact us</Link>,
//     'contact us',
//     null
//   ),
//   getItem(<Link to={PATH_CORPORATE.pricing}>Pricing</Link>, 'pricing', null),
//   getItem(<Link to={PATH_CORPORATE.license}>License</Link>, 'license', null),
// ]),

// getItem('User profile', 'user-profile', <UserOutlined />, [
//   getItem(
//     <Link to={PATH_USER_PROFILE.details}>Details</Link>,
//     'details',
//     null
//   ),
//   getItem(
//     <Link to={PATH_USER_PROFILE.preferences}>Preferences</Link>,
//     'preferences',
//     null
//   ),
//   getItem(
//     <Link to={PATH_USER_PROFILE.personalInformation}>Information</Link>,
//     'personal-information',
//     null
//   ),
//   getItem(
//     <Link to={PATH_USER_PROFILE.security}>Security</Link>,
//     'security',
//     null
//   ),
//   getItem(
//     <Link to={PATH_USER_PROFILE.activity}>Activity</Link>,
//     'activity',
//     null
//   ),
//   getItem(
//     <Link to={PATH_USER_PROFILE.action}>Actions</Link>,
//     'actions',
//     null
//   ),
//   getItem(<Link to={PATH_USER_PROFILE.help}>Help</Link>, 'help', null),
//   getItem(
//     <Link to={PATH_USER_PROFILE.feedback}>Feedback</Link>,
//     'feedback',
//     null
//   ),
// ]),

// getItem('Authentication', 'authentication', <SecurityScanOutlined />, [
//   getItem(<Link to={PATH_AUTH.signin}>Sign In</Link>, 'auth-signin', null),
//   getItem(<Link to={PATH_AUTH.signup}>Sign Up</Link>, 'auth-signup', null),
//   getItem(<Link to={PATH_AUTH.welcome}>Welcome</Link>, 'auth-welcome', null),
//   getItem(
//     <Link to={PATH_AUTH.verifyEmail}>Verify email</Link>,
//     'auth-verify',
//     null
//   ),
//   getItem(
//     <Link to={PATH_AUTH.passwordReset}>Password reset</Link>,
//     'auth-password-reset',
//     null
//   ),
//   getItem(<Link to={PATH_AUTH.passwordConfirm}>Passsword confirmation</Link>, 'auth-password-confirmation', null),
//   getItem(
//     <Link to={PATH_AUTH.accountDelete}>Account deleted</Link>,
//     'auth-account-deactivation',
//     null
//   ),
// ]),

// getItem('Errors', 'errors', <BugOutlined />, [
//   getItem(<Link to={PATH_ERROR.error400}>400</Link>, '400', null),
//   getItem(<Link to={PATH_ERROR.error403}>403</Link>, '403', null),
//   getItem(<Link to={PATH_ERROR.error404}>404</Link>, '404', null),
//   getItem(<Link to={PATH_ERROR.error500}>500</Link>, '500', null),
//   getItem(<Link to={PATH_ERROR.error503}>503</Link>, '503', null),
// ]),

// getItem('Help', 'help', null, [], 'group'),
// getItem(
//   <Link to={PATH_DOCS.productRoadmap} target="_blank">
//     Roadmap
//   </Link>,
//   'product-roadmap',
//   <ProductOutlined />
// ),
// getItem(
//   <Link to={PATH_DOCS.components} target="_blank">
//     Components
//   </Link>,
//   'components',
//   <AppstoreAddOutlined />
// ),
// getItem(
//   <Link to={PATH_DOCS.help} target="_blank">
//     Documentation
//   </Link>,
//   'documentation',
//   <SnippetsOutlined />
// ),
// getItem(
//   <Link to={PATH_GITHUB.repo} target="_blank">
//     Give us a star
//   </Link>,
//   'give-us-a-star',
//   <GithubOutlined />
// ),
// ];

const rootSubmenuKeys = ['forms', 'courses-management'];

type SideNavProps = SiderProps;

const SideNav = ({ ...others }: SideNavProps) => {
  const nodeRef = useRef(null);
  const scrollPositionRef = useRef<number>(0);
  const { pathname } = useLocation();
  const [openKeys, setOpenKeys] = useState(['']);
  // const [current, setCurrent] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const { mytheme } = useSelector((state: RootState) => state.theme);

  // Check permissions for menu items
  const hasUserView = usePermission('user::view');
  // const hasOrgView = usePermission('organization::view');
  const hasFormTemplateView = usePermission('formtemplate::view');
  const hasConfigSetView = usePermission('configset::view');
  const hasScheduleView = usePermission('schedule::view');
  const hasQueueView = useAnyPermission(['queue::view', 'queue::viewall']);
  const hasTagView = usePermission('tag::view');
  const hasCourseView = usePermission('course::view');
  const hasKnowledgeBaseView = usePermission('knowledgebase::view');

  // Get sidebar preferences and set all menu items
  const { preferences, setAllMenuItems } = useSidebar();

  // Get filtered menu items based on permissions (memoized to prevent re-creation on every render)
  const isAdmin = useSelector((state: RootState) => state.auth.user?.isAdmin === true);

  const allItems = useMemo(
    () =>
      getMenuItems({
        hasUserView,
        hasFormTemplateView,
        hasConfigSetView,
        hasScheduleView,
        hasQueueView,
        hasTagView,
        hasCourseView,
        hasKnowledgeBaseView,
        isAdmin,
      }),
    [
      hasUserView,
      hasFormTemplateView,
      hasConfigSetView,
      hasScheduleView,
      hasQueueView,
      hasTagView,
      hasCourseView,
      hasKnowledgeBaseView,
      isAdmin,
    ]
  );

  // Extract all menu items info for customizer (including children)
  useEffect(() => {
    const extractMenuItems = (items: MenuProps['items']): Array<{ key: string; label: string; children?: Array<{ key: string; label: string }> }> => {
      const result: Array<{ key: string; label: string; children?: Array<{ key: string; label: string }> }> = [];
      
      items?.forEach((item) => {
        if (!item) return;
        
        const key = String(item.key || '');
        if (!key) return;

        // Extract label text
        let label = '';
        if ('label' in item) {
          if (typeof item.label === 'string') {
            label = item.label;
          } else if (React.isValidElement(item.label)) {
            // Try to extract text from React element (Link, etc.)
            const element = item.label as React.ReactElement;
            if (element.props?.children) {
              label = typeof element.props.children === 'string' 
                ? element.props.children 
                : element.props.children?.props?.children || key;
            } else {
              label = key;
            }
          } else {
            label = key;
          }
        } else {
          label = key;
        }

        const menuItem: { key: string; label: string; children?: Array<{ key: string; label: string }> } = {
          key,
          label: label || key,
        };

        // Extract children if present
        if ('children' in item && item.children && Array.isArray(item.children)) {
          menuItem.children = extractMenuItems(item.children);
        }

        result.push(menuItem);
      });

      return result;
    };

    const menuItemsInfo = extractMenuItems(allItems);
    setAllMenuItems(menuItemsInfo);
  }, [allItems, setAllMenuItems]);

  // Apply sidebar preferences (hide items, reorder, etc.)
  const items = useMemo(() => {
    // Save scroll position before filtering
    const siderElement = nodeRef.current as HTMLElement | null;
    if (siderElement) {
      scrollPositionRef.current = siderElement.scrollTop;
    }

    let filtered: typeof allItems = allItems ? [...allItems] : [];

    // Filter out hidden items
    if (preferences.hiddenItems.length > 0) {
      filtered = filtered.filter((item) => {
        if (!item) return false;
        // Check if item itself is hidden
        if (preferences.hiddenItems.includes(item.key as string)) {
          return false;
        }
        // Check if any child is hidden
        if ('children' in item && item.children && Array.isArray(item.children)) {
          item.children = item.children.filter(
            (child: any) => child && !preferences.hiddenItems.includes(child.key as string)
          );
        }
        return true;
      });
    }

    // Apply custom order if specified
    if (preferences.order.length > 0) {
      const orderMap = new Map(
        preferences.order.map((key, index) => [key, index])
      );
      filtered = filtered
        .filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined)
        .sort((a, b) => {
          const aIndex = orderMap.get(a.key as string) ?? Infinity;
          const bIndex = orderMap.get(b.key as string) ?? Infinity;
          return aIndex - bIndex;
        });
    }

    // Move pinned items to top
    if (preferences.pinnedItems.length > 0) {
      const pinned: typeof filtered = [];
      const unpinned: typeof filtered = [];

      filtered
        .filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined)
        .forEach((item) => {
          if (preferences.pinnedItems.includes(item.key as string)) {
            pinned.push(item);
          } else {
            unpinned.push(item);
          }
        });

      filtered = [...pinned, ...unpinned];
    }

    return filtered;
  }, [allItems, preferences]);

  // Restore scroll position after items render
  useEffect(() => {
    // Restore scroll position after menu re-renders
    const siderElement = nodeRef.current as HTMLElement | null;
    if (siderElement && scrollPositionRef.current > 0) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        siderElement.scrollTop = scrollPositionRef.current;
      });
    }
  }, [items]);

  const navigate = useNavigate();

  // const onClick: MenuProps['onClick'] = (e) => {
  //   console.log('click ', e);
  // };

  const onClick: MenuProps['onClick'] = (e) => {
    // Keep parent menu open after clicking a child
    const parentKey = rootSubmenuKeys.find((key) => e.keyPath.includes(key));
    if (parentKey) {
      setOpenKeys([parentKey]);
    } else {
      setOpenKeys([]);
    }

    setSelectedKeys([e.key]);
  };

  // const onOpenChange: MenuProps['onOpenChange'] = (keys) => {
  //   const latestOpenKey = keys.find((key) => openKeys.indexOf(key) === -1);
  //   if (latestOpenKey && rootSubmenuKeys.indexOf(latestOpenKey!) === -1) {
  //     setOpenKeys(keys);
  //   } else {
  //     setOpenKeys(latestOpenKey ? [latestOpenKey] : []);
  //   }
  // };

  const onOpenChange: MenuProps['onOpenChange'] = (keys) => {
    // Keep multiple parents open or single — your choice
    const latestOpenKey = keys.find((key) => !openKeys.includes(key));
    if (latestOpenKey) {
      setOpenKeys([latestOpenKey]);
    } else {
      setOpenKeys(keys);
    }
  };

  useEffect(() => {
    if (pathname === '/') {
      return navigate('/dashboard');
    }

    // const paths = pathname.split('/');
    // setOpenKeys(paths);
    // setCurrent(paths[paths.length - 1]);

    // const matchedParent = rootSubmenuKeys.find((key) =>
    //   pathname.startsWith(key)
    // );

    // setOpenKeys(matchedParent ? [matchedParent] : []);
    // setCurrent(pathname);

    // Detect if current path belongs to a submenu (like /forms/templates)
    const matchedParent = rootSubmenuKeys.find((key) => pathname.includes(key));

    // Open parent if found, else collapse
    setOpenKeys(matchedParent ? [matchedParent] : []);

    // Compute best matching menu key for current path (supports nested routes)
    const collectKeys = (menuItems?: MenuProps['items']): string[] => {
      if (!menuItems) return [];
      const keys: string[] = [];
      for (const item of menuItems) {
        if (!item) continue;
        const menuItem = item as MenuItem;
        const key = menuItem?.key;
        if (key) keys.push(String(key));

        // Safely access children only if menuItem is not null or undefined
        let children: MenuProps['items'] | undefined = [];
        if (
          menuItem &&
          'children' in menuItem &&
          Array.isArray((menuItem as any).children)
        ) {
          children = (menuItem as any).children;
        }

        if (children && children.length) keys.push(...collectKeys(children));
      }
      return keys;
    };

    const menuKeys = collectKeys(items).filter(Boolean);

    // Prefer exact match, otherwise choose the longest key that is a path prefix
    let bestKey = menuKeys.find((k) => k === pathname);
    if (!bestKey) {
      const candidates = menuKeys.filter(
        (k) =>
          k.startsWith('/') && (pathname === k || pathname.startsWith(k + '/'))
      );
      candidates.sort((a, b) => b.length - a.length);
      bestKey = candidates[0];
    }

    setSelectedKeys(bestKey ? [bestKey] : []);
  }, [pathname, items, navigate]);

  return (
    <Sider ref={nodeRef} breakpoint="lg" collapsedWidth="0" {...others} data-tour="sidebar">
      <Logo
        color="blue"
        asLink
        href={PATH_LANDING.root}
        justify="center"
        gap="small"
        imgSize={{ h: 28, w: 28 }}
        style={{ padding: '1rem 0' }} // flexShrink: 0
      />
      <ConfigProvider
        theme={{
          components: {
            Menu: {
              itemBg: 'none',
              itemSelectedBg: mytheme === 'dark' ? '#111b26' : COLOR['100'],
              itemHoverBg: mytheme === 'dark' ? '#1f2937' : COLOR['50'],
              itemSelectedColor: mytheme === 'dark' ? '#4d8bff' : COLOR['600'],
              itemHoverColor:
                mytheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : undefined,
              itemColor:
                mytheme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : undefined,
            },
          },
        }}
      >
        <Menu
          mode="inline"
          items={items}
          onClick={onClick}
          openKeys={openKeys}
          onOpenChange={onOpenChange}
          selectedKeys={selectedKeys}
          // selectedKeys={[current]}
          // selectedKeys={[pathname, current]}
          style={{ border: 'none'}} // flex: 1 
        />
      </ConfigProvider>
    </Sider>
  );
};

export default SideNav;
