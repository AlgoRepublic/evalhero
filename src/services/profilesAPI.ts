import { Profile } from '../features/auth/authSlice';
import { api } from './api';
import { toFormData } from '../utils/formDataHelper';

export interface ProfilesMetadata {
  count: number;
  page: number;
  perPage: number;
}

export interface ProfilesData {
  metadata: ProfilesMetadata;
  records: Profile[];
}

export interface ProfilesResponse {
  success: boolean;
  message: string;
  data: {
    profiles: ProfilesData;
  };
}

/** Request body for GET /api/v1/profiles */
export interface ProfilesListRequest {
  page?: number;
  perPage?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  cursor?: string;
  userName?: string;
  userEmailOrPhone?: string;
  roles?: string[];
  departments?: string[];
  locations?: string[];
}

/** Response shape from GET /api/v1/profiles */
export interface ProfilesListResponse {
  success: boolean;
  message: string;
  data: {
    profiles: {
      records: Profile[];
      metadata: {
        count: number;
        page: number;
        perPage: number;
      };
    };
  };
}

export interface ProfileStatsSummary {
  totalStats: number;
  uniqueSubmissions: number;
  uniqueSubjects: number;
  uniqueAssignees: number;
  uniqueQuestions: number;
  uniqueTags: number;
  statsAsSubject: number;
  statsAsAssignee: number;
}

export interface ProfileStatsPassFail {
  total: number;
  pass: number;
  fail: number;
  passRate: number;
}

export interface ProfileStatsScore {
  total: number;
  average: number;
  averageOutOf: number;
  min: number;
  max: number;
  totalScore: number;
  totalScoreOutOf: number;
  averagePercentage: number;
}

export interface ProfileStatsTag {
  _id: string;
  name: string;
}

export interface ProfileStatsData {
  profile: {
    _id: string;
    name: string;
  };
  tags: ProfileStatsTag[];
  summary: ProfileStatsSummary;
  passFail: ProfileStatsPassFail;
  score: ProfileStatsScore;
}

export interface ProfileStatsResponse {
  success: boolean;
  message: string;
  data: {
    stats: ProfileStatsData;
  };
}

export interface GetProfileStatsRequest {
  tagId?: string[];
  subjectIds: string[];
  includeGrowth?: boolean;
  includeMomentum?: boolean;
  startDate?: string;
  endDate?: string;
}

// 🔹 RTK Query API
export const profilesApi = api.injectEndpoints({
  endpoints: (build) => ({
    // 🟢 GET - Profiles List (paginated, with filters)
    getProfiles: build.query<ProfilesListResponse, ProfilesListRequest>({
      query: (body) => ({
        url: `/profiles`,
        method: 'GET',
        params: {
          page: body.page ?? 1,
          perPage: Math.min(body.perPage ?? 10, 100), // API max: 100
          sortBy: body.sortBy ?? 'createdAt',
          order: body.order ?? 'desc',
          ...(body.cursor && { cursor: body.cursor }),
          ...(body.userName && { userName: body.userName }),
          ...(body.userEmailOrPhone && { userEmailOrPhone: body.userEmailOrPhone }),
          ...(body.roles?.length && { roles: body.roles }),
          ...(body.departments?.length && { departments: body.departments }),
          ...(body.locations?.length && { locations: body.locations }),
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.profiles.records.map((profile) => ({
                type: 'Profile' as const,
                id: profile._id,
              })),
              { type: 'Profile', id: 'LIST' },
            ]
          : [{ type: 'Profile', id: 'LIST' }],
    }),

    // 🟡 POST - Profile Statistics
    getProfileStats: build.mutation<
      ProfileStatsResponse,
      GetProfileStatsRequest
    >({
      query: ({ tagId, subjectIds, includeGrowth, includeMomentum, startDate, endDate }) => ({
        url: `/profiles/stats`,
        method: 'POST',
        body: toFormData({ tagId, subjectIds, includeGrowth,includeMomentum,startDate,endDate }),
      }),
    }),
  }),
  overrideExisting: false,
});

// 🔹 Hooks
export const { useGetProfilesQuery, useGetProfileStatsMutation } = profilesApi;
