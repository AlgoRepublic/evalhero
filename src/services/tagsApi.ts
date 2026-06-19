import { toFormData } from '../utils/formDataHelper';
import { api } from './api';

export interface Tag {
  _id: string;
  name: string;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TagsMetadata {
  count: number;
  page: number;
  perPage: number;
}

export interface TagsData {
  metadata: TagsMetadata;
  records: Tag[];
}

export interface TagsResponse {
  success: boolean;
  message: string;
  data: {
    tags: TagsData;
  };
}

export interface TagResponse {
  success: boolean;
  message: string;
  data: {
    tag: Tag;
  };
}

export interface GetTagsByIdsRequest {
  tagIds: string[];
}

export interface GetTagsByIdsResponse {
  success: boolean;
  message: string;
  data: {
    tags: Tag[];
  };
}

export interface UpdateTagDto {
  id: string;
  name: string;
  restore?: boolean;
}

export interface TagStatsSummary {
  totalStats: number;
  uniqueSubmissions: number;
  uniqueSubjects: number;
  uniqueAssignees: number;
  uniqueQuestions: number;
}

export interface TagStatsPassFail {
  total: number;
  pass: number;
  fail: number;
  passRate: number;
}

export interface TagStatsScore {
  total: number;
  average: number;
  averageOutOf: number;
  min: number;
  max: number;
  totalScore: number;
  totalScoreOutOf: number;
  averagePercentage: number;
}

export interface TagStatsData {
  tag: {
    _id: string;
    name: string;
  };
  summary: TagStatsSummary;
  passFail: TagStatsPassFail;
  score: TagStatsScore;
}

export interface TagStatsResponse {
  success: boolean;
  message: string;
  data: {
    stats: TagStatsData;
  };
}

// Comprehensive Tag Stats API Types
export interface ComprehensiveTagStatsRequest {
  subjectIds?: string[];
  startDate?: string;
  endDate?: string;
  tagId?: string;
  includeGrowth?: boolean;
  includeMomentum?: boolean;
}

export interface TagBreakdown {
  tagId: string;
  tagName: string;
  relevantSubmissions: number;
  pointsPct: number;
  passPct: number;
}

export interface TagLeaderboardItem {
  subjectId: string;
  userName: string;
  relSubs: number;
  pointsPct: number;
  passPct: number;
  momentum: number | null;
}

export interface GrowthSeriesPoint {
  x: string;
  y: number;
}

export interface GrowthOverall {
  pointsEarnedSeries: GrowthSeriesPoint[];
  pointsPctSeries: GrowthSeriesPoint[];
  passRateSeries: GrowthSeriesPoint[];
  activitySeries: GrowthSeriesPoint[];
}

export interface SubjectSeries {
  subjectId: string;
  pointsPct: GrowthSeriesPoint[];
  passRate: GrowthSeriesPoint[];
  activity: GrowthSeriesPoint[];
  pointsEarned: GrowthSeriesPoint[];
}

export interface GrowthData {
  days: string[];
  overall: GrowthOverall;
  subjectSeries: SubjectSeries[];
}

export interface MomentumData {
  dPoints: number;
  dPass: number;
}

export interface ComprehensiveTagStatsSummary {
  totalStats: number;
  uniqueSubmissions: number;
  uniqueSubjects: number;
  uniqueAssignees: number;
  uniqueQuestions: number;
}

export interface ComprehensiveTagStatsPassFail {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
}

export interface ComprehensiveTagStatsScore {
  total: number;
  earned: number;
  max: number;
  minScore: number;
  maxScore: number;
  avgScore: number;
  avgPct: number;
}

export interface ComprehensiveTagStatsFilters {
  subjectIds: string[] | null;
  startDate: string | null;
  endDate: string | null;
  tagId: string | null;
  includeGrowth: boolean;
  includeMomentum: boolean;
}

export interface ComprehensiveTagStatsData {
  summary: ComprehensiveTagStatsSummary;
  passFail: ComprehensiveTagStatsPassFail;
  score: ComprehensiveTagStatsScore;
  tagBreakdown: TagBreakdown[];
  tagLeaderboard: TagLeaderboardItem[] | null;
  growth: GrowthData | null;
  momentum: MomentumData | null;
  filters: ComprehensiveTagStatsFilters;
}

export interface ComprehensiveTagStatsResponse {
  success: boolean;
  message: string;
  data: {
    stats: ComprehensiveTagStatsData;
  };
}

export const tagsApi = api.injectEndpoints({
  endpoints: (build) => ({
    // 🟢 GET - List with Pagination
    getTags: build.query<
      TagsResponse,
      { page?: number; perPage?: number; sortBy?: string; order?: 'asc' | 'desc'; name?: string }
    >({
      query: ({ page = 1, perPage = 10, sortBy = 'name', order = 'asc', name }) => ({
        url: `/tags`,
        method: 'GET',
        params: {
          page,
          perPage,
          sortBy,
          order,
          ...(name ? { name } : {}),
        },
      }),
      providesTags: (result) =>
        result?.data?.tags?.records?.length
          ? [
              ...result.data.tags.records.map(({ _id }) => ({
                type: 'Tag' as const,
                id: _id,
              })),
              { type: 'Tag', id: 'LIST' },
            ]
          : [{ type: 'Tag', id: 'LIST' }],
    }),

    // 🟢 GET - Single Tag
    getTag: build.query<TagResponse, string>({
      query: (id) => ({
        url: `/tags/${id}`,
        method: 'GET',
      }),
      providesTags: (_result, _error, id) => [{ type: 'Tag', id }],
    }),

    // 🟡 POST - Get Tags by IDs
    getTagsByIds: build.query<GetTagsByIdsResponse, GetTagsByIdsRequest>({
      query: ({ tagIds }) => ({
        url: `/tags/getbyids`,
        method: 'POST',
        body: toFormData({ tagIds }),
      }),
      providesTags: (result) =>
        result?.data?.tags?.length
          ? [
              ...result.data.tags.map(({ _id }) => ({
                type: 'Tag' as const,
                id: _id,
              })),
            ]
          : [],
    }),

    // 🟡 POST - Create
    addTag: build.mutation<Tag, { name: string }>({
      query: ({ name }) => ({
        url: `/tags`,
        method: 'POST',
        body: toFormData({ name }),
      }),
      invalidatesTags: [{ type: 'Tag', id: 'LIST' }],
    }),

    // 🟡 PUT - Update
    updateTag: build.mutation<Tag, UpdateTagDto>({
      query: ({ id, ...body }) => ({
        url: `/tags/${id}`,
        method: 'PUT',
        body: toFormData({ _id: id, ...body }),
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'Tag', id: arg.id },
        { type: 'Tag', id: 'LIST' },
      ],
    }),

    // 🔴 DELETE
    deleteTag: build.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `/tags/${id}`,
        method: 'DELETE',
        body: toFormData({ _id: id }),
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'Tag', id: arg.id },
        { type: 'Tag', id: 'LIST' },
      ],
    }),

    // 🟢 GET - Tag Statistics
    getTagStats: build.query<
      TagStatsResponse,
      { tagId: string; subjectId?: string }
    >({
      query: ({ tagId, subjectId }) => ({
        url: `/tags/${tagId}/stats`,
        method: 'GET',
        params: subjectId ? { subjectId } : undefined,
      }),
      providesTags: (_result, _error, { tagId }) => [{ type: 'Tag', id: tagId }],
    }),

    // 🟡 POST - Comprehensive Tag Statistics
    getComprehensiveTagStats: build.mutation<
      ComprehensiveTagStatsResponse,
      ComprehensiveTagStatsRequest
    >({
      query: (body) => ({
        url: `/tags/stats`,
        method: 'POST',
        body: toFormData(body),
        // Send as JSON (not FormData) since the API expects JSON with arrays
      }),
    }),
  }),
});

export const {
  useGetTagsQuery,
  useLazyGetTagsQuery,
  useGetTagQuery,
  useLazyGetTagQuery,
  useGetTagsByIdsQuery,
  useLazyGetTagsByIdsQuery,
  useAddTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
  useGetTagStatsQuery,
  useLazyGetTagStatsQuery,
  useGetComprehensiveTagStatsMutation,
} = tagsApi;

