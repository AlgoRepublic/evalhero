import { useMemo } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { useGetAssetUrlQuery } from '../services/assetsApi';

export interface UseAssetUrlResult {
  url: string | undefined;
  isLoading: boolean;
  isError: boolean;
}

/** Keys that are MIME/types (e.g. "image", "image/png") are not S3 keys and should not be resolved. */
const MIME_TYPE_PATTERN = /^(image|image\/[\w+-]+)$/i;

/**
 * Resolves an S3 key to a signed URL via the API, or returns the value as-is if it's already a full URL.
 * Cached per key by RTK Query. No request is made when key is undefined/null/empty, a full URL, or a MIME-type string (skipToken).
 */
export function useAssetUrl(key: string | null | undefined): UseAssetUrlResult {
  const isFullUrl = typeof key === 'string' && (key.startsWith('http://') || key.startsWith('https://'));
  const isMimeTypeOnly = typeof key === 'string' && MIME_TYPE_PATTERN.test(key.trim());
  const shouldSkip = !key || isFullUrl || isMimeTypeOnly;

  const { data, isLoading, isError } = useGetAssetUrlQuery(
    shouldSkip ? skipToken : key,
  );

  return useMemo(() => {
    if (!key) return { url: undefined, isLoading: false, isError: false };
    if (isFullUrl) return { url: key, isLoading: false, isError: false };
    if (isMimeTypeOnly) return { url: undefined, isLoading: false, isError: false };
    return {
      url: data ?? undefined,
      isLoading,
      isError,
    };
  }, [key, isFullUrl, isMimeTypeOnly, data, isLoading, isError]);
}
