import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { FormOutlined } from '@ant-design/icons';
import AddSchedule from './ScheduledComponents/AddSchedule';

const AddSchedulePage = () => {
  return (
    <div>
      <Helmet>
        <title>Add Schedule - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Add Schedule"
        breadcrumbs={[
          {
            title: (
              <>
                <FormOutlined /> <span> Forms</span>
              </>
            ),
          },
          {
            title: 'Schedules',
            path: '/forms/schedules',
          },
          {
            title: 'Add',
          },
        ]}
      />
      <AddSchedule />
    </div>
  );
};

export { AddSchedulePage };
