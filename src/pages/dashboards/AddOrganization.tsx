import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { SafetyOutlined } from '@ant-design/icons';
import AddOrganization from './components/AddOrganization';

const AddOrganizationPage = () => {
  return (
    <div>
      <Helmet>
        <title>Add Organization - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Add Organization"
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
            title: 'Add',
          },
        ]}
      />
      <AddOrganization />
    </div>
  );
};

export { AddOrganizationPage };
