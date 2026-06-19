import React from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Button, Spin, Typography } from 'antd';
// import { PageHeader } from '../../components';
// import { useGetTemplateQuery } from '../../services/templatesAPI';
// import { LockOutlined, UnlockOutlined } from '@ant-design/icons';
// import { EditTemplate } from './components/EditTemplate';
import {
  useGetVersionQuery,
  // useLockVersionMutation,
} from '../../services/templateVersionApi';

const { Text } = Typography;

export const TemplateVersionDetailPage: React.FC = () => {
  const { versionId } = useParams<{
    id: string;
    versionId: string;
  }>();

  const {
    data: versionRes,
    isFetching: versionLoading,
    error,
    refetch,
  } = useGetVersionQuery(versionId!, { skip: !versionId });

  // const { data: templateRes } = useGetTemplateQuery(templateId!, {
  //   skip: !templateId,
  // });
  // const [unlockVersion] = useLockVersionMutation(); // changed from lockVersion to unlockVersion
  console.log('versionRes', versionRes);
  const version = versionRes?.data?.version;
  // const template = templateRes?.data?.template;

  if (versionLoading)
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="Loading version..." />
      </div>
    );

  if (error || !version)
    return (
      <Alert
        type="error"
        message="Failed to load version"
        action={<Button onClick={refetch}>Retry</Button>}
      />
    );

  // const handleUnlock = async () => {
  //   try {
  //     await unlockVersion(versionId!).unwrap();
  //     message.success('Version unlocked for editing');
  //     refetch();
  //   } catch (e: any) {
  //     message.error(e?.data?.message ?? 'Failed to unlock version');
  //   }
  // };

  return (
    <div>
      {/* <PageHeader
        title={`Version v${version?.version || ''}`}
        breadcrumbs={[
          { title: 'Forms' },
          { title: 'Templates', path: '/forms/templates' },
          { title: `Template Detail` },
          { title: `Version ${version?.version || ''}` },
        ]}
      /> */}

      <div style={{ padding: 16 }}>
        <Text strong>Status:</Text>{' '}
        {/* <Text type={version?.status === 'locked' ? 'danger' : 'success'}>
          {version.status?.toUpperCase()}
        </Text> */}
      </div>

      {/* <EditTemplate
        version={version}
        template={template!}
        refetchDraft={refetch}
        draftLoading={versionLoading}
      /> */}
    </div>
  );
};
