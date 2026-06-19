import { createApi } from '@reduxjs/toolkit/query/react';
// import { baseQueryWithReauth } from './baseQueryWithReauth';
import { baseQueryWithProfileGuard } from './baseQueryWithProfileGuard';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithProfileGuard,
  tagTypes: ['Organization', 'Auth','Profile', 'UserInfo', 'Department', 'Location', 'Permission', 'Role', 'Invite', 'PendingInvites', 'Template', 'Queue', 'TemplateVersion', 'Assignment', 'User', 'Chat', 'Tag', 'Course', 'CoursePage', 'Cohort', 'CourseRole', 'CourseMember', 'CourseProgress', 'CourseFormApproval', 'CourseStats', 'CourseEnrollment', 'KnowledgeBase', 'DMChannel', 'DMMessage', 'AssetUrl', 'ProfileDocument', 'GlobalFormTemplate', 'ConfigSet', 'Activity'],
  endpoints: () => ({}),
});
