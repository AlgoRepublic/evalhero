import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { FormOutlined } from '@ant-design/icons';
import AddEditConfigSetForm from './components/AddEditConfigSetForm';
import { PATH_FORMS } from '../../constants/routes';

const AddConfigSetPage = () => {
  return (
    <div>
      <Helmet>
        <title>Add Quick Setting - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Add Quick Setting"
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
            title: 'Add',
          },
        ]}
      />
      <AddEditConfigSetForm mode="add" />
    </div>
  );
};

export { AddConfigSetPage };
