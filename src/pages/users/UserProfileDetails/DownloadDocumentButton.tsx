import React from 'react';
import { Button, message  } from 'antd';
import { useLazyGetAssetUrlQuery } from '../../../services/assetsApi';

export interface DownloadDocumentButtonProps {
  documentKey: string;
  isMobile?: boolean;
}

export function DownloadDocumentButton({ documentKey, isMobile = false }: DownloadDocumentButtonProps) {
  const [getAssetUrl, { isFetching }] = useLazyGetAssetUrlQuery();

  const handleDownload = React.useCallback(async () => {
    const result = await getAssetUrl(documentKey);
    const url = result.data;
    if (typeof url === 'string' && url) {
      window.open(url, '_blank');
    } else {
      message.error('Failed to get asset URL');
    }
  }, [getAssetUrl, documentKey]);

  return (
    <Button
      type="primary"
      variant="solid"
      color="purple"
      size={isMobile ? 'small' : 'middle'}
      block={isMobile}
      loading={isFetching}
      onClick={handleDownload}
      style={{ minWidth: isMobile ? 64 : 80 }}
    >
      Download
    </Button>
  );
}
