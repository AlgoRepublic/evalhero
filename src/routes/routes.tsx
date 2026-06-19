import { createBrowserRouter, useLocation } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from './RouteGuards';
import { PermissionProtectedRoute, AdminProtectedRoute } from './PermissionProtectedRoute';
import {
  // CorporateLayout,
  DashboardLayout,
  // GuestLayout,
  // UserAccountLayout,
} from '../layouts';
import React, { ReactNode, useEffect, Suspense } from 'react';
import { Spin } from 'antd';

// Helper function to create lazy-loaded components from named exports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lazyNamed = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ [key: string]: T }>,
  exportName: string
): React.LazyExoticComponent<T> => {
  return React.lazy(() =>
    importFn().then((module) => ({ default: module[exportName] as T }))
  );
};

// Lazy-loaded authentication pages
const SignInPage = lazyNamed(
  () => import('../pages'),
  'SignInPage'
);
const SignUpPage = lazyNamed(() => import('../pages'), 'SignUpPage');
const WelcomePage = lazyNamed(() => import('../pages'), 'WelcomePage');
const VerifyEmailPage = lazyNamed(
  () => import('../pages'),
  'VerifyEmailPage'
);
const PasswordResetPage = lazyNamed(
  () => import('../pages'),
  'PasswordResetPage'
);
const AccountDeactivePage = lazyNamed(
  () => import('../pages'),
  'AccountDeactivePage'
);
const OtpPage = lazyNamed(() => import('../pages'), 'OtpPage');
const InviteConfirmPage = lazyNamed(
  () => import('../pages/authentication/InviteConfirmPage'),
  'InviteConfirmPage'
);

// Lazy-loaded error pages
const ErrorPage = lazyNamed(() => import('../pages'), 'ErrorPage');
const Error400Page = lazyNamed(() => import('../pages'), 'Error400Page');
const Error403Page = lazyNamed(() => import('../pages'), 'Error403Page');
const Error404Page = lazyNamed(() => import('../pages'), 'Error404Page');
const Error500Page = lazyNamed(() => import('../pages'), 'Error500Page');
const Error503Page = lazyNamed(() => import('../pages'), 'Error503Page');

// Lazy-loaded dashboard pages
const DashboardPage = lazyNamed(
  () => import('../pages/dashboards'),
  'DashboardPage'
);
const OrganizationsPage = lazyNamed(
  () => import('../pages/dashboards'),
  'OrganizationsPage'
);
const AddOrganizationPage = lazyNamed(
  () => import('../pages/dashboards'),
  'AddOrganizationPage'
);
const EditOrganizationPage = lazyNamed(
  () => import('../pages/dashboards'),
  'EditOrganizationPage'
);

// Lazy-loaded forms pages
const TemplatesPage = lazyNamed(() => import('../pages/forms'), 'TemplatesPage');
const AddTemplatePage = lazyNamed(
  () => import('../pages/forms'),
  'AddTemplatePage'
);
const EditTemplatePage = lazyNamed(
  () => import('../pages/forms'),
  'EditTemplatePage'
);
const TemplateVersionsPage = lazyNamed(
  () => import('../pages/forms'),
  'TemplateVersionsPage'
);
const TemplateVersionDetailPage = lazyNamed(
  () => import('../pages/forms'),
  'TemplateVersionDetailPage'
);
const SchedulesPage = lazyNamed(
  () => import('../pages/forms'),
  'SchedulesPage'
);
const AddSchedulePage = lazyNamed(
  () => import('../pages/forms'),
  'AddSchedulePage'
);
const EditSchedulePage = lazyNamed(
  () => import('../pages/forms'),
  'EditSchedulePage'
);
const QueuePage = lazyNamed(() => import('../pages/forms'), 'QueuePage');
const SubmitQueuePage = lazyNamed(
  () => import('../pages/forms'),
  'SubmitQueuePage'
);
const QueueSubmissionsPage = lazyNamed(
  () => import('../pages/forms'),
  'QueueSubmissionsPage'
);
const QuickSubmissionPage = lazyNamed(
  () => import('../pages/forms'),
  'QuickSubmissionPage'
);
const GlobalTemplatesPage = lazyNamed(
  () => import('../pages/forms'),
  'GlobalTemplatesPage'
);
const AddGlobalTemplatePage = lazyNamed(
  () => import('../pages/forms'),
  'AddGlobalTemplatePage'
);
const EditGlobalTemplatePage = lazyNamed(
  () => import('../pages/forms'),
  'EditGlobalTemplatePage'
);
const ConfigSetsPage = lazyNamed(
  () => import('../pages/forms'),
  'ConfigSetsPage'
);
const AddConfigSetPage = lazyNamed(
  () => import('../pages/forms'),
  'AddConfigSetPage'
);
const EditConfigSetPage = lazyNamed(
  () => import('../pages/forms'),
  'EditConfigSetPage'
);

// Lazy-loaded knowledge-base pages
const KnowledgeBasePage = lazyNamed(
  () => import('../pages/knowledge-base'),
  'KnowledgeBasePage'
);

// Lazy-loaded courses pages
const CoursesPage = lazyNamed(() => import('../pages/courses'), 'CoursesPage');
const AddCoursePage = lazyNamed(() => import('../pages/courses'), 'AddCoursePage');
const EditCoursePage = lazyNamed(() => import('../pages/courses'), 'EditCoursePage');
const CourseDetailPage = lazyNamed(() => import('../pages/courses'), 'CourseDetailPage');
const AddCoursePagePage = lazyNamed(() => import('../pages/courses/pages/AddCoursePage'), 'default');
const EditCoursePagePage = lazyNamed(() => import('../pages/courses/pages/EditCoursePage'), 'default');
const ViewCoursePagePage = lazyNamed(() => import('../pages/courses/pages/ViewCoursePage'), 'default');

// Lazy-loaded enrollment pages
const EnrollmentsListPage = lazyNamed(() => import('../pages/courses/pages/EnrollmentsListPage'), 'default');
const AddEnrollmentPage = lazyNamed(() => import('../pages/courses/pages/AddEnrollmentPage'), 'default');
const EditEnrollmentPage = lazyNamed(() => import('../pages/courses/pages/EditEnrollmentPage'), 'default');
const ViewEnrollmentPage = lazyNamed(() => import('../pages/courses/pages/ViewEnrollmentPage'), 'default');
const CoursePageFormSubmitPage = lazyNamed(() => import('../pages/courses/pages/CoursePageFormSubmitPage'), 'default');
const CourseApprovalsPage = lazyNamed(() => import('../pages/courses/pages/CourseApprovalsPage'), 'CourseApprovalsPage');

// Lazy-loaded other pages
const UsersPage = lazyNamed(() => import('../pages'), 'UsersPage');
const UserProfileDetailsPage = lazyNamed(
  () => import('../pages/users/UserProfileDetails'),
  'default'
);
const ProfilePage = lazyNamed(() => import('../pages'), 'ProfilePage');
const ProfileStatsPage = lazyNamed(() => import('../pages'), 'ProfileStatsPage');
const ChatPage = lazyNamed(() => import('../pages/chat'), 'ChatPage');
const CalendarPage = lazyNamed(() => import('../pages/calendar'), 'CalendarPage');
const TagsPage = lazyNamed(() => import('../pages/tags'), 'TagsPage');
const AddTagPage = lazyNamed(() => import('../pages/tags'), 'AddTagPage');
const EditTagPage = lazyNamed(() => import('../pages/tags'), 'EditTagPage');
// const TagStatsPage = lazyNamed(() => import('../pages/tags'), 'TagStatsPage');
const ComprehensiveTagStatsPage = lazyNamed(() => import('../pages/tags'), 'ComprehensiveTagStatsPage');
const AnalyticsPage = lazyNamed(() => import('../pages/analytics/AnalyticsPage'), 'default');

// Suspense fallback component
const SuspenseFallback = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
    }}
  >
    <Spin />
  </div>
);

// Wrapper component for Suspense boundaries
const LazyRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => (
  <Suspense fallback={<SuspenseFallback />}>{children}</Suspense>
);

// Custom scroll restoration function
export const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    }); // Scroll to the top when the location changes
  }, [pathname]);

  return null; // This component doesn't render anything
};

type PageProps = {
  children: ReactNode;
};

// Create an HOC to wrap your route components with ScrollToTop
const PageWrapper = ({ children }: PageProps) => {
  return (
    <>
      <ScrollToTop />
      {children}
    </>
  );
};

// Create the router
const router = createBrowserRouter([
  // 🔹 Public Routes
  {
    element: <PublicRoute />, // 👈 only for not-logged-in users
    children: [
      // {
      //   path: '/',
      //   element: <PageWrapper children={<GuestLayout />} />,
      //   errorElement: <ErrorPage />,
      //   children: [{ index: true, element: <HomePage /> }],
      // },
      {
        path: '/auth',
        errorElement: (
          <LazyRoute>
            <ErrorPage />
          </LazyRoute>
        ),
        children: [
          {
            path: 'signin',
            element: (
              <LazyRoute>
                <SignInPage />
              </LazyRoute>
            ),
          },
          {
            path: 'signup',
            element: (
              <LazyRoute>
                <SignUpPage />
              </LazyRoute>
            ),
          },
          {
            path: 'welcome',
            element: (
              <LazyRoute>
                <WelcomePage />
              </LazyRoute>
            ),
          },
          {
            path: 'verify-otp',
            element: (
              <LazyRoute>
                <OtpPage />
              </LazyRoute>
            ),
          },
          {
            path: 'verify-email',
            element: (
              <LazyRoute>
                <VerifyEmailPage />
              </LazyRoute>
            ),
          },
          {
            path: 'password-reset',
            element: (
              <LazyRoute>
                <PasswordResetPage />
              </LazyRoute>
            ),
          },
          {
            path: 'account-delete',
            element: (
              <LazyRoute>
                <AccountDeactivePage />
              </LazyRoute>
            ),
          },
          {
            path: 'invite/:inviteId',
            element: (
              <LazyRoute>
                <InviteConfirmPage />
              </LazyRoute>
            ),
          },
        ],
      },
    ],
  },
  {
    path: '/',
    element: <PageWrapper children={<DashboardLayout />} />,
    errorElement: (
      <LazyRoute>
        <ErrorPage />
      </LazyRoute>
    ),
    children: [
      {
        index: true,
        path: '',
        element: (
          <LazyRoute>
            <DashboardPage />
          </LazyRoute>
        ),
      },
    ],
  },
  {
    element: <ProtectedRoute />, // 👈 only for logged-in users
    children: [
      {
        path: '/dashboard',
        element: <PageWrapper children={<DashboardLayout />} />,
        errorElement: (
          <LazyRoute>
            <ErrorPage />
          </LazyRoute>
        ),
        children: [
          {
            path: 'organizations',
            element: (
              <LazyRoute>
                <OrganizationsPage />
              </LazyRoute>
              // <PermissionProtectedRoute permission="organization::view">
              //   <OrganizationsPage />
              // </PermissionProtectedRoute>
            ),
          },
          {
            path: 'organizations/add',
            element: (
              <PermissionProtectedRoute permission="organization::create">
                <LazyRoute>
                  <AddOrganizationPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'organizations/edit/:id',
            element: (
              <PermissionProtectedRoute permission="organization::edit">
                <LazyRoute>
                  <EditOrganizationPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            index: true, // 👈 /dashboard
            element: (
              <LazyRoute>
                <DashboardPage />
              </LazyRoute>
            ),
          },
        ],
      },
      {
        path: '/forms',
        element: <PageWrapper children={<DashboardLayout />} />,
        errorElement: (
          <LazyRoute>
            <ErrorPage />
          </LazyRoute>
        ),
        children: [
          // {
          //   index: true,
          //   element: <CanvasBuilderPage />,
          // },
          {
            path: 'templates',
            element: (
              <PermissionProtectedRoute permission="formtemplate::view">
                <LazyRoute>
                  <TemplatesPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'templates/folder/:folderId',
            element: (
              <PermissionProtectedRoute permission="formtemplate::view">
                <LazyRoute>
                  <TemplatesPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'templates/add',
            element: (
              <PermissionProtectedRoute permission="formtemplate::create">
                <LazyRoute>
                  <AddTemplatePage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'templates/edit/:id',
            element: (
              <PermissionProtectedRoute permission="formtemplate::edit">
                <LazyRoute>
                  <EditTemplatePage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'templates/:id/versions',
            element: (
              <PermissionProtectedRoute permission="formtemplate::view">
                <LazyRoute>
                  <TemplateVersionsPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'templates/:id/versions/:versionId',
            element: (
              <PermissionProtectedRoute permission="formtemplate::view">
                <LazyRoute>
                  <TemplateVersionDetailPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'global-templates',
            element: (
              <AdminProtectedRoute>
                <LazyRoute>
                  <GlobalTemplatesPage />
                </LazyRoute>
              </AdminProtectedRoute>
            ),
          },
          {
            path: 'global-templates/add',
            element: (
              <AdminProtectedRoute>
                <LazyRoute>
                  <AddGlobalTemplatePage />
                </LazyRoute>
              </AdminProtectedRoute>
            ),
          },
          {
            path: 'global-templates/edit/:id',
            element: (
              <AdminProtectedRoute>
                <LazyRoute>
                  <EditGlobalTemplatePage />
                </LazyRoute>
              </AdminProtectedRoute>
            ),
          },
          {
            path: 'config-sets',
            element: (
              <PermissionProtectedRoute permission="configset::view">
                <LazyRoute>
                  <ConfigSetsPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'config-sets/add',
            element: (
              <PermissionProtectedRoute permission="configset::create">
                <LazyRoute>
                  <AddConfigSetPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'config-sets/edit/:id',
            element: (
              <PermissionProtectedRoute permission="configset::edit">
                <LazyRoute>
                  <EditConfigSetPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'schedules',
            element: (
              <PermissionProtectedRoute permission="schedule::view">
                <LazyRoute>
                  <SchedulesPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'schedules/add',
            element: (
              <PermissionProtectedRoute permission="schedule::create">
                <LazyRoute>
                  <AddSchedulePage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'schedules/edit/:id',
            element: (
              <PermissionProtectedRoute permission="schedule::edit">
                <LazyRoute>
                  <EditSchedulePage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'queues',
            element: (
              <PermissionProtectedRoute permissions={['queue::view', 'queue::viewall']}>
                <LazyRoute>
                  <QueuePage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'queues/:id/submit',
            element: (
              <PermissionProtectedRoute permissions={['queue::view', 'queue::viewall']}>
                <LazyRoute>
                  <SubmitQueuePage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'queues/:id/submissions',
            element: (
              <PermissionProtectedRoute permissions={['queue::view', 'queue::viewall']}>
                <LazyRoute>
                  <QueueSubmissionsPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'templates/:templateId/quick-submission',
            element: (
              <PermissionProtectedRoute permission="formtemplate::quicksubmit">
                <LazyRoute>
                  <QuickSubmissionPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
        ],
      },
      {
        path: '/knowledge-base',
        element: <PageWrapper children={<DashboardLayout />} />,
        errorElement: (
          <LazyRoute>
            <ErrorPage />
          </LazyRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <PermissionProtectedRoute permission="knowledgebase::view">
                <LazyRoute>
                  <KnowledgeBasePage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'folder/:folderId',
            element: (
              <PermissionProtectedRoute permission="knowledgebase::view">
                <LazyRoute>
                  <KnowledgeBasePage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
        ],
      },
      {
        path: '/users',
        element: <PageWrapper children={<DashboardLayout />} />,
        errorElement: (
          <LazyRoute>
            <ErrorPage />
          </LazyRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <PermissionProtectedRoute permission="user::view">
                <LazyRoute>
                  <UsersPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: ':profileId',
            element: (
              <PermissionProtectedRoute permission="user::view">
                <LazyRoute>
                  <UserProfileDetailsPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
        ],
      },
      {
        path: '/analytics',
        element: <PageWrapper children={<DashboardLayout />} />,
        errorElement: (
          <LazyRoute>
            <ErrorPage />
          </LazyRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <LazyRoute>
                <AnalyticsPage />
              </LazyRoute>
            ),
          },
        ],
      },
      {
        path: '/chat',
        element: <PageWrapper children={<DashboardLayout />} />,
        errorElement: (
          <LazyRoute>
            <ErrorPage />
          </LazyRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <LazyRoute>
                <ChatPage />
              </LazyRoute>
            ),
          },
          {
            path: 'channel/:channelId',
            element: (
              <LazyRoute>
                <ChatPage />
              </LazyRoute>
            ),
          },
          {
            path: 'channel/:channelId/thread/:threadId',
            element: (
              <LazyRoute>
                <ChatPage />
              </LazyRoute>
            ),
          },
        ],
      },
      {
        path: '/calendar',
        element: <PageWrapper children={<DashboardLayout />} />,
        errorElement: (
          <LazyRoute>
            <ErrorPage />
          </LazyRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <LazyRoute>
                <CalendarPage />
              </LazyRoute>
            ),
          },
        ],
      },
      {
        path: '/tags',
        element: <PageWrapper children={<DashboardLayout />} />,
        errorElement: (
          <LazyRoute>
            <ErrorPage />
          </LazyRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <PermissionProtectedRoute permission="tag::view">
                <LazyRoute>
                  <TagsPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'add',
            element: (
              <PermissionProtectedRoute permission="tag::create">
                <LazyRoute>
                  <AddTagPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'edit/:id',
            element: (
              <PermissionProtectedRoute permission="tag::edit">
                <LazyRoute>
                  <EditTagPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          // {
          //   path: ':tagId/stats',
          //   element: (
          //     <PermissionProtectedRoute permission="tag::view">
          //       <LazyRoute>
          //         <TagStatsPage />
          //       </LazyRoute>
          //     </PermissionProtectedRoute>
          //   ),
          // },
          {
            path: ':tagId/stats',
            element: (
              <PermissionProtectedRoute permission="tag::view">
                <LazyRoute>
                  <ComprehensiveTagStatsPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
        ],
      },
      {
        path: '/courses-management/courses',
        element: <PageWrapper children={<DashboardLayout />} />,
        errorElement: (
          <LazyRoute>
            <ErrorPage />
          </LazyRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <PermissionProtectedRoute permission="course::view">
                <LazyRoute>
                  <CoursesPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'folder/:folderId',
            element: (
              <PermissionProtectedRoute permission="course::view">
                <LazyRoute>
                  <CoursesPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'add',
            element: (
              <PermissionProtectedRoute permission="course::create">
                <LazyRoute>
                  <AddCoursePage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: ':id',
            element: (
              <PermissionProtectedRoute permission="course::view">
                <LazyRoute>
                  <CourseDetailPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: ':id/edit',
            element: (
              <PermissionProtectedRoute permission="course::edit">
                <LazyRoute>
                  <EditCoursePage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: ':courseId/pages/add',
            element: (
              <PermissionProtectedRoute permission="course::edit">
                <LazyRoute>
                  <AddCoursePagePage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: ':courseId/pages/:pageId',
            element: (
              <PermissionProtectedRoute permission="course::view">
                <LazyRoute>
                  <ViewCoursePagePage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: ':courseId/pages/:pageId/edit',
            element: (
              <PermissionProtectedRoute permission="course::edit">
                <LazyRoute>
                  <EditCoursePagePage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
        ],
      },
      {
        path: '/courses-management/approvals',
        element: <PageWrapper children={<DashboardLayout />} />,
        errorElement: (
          <LazyRoute>
            <ErrorPage />
          </LazyRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <PermissionProtectedRoute permission="course::view">
                <LazyRoute>
                  <CourseApprovalsPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
        ],
      },
      {
        path: '/courses-management/enrollments',
        element: <PageWrapper children={<DashboardLayout />} />,
        errorElement: (
          <LazyRoute>
            <ErrorPage />
          </LazyRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <PermissionProtectedRoute permission="course::view">
                <LazyRoute>
                  <EnrollmentsListPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: 'add',
            element: (
              <PermissionProtectedRoute permission="course::edit">
                <LazyRoute>
                  <AddEnrollmentPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: ':enrollmentId',
            element: (
              <PermissionProtectedRoute permission="course::view">
                <LazyRoute>
                  <ViewEnrollmentPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: ':enrollmentId/edit',
            element: (
              <PermissionProtectedRoute permission="course::edit">
                <LazyRoute>
                  <EditEnrollmentPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
          {
            path: ':enrollmentId/progress/form',
            element: (
              <PermissionProtectedRoute permission="course::view">
                <LazyRoute>
                  <CoursePageFormSubmitPage />
                </LazyRoute>
              </PermissionProtectedRoute>
            ),
          },
        ],
      },
      {
        path: '/profile',
        element: <PageWrapper children={<DashboardLayout />} />,
        errorElement: (
          <LazyRoute>
            <ErrorPage />
          </LazyRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <LazyRoute>
                <ProfilePage />
              </LazyRoute>
            ),
          },
          {
            path: 'stats',
            element: (
              <LazyRoute>
                <ProfileStatsPage />
              </LazyRoute>
            ),
          },
        ],
      },
      //  {
      //   path: '/submissions',
      //   element: <PageWrapper children={<DashboardLayout />} />,
      //   errorElement: <ErrorPage />,
      // },
      //  {
      //   path: '/courses',
      //   element: <PageWrapper children={<DashboardLayout />} />,
      //   errorElement: <ErrorPage />,
      // },
      //       <Route path="/preview" element={<FormPreview />} />
      // <Route path="/submissions" element={<SubmissionViewer />} />
      // <Route path="/courses" element={<CourseBuilder />} />
      // {
      //   path: '/dashboard',
      //   element: <PageWrapper children={<DashboardLayout />} />,
      //   errorElement: <ErrorPage />,
      //   // children: [
      //   //   {
      //   //     index: true,
      //   //     path: '',
      //   //     element: <Dashboard />,
      //   //   },
      //   // ],
      //   children: [
      //     // { path: '/dashboard', element: <DashboardPage /> },
      //     {
      //       path: 'organizations',
      //       element: <OrganizationsPage />,
      //       children: [
      //         {
      //           // index: true,
      //           path: 'add',
      //           element: <AddOrganizationPage />,
      //         },
      //       ],
      //     },
      //     {
      //       path: 'organizations/add',
      //       element: <AddOrganizationPage />,
      //     },
      //     // {
      //     //   path: 'organizations/edit/:id',
      //     //   element: <EditOrganizationPage />,
      //     // },
      //     // { path: 'ecommerce', element: <EcommerceDashboardPage /> },
      //   ],
      // },
      // {
      //   path: '/user-profile',
      //   element: <PageWrapper children={<UserAccountLayout />} />,
      //   errorElement: <ErrorPage />,
      //   children: [
      //     { index: true, path: 'details', element: <UserProfileDetailsPage /> },
      //     // other profile pages...
      //   ],
      // },
    ],
  },
  // {
  //   path: '/dashboard',
  //   element: <PageWrapper children={<DashboardLayout />} />,
  //   errorElement: <ErrorPage />,
  //   children: [
  //     {
  //       index: true,
  //       path: 'default',
  //       element: <DefaultDashboardPage />,
  //     },
  //     {
  //       path: 'projects',
  //       element: <ProjectsDashboardPage />,
  //     },
  //     {
  //       path: 'ecommerce',
  //       element: <EcommerceDashboardPage />,
  //     },
  //     {
  //       path: 'marketing',
  //       element: <MarketingDashboardPage />,
  //     },
  //     {
  //       path: 'social',
  //       element: <SocialDashboardPage />,
  //     },
  //     {
  //       path: 'bidding',
  //       element: <BiddingDashboardPage />,
  //     },
  //     {
  //       path: 'learning',
  //       element: <LearningDashboardPage />,
  //     },
  //     {
  //       path: 'logistics',
  //       element: <LogisticsDashboardPage />,
  //     },
  //   ],
  // },
  // {
  //   path: '/sitemap',
  //   element: <PageWrapper children={<DashboardLayout />} />,
  //   errorElement: <ErrorPage />,
  //   children: [
  //     {
  //       index: true,
  //       path: '',
  //       element: <SitemapPage />,
  //     },
  //   ],
  // },
  // {
  //   path: '/corporate',
  //   element: <PageWrapper children={<CorporateLayout />} />,
  //   errorElement: <ErrorPage />,
  //   children: [
  //     {
  //       index: true,
  //       path: 'about',
  //       element: <CorporateAboutPage />,
  //     },
  //     {
  //       path: 'team',
  //       element: <CorporateTeamPage />,
  //     },
  //     {
  //       path: 'faqs',
  //       element: <CorporateFaqPage />,
  //     },
  //     {
  //       path: 'contact',
  //       element: <CorporateContactPage />,
  //     },
  //     {
  //       path: 'pricing',
  //       element: <CorporatePricingPage />,
  //     },
  //     {
  //       path: 'license',
  //       element: <CorporateLicensePage />,
  //     },
  //   ],
  // },
  // {
  //   path: '/user-profile',
  //   element: <PageWrapper children={<UserAccountLayout />} />,
  //   errorElement: <ErrorPage />,
  //   children: [
  //     {
  //       index: true,
  //       path: 'details',
  //       element: <UserProfileDetailsPage />,
  //     },
  //     {
  //       path: 'preferences',
  //       element: <UserProfilePreferencesPage />,
  //     },
  //     {
  //       path: 'information',
  //       element: <UserProfileInformationPage />,
  //     },
  //     {
  //       path: 'security',
  //       element: <UserProfileSecurityPage />,
  //     },
  //     {
  //       path: 'activity',
  //       element: <UserProfileActivityPage />,
  //     },
  //     {
  //       path: 'actions',
  //       element: <UserProfileActionsPage />,
  //     },
  //     {
  //       path: 'help',
  //       element: <UserProfileHelpPage />,
  //     },
  //     {
  //       path: 'feedback',
  //       element: <UserProfileFeedbackPage />,
  //     },
  //   ],
  // },
  // {
  //   path: '/auth',
  //   errorElement: <ErrorPage />,
  //   children: [
  //     {
  //       path: 'signup',
  //       element: <SignUpPage />,
  //     },
  //     {
  //       path: 'signin',
  //       element: <SignInPage />,
  //     },
  //     {
  //       path: 'welcome',
  //       element: <WelcomePage />,
  //     },
  //     {
  //       path: 'verify-email',
  //       element: <VerifyEmailPage />,
  //     },
  //     {
  //       path: 'password-reset',
  //       element: <PasswordResetPage />,
  //     },
  //     {
  //       path: 'account-delete',
  //       element: <AccountDeactivePage />,
  //     },
  //   ],
  // },
  {
    path: 'errors',
    errorElement: (
      <LazyRoute>
        <ErrorPage />
      </LazyRoute>
    ),
    children: [
      {
        path: '400',
        element: (
          <LazyRoute>
            <Error400Page />
          </LazyRoute>
        ),
      },
      {
        path: '403',
        element: (
          <LazyRoute>
            <Error403Page />
          </LazyRoute>
        ),
      },
      {
        path: '404',
        element: (
          <LazyRoute>
            <Error404Page />
          </LazyRoute>
        ),
      },
      {
        path: '500',
        element: (
          <LazyRoute>
            <Error500Page />
          </LazyRoute>
        ),
      },
      {
        path: '503',
        element: (
          <LazyRoute>
            <Error503Page />
          </LazyRoute>
        ),
      },
    ],
  },
  // {
  //   path: '/about',
  //   element: <PageWrapper children={<DashboardLayout />} />,
  //   errorElement: <ErrorPage />,
  //   children: [
  //     {
  //       index: true,
  //       path: '',
  //       element: <AboutPage />,
  //     },
  //   ],
  // },
]);

export default router;
