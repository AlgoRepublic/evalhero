import React, { useEffect, useState } from 'react';
import { Badge, notification, theme } from 'antd';
import { WifiOutlined, DisconnectOutlined } from '@ant-design/icons';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

/**
 * OfflineIndicator component that shows network status
 * Displays a badge when offline and shows notifications on status changes
 */
export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [prevStatus, setPrevStatus] = useState<boolean | null>(null);
  const currentTheme = useSelector((state: RootState) => state.theme.mytheme);
  const { token } = theme.useToken();
  const [api, contextHolder] = notification.useNotification();

  useEffect(() => {
    // Only show notification on status change, not on initial mount
    if (prevStatus !== null && prevStatus !== isOnline) {
      if (!isOnline) {
        api.warning({
          message: 'You are offline',
          description: 'Please check your internet connection. Some features may be limited.',
          duration: 4,
          placement: 'topRight',
          icon: <DisconnectOutlined style={{ color: token.colorWarning }} />,
        });
      } else {
        api.success({
          message: 'You are back online',
          description: 'Your connection has been restored.',
          duration: 3,
          placement: 'topRight',
          icon: <WifiOutlined style={{ color: token.colorSuccess }} />,
        });
      }
    }
    setPrevStatus(isOnline);
  }, [isOnline, prevStatus, api, token]);

  // Don't render anything if online (to avoid cluttering UI)
  if (isOnline) {
    return <>{contextHolder}</>;
  }

  return (
    <>
      {contextHolder}
      <Badge
        status="error"
        title="Offline - No internet connection"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 9999,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            backgroundColor: currentTheme === 'dark' ? token.colorErrorBg : token.colorError,
            color: currentTheme === 'dark' ? token.colorError : '#fff',
            borderRadius: token.borderRadius,
            boxShadow: token.boxShadow,
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <DisconnectOutlined />
          <span>Offline</span>
        </div>
      </Badge>
    </>
  );
};
