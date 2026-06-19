import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { FormOutlined } from '@ant-design/icons';
import AddTemplate from './components/AddTemplate';

const AddTemplatePage = () => {
  return (
    <div>
      <Helmet>
        <title>Add Template - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Add Template"
        breadcrumbs={[
          {
            title: (
              <>
                <FormOutlined /> <span> Forms</span>
              </>
            ),
          },
          {
            title: 'Templates',
            path: '/forms/templates',
          },
          {
            title: 'Add',
          },
        ]}
      />
      <AddTemplate />
    </div>
  );
};

export { AddTemplatePage };
