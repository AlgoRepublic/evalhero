import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, Typography } from 'antd';
import { useSocket } from '../../context/SocketContext';
import { SOCKET_EVENTS } from '../../services/socketEvents';
// import { PATH_USER_PROFILE } from '../../constants/routes';

const COUNTDOWN_SECONDS = 30;

export interface ProfilePermissionsUpdatedPayload {
  profileId: string;
  reason: 'role_updated' | 'roles_assigned';
  message: string;
}

/**
 * Hard refresh and redirect to profile page (full page load, bypasses cache).
 */
function hardRefreshToProfile() {
  const profileUrl = `/profile?_=${Date.now()}`;
  window.location.href = profileUrl;
}

/**
 * Shows a non-closeable modal when the server sends profile:permissions:updated.
 * User must click "Reload now" for a hard refresh to profile page, or the page
 * auto-refreshes after 30 seconds. See UI-PROFILE-ROOM-REACT.md.
 */
export function PermissionNotification() {
  const [show, setShow] = useState(false);
  const [payload, setPayload] = useState<ProfilePermissionsUpdatedPayload | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { on, off, isConnected } = useSocket();

  const performReload = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setShow(false);
    setPayload(null);
    setSecondsLeft(COUNTDOWN_SECONDS);
    hardRefreshToProfile();
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    const handler = (data: ProfilePermissionsUpdatedPayload) => {
      setPayload(data);
      setShow(true);
      setSecondsLeft(COUNTDOWN_SECONDS);
    };

    on(SOCKET_EVENTS.PROFILE.PERMISSIONS_UPDATED, handler);
    return () => {
      off(SOCKET_EVENTS.PROFILE.PERMISSIONS_UPDATED, handler);
    };
  }, [isConnected, on, off]);

  // Countdown timer: when modal opens, run 30s countdown then auto reload
  useEffect(() => {
    if (!show || !payload) return;

    setSecondsLeft(COUNTDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          performReload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [show, payload, performReload]);

  const handleReloadClick = () => {
    performReload();
  };

  return (
    <Modal
      open={show && !!payload}
      title="Permissions Updated"
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={
        <Button type="primary" size="large" onClick={handleReloadClick}>
          Reload now
        </Button>
      }
      width={480}
    >
      <Typography.Paragraph>{payload?.message}</Typography.Paragraph>
      <Typography.Paragraph type="secondary">
        The page will automatically reload and redirect to your profile in{' '}
        <strong>{secondsLeft}</strong> second{secondsLeft !== 1 ? 's' : ''}.
      </Typography.Paragraph>
    </Modal>
  );
}
