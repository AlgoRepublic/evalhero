import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { TagsOutlined } from '@ant-design/icons';
import { EditTagForm } from './components/EditTagForm';
import { useParams } from 'react-router-dom';
import { Alert, Button, Spin } from 'antd';
import { useGetTagQuery } from '../../services/tagsApi';

const EditTagPage = () => {
  const { id } = useParams<{ id: string }>();

  const {
    data: tagRes,
    isFetching: tagLoading,
    error: tagError,
    refetch: refetchTag,
  } = useGetTagQuery(id!, { skip: !id });

  /* ------------------- UI ------------------- */
  const loading = tagLoading;

  if (loading) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Loading tag..." />
      </div>
    );
  }

  if (tagError || !tagRes?.data?.tag) {
    return (
      <Alert
        type="error"
        message="Failed to load tag data"
        action={<Button onClick={refetchTag}>Retry</Button>}
      />
    );
  }

  return (
    <div>
      <Helmet>
        <title>Edit Tag - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Edit Tag"
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
            title: 'Edit',
          },
        ]}
      />
      <EditTagForm tag={tagRes.data.tag} />
    </div>
  );
};

export { EditTagPage };

