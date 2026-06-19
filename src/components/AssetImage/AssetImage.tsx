import { Spin, Image } from 'antd';
import type { ImageProps } from 'antd';
import { useAssetUrl } from '../../hooks/useAssetUrl';
import { ImgHTMLAttributes } from 'react';

export interface AssetImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** S3 key or existing full URL. Resolved via signed-url API when not a full URL. */
  src?: string | null;
  fallback?: string;
  /** Ant Design Image preview (e.g. false to disable lightbox). */
  preview?: ImageProps['preview'];
}

/** Props that are safe to pass to Ant Design Image (avoids HTMLImageElement vs wrapper div type conflicts). */
const IMAGE_SAFE_KEYS: (keyof ImageProps)[] = [
  'width', 'height', 'className', 'loading', 'referrerPolicy', 'decoding',
  'crossOrigin', 'placeholder', 'preview', 'rootClassName',
];

/**
 * Image that resolves S3 keys to signed URLs. Use instead of <img src={imageUrl} /> when src may be a key.
 * Shows a loading spinner while the image URL is being resolved.
 */
export function AssetImage({ src, alt = '', fallback, style, ...imgProps }: AssetImageProps) {
  const { url, isLoading } = useAssetUrl(src);
  const imageProps: Partial<ImageProps> = {};
  IMAGE_SAFE_KEYS.forEach((key) => {
    if (key in imgProps && imgProps[key as keyof typeof imgProps] !== undefined) {
      (imageProps as Record<string, unknown>)[key] = imgProps[key as keyof typeof imgProps];
    }
  });

  return (
    <Spin size="small" spinning={isLoading}>
      <Image
        src={url ?? undefined}
        alt={alt}
        fallback={fallback as string | undefined}
        style={style}
        {...imageProps}
      />
    </Spin>
  );
}
