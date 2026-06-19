/**
 * Analytics API - aggregates data from assignments, submissions, templates, tags, profiles
 * for the super admin analytics dashboard.
 *
 * IMPORTANT: All fetching is done on the frontend. The backend returns raw records.
 * This module handles pagination to ensure we get ALL data, not just the first page.
 */
import { store } from '../store';
import { assignmentsApi } from './assignmentsApi';
import { queueApi } from './queueApi';
import { templateApi } from './templatesAPI';
import { tagsApi } from './tagsApi';
import { profilesApi } from './profilesAPI';
import type { Assignment, AssignmentsResponse } from './assignmentsApi';
import type { QueueSubmission, QueueSubmissionsResponse } from './queueApi';
import type { Template, TemplatesResponse } from './templatesAPI';
import type { Tag, TagsResponse } from './tagsApi';
import type { ProfilesListResponse } from './profilesAPI';
import type { User } from '../features/auth/authSlice';

// Default page size for paginated fetches
const DEFAULT_PAGE_SIZE = 100;
const SUBMISSIONS_PAGE_SIZE = 2000;
const BATCH_SIZE = 8;

/**
 * Progress callback type for tracking fetch progress
 */
export type FetchProgressCallback = (phase: AnalyticsFetchPhase, progress: number, details?: string) => void;

/**
 * Phases of analytics data fetching
 */
export type AnalyticsFetchPhase =
  | 'loading_assignments'
  | 'loading_templates'
  | 'loading_tags'
  | 'loading_profiles'
  | 'loading_submissions'
  | 'processing';

/**
 * Extended raw payload including profiles for name resolution
 */
export interface AnalyticsRawPayload {
  submissions: QueueSubmission[];
  assignments: Assignment[];
  schemas: Array<{ _id: string; version?: number; formTemplate: string }>;
  templates: Array<{ _id: string; name: string }>;
  tags: Array<{ _id: string; name: string; deletedAt?: string | null }>;
  profiles: ProfileData[];
}

/**
 * Profile data structure for analytics - simplified version of Profile
 */
export interface ProfileData {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
}

/**
 * Profile lookup map type for name resolution
 */
export interface ProfileLookup {
  byId: Record<string, ProfileData>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchWithDispatch<T>(initiate: () => any): Promise<T> {
  const result = (await store.dispatch(initiate())) as {
    data?: T;
    isSuccess?: boolean;
    error?: unknown;
  };
  if (result?.error) throw result.error;
  if (result?.isSuccess && result?.data != null) return result.data;
  throw new Error('Analytics fetch failed');
}

/**
 * Fetches a single page of submissions for an assignment
 */
async function fetchSubmissionsPageForAssignment(
  assignmentId: string,
  page: number
): Promise<QueueSubmission[]> {
  const res = await fetchWithDispatch<QueueSubmissionsResponse>(() =>
    queueApi.endpoints.getQueueSubmissions.initiate({
      assignmentId,
      page,
      perPage: SUBMISSIONS_PAGE_SIZE,
      sortBy: 'updatedAt',
      order: 'desc',
    })
  );
  return res?.data?.submissions?.records ?? [];
}

/**
 * Fetches ALL submissions for an assignment by paginating through all pages
 */
async function fetchAllSubmissionsForAssignment(
  assignmentId: string,
  onProgress?: FetchProgressCallback
): Promise<QueueSubmission[]> {
  const allSubmissions: QueueSubmission[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const submissions = await fetchSubmissionsPageForAssignment(assignmentId, page);
    allSubmissions.push(...submissions);

    if (submissions.length < SUBMISSIONS_PAGE_SIZE) {
      hasMore = false;
    } else {
      page++;
    }

    onProgress?.('loading_submissions', page * SUBMISSIONS_PAGE_SIZE, `Page ${page}`);
  }

  return allSubmissions;
}

/**
 * Fetches all pages of a paginated endpoint
 */
async function fetchAllPages<R>(
  fetchPage: (page: number) => Promise<{ records: R[]; metadata: { count: number; page: number; perPage: number } }>,
  onProgress?: FetchProgressCallback,
  phase?: AnalyticsFetchPhase
): Promise<R[]> {
  const allRecords: R[] = [];
  let page = 1;
  let hasMore = true;
  const firstPage = await fetchPage(page);
  allRecords.push(...firstPage.records);
  const totalCount = firstPage.metadata.count;

  onProgress?.(phase ?? 'loading_assignments', allRecords.length, `Fetched ${allRecords.length} of ${totalCount}`);

  while (hasMore) {
    const expectedTotal = page * firstPage.metadata.perPage;
    if (allRecords.length >= totalCount || allRecords.length >= expectedTotal) {
      hasMore = allRecords.length < totalCount;
      page++;
      if (hasMore) {
        const nextPage = await fetchPage(page);
        allRecords.push(...nextPage.records);
        onProgress?.(phase ?? 'loading_assignments', allRecords.length, `Fetched ${allRecords.length} of ${totalCount}`);
      }
    } else {
      hasMore = false;
    }
  }

  return allRecords;
}

/**
 * Extracts user info from a Profile's user field (which can be string ID or User object)
 */
function extractUserFromProfile(profile: { user?: string | User }): { name: string; email?: string; avatar?: string } {
  const user = profile.user;
  if (!user) return { name: '' };
  if (typeof user === 'string') return { name: '' };
  return {
    name: user.name ?? '',
    email: user.email,
    avatar: user.avatar,
  };
}

/**
 * Fetches all assignments (both one_time and recurrence types) with pagination
 */
async function fetchAllAssignments(
  onProgress?: FetchProgressCallback
): Promise<Assignment[]> {
  // First, get count of all assignments by fetching both types
  const [oneTimeRes, recurrenceRes] = await Promise.all([
    fetchWithDispatch<AssignmentsResponse>(() =>
      assignmentsApi.endpoints.getAssignments.initiate({
        page: 1,
        perPage: 1,
        type: 'one_time',
        sortBy: 'dueDate',
        order: 'desc',
      })
    ),
    fetchWithDispatch<AssignmentsResponse>(() =>
      assignmentsApi.endpoints.getAssignments.initiate({
        page: 1,
        perPage: 1,
        type: 'recurrence',
        sortBy: 'dueDate',
        order: 'desc',
      })
    ),
  ]);

  const oneTimeCount = oneTimeRes?.data?.metadata?.count ?? 0;
  const recurrenceCount = recurrenceRes?.data?.metadata?.count ?? 0;
  const totalCount = oneTimeCount + recurrenceCount;

  onProgress?.('loading_assignments', 0, `Total assignments: ${totalCount}`);

  const allAssignments: Assignment[] = [];

  // Fetch all one_time assignments
  if (oneTimeCount > 0) {
    const oneTimeAssignments = await fetchAllPages<Assignment>(
      async (page) => {
        const res = await fetchWithDispatch<AssignmentsResponse>(() =>
          assignmentsApi.endpoints.getAssignments.initiate({
            page,
            perPage: DEFAULT_PAGE_SIZE,
            type: 'one_time',
            sortBy: 'dueDate',
            order: 'desc',
          })
        );
        return {
          records: res?.data?.records ?? [],
          metadata: res?.data?.metadata ?? { count: 0, page: 1, perPage: DEFAULT_PAGE_SIZE },
        };
      },
      onProgress,
      'loading_assignments'
    );
    allAssignments.push(...oneTimeAssignments);
  }

  // Fetch all recurrence assignments
  if (recurrenceCount > 0) {
    const recurrenceAssignments = await fetchAllPages<Assignment>(
      async (page) => {
        const res = await fetchWithDispatch<AssignmentsResponse>(() =>
          assignmentsApi.endpoints.getAssignments.initiate({
            page,
            perPage: DEFAULT_PAGE_SIZE,
            type: 'recurrence',
            sortBy: 'dueDate',
            order: 'desc',
          })
        );
        return {
          records: res?.data?.records ?? [],
          metadata: res?.data?.metadata ?? { count: 0, page: 1, perPage: DEFAULT_PAGE_SIZE },
        };
      },
      onProgress,
      'loading_assignments'
    );
    allAssignments.push(...recurrenceAssignments);
  }

  return allAssignments;
}

/**
 * Fetches all templates with pagination
 */
async function fetchAllTemplates(
  onProgress?: FetchProgressCallback
): Promise<Array<{ _id: string; name: string }>> {
  const templates = await fetchAllPages<Template>(
    async (page) => {
      const res = await fetchWithDispatch<TemplatesResponse>(() =>
        templateApi.endpoints.getTemplates.initiate({
          page,
          perPage: DEFAULT_PAGE_SIZE,
          sortBy: 'name',
          order: 'asc',
        })
      );
      return {
        records: res?.data?.records ?? [],
        metadata: res?.data?.metadata ?? { count: 0, page: 1, perPage: DEFAULT_PAGE_SIZE },
      };
    },
    onProgress,
    'loading_templates'
  );

  return templates.map((t: Template) => ({ _id: t._id, name: t.name ?? '' }));
}

/**
 * Fetches all tags with pagination
 */
async function fetchAllTags(
  onProgress?: FetchProgressCallback
): Promise<Array<{ _id: string; name: string; deletedAt?: string | null }>> {
  const tags = await fetchAllPages<Tag>(
    async (page) => {
      const res = await fetchWithDispatch<TagsResponse>(() =>
        tagsApi.endpoints.getTags.initiate({
          page,
          perPage: DEFAULT_PAGE_SIZE,
          sortBy: 'name',
          order: 'asc',
        })
      );
      return {
        records: res?.data?.tags?.records ?? [],
        metadata: res?.data?.tags?.metadata ?? { count: 0, page: 1, perPage: DEFAULT_PAGE_SIZE },
      };
    },
    onProgress,
    'loading_tags'
  );

  return tags.map((t: Tag) => ({
    _id: t._id,
    name: t.name ?? '',
    deletedAt: t.deletedAt ?? null,
  }));
}

/**
 * Fetches all profiles with pagination for name resolution
 */
async function fetchAllProfiles(
  onProgress?: FetchProgressCallback
): Promise<ProfileData[]> {
  const profiles = await fetchAllPages<ProfileData>(
    async (page) => {
      const res = await fetchWithDispatch<ProfilesListResponse>(() =>
        profilesApi.endpoints.getProfiles.initiate({
          page,
          perPage: DEFAULT_PAGE_SIZE,
          sortBy: 'name',
          order: 'asc',
        })
      );
      const records = res?.data?.profiles?.records ?? [];
      // Transform to our simplified ProfileData format
      const profileData: ProfileData[] = records.map((p) => {
        const userInfo = extractUserFromProfile(p);
        return {
          _id: p._id,
          name: userInfo.name || p._id,
          email: userInfo.email,
          avatar: userInfo.avatar,
        };
      });
      return {
        records: profileData,
        metadata: res?.data?.profiles?.metadata ?? { count: 0, page: 1, perPage: DEFAULT_PAGE_SIZE },
      };
    },
    onProgress,
    'loading_profiles'
  );

  return profiles;
}

/**
 * Runs tasks in batches to avoid hammering the API
 */
async function runBatched<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: FetchProgressCallback,
  phase?: AnalyticsFetchPhase
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((item, idx) => fn(item, i + idx)));
    results.push(...batchResults);

    const progress = Math.min(((i + batch.length) / items.length) * 100, 100);
    onProgress?.(phase ?? 'loading_submissions', progress, `Processed ${i + batch.length} of ${items.length}`);
  }
  return results;
}

/**
 * Builds schema map from assignments for template resolution
 */
function buildSchemaMap(assignments: Assignment[]): Array<{ _id: string; version?: number; formTemplate: string }> {
  const schemaMap = new Map<string, { _id: string; version?: number; formTemplate: string }>();
  for (const a of assignments) {
    const schema = a.formTemplateSchema;
    const templateId =
      typeof a.formTemplate === 'object' && a.formTemplate?._id
        ? a.formTemplate._id
        : '';
    const sid =
      typeof schema === 'object' && schema && '_id' in schema
        ? (schema as { _id: string })._id
        : typeof schema === 'string'
          ? schema
          : '';
    if (sid && !schemaMap.has(sid)) {
      schemaMap.set(sid, {
        _id: sid,
        version:
          typeof schema === 'object' && schema && 'version' in schema
            ? (schema as { version?: number }).version
            : undefined,
        formTemplate: templateId,
      });
    }
  }
  return Array.from(schemaMap.values());
}

/**
 * Builds a profile lookup map for efficient name resolution
 */
export function buildProfileLookup(profiles: ProfileData[]): ProfileLookup {
  const byId: Record<string, ProfileData> = {};
  for (const profile of profiles) {
    if (profile._id) {
      byId[profile._id] = profile;
    }
  }
  return { byId };
}

/**
 * Gets the display name for a profile, with fallbacks
 */
export function getProfileDisplayName(profile: ProfileData | undefined, fallbackId: string): string {
  if (!profile) return fallbackId;
  if (profile.name && String(profile.name).trim()) return String(profile.name).trim();
  if (profile.email && String(profile.email).trim()) return String(profile.email).trim();
  return fallbackId;
}

/**
 * Gets the avatar key for a profile
 */
export function getProfileAvatarKey(profile: ProfileData | undefined): string | null {
  if (!profile) return null;
  return profile.avatar ?? null;
}

/**
 * Fetches all data needed for analytics in the shape expected by the normalizer.
 * Uses existing APIs: assignments (all types), queue submissions per assignment, templates, tags, profiles.
 *
 * @param onProgress Optional callback for tracking fetch progress
 * @returns Raw analytics payload with all data
 */
export async function fetchAnalyticsData(
  onProgress?: FetchProgressCallback
): Promise<AnalyticsRawPayload> {
  // Fetch all foundational data in parallel
  onProgress?.('loading_assignments', 0, 'Starting...');

  const [assignments, templates, tags, profiles] = await Promise.all([
    fetchAllAssignments(onProgress),
    fetchAllTemplates(onProgress),
    fetchAllTags(onProgress),
    fetchAllProfiles(onProgress),
  ]);

  // Build schema map
  const schemas = buildSchemaMap(assignments);

  // Fetch submissions for all assignments in batches
  onProgress?.('loading_submissions', 0, `Fetching submissions for ${assignments.length} assignments`);

  const allSubmissions: QueueSubmission[] = [];
  const submissionBatches = await runBatched(
    assignments,
    BATCH_SIZE,
    async (a: Assignment) => {
      const list = await fetchAllSubmissionsForAssignment(a._id, onProgress);
      return list.map((s): QueueSubmission => {
        const assignmentId =
          typeof s.assignment === 'object' && s.assignment && '_id' in s.assignment
            ? (s.assignment as Assignment)._id
            : typeof s.assignment === 'string'
              ? s.assignment
              : (s as { assignmentId?: string }).assignmentId ?? a._id;
        return { ...s, assignment: assignmentId };
      });
    },
    onProgress,
    'loading_submissions'
  );

  for (const batch of submissionBatches) {
    allSubmissions.push(...batch);
  }

  onProgress?.('processing', 100, 'Complete!');

  return {
    submissions: allSubmissions,
    assignments,
    schemas,
    templates,
    tags,
    profiles,
  };
}
