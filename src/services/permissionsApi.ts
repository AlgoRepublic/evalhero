import { setPermissions } from '../features/auth/authSlice';
import { api } from './api';

export interface Permission {
  _id: string;
  entity: string;
  name: string;
  code: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export const permissionsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getPermissions: build.query<{
      success: boolean;
      message: string;
      data: {
        permissions: {records: Permission[]};
      };
    }, void>({
      query: () => `/permissions`,
      providesTags: (result) => {
        return result?.data?.permissions?.records?.length
          ? [
              ...result.data.permissions.records.map((perm) => ({
                type: 'Permission' as const,
                id: perm._id,
              })),
              { type: 'Permission', id: 'LIST' },
            ]
          : [{ type: 'Permission', id: 'LIST' }];
      },
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const { permissions } = data.data;
          if (data.success) {
            dispatch(setPermissions(permissions.records));
          }
        } catch (e) {
          console.error('Fetching permissions error', e);
        }
      }
    }),
    
  }),
});

export const { useGetPermissionsQuery, useLazyGetPermissionsQuery } = permissionsApi;
