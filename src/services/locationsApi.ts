// src/services/locationApi.ts
import { toFormData } from '../utils/formDataHelper';
import { api } from './api';

export interface Location {
  _id: string;
  name: string;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateLocationDto {
  id: string;
  name: string;
  restore?: boolean;
}

export const locationApi = api.injectEndpoints({
  endpoints: (build) => ({
    getLocations: build.query<{
      success: boolean;
      message: string;
      data: {
        locations: {
          records: Location[];
        };
      };
    }, void>({
      query: () => `/locations`,
      providesTags: (result) =>
        result?.data?.locations?.records?.length
          ? [
              ...result.data.locations.records.map(({ _id }) => ({
                type: 'Location' as const,
                id: _id,
              })),
              { type: 'Location', id: 'LIST' },
            ]
          : [{ type: 'Location', id: 'LIST' }],
    }),

    addLocation: build.mutation<Location, { name: string }>({
      query: ({ name }) => ({
        url: `/locations`,
        method: 'POST',
        body: toFormData({ name }),
      }),
      invalidatesTags: [{ type: 'Location', id: 'LIST' }],
    }),

    updateLocation: build.mutation<Location, UpdateLocationDto>({
      query: ({ id, ...body }) => ({
        url: `/locations/${id}`,
        method: 'PUT',
        body: toFormData(body),
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'Location', id: arg.id },
        { type: 'Location', id: 'LIST' },
      ],
    }),

    deleteLocation: build.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `/locations/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'Location', id: arg.id },
        { type: 'Location', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetLocationsQuery,
  useLazyGetLocationsQuery,
  useAddLocationMutation,
  useUpdateLocationMutation,
  useDeleteLocationMutation,
} = locationApi;
