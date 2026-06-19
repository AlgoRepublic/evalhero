import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { UserOutlined, BarChartOutlined } from '@ant-design/icons';
import { useAppSelector } from '../../hooks';
import { ProfileStatsTab } from './components';

const ProfileStatsPage = () => {
  const { selectedProfile } = useAppSelector((state) => state.auth);
  const profileName =
    selectedProfile && typeof selectedProfile.user === 'object' && selectedProfile.user && 'name' in selectedProfile.user
      ? (selectedProfile.user as { name?: string }).name
      : 'Profile';

  return (
    <div style={{ paddingBottom: 24 }}>
      <Helmet>
        <title>{`${profileName} - Statistics - Eval Hero`}</title>
      </Helmet>
      <PageHeader
        title={selectedProfile ? `${profileName} - Statistics` : 'Profile Statistics'}
        breadcrumbs={[
          {
            title: (
              <>
                <UserOutlined />
                <span>Profile</span>
              </>
            ),
            path: '/profile',
          },
          {
            title: (
              <>
                <BarChartOutlined />
                <span>Statistics</span>
              </>
            ),
          },
        ]}
      />
      <div style={{ padding: '0 24px' }}>
        <ProfileStatsTab />
      </div>
    </div>
  );
};

export { ProfileStatsPage };
