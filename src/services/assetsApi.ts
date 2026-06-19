import { api } from './api';

/**
 * API response from GET /org-storage/signed-url?key=...
 * Example: { success: true, message: "Signed URL generated successfully", data: { url: "https://..." } }
 */
interface SignedUrlApiBody {
  success?: boolean;
  message?: string;
  data?: {
    url?: string;
    signedUrl?: string;
    link?: string;
    src?: string;
    type?: string;
  } | string;
  url?: string;
  signedUrl?: string;
  link?: string;
}

/** Returns the value only if it looks like a URL; avoids returning type strings like "image". */
function asUrl(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const trimmed = value.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return '';
}

/**
 * transformResponse receives the base query return value: { data: apiBody }.
 * So the actual API response body is at response.data.
 * Only returns a value when it is a valid URL (http/https); ignores type fields like "image".
 */
export const assetsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAssetUrl: build.query<string, string>({
      query: (key) => ({
        url: '/org-storage/signed-url',
        params: { key },
      }),
      // Normalize: base query may return { data } (from fetchBaseQuery) or skipToken when skipped
      transformResponse: (baseQueryResult: unknown): string => {
        if (baseQueryResult == null || typeof baseQueryResult === 'symbol') return '';
        if (typeof baseQueryResult === 'string') return asUrl(baseQueryResult);
        // Unwrap: base query often returns { data: apiBody }
        const body = (baseQueryResult as { data?: unknown }).data ?? baseQueryResult;
        if (body == null || typeof body === 'symbol') return '';
        if (typeof body === 'string') return asUrl(body);
        const asBody = body as SignedUrlApiBody;
        const inner = asBody.data;
        if (typeof inner === 'string') return asUrl(inner);
        if (inner && typeof inner === 'object') {
          const u =
            asUrl(inner.url) ||
            asUrl(inner.signedUrl) ||
            asUrl(inner.link) ||
            asUrl(inner.src);
          if (u) return u;
        }
        return asUrl(asBody.url) || asUrl(asBody.signedUrl) || asUrl(asBody.link) || '';
      },
      providesTags: (_result, _error, key) =>
        typeof key === 'string' ? [{ type: 'AssetUrl', id: key }] : [],
    }),
  }),
  overrideExisting: false,
});

export const { useGetAssetUrlQuery, useLazyGetAssetUrlQuery } = assetsApi;
