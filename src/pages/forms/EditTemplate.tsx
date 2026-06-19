import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { FormOutlined } from '@ant-design/icons';
import { EditTemplate } from './components/EditTemplate';
import { useParams } from 'react-router-dom';
import { Alert, Button, Spin } from 'antd';
import { useGetTemplateQuery } from '../../services/templatesAPI';

const EditTemplatePage = () => {
  const { id } = useParams<{ id: string }>();

  const {
    data: metaRes,
    isFetching: metaLoading,
    error: metaError,
    refetch: refetchMeta,
  } = useGetTemplateQuery(id!, { skip: !id });

  /* ------------------- UI ------------------- */
  const loading = metaLoading;

  if (loading) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Loading template..." />
      </div>
    );
  }

  if (metaError || !metaRes?.data?.formTemplate) {
    return (
      <Alert
        type="error"
        message="Failed to load template data"
        action={<Button onClick={refetchMeta}>Retry</Button>}
      />
    );
  }

  return (
    <div>
      <Helmet>
        <title>Edit Template - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Add Template"
        breadcrumbs={[
          {
            title: (
              <>
                <FormOutlined />
                <span>Forms</span>
              </>
            ),
            // path: '/forms',
          },
          {
            title: 'Templates',
            path: '/forms/templates',
          },
          {
            title: 'Update',
          },
        ]}
      />
      <EditTemplate
        template={metaRes.data.formTemplate!}
      />
    </div>
  );
};

export { EditTemplatePage };
