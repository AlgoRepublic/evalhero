// src/services/roleApi.ts
import { toFormData } from '../utils/formDataHelper';
import { api } from './api';

export interface Role {
  _id: string;
  name: string;
  permissionCodes: string[];
  deletedAt?: string | null;
  organization?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateRoleDto {
  name: string;
  permissionCodes?: string[];
}

export interface UpdateRoleDto {
  id: string;
  name: string;
  permissionCodes?: string[];
  restore?: boolean;
}

export const roleApi = api.injectEndpoints({
  endpoints: (build) => ({
    getRoles: build.query<{
      success: boolean;
      message: string;
      data: {
        roles: {
          records: Role[];
        };
      };
    }, void>({
      query: () => `/roles`,
      providesTags: (result) =>
        result?.data?.roles?.records?.length
          ? [
              ...result.data.roles.records.map(({ _id }) => ({
                type: 'Role' as const,
                id: _id,
              })),
              { type: 'Role', id: 'LIST' },
            ]
          : [{ type: 'Role', id: 'LIST' }],
    }),

    addRole: build.mutation<Role, CreateRoleDto>({
      query: (body) => ({
        url: `/roles`,
        method: 'POST',
        body: toFormData(body),
      }),
      invalidatesTags: [{ type: 'Role', id: 'LIST' }],
    }),

    updateRole: build.mutation<Role, UpdateRoleDto>({
      query: ({ id, ...body }) => ({
        url: `/roles/${id}`,
        method: 'PUT',
        body: toFormData(body),
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'Role', id: arg.id },
        { type: 'Role', id: 'LIST' },
      ],
    }),

    deleteRole: build.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `/roles/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'Role', id: arg.id },
        { type: 'Role', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetRolesQuery,
  useAddRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} = roleApi;
