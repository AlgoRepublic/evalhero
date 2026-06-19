import { Avatar, Spin, AvatarProps } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useAssetUrl } from '../../hooks/useAssetUrl';

export interface AssetAvatarProps extends Omit<AvatarProps, 'src'> {
  /** S3 key or existing full URL. Resolved via signed-url API when not a full URL. */
  avatarKey?: string | null;
  /** Fallback content when no image (e.g. initial letter). */
  fallback?: React.ReactNode;
}

/**
 * Avatar that resolves S3 keys to signed URLs. Use instead of <Avatar src={getAvatarUrl(...)} />.
 * Shows a loading spinner while the image URL is being resolved.
 */
export function AssetAvatar({ avatarKey, fallback, ...avatarProps }: AssetAvatarProps) {
  const { url, isLoading } = useAssetUrl(avatarKey);
  const fallbackNode = fallback ?? <UserOutlined />;

  return (
    <Spin size="small" spinning={isLoading}>
      <Avatar src={url} {...avatarProps}>
        {!url ? fallbackNode : null}
      </Avatar>
    </Spin>
  );
}
