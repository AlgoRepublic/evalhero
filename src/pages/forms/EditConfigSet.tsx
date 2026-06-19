import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { FormOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { Alert, Button, Spin } from 'antd';
import { useGetConfigSetQuery } from '../../services/configSetsApi';
import AddEditConfigSetForm from './components/AddEditConfigSetForm';
import { PATH_FORMS } from '../../constants/routes';

const EditConfigSetPage = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isFetching, error, refetch } = useGetConfigSetQuery(id!, { skip: !id });
  const configSet = data?.data?.configSet;

  if (isFetching && !configSet) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Loading config set..." />
      </div>
    );
  }

  if (error || !configSet) {
    return (
      <Alert
        type="error"
        message="Failed to load config set"
        action={<Button onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  return (
    <div>
      <Helmet>
        <title>Edit Quick Setting - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Edit Quick Setting"
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
            path: PATH_FORMS.configSets,
          },
          {
            title: configSet.name ?? 'Edit',
          },
        ]}
      />
      <AddEditConfigSetForm mode="edit" configSet={configSet} />
    </div>
  );
};

export { EditConfigSetPage };
