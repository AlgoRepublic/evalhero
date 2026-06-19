import { Button, Col, Grid, message, Row, Space } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import { PageHeader, ProtectedComponent } from '../../components';
// import { DASHBOARD_ITEMS } from '../../constants';
import { Helmet } from 'react-helmet-async';
import { useStylesContext } from '../../context';
import { Link, Outlet } from 'react-router-dom';
import { useState } from 'react';
import RolesManager from './components/RolesManagement';
import DepartmentManagement from './components/DepartmentManagement';
import InviteUserModal from './components/InviteUserModal';
import PendingUsersModal from './components/PendingUsers';
import DashboardOrganizationSection from './components/DashboardOrganizationSection';
import LocationManagement from './components/LocationManagement';
import { useAppSelector } from '../../hooks';

const { useBreakpoint } = Grid;

export const DashboardPage = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md; // Below md (768px) is mobile
  const isXS = screens.xs;
  const [inviteModalOpened, setInviteModalOpened] = useState(false);
  const [pendingModalOpened, setPendingModalOpened] = useState(false);
  const stylesContext = useStylesContext();
  const { selectedProfile } = useAppSelector((state) => state.auth);

  return (
    <div>
      <Helmet>
        <title>Dashboard - Eval Hero</title>
      </Helmet>
      {inviteModalOpened && (
        <InviteUserModal
          open={inviteModalOpened}
          onCancel={() => setInviteModalOpened(false)}
          onInvite={() => {
            message.success('Users invited successfully');
            setInviteModalOpened(false);
          }}
        />
      )}
      {pendingModalOpened && (
        <PendingUsersModal
          onClose={() => setPendingModalOpened(false)}
          open={pendingModalOpened}
        />
      )}
      <PageHeader
        title="dashboard"
        breadcrumbs={[
          {
            title: (
              <>
                <SafetyOutlined />
                <span>Dashboard</span>
              </>
            ),
          },
        ]}
      />
      <Row {...stylesContext?.rowProps} justify="center" gutter={[0, isMobile ? 12 : 16]}>
        <Col xs={24} md={24} lg={20} xl={16} data-tour="dashboard-content">
          <Row 
            justify="space-between" 
            align={isXS ? 'top' : 'middle'} 
            gutter={[isXS ? 0 : 16, isXS ? 12 : 16]}
          >
            <Col xs={24} sm={7} md={12}>
              <ProtectedComponent permission="organization::view">
                <Link to="/dashboard/organizations">
                  <Button 
                    variant="filled" 
                    type="primary"
                    block={isXS}
                    size={isXS ? 'middle' : isMobile ? 'middle' : 'large'}
                  >
                    View All Organizations
                  </Button>
                </Link>
              </ProtectedComponent>
            </Col>
            <Col xs={24} sm={17} md={12}>
              {isXS ? (
                <Space 
                  direction="vertical" 
                  size="small" 
                  style={{ width: '100%' }}
                >
                  <ProtectedComponent permission="user::view">
                    <Button
                      variant="solid"
                      color="green"
                      type="primary"
                      onClick={() => setPendingModalOpened(true)}
                      block
                      size="middle"
                    >
                      Pending Users
                    </Button>
                  </ProtectedComponent>
                  <ProtectedComponent permission="user::invite">
                    <Button
                      variant="solid"
                      type="primary"
                      onClick={() => setInviteModalOpened(true)}
                      block
                      size="middle"
                    >
                      Invite Users
                    </Button>
                  </ProtectedComponent>
                </Space>
              ) : (
                <Row justify="end" gutter={[16, 0]}>
                  <Space size="middle" align="end">
                    <ProtectedComponent permission="user::view">
                      <Button
                        variant="solid"
                        color="green"
                        type="primary"
                        onClick={() => setPendingModalOpened(true)}
                        size={isMobile ? 'middle' : 'large'}
                      >
                        Pending Users
                      </Button>
                    </ProtectedComponent>
                    <ProtectedComponent permission="user::invite">
                      <Button
                        variant="solid"
                        type="primary"
                        onClick={() => setInviteModalOpened(true)}
                        size={isMobile ? 'middle' : 'large'}
                      >
                        Invite Users
                      </Button>
                    </ProtectedComponent>
                  </Space>
                </Row>
              )}
            </Col>
          </Row>

          {selectedProfile && (
            <>
              {/* Organization Section - Always visible, readonly if no edit permission */}
              {selectedProfile.organization && (
                <>
                  <DashboardOrganizationSection />
                  {/* Always show departments, locations, and roles - readonly if no view permission */}
                  <DepartmentManagement />
                  <LocationManagement />
                  <RolesManager />
                </>
              )}
            </>
          )}
        </Col>
      </Row>
      <Outlet />
    </div>
  );
};
