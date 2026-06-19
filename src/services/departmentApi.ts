import { toFormData } from '../utils/formDataHelper';
import { api } from './api';

export interface Department {
  _id: string;
  name: string;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateDepartmentDto {
  id: string;
  name: string;
  restore?: boolean;
}

export const departmentApi = api.injectEndpoints({
  endpoints: (build) => ({
    getDepartments: build.query<{
      success: boolean;
      message: string;
      data: {
        departments: {
            records: Department[];
        }
      };
    }, void>({
      query: () => `/departments`,
      providesTags: (result) =>
        result?.data?.departments?.records?.length
          ? [
              ...result.data.departments.records.map(({ _id }) => ({
                type: 'Department' as const,
                _id,
              })),
              { type: 'Department', id: 'LIST' },
            ]
          : [{ type: 'Department', id: 'LIST' }],
    }),

    addDepartment: build.mutation<Department, { name: string }>({
      query: ({ name }) => ({
        url: `/departments`,
        method: 'POST',
        body: toFormData({ name }),
      }),
      invalidatesTags: [{ type: 'Department', id: 'LIST' }],
    }),

    updateDepartment: build.mutation<Department, UpdateDepartmentDto>({
      query: ({ id, ...body }) => ({
        url: `/departments/${id}`,
        method: 'PUT',
        body: toFormData(body),
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'Department', id: arg.id },
        { type: 'Department', id: 'LIST' },
      ],
    }),

    deleteDepartment: build.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `/departments/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'Department', id: arg.id },
        { type: 'Department', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetDepartmentsQuery,
  useAddDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useLazyGetDepartmentsQuery,
} = departmentApi;
