// src/pages/queue/QueuePage.tsx
import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { FormOutlined } from '@ant-design/icons';
import QueueTable from './QueuesComponents/QueueTable.tsx';

export const QueuePage = () => {
  return (
    <>
      <Helmet>
        <title>Queues - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Queues"
        breadcrumbs={[
          {
            title: (
              <>
                <FormOutlined />
                <span>Forms</span>
              </>
            ),
          },
          { title: 'Queues' },
        ]}
      />
      <QueueTable />
    </>
  );
};
