import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { TagsOutlined } from '@ant-design/icons';
import AddTagForm from './components/AddTagForm';

const AddTagPage = () => {
  return (
    <div>
      <Helmet>
        <title>Add Tag - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Add Tag"
        breadcrumbs={[
          {
            title: (
              <>
                <TagsOutlined />
                <span>Tags</span>
              </>
            ),
          },
          {
            title: 'Tags',
            path: '/tags',
          },
          {
            title: 'Add',
          },
        ]}
      />
      <AddTagForm />
    </div>
  );
};

export { AddTagPage };

