import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { SafetyOutlined } from '@ant-design/icons';
import EditOrganization from './components/EditOrganization';

const EditOrganizationPage = () => {
  return (
    <div>
      <Helmet>
        <title>Edit Organization - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Update Organization"
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
            path: '/dashboard/organizations',
          },
          {
            title: 'Update',
          },
        ]}
      />
      <EditOrganization />
    </div>
  );
};

export { EditOrganizationPage };
