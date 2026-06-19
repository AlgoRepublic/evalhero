import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { FormOutlined } from '@ant-design/icons';
import { useGetDraftVersionsQuery } from '../../services/templateVersionApi';
import { useParams } from 'react-router-dom';
import { Spin } from 'antd';
import { TemplateVersionsTable } from './components/TemplateVersionsTable';

const TemplateVersionsPage = () => {
  const { id } = useParams<{ id: string }>();

  const {
    data: versionsRes,
    isFetching,
    // error: versionsError,
    // refetch: refetchVersions,
  } = useGetDraftVersionsQuery({ templateId: id! }, { skip: !id });

  /* ------------------- UI ------------------- */

  if (isFetching) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Loading template versions..." />
      </div>
    );
  }

  console.log('versionsRes', versionsRes);

  return (
    <div>
      <Helmet>
        <title>Template Versions - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Template Versions"
        breadcrumbs={[
          {
            title: (
              <>
                <FormOutlined /> <span> Forms</span>
              </>
            ),
          },
          { title: 'Templates', path: '/forms/templates' },
          { title: 'Versions' },
        ]}
      />
      <TemplateVersionsTable />
    </div>
  );
};

export { TemplateVersionsPage };
