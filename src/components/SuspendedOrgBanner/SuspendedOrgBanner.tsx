import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { WarningOutlined } from '@ant-design/icons';
import { isImpersonationActive } from '../../utils/impersonation';

const BANNER_HEIGHT = 40;

/**
 * Shows a fixed banner when the current selected organization is suspended (deletedAt not null).
 * Message: "Contact with Admin".
 * Positions below impersonation banner when both are visible.
 */
export function SuspendedOrgBanner() {
  const selectedProfile = useSelector((state: RootState) => state.auth.selectedProfile);
  const orgSuspended =
    selectedProfile?.organization != null &&
    selectedProfile.organization.deletedAt != null &&
    selectedProfile.organization.deletedAt !== '';

  if (!orgSuspended) return null;

  const top = isImpersonationActive() ? 48 : 0;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top,
        left: 0,
        right: 0,
        height: BANNER_HEIGHT,
        backgroundColor: '#fa8c16',
        color: '#fff',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontSize: 14,
        fontWeight: 600,
        zIndex: 9998,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <WarningOutlined />
      <span>Organization is suspended. Contact with Admin</span>
    </div>
  );
}

export const SUSPENDED_ORG_BANNER_HEIGHT = BANNER_HEIGHT;
