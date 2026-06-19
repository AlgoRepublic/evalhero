/**
 * DM Chats API - Direct Message channels and messages
 * @see DM_CHAT_API_UI_DEVELOPER.md
 */
import { toFormData } from '../utils/formDataHelper';
import { api } from './api';

// ---------------------------------------------------------------------------
// Types (aligned with DM_CHAT_API_UI_DEVELOPER.md)
// ---------------------------------------------------------------------------

export interface DMUser {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface DMProfile {
  _id: string;
  user: DMUser;
  organization?: string;
  [key: string]: unknown;
}

/** profileId -> ISO date string (last read timestamp for that participant) */
export type LastReadByParticipants = Record<string, string>;

export interface DMChannel {
  _id: string;
  organization?: string;
  channelType: 'dm' | 'group_dm';
  participants: DMProfile[];
  lastActivityAt: string;
  /** When each participant last read; used to compute unread (messages where createdAt > lastReadAt) */
  lastReadByParticipants?: LastReadByParticipants;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface DMMessage {
  _id: string;
  channel: string;
  sentBy: DMProfile;
  action: 'message';
  actionData: { text: string };
  mentions?: DMProfile[];
  thread?: string | null;
  parentMessage?: string | null;
  localId?: string | null;
  createdAt: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface CreateOrGetDMChannelPayload {
  participantIds: string[];
}

export interface CreateOrGetDMChannelResponse {
  success: boolean;
  message: string;
  data: {
    channel: DMChannel;
    isNew: boolean;
  };
}

export interface ListDMChannelsResponse {
  success: boolean;
  message?: string;
  data: {
    channels: DMChannel[];
    hasMore: boolean;
  };
}

export interface GetDMChannelResponse {
  success: boolean;
  message?: string;
  data: { channel: DMChannel };
}

export interface SearchProfilesResponse {
  success: boolean;
  data: { profiles: DMProfile[] };
}

export interface ListDMMessagesResponse {
  success: boolean;
  data: {
    messages: DMMessage[];
    hasMore: boolean;
  };
}

export interface SendDMMessagePayload {
  text: string;
  mentions?: string[];
  localId?: string;
}

export interface SendDMMessageResponse {
  success: boolean;
  message?: string;
  data: { message: DMMessage };
}

export interface DMOnlineStatusItem {
  profileId: string;
  isOnline: boolean;
}

export interface GetDMOnlineStatusResponse {
  success: boolean;
  message?: string;
  data: { profiles: DMOnlineStatusItem[] };
}

export interface ListDMThreadRepliesResponse {
  success: boolean;
  data: {
    replies: DMMessage[];
    replyCount: number;
    hasMore: boolean;
  };
}

export interface SendDMThreadReplyPayload {
  messageId: string;
  text: string;
  mentions?: string[];
  localId?: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const dmchatsApi = api.injectEndpoints({
  endpoints: (build) => ({
    searchDMProfiles: build.query<SearchProfilesResponse['data'], { search?: string; limit?: number; excludeSelf?: boolean }>({
      query: ({ search = '', limit = 20, excludeSelf = true }) => ({
        url: '/dmchats/profiles',
        params: { search, limit, excludeSelf },
      }),
      transformResponse: (raw: SearchProfilesResponse) => raw.data,
    }),

    listDMChannels: build.query<ListDMChannelsResponse['data'], { limit?: number; before?: string } | void>({
      query: (params = {}) => ({
        url: '/dmchats/channels',
        params: { limit: params?.limit ?? 50, before: params?.before },
      }),
      transformResponse: (raw: ListDMChannelsResponse) => raw.data,
      providesTags: (result) =>
        result
          ? [
              ...result.channels.map((c) => ({ type: 'DMChannel' as const, id: c._id })),
              { type: 'DMChannel', id: 'LIST' },
            ]
          : [{ type: 'DMChannel', id: 'LIST' }],
    }),

    getDMChannel: build.query<DMChannel, string>({
      query: (channelId) => ({ url: `/dmchats/channels/${channelId}` }),
      transformResponse: (raw: GetDMChannelResponse) => raw.data.channel,
      providesTags: (_result, _err, id) => [{ type: 'DMChannel', id }],
    }),

    createOrGetDMChannel: build.mutation<CreateOrGetDMChannelResponse['data'], CreateOrGetDMChannelPayload>({
      query: (body) => ({
        url: '/dmchats/channels',
        method: 'POST',
        body: toFormData(body),
      }),
      transformResponse: (raw: CreateOrGetDMChannelResponse) => raw.data,
      invalidatesTags: [{ type: 'DMChannel', id: 'LIST' }],
    }),

    listDMMessages: build.query<
      ListDMMessagesResponse['data'],
      { channelId: string; limit?: number; before?: string; after?: string }
    >({
      query: ({ channelId, limit = 50, before, after }) => ({
        url: `/dmchats/channels/${channelId}/messages`,
        params: { limit, before, after },
      }),
      transformResponse: (raw: ListDMMessagesResponse) => raw.data,
      providesTags: (_result, _err, { channelId }) => [{ type: 'DMMessage', id: channelId }],
      keepUnusedDataFor: 0, // do not cache DM messages; always refetch when opening a channel
    }),

    markDMChannelRead: build.mutation<{ success: boolean }, string>({
      query: (channelId) => ({
        url: `/dmchats/channels/${channelId}/read`,
        method: 'POST',
      }),
    }),

    setDMTyping: build.mutation<unknown, { channelId: string; isTyping: boolean }>({
      query: ({ channelId, isTyping }) => ({
        url: `/dmchats/channels/${channelId}/typing`,
        method: 'POST',
        body: toFormData({ isTyping }),
      }),
    }),

    getDMOnlineStatus: build.query<DMOnlineStatusItem[], void>({
      query: () => ({ url: '/dmchats/online-status' }),
      transformResponse: (raw: GetDMOnlineStatusResponse) => raw.data?.profiles ?? [],
    }),

    listDMThreadReplies: build.query<
      ListDMThreadRepliesResponse['data'],
      { messageId: string; limit?: number; before?: string }
    >({
      query: ({ messageId, limit = 50, before }) => ({
        url: `/dmchats/messages/${messageId}/threads`,
        params: { limit, before },
      }),
      transformResponse: (raw: ListDMThreadRepliesResponse) => raw.data,
      providesTags: (_result, _err, { messageId }) => [{ type: 'DMMessage', id: `thread-${messageId}` }],
      keepUnusedDataFor: 0,
    }),
  }),
});

export const {
  useSearchDMProfilesQuery,
  useLazySearchDMProfilesQuery,
  useListDMChannelsQuery,
  useGetDMChannelQuery,
  useCreateOrGetDMChannelMutation,
  useListDMMessagesQuery,
  useListDMThreadRepliesQuery,
  useMarkDMChannelReadMutation,
  useSetDMTypingMutation,
  useGetDMOnlineStatusQuery,
} = dmchatsApi;
