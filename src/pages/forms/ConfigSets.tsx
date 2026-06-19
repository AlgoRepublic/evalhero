import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { FormOutlined } from '@ant-design/icons';
import ConfigSetsTable from './components/ConfigSetsTable';

const ConfigSetsPage = () => {
  return (
    <div>
      <Helmet>
        <title>Quick Settings - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Quick Settings"
        breadcrumbs={[
          {
            title: (
              <>
                <FormOutlined />
                <span>Forms</span>
              </>
            ),
          },
          {
            title: 'Quick Settings',
          },
        ]}
      />
      <ConfigSetsTable />
    </div>
  );
};

export { ConfigSetsPage };
