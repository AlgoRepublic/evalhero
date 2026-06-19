import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { FormOutlined } from '@ant-design/icons';
import EditScheduleComponent from './ScheduledComponents/EditSchedule';

const EditSchedulePage = () => {
  return (
    <div>
      <Helmet>
        <title>Edit Schedule - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Edit Schedule"
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
            title: 'Schedules',
            path: '/forms/schedules',
          },
          {
            title: 'Update',
          },
        ]}
      />
      <EditScheduleComponent />
    </div>
  );
};

export { EditSchedulePage };
