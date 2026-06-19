/**
 * Upload API utility for file uploads.
 * Uses the api instance (baseQueryWithReauth) so auth and x-profile-id are applied.
 * Returns the path/URL from the API as-is (no base URL prepended).
 */

import type { RootState } from '../store';
import { store } from '../store';
import { api } from '../services/api';

/** API upload response shape */
interface UploadResponse {
  success?: boolean;
  data?: { url?: string; path?: string };
  url?: string;
  path?: string;
}

const uploadApi = api.injectEndpoints({
  endpoints: (build) => ({
    uploadFile: build.mutation<string, FormData>({
      query: (formData) => ({
        url: '/uploads',
        method: 'POST',
        body: formData,
      }),
      transformResponse: (response: UploadResponse): string => {
        if (response?.success && response?.data) {
          const url = response.data.url ?? response.data.path ?? '';
          if (url) return url;
        }
        const fallback = response?.path ?? response?.url ?? response?.data?.path ?? response?.data?.url ?? '';
        if (fallback) return fallback;
        throw new Error('No file URL found in upload response');
      },
    }),
  }),
  overrideExisting: true,
});

/**
 * Upload a file to the server.
 * @param file - File to upload (File, Blob, or string data URL)
 * @returns Promise with the uploaded file path/URL as returned by the API (no base URL added)
 */
export async function uploadFile(file: File | Blob | string): Promise<string> {
  const state = store.getState() as RootState;
  const token = state.auth.accessToken ?? localStorage.getItem('accessToken');
  if (!token) {
    throw new Error('No authentication token found');
  }

  let fileBlob: Blob;
  if (typeof file === 'string') {
    const res = await fetch(file);
    fileBlob = await res.blob();
  } else {
    fileBlob = file;
  }

  const formData = new FormData();
  formData.append('file', fileBlob);

  try {
    const result = await store.dispatch(uploadApi.endpoints.uploadFile.initiate(formData));
    if ('error' in result) {
      const msg = (result.error as { data?: { message?: string } })?.data?.message ?? 'Upload failed';
      throw new Error(msg);
    }
    return result.data;
  } catch (error) {
    console.error('[UploadAPI] Error uploading file:', error);
    throw error;
  }
}

