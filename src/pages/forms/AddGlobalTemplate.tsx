import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { FormOutlined } from '@ant-design/icons';
import AddGlobalTemplateForm from './components/AddGlobalTemplateForm';
import { PATH_FORMS } from '../../constants/routes';

const AddGlobalTemplatePage = () => {
  return (
    <div>
      <Helmet>
        <title>Add Global Template - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Add Global Template"
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
            title: 'Global Templates',
            path: PATH_FORMS.globalTemplates,
          },
          {
            title: 'Add',
          },
        ]}
      />
      <AddGlobalTemplateForm />
    </div>
  );
};

export { AddGlobalTemplatePage };
