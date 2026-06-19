import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { SafetyOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import OrganizationTable from './components/organizationsTable';
import { ProtectedComponent } from '../../components/ProtectedComponent';

const OrganizationsPage = () => {
  const navigate = useNavigate();
  return (
    <div>
      <Helmet>
        <title>Organizations - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Organization"
        breadcrumbs={[
          {
            title: (
              <>
                <SafetyOutlined />
                <span>Dashboard</span>
              </>
            ),
            path: '/dashboard',
          },
          {
            title: 'Organizations',
          },
        ]}
      />
      <div>
        <ProtectedComponent permission="organization::create">
          <Button
            onClick={() => navigate('/dashboard/organizations/add')}
            type="primary"
            style={{ marginBottom: 16 }}
          >
            Add Organization
          </Button>
        </ProtectedComponent>
        <OrganizationTable />
      </div>
    </div>
  );
};

export { OrganizationsPage };
