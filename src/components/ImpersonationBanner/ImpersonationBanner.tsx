import { Button } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useEndImpersonationMutation } from '../../services/usersApi';
import { isImpersonationActive, getImpersonatedDisplay, clearImpersonationAndRestoreAdmin } from '../../utils/impersonation';
import { addActivity } from '../../utils/activityUtils';
import { useCallback, useState } from 'react';
import { message } from 'antd';

export function ImpersonationBanner() {
  const [endImpersonation, { isLoading }] = useEndImpersonationMutation();
  const [active, setActive] = useState(isImpersonationActive());
  const display = getImpersonatedDisplay();

  const handleExit = useCallback(async () => {
    try {
      const label = [display.name, display.email].filter(Boolean).join(' • ') || 'Unknown user';
      addActivity({
        type: 'impersonation',
        description: 'Ended impersonation',
        meta: { impersonatedUser: label },
      });
      await endImpersonation().unwrap();
      clearImpersonationAndRestoreAdmin();
      setActive(false);
      message.success('Impersonation ended. Restoring your session.');
      window.location.reload();
    } catch (err: unknown) {
      const e = err as { data?: { message?: string }; message?: string };
      message.error(e?.data?.message ?? e?.message ?? 'Failed to end impersonation');
    }
  }, [endImpersonation]);

  if (!active) return null;

  const label = [display.name, display.email].filter(Boolean).join(' • ') || 'Unknown user';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#d4380d',
        color: '#fff',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        fontSize: 14,
        fontWeight: 600,
        zIndex: 9999,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <span>Viewing as: {label}</span>
      <Button
        type="primary"
        ghost
        size="small"
        icon={<LogoutOutlined />}
        onClick={handleExit}
        loading={isLoading}
        style={{
          color: '#fff',
          borderColor: '#fff',
          fontWeight: 600,
        }}
      >
        Exit impersonation
      </Button>
    </div>
  );
}
