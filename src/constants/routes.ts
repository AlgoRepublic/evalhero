function path(root: string, sublink: string) {
  return `${root}${sublink}`;
}

const ROOTS_LANDING = '/';
const ROOTS_DASHBOARD = '/dashboards';
const ROOTS_SITEMAP = '/sitemap';
const ROOTS_LAYOUT = '/layouts';
const ROOTS_CORPORATE = '/corporate';
const ROOTS_PROFILE = '/user-profile';
const ROOTS_SOCIAL = '/social';
const ROOTS_BLOG = '/blog';
const ROOTS_CAREERS = '/careers';
const ROOTS_ACCOUNT = '/account';
const ROOTS_AUTH = '/auth';
const ROOTS_PROJECTS = '/projects';
const ROOTS_CONTACTS = '/contacts';
const ROOTS_USER_MGMT = '/user-management';
const ROOTS_SUBSCRIPTION = '/subscription';
const ROOTS_INVOICE = '/invoice';
const ROOTS_FILE_MGMT = '/file-manager';
const ROOTS_INBOX = '/inbox';
const ROOTS_CALENDAR = '/calendar';
const ROOTS_ERRORS = '/errors';
const ROOTS_ABOUT = '/about';
const ROOTS_FORMS = "/forms"
const ROOTS_CHAT = "/chat"
const ROOTS_TAGS = "/tags"
const ROOTS_COURSES = "/courses-management"
const ROOTS_KNOWLEDGE_BASE = "/knowledge-base"

export const PATH_LANDING = {
  root: ROOTS_LANDING,
  why: '/why-us',
  pricing: '/pricing',
  about: '/about',
  contact: '/contact',
};

export const PATH_DASHBOARD = {
  root: ROOTS_DASHBOARD,
  default: path(ROOTS_DASHBOARD, '/default'),
  forms: path(ROOTS_DASHBOARD, '/forms'),
  // projects: path(ROOTS_DASHBOARD, '/projects'),
  // ecommerce: path(ROOTS_DASHBOARD, '/ecommerce'),
  // marketing: path(ROOTS_DASHBOARD, '/marketing'),
  // social: path(ROOTS_DASHBOARD, '/social'),
  // bidding: path(ROOTS_DASHBOARD, '/bidding'),
  // learning: path(ROOTS_DASHBOARD, '/learning'),
  // logistics: path(ROOTS_DASHBOARD, '/logistics'),
};

export const PATH_SITEMAP = {
  root: ROOTS_SITEMAP,
};

export const PATH_LAYOUT = {
  root: ROOTS_LAYOUT,
  sidebar: {
    light: path(ROOTS_LAYOUT, '/sidebar/light'),
    dark: path(ROOTS_LAYOUT, '/sidebar/dark'),
    minimized: path(ROOTS_LAYOUT, '/sidebar/minimized'),
  },
  header: {
    light: path(ROOTS_LAYOUT, '/header/light'),
    dark: path(ROOTS_LAYOUT, '/header/dark'),
    overlay: path(ROOTS_LAYOUT, '/header/overlay'),
  },
};

export const PATH_CORPORATE = {
  root: ROOTS_CORPORATE,
  about: path(ROOTS_CORPORATE, '/about'),
  team: path(ROOTS_CORPORATE, '/team'),
  faqs: path(ROOTS_CORPORATE, '/faqs'),
  contact: path(ROOTS_CORPORATE, '/contact'),
  pricing: path(ROOTS_CORPORATE, '/pricing'),
  license: path(ROOTS_CORPORATE, '/license'),
};

export const PATH_FORMS = {
  root: ROOTS_FORMS,
  templates: path(ROOTS_FORMS, '/templates'),
  templatesFolder: (folderId: string) => path(ROOTS_FORMS, `/templates/folder/${folderId}`),
  globalTemplates: path(ROOTS_FORMS, '/global-templates'),
  configSets: path(ROOTS_FORMS, '/config-sets'),
  schedules: path(ROOTS_FORMS, '/schedules'),
  queues: path(ROOTS_FORMS, '/queues'),
};

export const PATH_CHAT = {
  root: ROOTS_CHAT,
  channel: (channelId: string) => path(ROOTS_CHAT, `/channel/${channelId}`),
  thread: (channelId: string, threadId: string) => path(ROOTS_CHAT, `/channel/${channelId}/thread/${threadId}`),
};

export const PATH_TAGS = {
  root: ROOTS_TAGS,
};

export const PATH_COURSES = {
  root: ROOTS_COURSES,
  courses: path(ROOTS_COURSES, '/courses'),
  coursesFolder: (folderId: string) => path(ROOTS_COURSES, `/courses/folder/${folderId}`),
  enrollments: path(ROOTS_COURSES, '/enrollments'),
  /** Course Approvals – conversation list only (no chat sidebar) */
  approvals: path(ROOTS_COURSES, '/approvals'),
  add: path(ROOTS_COURSES, '/courses/add'),
  detail: (id: string | number) => path(ROOTS_COURSES, `/courses/${id}`),
  edit: (id: string | number) => path(ROOTS_COURSES, `/courses/${id}/edit`),
  pageAdd: (courseId: string | number) => path(ROOTS_COURSES, `/courses/${courseId}/pages/add`),
  pageView: (courseId: string | number, pageId: string | number) => path(ROOTS_COURSES, `/courses/${courseId}/pages/${pageId}`),
  pageEdit: (courseId: string | number, pageId: string | number) => path(ROOTS_COURSES, `/courses/${courseId}/pages/${pageId}/edit`),
  enrollmentAdd: path(ROOTS_COURSES, '/enrollments/add'),
  enrollmentView: (enrollmentId: string | number) => path(ROOTS_COURSES, `/enrollments/${enrollmentId}`),
  enrollmentEdit: (enrollmentId: string | number) => path(ROOTS_COURSES, `/enrollments/${enrollmentId}/edit`),
  /** Course progress inline form fill/submit (new tab). Use with ?courseId=...&pageId=...&formBlockId=... */
  enrollmentProgressForm: (
    enrollmentId: string | number,
    pageId: string,
    formBlockId: string,
    courseId?: string
  ) => {
    const base =
      path(ROOTS_COURSES, `/enrollments/${enrollmentId}/progress/form`) +
      `?pageId=${encodeURIComponent(pageId)}&formBlockId=${encodeURIComponent(formBlockId)}`;
    return courseId ? `${base}&courseId=${encodeURIComponent(courseId)}` : base;
  },
};

export const PATH_KNOWLEDGE_BASE = {
  root: ROOTS_KNOWLEDGE_BASE,
  folder: (folderId: string) => path(ROOTS_KNOWLEDGE_BASE, `/folder/${folderId}`),
};

export const PATH_USER_PROFILE = {
  root: ROOTS_PROFILE,
  details: path(ROOTS_PROFILE, '/details'),
  preferences: path(ROOTS_PROFILE, '/preferences'),
  personalInformation: path(ROOTS_PROFILE, '/personal-information'),
  security: path(ROOTS_PROFILE, '/security'),
  activity: path(ROOTS_PROFILE, '/activity'),
  action: path(ROOTS_PROFILE, '/actions'),
  help: path(ROOTS_PROFILE, '/help'),
  feedback: path(ROOTS_PROFILE, '/feedback'),
};

export const PATH_SOCIAL = {
  root: ROOTS_SOCIAL,
  feed: path(ROOTS_SOCIAL, '/feed'),
  activity: path(ROOTS_SOCIAL, '/activity'),
  followers: path(ROOTS_SOCIAL, '/followers'),
  settings: path(ROOTS_SOCIAL, '/settings'),
};

export const PATH_BLOG = {
  root: ROOTS_BLOG,
  details: (id: string | number): string => path(ROOTS_BLOG, `/view/${id}`),
};

export const PATH_CAREERS = {
  root: ROOTS_CAREERS,
  new: path(ROOTS_CAREERS, `/new`),
};

export const PATH_ACCOUNT = {
  root: ROOTS_ACCOUNT,
  settings: path(ROOTS_ACCOUNT, '/settings'),
  security: path(ROOTS_ACCOUNT, '/security'),
  activity: path(ROOTS_ACCOUNT, '/activity'),
  billing: path(ROOTS_ACCOUNT, '/billing'),
  statements: path(ROOTS_ACCOUNT, '/statements'),
  referral: path(ROOTS_ACCOUNT, '/referral'),
  api: path(ROOTS_ACCOUNT, '/api-keys'),
  logs: path(ROOTS_ACCOUNT, '/logs'),
};

export const PATH_AUTH = {
  root: ROOTS_AUTH,
  signin: path(ROOTS_AUTH, '/signin'),
  signup: path(ROOTS_AUTH, '/signup'),
  passwordReset: path(ROOTS_AUTH, '/password-reset'),
  passwordConfirm: path(ROOTS_AUTH, '/password-confirmation'),
  welcome: path(ROOTS_AUTH, '/welcome'),
  verifyEmail: path(ROOTS_AUTH, '/verify-email'),
  verifyOtp: path(ROOTS_AUTH, '/verify-otp'),
  accountDelete: path(ROOTS_AUTH, '/account-delete'),
};

export const PATH_ERROR = {
  root: ROOTS_ERRORS,
  error400: path(ROOTS_ERRORS, '/400'),
  error403: path(ROOTS_ERRORS, '/403'),
  error404: path(ROOTS_ERRORS, '/404'),
  error500: path(ROOTS_ERRORS, '/500'),
  error503: path(ROOTS_ERRORS, '/503'),
};

export const PATH_PROJECTS = {
  root: ROOTS_PROJECTS,
  details: (id: string | number): string => path(ROOTS_PROJECTS, `/view/${id}`),
};

export const PATH_CONTACTS = {
  root: ROOTS_CONTACTS,
  details: (id: string | number): string => path(ROOTS_CONTACTS, `/view/${id}`),
  new: path(ROOTS_CONTACTS, '/new'),
  editDetails: (id: string | number): string =>
    path(ROOTS_CONTACTS, `/edit/${id}`),
};

export const PATH_USER_MGMT = {
  root: ROOTS_USER_MGMT,
  users: {
    all: path(ROOTS_USER_MGMT, '/users'),
    details: (id: string | number): string =>
      path(ROOTS_USER_MGMT, `/view/${id}`),
  },
  roles: {
    all: path(ROOTS_USER_MGMT, '/roles'),
    details: (id: string | number): string =>
      path(ROOTS_USER_MGMT, `/roles/view/${id}`),
  },
  permissions: path(ROOTS_USER_MGMT, '/permissions'),
};

export const PATH_INVOICE = {
  root: ROOTS_INVOICE,
  new: path(ROOTS_INVOICE, `/new`),
  details: (id: string | number): string =>
    path(ROOTS_USER_MGMT, `/view/${id}`),
};

export const PATH_FILE = {
  root: ROOTS_FILE_MGMT,
  files: path(ROOTS_FILE_MGMT, `/files`),
  blank: path(ROOTS_FILE_MGMT, `/blank`),
};

export const PATH_INBOX = {
  root: ROOTS_INBOX,
  new: path(ROOTS_INBOX, `/new`),
  details: (id: string | number): string => path(ROOTS_INBOX, `/view/${id}`),
  blank: path(ROOTS_INBOX, `/blank`),
};

export const PATH_CALENDAR = {
  root: ROOTS_CALENDAR,
};

export const PATH_SUBSCRIPTION = {
  root: ROOTS_SUBSCRIPTION,
  list: path(ROOTS_SUBSCRIPTION, `/list`),
  new: path(ROOTS_SUBSCRIPTION, `/new`),
  details: (id: string | number): string =>
    path(ROOTS_SUBSCRIPTION, `/view/${id}`),
};

export const PATH_START = {
  root: 'https://mantine-analytics-dashboard-docs.netlify.app/getting-started',
};

export const PATH_DOCS = {
  help: 'https://github.com/design-sparx/antd-multipurpose-dashboard/blob/main/README.md',
  components: 'https://6546507b657a74164abf2db6-oniqlpqtfs.chromatic.com/',
  productRoadmap:
    'https://kelvink96.notion.site/1af2c000eb4f4b1688684cb2d88d5ee4?v=eb14f3050b7d4357821dbcb4bb61b636&p=752cacbf390f4d1cbc0e625550391d9b&pm=s',
};

export const PATH_CHANGELOG = {
  root: '',
};

export const PATH_GITHUB = {
  org: 'https://github.com/design-sparx',
  personal: 'https://github.com/kelvink96',
  repo: 'https://github.com/design-sparx/antd-multipurpose-dashboard',
};

export const PATH_SOCIALS = {
  behance: 'https://www.behance.net/kelvink96',
  dribbble: 'https://dribbble.com/kelvink96',
  facebook: 'https://www.facebook.com/kelvinkk96',
  instagram: 'https://www.instagram.com/kelvink_96/',
  linkedin: 'https://www.linkedin.com/in/kelvink96/',
  youtube: 'https://twitter.com/kelvink_96',
};

export const PATH_ABOUT = {
  root: ROOTS_ABOUT,
};

export const PATH_USERS = {
  root: '/users',
  profileDetail: (profileId: string) => `/users/${profileId}`,
};

export const PATH_ANALYTICS = {
  root: '/analytics',
};
