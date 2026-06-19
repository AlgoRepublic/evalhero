import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { FormOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { Alert, Button, Spin } from 'antd';
import { useGetGlobalFormTemplateQuery } from '../../services/globalFormTemplatesApi';
import EditGlobalTemplateForm from './components/EditGlobalTemplateForm';
import { PATH_FORMS } from '../../constants/routes';

const EditGlobalTemplatePage = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isFetching, error, refetch } = useGetGlobalFormTemplateQuery(id!, { skip: !id });

  if (isFetching) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Loading global template..." />
      </div>
    );
  }

  if (error || !data?.data?.globalFormTemplate) {
    return (
      <Alert
        type="error"
        message="Failed to load global template"
        action={<Button onClick={refetch}>Retry</Button>}
      />
    );
  }

  return (
    <div>
      <Helmet>
        <title>Edit Global Template - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Edit Global Template"
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
            title: 'Edit',
          },
        ]}
      />
      <EditGlobalTemplateForm template={data.data.globalFormTemplate} />
    </div>
  );
};

export { EditGlobalTemplatePage };
